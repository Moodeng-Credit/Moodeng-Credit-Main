// Per-borrower loan cap (public.borrower_loan_caps, migration 20261116200000_borrower_loan_caps.sql).
//
// The team caps a borrower after a call. A request that takes them past the cap is held off the public
// board ('over_cap') and the team is alerted. Funding it needs an override with a written reason
// (admin-fund-loan action cap_override): saved on the loan, posted to the team, and the hold released.
import { postDiscord } from './discord.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const MIN_OVERRIDE_REASON = 10;

export type CapStatus = {
   capped: boolean;
   cap: number | null;
   note: string | null;
   inUse: number;
   amount: number;
   over: boolean;
   override: { reason: string; at: string; by: string | null; cap: number | null } | null;
};

const money = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

/** What the borrower has in use, besides this loan: live requests (< 7 days) + funded, not fully repaid. */
export const capInUse = async (svc: Svc, borrowerId: string, excludeLoanId: string): Promise<number> => {
   const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
   const { data, error } = await svc
      .from('loans')
      .select('id, loan_amount, loan_status, repayment_status, created_at')
      .eq('borrower_user_id', borrowerId)
      .in('loan_status', ['Requested', 'Lent']);
   if (error) throw new Error(error.message);
   return ((data ?? []) as Array<{ id: string; loan_amount: number | null; loan_status: string; repayment_status: string | null; created_at: string }>)
      .filter((l) => l.id !== excludeLoanId)
      .filter((l) => (l.loan_status === 'Requested' ? l.created_at > since : l.repayment_status !== 'Paid'))
      .reduce((sum, l) => sum + Number(l.loan_amount ?? 0), 0);
};

/** Cap check for funding `loanId` (optionally at a different principal than the request). */
export const capStatus = async (svc: Svc, loanId: string, principal?: number | null): Promise<CapStatus> => {
   const { data: loan, error } = await svc.from('loans').select('id, borrower_user_id, loan_amount').eq('id', loanId).maybeSingle();
   if (error) throw new Error(error.message);
   if (!loan) throw new Error('Loan not found');
   const amount = Number(principal ?? loan.loan_amount ?? 0);
   const { data: ov } = await svc
      .from('loan_cap_overrides')
      .select('reason, overridden_at, overridden_by, cap_usd')
      .eq('loan_id', loanId)
      .maybeSingle();
   const override = ov ? { reason: ov.reason, at: ov.overridden_at, by: ov.overridden_by, cap: ov.cap_usd } : null;
   if (!loan.borrower_user_id) return { capped: false, cap: null, note: null, inUse: 0, amount, over: false, override };
   const { data: capRow } = await svc.from('borrower_loan_caps').select('cap_usd, note').eq('user_id', loan.borrower_user_id).maybeSingle();
   if (!capRow) return { capped: false, cap: null, note: null, inUse: 0, amount, over: false, override };
   const cap = Number(capRow.cap_usd);
   const inUse = await capInUse(svc, loan.borrower_user_id, loan.id);
   return { capped: true, cap, note: capRow.note ?? null, inUse, amount, over: inUse + amount > cap + 1e-9, override };
};

/** Error text when funding must stop: over the cap and no override yet. */
export const capBlock = (s: CapStatus): string | null =>
   s.over && !s.override
      ? `Over this borrower's cap (${money(s.cap ?? 0)}, ${money(s.inUse)} in use, this loan ${money(s.amount)}). Tap Override and write why first.`
      : null;

const teamAlert = async (svc: Svc, text: string, title: string) => {
   const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
   const chatId = (setting?.value as string | undefined)?.trim();
   if (chatId) await sendTelegramMessage(chatId, text).catch((e: Error) => console.error('loanCap Telegram failed:', e.message));
   await postDiscord({ embeds: [{ title, description: text, color: 0xf5a623, timestamp: new Date().toISOString() }] });
};

const nameOf = async (svc: Svc, userId: string | null) => {
   if (!userId) return 'someone';
   const { data } = await svc.from('users').select('username, display_name').eq('id', userId).maybeSingle();
   return data?.username ? `@${data.username}` : (data?.display_name ?? 'someone');
};

/** Saves the override (reason, who, when, the cap it overrode), releases the over-cap hold, tells the team. */
export const overrideCap = async (svc: Svc, loanId: string, adminId: string, rawReason: unknown) => {
   const reason = String(rawReason ?? '').trim();
   if (reason.length < MIN_OVERRIDE_REASON) return { ok: false, error: `Write a reason (at least ${MIN_OVERRIDE_REASON} characters)` };
   const status = await capStatus(svc, loanId);
   if (!status.capped) return { ok: false, error: 'This borrower has no cap' };

   const { data: loan, error } = await svc
      .from('loans')
      .select('tracking_id, borrower_user_id, on_hold_reason, loan_status')
      .eq('id', loanId)
      .maybeSingle();
   if (error) return { ok: false, error: error.message };
   if (!loan || loan.loan_status !== 'Requested') return { ok: false, error: 'This loan is not an open request' };
   const { error: saveError } = await svc.from('loan_cap_overrides').upsert({
      loan_id: loanId,
      reason,
      cap_usd: status.cap,
      amount_usd: status.amount,
      in_use_usd: status.inUse,
      overridden_by: adminId,
      overridden_at: new Date().toISOString()
   });
   if (saveError) return { ok: false, error: saveError.message };
   if (loan.on_hold_reason === 'over_cap') {
      await svc.from('loans').update({ on_hold_since: null, on_hold_reason: null }).eq('id', loanId).eq('on_hold_reason', 'over_cap');
   }

   const [who, borrower] = await Promise.all([nameOf(svc, adminId), nameOf(svc, loan.borrower_user_id)]);
   await teamAlert(
      svc,
      `🔓 Cap override: ${borrower}, request ${loan.tracking_id ?? loanId}\n` +
         `Asked ${money(status.amount)} · cap ${money(status.cap ?? 0)} · ${money(status.inUse)} already in use\n` +
         `By ${who}. Reason: ${reason}`,
      '🔓 Loan cap overridden'
   ).catch((e: Error) => console.error('loanCap alert failed:', e.message));
   return { ok: true, status: { ...status, override: { reason, at: new Date().toISOString(), by: adminId, cap: status.cap } } };
};

/** Backstop: a capped loan was recorded as funded with no override (e.g. an old tab). */
export const alertFundedOverCapWithoutOverride = async (svc: Svc, loanId: string, s: CapStatus) => {
   const { data: loan } = await svc.from('loans').select('tracking_id, borrower_user_id').eq('id', loanId).maybeSingle();
   const borrower = await nameOf(svc, loan?.borrower_user_id ?? null);
   await teamAlert(
      svc,
      `⚠️ ${borrower}'s loan ${loan?.tracking_id ?? loanId} was funded OVER their cap with no override: ` +
         `${money(s.amount)} (cap ${money(s.cap ?? 0)}, ${money(s.inUse)} already in use). Please add the reason in admin.`,
      '⚠️ Funded over cap'
   );
};
