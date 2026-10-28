// Weekly team ping: unpaid loans due this week (Mon–Sun, Bangkok) and the ones still overdue, posted
// once a week to the Telegram chat in telegram_bot_settings.loans_due_chat_id. Runs from
// loan-weekly-digest ({ event: 'team_due' }); the cron fires Mondays 09:00 Bangkok.

import { messengerChatUrl } from './sendpulse.ts';

const BANGKOK_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 Bangkok of the week holding `at`, as a UTC instant, plus the next Monday. */
export const bangkokWeek = (at: Date) => {
   const local = new Date(at.getTime() + BANGKOK_MS);
   const sinceMonday = (local.getUTCDay() + 6) % 7;
   const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceMonday);
   const start = new Date(mondayLocal - BANGKOK_MS);
   return { start, end: new Date(start.getTime() + 7 * DAY_MS), key: new Date(mondayLocal).toISOString().slice(0, 10) };
};

export type TeamDueLoan = {
   dueDate: string;
   owedUsd: number;
   name: string;
   username: string | null;
   facebookName: string | null;
   messengerContactId: string | null;
   onHold: boolean;
};

const day = (iso: string | Date) =>
   new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' });
const usd = (value: number) => `$${value.toFixed(2)}`;

const line = (loan: TeamDueLoan, now: Date, overdue: boolean) => {
   const who = `${loan.name}${loan.username ? ` (@${loan.username})` : ''}`;
   const late = overdue ? ` (${Math.max(1, Math.floor((now.getTime() - Date.parse(loan.dueDate)) / DAY_MS))}d late)` : '';
   const fb = loan.facebookName ? ` · FB: ${loan.facebookName}` : loan.messengerContactId ? ' · Messenger ✓' : ' · no FB';
   return `• ${day(loan.dueDate)}${late} · ${who} · ${usd(loan.owedUsd)} left${fb}${loan.onHold ? ' · on hold' : ''}`;
};

const total = (loans: TeamDueLoan[]) => usd(loans.reduce((sum, loan) => sum + loan.owedUsd, 0));

/** The message and its 💬 buttons (one per borrower with Messenger, this week's first). */
export const buildTeamLoansDue = (loans: TeamDueLoan[], now: Date) => {
   const { start, end } = bangkokWeek(now);
   const sorted = [...loans].sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
   const thisWeek = sorted.filter((loan) => Date.parse(loan.dueDate) >= start.getTime() && Date.parse(loan.dueDate) < end.getTime());
   const overdue = sorted.filter((loan) => Date.parse(loan.dueDate) < start.getTime());
   const range = `${day(start)} – ${day(new Date(end.getTime() - 1))}`;

   const sections = [
      thisWeek.length
         ? `📅 Due this week — ${thisWeek.length} loan${thisWeek.length === 1 ? '' : 's'}, ${total(thisWeek)}\n${thisWeek.map((loan) => line(loan, now, false)).join('\n')}`
         : '📅 Due this week: none 🎉',
      overdue.length
         ? `⏰ Still overdue — ${overdue.length} loan${overdue.length === 1 ? '' : 's'}, ${total(overdue)}\n${overdue.map((loan) => line(loan, now, true)).join('\n')}`
         : null
   ].filter(Boolean);
   const text = `💰 Upcoming loan repayments (${range}, Bangkok)\n\n${sections.join('\n\n')}`;

   const seen = new Set<string>();
   const buttons: Array<{ text: string; url: string }> = [];
   for (const loan of [...thisWeek, ...overdue]) {
      if (!loan.messengerContactId || seen.has(loan.messengerContactId) || buttons.length >= 40) continue;
      seen.add(loan.messengerContactId);
      buttons.push({ text: `💬 ${(loan.facebookName ?? loan.name).split(/\s+/).slice(0, 2).join(' ')}`, url: messengerChatUrl(loan.messengerContactId) });
   }
   const keyboard: Array<Array<{ text: string; url: string }>> = [];
   for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));
   return { text: text.length > 4000 ? `${text.slice(0, 3990)}\n…` : text, keyboard };
};
