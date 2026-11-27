// What happens after a repayment is recorded (public.record_loan_payment 'repay'), shared by
// confirm-loan-payment (the app's Pay button) and _shared/idRepayments.ts (Indonesians paying from Walt
// straight to the lender through Relay), so both paths run exactly the same follow-ups:
//
//   Paid    → credit progression (the ONLY writer of users.cs) + loan-repayment-received-notification
//             (borrower/lender/team messages, the Indonesian 'repaid' Telegram)
//   Partial → the borrower's "we got $X, $Y left" (email/push/Messenger) + the team feed line
//   always  → the Discord repay feed line
//
// Never throws; side-effect failures come back in `errors` (the payment is recorded either way).
import {
   drawLimitSpin,
   earnsLimitSpin,
   evaluateCreditProgression,
   getCreditTrack,
   getEffectiveCreditLimit,
   getIncomeNextLimit,
   limitSpinUnlockAt,
   LOW_INCOME_CEILING,
   MAX_CREDIT_LIMIT,
   toNumber
} from './creditAndPoints.ts';
import { postDiscord } from './discord.ts';
import { notifyBorrowerPartialRepayment } from './partialRepaymentNotice.ts';
import { postPartialRepaymentToTeam } from './teamLoanFeed.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;

export type SideEffectError = { type: 'award_points' | 'loan_notification' | 'credit_progression'; message: string };
// unlocksAt: a Limit Spin paid before day 3 waits until then (the limit isn't raised yet).
export type CreditLevelUp = { fromLimit: number; toLimit: number; spin?: boolean; unlocksAt?: string };

// On a fully-repaid full-limit loan, level up the borrower's credit limit. (The limit the loan was
// measured against is recorded by public.record_loan_payment in the same update that marks it Paid.)
export const applyCreditProgression = async (
   admin: Admin,
   loan: Record<string, unknown>
): Promise<{ errors: SideEffectError[]; levelUp: CreditLevelUp | null }> => {
   const errors: SideEffectError[] = [];
   const borrowerId = loan.borrower_user_id as string | null;
   if (!borrowerId || !loan.due_date) return { errors, levelUp: null };

   const { data: borrower, error: borrowerError } = await admin
      .from('users')
      .select('id, cs, is_world_id, is_didit, created_at')
      .eq('id', borrowerId)
      .single();
   if (borrowerError || !borrower) {
      errors.push({ type: 'credit_progression', message: borrowerError?.message ?? 'Borrower not found' });
      return { errors, levelUp: null };
   }

   // Income ceiling (migrations 20261127010000 / 20261127030000), read first: it sets how far the limit can
   // grow, the step, and (low income) that a repayment counts any time (its spin unlocks on day 3).
   const { data: ceilingRow, error: ceilingError } = await admin.rpc('limit_ceiling_for', { p_user: borrower.id });
   const ceiling = toNumber((ceilingRow as { ceiling?: number | string } | null)?.ceiling ?? 0);
   const lowIncome = ceiling > 0 && ceiling <= LOW_INCOME_CEILING && getCreditTrack(borrower.created_at ?? null) === 'B';

   const evaluation = evaluateCreditProgression({
      // Ceiling unreadable: judge by the most lenient rule (any time) so a real level-up reaches the HOLD below.
      lowIncome: lowIncome || Boolean(ceilingError),
      currentLimit: borrower.cs ?? 0,
      // Any supported identity method grants verified status for credit progression, mirroring the
      // frontend isUserVerified(). Didit is the majority path; gating on World ID alone stalled
      // Didit-verified borrowers' credit-limit growth (this is the authoritative writer).
      isVerified: borrower.is_world_id === 'ACTIVE' || borrower.is_didit === 'ACTIVE',
      repaidAmount: toNumber(loan.repaid_amount as number | string | null),
      totalRepaymentAmount: toNumber(loan.total_repayment_amount as number | string | null),
      loanAmount: toNumber(loan.loan_amount as number | string | null),
      dueDate: String(loan.due_date),
      dueTimezone: (loan.due_timezone as string | null | undefined) ?? null,
      paidAt: String(loan.repaid_at ?? loan.updated_at ?? new Date().toISOString()),
      fundedAt: (loan.funded_at as string | null | undefined) ?? null,
      joinedAt: (borrower.created_at as string | null | undefined) ?? null
   });

   if (!evaluation.shouldLevelUp) return { errors, levelUp: null };

   // No ceiling read = no raise: hold it and tell the team (a raise past someone's ceiling can't be undone).
   if (ceilingError || !(ceiling > 0)) {
      const message = `level-up held: income ceiling couldn't be read (${ceilingError?.message ?? 'empty'})`;
      errors.push({ type: 'credit_progression', message });
      await postDiscord(
         {
            content: `⚠️ ${loan.tracking_id}: a full-limit loan was repaid but the level-up was HELD (${message}). Check their limit and raise by hand.`
         },
         { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
      );
      return { errors, levelUp: null };
   }
   // Their income ladder (getIncomeNextLimit): the step and the top both follow their income. Never lowers.
   const current = getEffectiveCreditLimit(borrower.cs, true);
   const fundedAt = (loan.funded_at as string | null | undefined) ?? null;
   // Low income: a Limit Spin decides the raise (+$2 usually, up to +$5), never past their ceiling.
   const spin = earnsLimitSpin(ceiling, borrower.created_at ?? null, fundedAt) ? drawLimitSpin() : null;
   // A Shark bonus they saved by beating level 3 of Shark Chomp after their last spin (chomp_level_reward):
   // +$1 on this spin, still never past the ceiling. Used up once the spin is saved.
   let sharkBonus = 0;
   if (spin !== null) {
      const { data: bank } = await admin.from('limit_spin_bonus_bank').select('user_id').eq('user_id', borrower.id).maybeSingle();
      sharkBonus = bank ? 1 : 0;
   }
   const useBank = async () => {
      if (sharkBonus) await admin.from('limit_spin_bonus_bank').delete().eq('user_id', borrower.id);
   };
   const nextLimit =
      spin !== null
         ? Math.max(current, Math.min(current + spin + sharkBonus, ceiling, MAX_CREDIT_LIMIT))
         : getIncomeNextLimit(current, ceiling, borrower.created_at ?? null, fundedAt);
   if (nextLimit <= current) return { errors, levelUp: null };

   // Paid before day 3: the spin waits. Drawn now and saved; app_private.unlock_limit_spins (cron) raises
   // the limit at unlocks_at, which also sends "your spin is ready" (admin-messenger limit_up).
   const unlockAt = spin !== null ? limitSpinUnlockAt(fundedAt) : null;
   if (spin !== null && unlockAt && unlockAt.getTime() > Date.now()) {
      const { error: waitError } = await admin.from('limit_boost_spins').insert({
         user_id: borrower.id,
         loan_id: (loan.id as string | undefined) ?? null,
         drawn: spin,
         bonus: sharkBonus,
         from_limit: current,
         to_limit: nextLimit,
         unlocks_at: unlockAt.toISOString(),
         applied_at: null,
         waited: true
      });
      // 23505: this loan's spin is already saved (a repeated follow-up), nothing to add.
      if (waitError && waitError.code !== '23505') {
         const message = `waiting spin not saved: ${waitError.message}`;
         errors.push({ type: 'credit_progression', message });
         await postDiscord(
            { content: `⚠️ ${loan.tracking_id}: a Limit Spin was earned but NOT saved (${message}). Raise their limit by hand on day 3.` },
            { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
         );
         return { errors, levelUp: null };
      }
      if (!waitError) await useBank();
      return { errors, levelUp: { fromLimit: current, toLimit: nextLimit, spin: true, unlocksAt: unlockAt.toISOString() } };
   }

   // Compare-and-set on the limit we evaluated against: if two final repayments race, only the
   // first raises the limit, so one full-limit loan can never level a borrower up twice.
   const levelUp = admin.from('users').update({ cs: nextLimit }).eq('id', borrower.id);
   const { data: leveled, error: userUpdateError } = await (
      borrower.cs === null ? levelUp.is('cs', null) : levelUp.eq('cs', borrower.cs)
   ).select('id');
   if (userUpdateError) {
      errors.push({ type: 'credit_progression', message: userUpdateError.message });
      return { errors, levelUp: null };
   }
   if (!leveled?.length) {
      // The limit changed between reading and writing (a referral, an admin edit, a race). The borrower
      // earned this level-up, so don't lose it silently: tell the team to look.
      const { data: nowRow } = await admin.from('users').select('cs').eq('id', borrower.id).maybeSingle();
      const message = `level-up skipped: the limit changed from $${borrower.cs ?? '?'} to $${nowRow?.cs ?? '?'} during this repayment`;
      errors.push({ type: 'credit_progression', message });
      await postDiscord(
         {
            content: `⚠️ ${loan.tracking_id}: a full-limit loan was repaid in full but the borrower was NOT levelled up (${message}). Check their limit.`
         },
         { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
      );
      return { errors, levelUp: null };
   }
   if (spin !== null) {
      // The app's wheel lands on this (paid screen, or a "You earned a spin" card on home if they missed it).
      const { error: spinError } = await admin.from('limit_boost_spins').insert({
         user_id: borrower.id,
         loan_id: (loan.id as string | undefined) ?? null,
         drawn: spin,
         bonus: sharkBonus,
         from_limit: current,
         to_limit: nextLimit
      });
      if (spinError) errors.push({ type: 'credit_progression', message: `limit spin not saved: ${spinError.message}` });
      // The raise already includes the bonus, so it's used up even if the row didn't save.
      await useBank();
   }
   return { errors, levelUp: { fromLimit: current, toLimit: nextLimit, spin: spin !== null } };
};

// Posts one repayment line to a Discord channel via DISCORD_REPAY_WEBHOOK_URL; no-ops when unset.
// Deliberately no fallback to the login webhook — #logins is login events only. Red embed for in-app
// browsers (the users who may get stuck on Base), green otherwise. Never throws.
export const postRepayFeed = async (details: {
   username: string | null;
   email: string | null;
   repaidAmount: number;
   totalAmount: number;
   coin: string;
   trackingId: string | null;
   fullyRepaid: boolean;
   browser: { label: string; isInApp: boolean };
   userAgent: string | null;
}) => {
   const webhook = Deno.env.get('DISCORD_REPAY_WEBHOOK_URL');
   if (!webhook) return;

   const { username, email, repaidAmount, totalAmount, coin, trackingId, fullyRepaid, browser, userAgent } = details;
   const embed = {
      title: `💸 Repayment — ${username ?? 'unknown user'}`,
      color: browser.isInApp ? 0xe74c3c : 0x2ecc71,
      fields: [
         { name: 'User', value: `${username ?? '—'}\n${email ?? '—'}`, inline: true },
         {
            name: 'Amount',
            value: `$${repaidAmount.toFixed(2)} / $${totalAmount.toFixed(2)} ${coin}${fullyRepaid ? ' ✅ paid in full' : ' (partial)'}`,
            inline: true
         },
         { name: 'Browser', value: `${browser.isInApp ? '🚩 ' : ''}${browser.label}`, inline: true },
         { name: 'Loan', value: trackingId ?? '—', inline: false }
      ],
      footer: { text: (userAgent ?? 'no user-agent').slice(0, 180) },
      timestamp: new Date().toISOString()
   };

   try {
      await fetch(webhook, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ embeds: [embed] })
      });
   } catch {
      // Best-effort — the repay feed must never affect the payment.
   }
};

/**
 * The follow-ups for one recorded repayment. `updatedLoan` is the row record_loan_payment returned
 * (after the rupiah peg trigger, so a pegged loan that the peg closed comes back 'Paid').
 */
export const runRepaymentFollowUps = async (
   admin: Admin,
   args: {
      loanId: string;
      updatedLoan: Record<string, unknown>;
      /** USDC paid by this payment (human units). */
      paidNow: number;
      /** For the Discord repay feed. */
      browser: { label: string; isInApp: boolean };
      userAgent: string | null;
   }
): Promise<{ errors: SideEffectError[]; creditLevelUp: CreditLevelUp | null }> => {
   const { loanId, updatedLoan, paidNow } = args;
   const errors: SideEffectError[] = [];
   let creditLevelUp: CreditLevelUp | null = null;
   try {
      if (updatedLoan.repayment_status === 'Paid') {
         const progression = await applyCreditProgression(admin, updatedLoan);
         errors.push(...progression.errors);
         creditLevelUp = progression.levelUp;
         const { error: notifyError } = await admin.functions.invoke('loan-repayment-received-notification', { body: { loanId } });
         if (notifyError) errors.push({ type: 'loan_notification', message: notifyError.message });
      } else if (updatedLoan.repayment_status === 'Partial') {
         // A payment that leaves a balance: tell the borrower what was paid and what's left (and how to
         // reach us if it was a mistake), and post it to the team. Both never throw.
         await Promise.all([
            notifyBorrowerPartialRepayment(admin, updatedLoan as Parameters<typeof notifyBorrowerPartialRepayment>[1], paidNow),
            postPartialRepaymentToTeam(admin, loanId, paidNow)
         ]);
      }

      const { data: borrowerRow } = await admin
         .from('users')
         .select('username, email')
         .eq('id', updatedLoan.borrower_user_id)
         .maybeSingle();
      await postRepayFeed({
         username: borrowerRow?.username ?? null,
         email: borrowerRow?.email ?? null,
         repaidAmount: toNumber(updatedLoan.repaid_amount as number | string | null),
         totalAmount: toNumber(updatedLoan.total_repayment_amount as number | string | null),
         coin: (updatedLoan.coin as string | null)?.trim() || 'USDC',
         trackingId: (updatedLoan.tracking_id as string | null) ?? null,
         fullyRepaid: updatedLoan.repayment_status === 'Paid',
         browser: args.browser,
         userAgent: args.userAgent
      });
   } catch (err) {
      errors.push({ type: 'loan_notification', message: err instanceof Error ? err.message : String(err) });
   }
   return { errors, creditLevelUp };
};
