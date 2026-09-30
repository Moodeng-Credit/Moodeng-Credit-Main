// Team-facing side of "loans due": which timezone each borrower is in, and a post to the operator
// team group when a loan is due today or has gone overdue. The borrower reminders alone left the
// team blind: nobody but the borrower was told a repayment was due.

import { dueDayBounds, formatDeadline, resolveTimezone } from './loanDeadline.ts';
import { getLoanOutstandingAmount } from './loanNotifications.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type FeedKind = 'team_due_today' | 'team_overdue';

export type FeedLoan = {
   id: string;
   tracking_id: string;
   borrower_user_id: string | null;
   lender_user_id: string | null;
   loan_amount: number;
   total_repayment_amount: number;
   repaid_amount?: number | null;
   due_date: string | null;
   funded_at: string | null;
};

const MAX_LINES = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Most common non-VPN country across a user's logins. A single login through a VPN or a datacenter
// exit shouldn't move someone's deadline to another timezone.
const pickCountry = (rows: Array<{ country_iso: string | null; is_hosting: boolean | null }>): string | null => {
   const counts = new Map<string, number>();
   for (const row of rows) {
      if (!row.country_iso || row.is_hosting) continue;
      counts.set(row.country_iso, (counts.get(row.country_iso) ?? 0) + 1);
   }
   let best: string | null = null;
   let bestCount = 0;
   for (const [country, count] of counts) {
      if (count > bestCount) {
         best = country;
         bestCount = count;
      }
   }
   return best;
};

/** userId → IANA zone. Every requested id gets an entry (default zone when nothing is known). */
export const loadBorrowerTimezones = async (supabase: SupabaseClient, userIds: string[]): Promise<Map<string, string>> => {
   const ids = Array.from(new Set(userIds.filter(Boolean)));
   const zones = new Map<string, string>();
   if (!ids.length) return zones;

   const { data: users, error: usersError } = await supabase.from('users').select('id, video_call_timezone').in('id', ids);
   if (usersError) throw new Error(usersError.message);

   const { data: logins, error: loginsError } = await supabase
      .from('auth_ip_log')
      .select('user_id, country_iso, is_hosting, last_seen_at')
      .in('user_id', ids)
      .order('last_seen_at', { ascending: false })
      .limit(5000);
   if (loginsError) throw new Error(loginsError.message);

   const loginsByUser = new Map<string, Array<{ country_iso: string | null; is_hosting: boolean | null }>>();
   for (const row of (logins ?? []) as Array<{ user_id: string; country_iso: string | null; is_hosting: boolean | null }>) {
      const list = loginsByUser.get(row.user_id) ?? [];
      list.push(row);
      loginsByUser.set(row.user_id, list);
   }

   const saved = new Map<string, string | null>(
      ((users ?? []) as Array<{ id: string; video_call_timezone: string | null }>).map((user) => [user.id, user.video_call_timezone])
   );

   for (const id of ids) {
      zones.set(id, resolveTimezone(saved.get(id), pickCountry(loginsByUser.get(id) ?? [])));
   }
   return zones;
};

const getSetting = async (supabase: SupabaseClient, key: string): Promise<string | undefined> => {
   const { data } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? undefined;
};

const dollars = (amount: number) => `$${amount.toFixed(2)}`;

/**
 * Posts one message listing the loans not yet announced for `kind`, then records each so it is
 * announced once. Never throws: a Telegram problem must not stop the borrower reminders.
 * Returns how many loans were announced.
 */
export const postDueTeamFeed = async (
   supabase: SupabaseClient,
   kind: FeedKind,
   loans: FeedLoan[],
   usernames: Map<string, string | null>,
   zones: Map<string, string>,
   referenceDate: Date
): Promise<number> => {
   try {
      if (!loans.length) return 0;
      if ((await getSetting(supabase, 'due_team_feed_enabled')) === 'false') return 0;
      const chatId = (await getSetting(supabase, 'team_group_chat_id')) ?? Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
      if (!chatId) return 0;

      const { data: sent, error: sentError } = await supabase
         .from('loan_notifications')
         .select('loan_id')
         .in('loan_id', loans.map((loan) => loan.id))
         .eq('notification_type', kind);
      if (sentError) throw new Error(sentError.message);
      const alreadySent = new Set(((sent ?? []) as Array<{ loan_id: string }>).map((row) => row.loan_id));
      const pending = loans.filter((loan) => !alreadySent.has(loan.id) && loan.borrower_user_id && loan.due_date);
      if (!pending.length) return 0;

      const lenderIds = Array.from(new Set(pending.map((loan) => loan.lender_user_id).filter(Boolean))) as string[];
      const lenderNames = new Map<string, string>();
      if (lenderIds.length) {
         const { data: lenders } = await supabase.from('users').select('id, username').in('id', lenderIds);
         for (const lender of (lenders ?? []) as Array<{ id: string; username: string | null }>) {
            if (lender.username) lenderNames.set(lender.id, lender.username);
         }
      }

      const lines = pending.slice(0, MAX_LINES).map((loan) => {
         const zone = zones.get(loan.borrower_user_id as string) ?? resolveTimezone(null, null);
         const borrower = usernames.get(loan.borrower_user_id as string) ?? 'someone';
         const lender = loan.lender_user_id ? lenderNames.get(loan.lender_user_id) ?? 'unknown' : 'unknown';
         const owed = dollars(getLoanOutstandingAmount(loan));
         const deadline = formatDeadline(loan.due_date as string, zone);
         if (kind === 'team_due_today') {
            return `• ${borrower} owes ${owed} (lender ${lender}, ${loan.tracking_id})\n   overdue after ${deadline}`;
         }
         const { end } = dueDayBounds(loan.due_date as string, zone);
         const daysLate = Math.max(1, Math.floor((referenceDate.getTime() - end.getTime()) / DAY_MS) + 1);
         return `• ${borrower} owes ${owed} (lender ${lender}, ${loan.tracking_id})\n   was due by ${deadline}, ${daysLate} ${daysLate === 1 ? 'day' : 'days'} late`;
      });
      if (pending.length > MAX_LINES) lines.push(`…and ${pending.length - MAX_LINES} more`);

      const heading =
         kind === 'team_due_today'
            ? `📅 Due today (${pending.length} ${pending.length === 1 ? 'loan' : 'loans'})`
            : `⚠️ Overdue (${pending.length} ${pending.length === 1 ? 'loan' : 'loans'})`;
      await sendTelegramMessage(chatId, `${heading}\n${lines.join('\n')}`);

      const { error: recordError } = await supabase.from('loan_notifications').insert(
         pending.map((loan) => ({ loan_id: loan.id, user_id: loan.borrower_user_id, notification_type: kind }))
      );
      if (recordError) console.error('due team feed: could not record', recordError.message);
      return pending.length;
   } catch (error) {
      console.error('due team feed failed', error instanceof Error ? error.message : error);
      return 0;
   }
};
