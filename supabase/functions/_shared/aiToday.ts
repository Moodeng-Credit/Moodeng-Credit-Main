// AI models don't know today's date: their training stops months earlier, so a
// payslip dated September 2026 looked "in the future" to them in November 2026.
// Put the real date at the top of every prompt that judges dates.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const todayLine = (now = Date.now()): string => {
   const bkk = new Date(now + 7 * 3_600_000);
   const ymd = bkk.toISOString().slice(0, 10);
   const month = bkk.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
   return `Today is ${DAYS[bkk.getUTCDay()]} ${ymd} (${month} ${bkk.getUTCFullYear()}, Bangkok time). Any date on or before today is in the past, never "in the future" — your training data may end earlier, so trust this date over your own sense of the year.`;
};

export const withToday = (system: string, now = Date.now()): string => `${todayLine(now)}\n\n${system}`;
