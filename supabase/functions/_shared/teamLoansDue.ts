// Daily team ping (09:00 Bangkok): unpaid loans due in the next 7 days and the ones still overdue,
// posted once a day to the Telegram chat in telegram_bot_settings.loans_due_chat_id. Runs from
// loan-weekly-digest ({ event: 'team_due' }). Two-payment loans show their next unpaid part.

import { messengerChatUrl } from './sendpulse.ts';

const BANGKOK_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const UPCOMING_DAYS = 7;

/** Monday 00:00 Bangkok of the week holding `at`, as a UTC instant, plus the next Monday. */
export const bangkokWeek = (at: Date) => {
   const local = new Date(at.getTime() + BANGKOK_MS);
   const sinceMonday = (local.getUTCDay() + 6) % 7;
   const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceMonday);
   const start = new Date(mondayLocal - BANGKOK_MS);
   return { start, end: new Date(start.getTime() + 7 * DAY_MS), key: new Date(mondayLocal).toISOString().slice(0, 10) };
};

/** 00:00 Bangkok of the day holding `at`, as a UTC instant, plus its YYYY-MM-DD key. */
export const bangkokDay = (at: Date) => {
   const local = new Date(at.getTime() + BANGKOK_MS);
   const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
   return { start: new Date(midnightLocal - BANGKOK_MS), key: new Date(midnightLocal).toISOString().slice(0, 10) };
};

export type TeamDueLoan = {
   dueDate: string;
   owedUsd: number;
   name: string;
   username: string | null;
   facebookName: string | null;
   messengerContactId: string | null;
   onHold: boolean;
   /** Two-payment loans: which part is next, e.g. "part 1/2", and what the whole loan still owes. */
   part?: string | null;
   loanLeftUsd?: number | null;
};

const day = (iso: string | Date) =>
   new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' });
const usd = (value: number) => `$${value.toFixed(2)}`;

/** Whole Bangkok days from today to the loan's due day (0 = today, negative = late). */
const daysUntil = (loan: TeamDueLoan, now: Date) =>
   Math.round((bangkokDay(new Date(loan.dueDate)).start.getTime() - bangkokDay(now).start.getTime()) / DAY_MS);

const when = (days: number) => (days < 0 ? `${-days}d late` : days === 0 ? 'TODAY' : days === 1 ? 'tomorrow' : null);

const line = (loan: TeamDueLoan, now: Date) => {
   const who = `${loan.name}${loan.username ? ` (@${loan.username})` : ''}`;
   const label = when(daysUntil(loan, now));
   const part = loan.part ? ` (${loan.part}${loan.loanLeftUsd != null ? `, ${usd(loan.loanLeftUsd)} on the whole loan` : ''})` : '';
   const fb = loan.facebookName ? ` · FB: ${loan.facebookName}` : loan.messengerContactId ? ' · Messenger ✓' : ' · no FB';
   return `• ${day(loan.dueDate)}${label ? ` (${label})` : ''} · ${who} · ${usd(loan.owedUsd)} left${part}${fb}${loan.onHold ? ' · on hold' : ''}`;
};

const total = (loans: TeamDueLoan[]) => usd(loans.reduce((sum, loan) => sum + loan.owedUsd, 0));

/** The message and its 💬 buttons (one per borrower with Messenger, soonest first). */
export const buildTeamLoansDue = (loans: TeamDueLoan[], now: Date) => {
   const sorted = [...loans].sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
   const upcoming = sorted.filter((loan) => {
      const days = daysUntil(loan, now);
      return days >= 0 && days < UPCOMING_DAYS;
   });
   const overdue = sorted.filter((loan) => daysUntil(loan, now) < 0);
   const today = bangkokDay(now).start;
   const range = `${day(today)} – ${day(new Date(today.getTime() + (UPCOMING_DAYS - 1) * DAY_MS))}`;

   const sections = [
      upcoming.length
         ? `📅 Due next 7 days — ${upcoming.length} loan${upcoming.length === 1 ? '' : 's'}, ${total(upcoming)}\n${upcoming.map((loan) => line(loan, now)).join('\n')}`
         : '📅 Due next 7 days: none 🎉',
      overdue.length
         ? `⏰ Still overdue — ${overdue.length} loan${overdue.length === 1 ? '' : 's'}, ${total(overdue)}\n${overdue.map((loan) => line(loan, now)).join('\n')}`
         : null
   ].filter(Boolean);
   const text = `💰 Loans due (${range}, Bangkok)\n\n${sections.join('\n\n')}`;

   const seen = new Set<string>();
   const buttons: Array<{ text: string; url: string }> = [];
   for (const loan of [...upcoming, ...overdue]) {
      if (!loan.messengerContactId || seen.has(loan.messengerContactId) || buttons.length >= 40) continue;
      seen.add(loan.messengerContactId);
      buttons.push({ text: `💬 ${(loan.facebookName ?? loan.name).split(/\s+/).slice(0, 2).join(' ')}`, url: messengerChatUrl(loan.messengerContactId) });
   }
   const keyboard: Array<Array<{ text: string; url: string }>> = [];
   for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));
   return { text: text.length > 4000 ? `${text.slice(0, 3990)}\n…` : text, keyboard };
};
