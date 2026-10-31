// The two AI steps of the Messenger call-booking bot, on DeepSeek v4-flash (no thinking, JSON mode):
//   readCallTime: "bukas after 6pm" → the time windows the borrower means, in their own zone
//   writePrepNote: the "get to know you" answers → a short prep note for the call host
// Both are help, never decisions: nothing here scores a borrower or books anything.

// DeepSeek's current name for Flash (2026-08); 'deepseek-v4-flash' is a retired alias billed the same.
const MODEL = 'deepseek-flash';
const TIMEOUT_MS = 8_000;

const ask = async (system: string, user: string, maxTokens: number): Promise<{ data: Record<string, unknown> | null; ms: number; error?: string }> => {
   const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
   if (!apiKey) return { data: null, ms: 0, error: 'DEEPSEEK_API_KEY is not set' };
   const t0 = Date.now();
   const ctrl = new AbortController();
   const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
   try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
         method: 'POST',
         signal: ctrl.signal,
         headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
            model: MODEL,
            thinking: { type: 'disabled' },
            temperature: 0,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages: [
               { role: 'system', content: system },
               { role: 'user', content: user }
            ]
         })
      });
      if (!res.ok) return { data: null, ms: Date.now() - t0, error: `DeepSeek ${res.status}` };
      const reply = await res.json();
      return { data: JSON.parse(reply?.choices?.[0]?.message?.content ?? '{}'), ms: Date.now() - t0 };
   } catch (err) {
      return { data: null, ms: Date.now() - t0, error: err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'unreachable' };
   } finally {
      clearTimeout(timer);
   }
};

export type CallTimeWindow = { date: string; from: string; to: string };
export type CallTimeRead = { windows: CallTimeWindow[]; at: string | null; anytime: boolean; unclear: boolean; lang: 'en' | 'fil' | 'id'; summary: string };

const TIME_PROMPT = `You read a borrower's chat reply about when they can do a 15-minute video call. They may write English, Filipino, Taglish or Indonesian, with typos.
Reply with only this JSON:
{"windows":[{"date":"YYYY-MM-DD","from":"HH:MM","to":"HH:MM"}],"at":null,"anytime":false,"unclear":false,"lang":"en","summary":"..."}
Rules:
- windows: up to 4 time ranges in the next 7 days, in THEIR local time (24-hour), in the order they prefer.
- morning/umaga/pagi 08:00-12:00, lunch/tanghali/siang 11:00-13:00, afternoon/hapon/sore 12:00-17:00, evening/gabi/malam/night 17:00-21:00.
- "after 6pm" = 18:00-21:00. "before 3pm" = 09:00-15:00. One exact time like "3pm" = 14:30-15:30 and at = "15:00".
- bukas/besok = tomorrow, mamaya/nanti = later today, ngayon/sekarang = today, weekend = the coming Saturday and Sunday. A weekday name = its next date (today counts if it's that day and the time hasn't passed).
- "linggo" alone is Sunday, but "susunod na linggo", "sa isang linggo", "next week" and "minggu depan" mean next week: with no day named, that's Monday to Thursday of next week (09:00-21:00, or the time they gave). Never unclear.
- A time with no day: today if still possible, else tomorrow. A day with no time: 09:00-21:00.
- anytime=true (windows empty) if they say any time works. unclear=true if there is no usable day or time.
- at: "HH:MM" only when they named one exact time, else null.
- lang: "fil" for Filipino/Taglish, "id" for Indonesian, else "en".
- summary: under 8 words, English, just the time they asked for, e.g. "tomorrow after 6 PM" (for the team log only).`;

const okTime = (s: unknown) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
const okDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** `now` is the borrower's local wall time, e.g. { weekday: 'Thursday', date: '2026-10-29', time: '09:15' }. */
export const readCallTime = async (text: string, now: { weekday: string; date: string; time: string }) => {
   const { data, ms, error } = await ask(TIME_PROMPT, `Right now it is ${now.weekday} ${now.date} ${now.time} their time.\nTheir message: """${text.slice(0, 400)}"""`, 300);
   if (!data) return { read: null, ms, error };
   const windows = (Array.isArray(data.windows) ? data.windows : [])
      .filter((w: any) => okDate(w?.date) && okTime(w?.from) && okTime(w?.to))
      .slice(0, 4)
      .map((w: any) => ({ date: w.date, from: w.from, to: w.to }));
   const read: CallTimeRead = {
      windows,
      at: okTime(data.at) ? (data.at as string) : null,
      anytime: data.anytime === true,
      unclear: data.unclear === true && data.anytime !== true && windows.length === 0,
      lang: data.lang === 'fil' || data.lang === 'id' ? data.lang : 'en',
      summary: String(data.summary ?? '').slice(0, 60)
   };
   return { read, ms };
};

export type PrepNote = { who: string; opener: string; points: string[]; care: string };

const PREP_PROMPT = `You help a small lending team in the Philippines and Indonesia prepare for a friendly 15-minute onboarding video call with a new borrower.
Use only the answers given (some may be missing). Never judge, score or suggest lending decisions. Be warm, short and specific.
Reply with only this JSON:
{"who":"one line about them, max 20 words","opener":"one friendly first question for the host, max 20 words","points":["2-3 short talking points linking their situation to Moodeng: small first loans, credit level and limit grow with on-time repayments, reminders before due dates"],"care":"one heads-up if something sensitive came up (e.g. medical costs), else empty string"}`;

export const writePrepNote = async (firstName: string, host: string, answers: Record<string, string>) => {
   const { data, ms, error } = await ask(PREP_PROMPT, `Borrower first name: ${firstName}. Host: ${host}.\nAnswers: ${JSON.stringify(answers).slice(0, 1500)}`, 400);
   if (!data) return { note: null, ms, error };
   const note: PrepNote = {
      who: String(data.who ?? '').slice(0, 200),
      opener: String(data.opener ?? '').slice(0, 200),
      points: (Array.isArray(data.points) ? data.points : []).map((p) => String(p).slice(0, 200)).slice(0, 3),
      care: String(data.care ?? '').slice(0, 200)
   };
   return { note, ms };
};
