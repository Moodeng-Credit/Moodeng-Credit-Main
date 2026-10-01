// Team-facing "loan funded" / "loan repaid" posts, plus the daily "coming due" digest, for the #loans Discord channel (the same feed as
// "New loan request") and, for funding, the admin Telegram channel. Each post goes out once per loan:
// the loan_notifications row is claimed first (unique per loan + type), so the two callers of
// loan-funded-notification (confirm-loan-payment and the app) can't both post it.

import { postDiscord } from './discord.ts';
import { dueDayBounds, formatDeadlineForTeam, localHour, loanTimezone } from './loanDeadline.ts';
import { describeOwed, getTeamTimezone, loadBorrowerTimezones } from './loanDueTeamFeed.ts';
import { buildTxExplorerLink, getLoanOutstandingAmount } from './loanNotifications.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

type TeamFeedType = 'team_funded' | 'team_repaid';

type TeamFeedLoan = {
   id: string;
   tracking_id: string | null;
   borrower_user_id: string | null;
   lender_user_id: string | null;
   loan_amount: number | null;
   total_repayment_amount: number | null;
   repaid_amount?: number | null;
   due_date: string | null;
   due_timezone?: string | null;
   hash?: string[] | null;
   is_test?: boolean | null;
   loan_status?: string | null;
   repayment_status?: string | null;
   funded_at?: string | null;
};

const LOAN_COLUMNS =
   'id, tracking_id, borrower_user_id, lender_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, due_timezone, hash, is_test, loan_status, repayment_status, funded_at';

const siteUrl = () => (Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
const usdc = (amount: number | null | undefined) => `${Number(amount ?? 0).toFixed(2)} USDC`;

const handle = (u?: { username?: string | null; telegram_username?: string | null } | null) => {
   const tg = u?.telegram_username?.trim().replace(/^@/, '');
   if (tg) return `@${tg}`;
   return u?.username?.trim() || 'someone';
};

/** Claims the one post for this loan + type. False when it was already claimed (or claiming failed). */
const claim = async (svc: SupabaseClient, loanId: string, userId: string, type: TeamFeedType): Promise<boolean> => {
   const { error } = await svc.from('loan_notifications').insert({ loan_id: loanId, user_id: userId, notification_type: type });
   if (!error) return true;
   if (error.code !== '23505') console.error(`teamLoanFeed: could not claim ${type} for ${loanId}:`, error.message);
   return false;
};

/** Gives the claim back when nothing went out, so the next call for this loan tries again. */
const unclaim = async (svc: SupabaseClient, loanId: string, type: TeamFeedType) => {
   await svc.from('loan_notifications').delete().eq('loan_id', loanId).eq('notification_type', type);
};

const loadPeople = async (svc: SupabaseClient, loan: TeamFeedLoan) => {
   const ids = [loan.borrower_user_id, loan.lender_user_id].filter(Boolean) as string[];
   const { data } = await svc.from('users').select('id, username, telegram_username').in('id', ids);
   const rows = (data ?? []) as Array<{ id: string; username: string | null; telegram_username: string | null }>;
   return {
      borrower: rows.find((row) => row.id === loan.borrower_user_id) ?? null,
      lender: rows.find((row) => row.id === loan.lender_user_id) ?? null
   };
};

const loadLoan = async (svc: SupabaseClient, loanId: string): Promise<TeamFeedLoan | null> => {
   const { data } = await svc.from('loans').select(LOAN_COLUMNS).eq('id', loanId).maybeSingle();
   return (data as TeamFeedLoan | null) ?? null;
};

/** "💰 Loan funded" → #loans Discord + admin Telegram. Never throws. */
export const postLoanFundedToTeam = async (svc: SupabaseClient, loanId: string): Promise<boolean> => {
   try {
      const loan = await loadLoan(svc, loanId);
      // Only a loan that really is funded: the function can be called for any loan id.
      if (!loan?.borrower_user_id || loan.is_test || loan.loan_status !== 'Lent' || !loan.funded_at) return false;
      if (!(await claim(svc, loan.id, loan.borrower_user_id, 'team_funded'))) return false;

      const { borrower, lender } = await loadPeople(svc, loan);
      const zones = await loadBorrowerTimezones(svc, [loan.borrower_user_id]).catch(() => new Map<string, string>());
      const zone = loanTimezone(loan, zones.get(loan.borrower_user_id) ?? 'Asia/Manila');
      const due = loan.due_date ? formatDeadlineForTeam(loan.due_date, zone, await getTeamTimezone(svc)) : '—';
      const tx = buildTxExplorerLink(loan.hash?.[0]);
      const url = `${siteUrl()}/request-board?loan=${loan.id}`;

      const lines = [
         `💰 ${handle(borrower)} was funded ${usdc(loan.loan_amount)} by ${handle(lender)}`,
         `${loan.tracking_id ?? loan.id}`,
         `↩️ Repays ${usdc(loan.total_repayment_amount)}`,
         `⏳ Due ${due}`,
         tx ? `🔗 ${tx}` : ''
      ].filter(Boolean);

      const discordOk = await postDiscord(
         {
            embeds: [
               {
                  title: '💰 Loan funded',
                  description: [...lines, url].join('\n'),
                  color: 0x57f287,
                  timestamp: new Date().toISOString()
               }
            ]
         },
         { prefer: ['DISCORD_REQUESTS_WEBHOOK_URL'] }
      );

      let telegramOk = false;
      const { data: chat } = await svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
      if (chat?.value) {
         telegramOk = await sendTelegramMessage(chat.value as string, lines.join('\n'), {
            inlineKeyboard: [[{ text: 'View loan', url }]]
         })
            .then(() => true)
            .catch((err) => {
               console.error('teamLoanFeed: funded Telegram failed:', err instanceof Error ? err.message : err);
               return false;
            });
      }
      if (!discordOk && !telegramOk) {
         await unclaim(svc, loan.id, 'team_funded');
         return false;
      }
      return true;
   } catch (err) {
      console.error('teamLoanFeed: funded post failed for', loanId, err instanceof Error ? err.message : err);
      return false;
   }
};

/** "✅ Loan repaid" → #loans Discord (the team Telegram group already gets its own post). Never throws. */
export const postLoanRepaidToTeam = async (svc: SupabaseClient, loanId: string): Promise<boolean> => {
   try {
      const loan = await loadLoan(svc, loanId);
      if (!loan?.borrower_user_id || loan.is_test || loan.repayment_status !== 'Paid') return false;
      if (!(await claim(svc, loan.id, loan.borrower_user_id, 'team_repaid'))) return false;

      const { borrower, lender } = await loadPeople(svc, loan);
      const hashes = loan.hash ?? [];
      const tx = buildTxExplorerLink(hashes.at(-1));
      const description = [
         `✅ ${handle(borrower)} repaid ${usdc(loan.repaid_amount ?? loan.total_repayment_amount)} to ${handle(lender)}`,
         `${loan.tracking_id ?? loan.id}`,
         tx ? `🔗 ${tx}` : ''
      ]
         .filter(Boolean)
         .join('\n');

      const ok = await postDiscord(
         { embeds: [{ title: '✅ Loan repaid', description, color: 0x57f287, timestamp: new Date().toISOString() }] },
         { prefer: ['DISCORD_REQUESTS_WEBHOOK_URL'] }
      );
      if (!ok) await unclaim(svc, loan.id, 'team_repaid');
      return ok;
   } catch (err) {
      console.error('teamLoanFeed: repaid post failed for', loanId, err instanceof Error ? err.message : err);
      return false;
   }
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DIGEST_DAYS = 3;
const DIGEST_HOUR = 9; // team time
const DIGEST_KEY = 'loans_due_digest_last_date';
const MAX_DIGEST_LINES = 30;

const whenLabel = (days: number) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

/**
 * Once a day (first run after 9am team time): every unpaid loan whose due day ends within the next
 * 3 days, soonest first, posted to #loans. Called from the hourly loan-due-notifications job; the
 * day is claimed in telegram_bot_settings so reruns that hour don't repeat it. Never throws.
 */
export const postUpcomingDueDigest = async (svc: SupabaseClient, now: Date = new Date()): Promise<number> => {
   try {
      const teamZone = await getTeamTimezone(svc);
      if (localHour(now, teamZone) < DIGEST_HOUR) return 0;
      const today = now.toLocaleDateString('en-CA', { timeZone: teamZone });

      // Claim today in one conditional update, so two overlapping runs can't both post.
      await svc
         .from('telegram_bot_settings')
         .upsert(
            { key: DIGEST_KEY, value: '', description: 'Last team-local date the #loans "coming due" digest was posted.' },
            { onConflict: 'key', ignoreDuplicates: true }
         );
      const { data: previous } = await svc.from('telegram_bot_settings').select('value').eq('key', DIGEST_KEY).maybeSingle();
      if (previous?.value === today) return 0;
      const { data: claimed, error: claimError } = await svc
         .from('telegram_bot_settings')
         .update({ value: today, updated_at: now.toISOString() })
         .eq('key', DIGEST_KEY)
         .eq('value', previous?.value ?? '')
         .select('key');
      if (claimError || !claimed?.length) {
         if (claimError) console.error('teamLoanFeed: could not claim digest day:', claimError.message);
         return 0;
      }
      const release = () =>
         svc.from('telegram_bot_settings').update({ value: previous?.value ?? '' }).eq('key', DIGEST_KEY).eq('value', today);

      const { data } = await svc
         .from('loans')
         .select(LOAN_COLUMNS)
         .eq('loan_status', 'Lent')
         .neq('repayment_status', 'Paid')
         .gte('due_date', new Date(now.getTime() - 2 * DAY_MS).toISOString())
         .lte('due_date', new Date(now.getTime() + (DIGEST_DAYS + 1) * DAY_MS).toISOString());
      const candidates = ((data ?? []) as TeamFeedLoan[]).filter((loan) => !loan.is_test && loan.borrower_user_id && loan.due_date);
      if (!candidates.length) return 0;

      const zones = await loadBorrowerTimezones(svc, candidates.map((loan) => loan.borrower_user_id as string)).catch(
         () => new Map<string, string>()
      );
      const upcoming = candidates
         .map((loan) => {
            const zone = loanTimezone(loan, zones.get(loan.borrower_user_id as string) ?? 'Asia/Manila');
            const end = dueDayBounds(loan.due_date as string, zone).end.getTime();
            return { loan, zone, end, days: Math.ceil((end - now.getTime()) / DAY_MS) - 1 };
         })
         .filter((row) => row.end > now.getTime() && row.days <= DIGEST_DAYS && getLoanOutstandingAmount(row.loan as never) > 0)
         .sort((a, b) => a.end - b.end);
      if (!upcoming.length) return 0;

      const ids = Array.from(new Set(upcoming.flatMap(({ loan }) => [loan.borrower_user_id, loan.lender_user_id]).filter(Boolean))) as string[];
      const { data: people } = await svc.from('users').select('id, username, telegram_username').in('id', ids);
      const byId = new Map(((people ?? []) as Array<{ id: string; username: string | null; telegram_username: string | null }>).map((u) => [u.id, u]));

      const lines = upcoming.slice(0, MAX_DIGEST_LINES).map(({ loan, zone, days }) => {
         const owed = describeOwed(loan);
         const lender = loan.lender_user_id ? handle(byId.get(loan.lender_user_id)) : 'unknown';
         return `• **${whenLabel(days)}**: ${handle(byId.get(loan.borrower_user_id as string))} owes ${owed} (lender ${lender}, ${loan.tracking_id})\n   due by ${formatDeadlineForTeam(loan.due_date as string, zone, teamZone)}`;
      });
      if (upcoming.length > MAX_DIGEST_LINES) lines.push(`…and ${upcoming.length - MAX_DIGEST_LINES} more`);

      const posted = await postDiscord(
         {
            embeds: [
               {
                  title: `📅 Coming due in the next ${DIGEST_DAYS} days (${upcoming.length} ${upcoming.length === 1 ? 'loan' : 'loans'})`,
                  description: lines.join('\n').slice(0, 4000),
                  color: 0xfee75c,
                  timestamp: now.toISOString()
               }
            ]
         },
         { prefer: ['DISCORD_REQUESTS_WEBHOOK_URL'] }
      );
      if (!posted) {
         await release();
         return 0;
      }
      return upcoming.length;
   } catch (err) {
      console.error('teamLoanFeed: due digest failed', err instanceof Error ? err.message : err);
      return 0;
   }
};
