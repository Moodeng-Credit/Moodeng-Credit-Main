// What paying on time is worth, for the due reminders: the food voucher when this repayment earns it,
// otherwise the streak it grows (or, on the due day, saves). The numbers come from
// repay_reward_previews() (migration 20261114150000_repay_streak_rewards); the app's loan card says
// the same thing (getRepayRewardLine in src/views/dashboard-v2/dashboardV2Model.ts).

export type RepayRewardPreview = {
   /** On-time repayments in a row right now. */
   current: number;
   best: number;
   /** The streak count that pays the next food voucher, or null when none is left. */
   nextStep: number | null;
   /** On-time repayments still needed to reach nextStep. */
   toGo: number | null;
   nextPhp: number | null;
};

export type RepayRewardLocale = 'en' | 'fil' | 'id';
type ReminderMoment = 'urgent_reminder' | 'final_reminder' | 'due_today';

const COPY: Record<
   'en' | 'fil',
   {
      earn: (php: number) => string;
      earnToday: (php: number) => string;
      keep: (streak: number) => string;
      grow: (streak: number, php: number, at: number) => string;
      growOnly: (streak: number) => string;
   }
> = {
   en: {
      earn: (php) => `🎁 Pay on time and get ₱${php} food.`,
      earnToday: (php) => `🎁 Pay today and get ₱${php} food.`,
      keep: (streak) => `🔥 Pay today to keep your ${streak} streak.`,
      grow: (streak, php, at) => `🔥 Pay on time to reach streak ${streak}. ₱${php} food at streak ${at}.`,
      growOnly: (streak) => `🔥 Pay on time to reach streak ${streak}.`
   },
   fil: {
      earn: (php) => `🎁 Magbayad on time at makakuha ng ₱${php} food.`,
      earnToday: (php) => `🎁 Magbayad ngayon at makakuha ng ₱${php} food.`,
      keep: (streak) => `🔥 Magbayad ngayon para hindi mawala ang ${streak} streak mo.`,
      grow: (streak, php, at) => `🔥 Magbayad on time para maging streak ${streak}. ₱${php} food sa streak ${at}.`,
      growOnly: (streak) => `🔥 Magbayad on time para maging streak ${streak}.`
   }
};

export const parseRepayRewardPreview = (raw: unknown): RepayRewardPreview | null => {
   if (!raw || typeof raw !== 'object') return null;
   const value = raw as Record<string, unknown>;
   const num = (item: unknown) => (item === null || item === undefined ? null : Number(item));
   const current = num(value.current);
   const best = num(value.best);
   if (current === null || best === null || !Number.isFinite(current) || !Number.isFinite(best)) return null;
   return { current, best, nextStep: num(value.nextStep), toGo: num(value.toGo), nextPhp: num(value.nextPhp) };
};

/**
 * One short sentence for a reminder, or null when there is nothing to promise (no preview, an overdue
 * notice, or Indonesian copy: the food vouchers are for the Philippines).
 */
export const buildRepayRewardLine = (
   reward: RepayRewardPreview | null | undefined,
   type: string,
   locale: RepayRewardLocale = 'en'
): string | null => {
   if (!reward || locale === 'id') return null;
   if (type !== 'urgent_reminder' && type !== 'final_reminder' && type !== 'due_today') return null;
   const moment = type as ReminderMoment;
   const copy = COPY[locale];
   if (reward.nextStep !== null && reward.toGo === 1 && reward.nextPhp) {
      return moment === 'due_today' ? copy.earnToday(reward.nextPhp) : copy.earn(reward.nextPhp);
   }
   if (reward.nextStep === null && reward.current === 0) return null;
   if (moment === 'due_today' && reward.current > 0) return copy.keep(reward.current);
   return reward.nextStep !== null && reward.nextPhp
      ? copy.grow(reward.current + 1, reward.nextPhp, reward.nextStep)
      : copy.growOnly(reward.current + 1);
};

// --- "REWARD" typed to the Page (messengerRewardReply.ts sends the answer) ---

export const REWARD_KEYWORD = 'REWARD';
export const isRewardMessage = (text: string): boolean => /^\s*(my\s+)?rewards?(\s+ko)?\s*[!.?]*\s*$/i.test(text);

const formatUsd = (amount: number) => `$${amount.toFixed(2)}`;

export const buildRewardReply = (input: { streak: number; rewardLine: string | null; owed: number; dueLabel: string | null }): string => {
   const lines = [input.streak > 0 ? `🔥 ${input.streak} on time in a row.` : 'No streak yet. Your next on-time payment starts one.'];
   if (input.owed > 0 && input.dueLabel) lines.push(`You have ${formatUsd(input.owed)} due ${input.dueLabel}.`);
   if (input.rewardLine) lines.push(input.rewardLine);
   if (input.owed > 0) lines.push("We'll remind you here before it's due.");
   return lines.join('\n');
};

/** "today" / "tomorrow" / "in 5 days" / "now (overdue)", by calendar day in the loan's zone. */
export const dueLabelFor = (dueDate: string, zone: string, now: Date): string => {
   const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date);
   // due_date is stored as the due day at 00:00 UTC, so its UTC date is the due day.
   const dueDay = new Date(dueDate).toISOString().slice(0, 10);
   const days = Math.round((Date.parse(dueDay) - Date.parse(day(now))) / 86_400_000);
   if (days < 0) return 'now (overdue)';
   if (days === 0) return 'today';
   if (days === 1) return 'tomorrow';
   return `in ${days} days`;
};
