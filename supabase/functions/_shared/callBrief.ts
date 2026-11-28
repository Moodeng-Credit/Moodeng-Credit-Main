import { withToday } from './aiToday.ts';
// Call brief: everything we already know about a borrower, boiled down for the host to read back in the
// first minute of the call ("So you're an admin assistant in Binangonan, paid end of month — right?")
// instead of reading the whole profile. Made once per person on demand and saved (call_briefs); the
// host can ask for a fresh one. It is a reading aid, never a decision: nothing approves or rejects from it.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const MODEL = 'deepseek-v4-pro';
const MAX_INPUT_CHARS = 24_000;

export type CallBrief = {
   // One line: who this is.
   headline: string;
   // Things they told us, as sentences the host can say to confirm.
   say_back: string[];
   // What is missing or doesn't add up: questions to ask.
   ask: string[];
   // Things for the host to keep in mind (never said to the borrower).
   watch: string[];
};

const SYSTEM_PROMPT = `You prepare a host at Moodeng Credit for a short video call with a new borrower. Moodeng gives small USDC loans ($15–$100, about 30 days) to people in the Philippines and Indonesia. Before the call the borrower filled in a profile, recorded pre-screening answers, chatted with our booking bot and may have sent proof of income. The host has not read any of it.

From the data, write what the host should say in the first minute to confirm it, in the host's voice, speaking to the borrower.

Rules:
- Use ONLY facts in the data. Never guess or fill gaps. If something is missing, put a question about it in "ask" instead.
- "say_back": 4 to 7 short sentences, each one a fact to confirm, each ending in a check like "— is that right?" or "right?". Start with who they are (name, age, family, where they live), then work and pay, then payday, then what the loan is for. Plain spoken English, short words, no jargon. Turn income bands into words ("around $400 to $700 a month"). Money they gave in pesos or rupiah stays in that currency.
- "ask": 2 to 4 questions for what is missing, vague, or where two sources disagree (say which two).
- "watch": 0 to 3 short notes only the host sees: flags the AI graders or the team already raised. Empty if none.
- "headline": one line, like "Admin assistant, 36, two kids, Binangonan — wants help with bills".
- Do not mention scores, AI, verdicts or internal labels in "say_back" or "ask".

Reply with JSON only: {"headline": "", "say_back": [], "ask": [], "watch": []}`;

const strings = (value: unknown, max: number): string[] =>
   (Array.isArray(value) ? value : [])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim().slice(0, 400))
      .slice(0, max);

// Drop storage paths and other bulk the model doesn't need.
const lean = (value: unknown): unknown => {
   if (Array.isArray(value)) return value.map(lean);
   if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
         if (['video', 'audio', 'photo', 'path', 'files', 'file_hashes', 'id_hashes', 'row_keys', 'ip', 'browser', 'token'].includes(k)) continue;
         if (v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
         out[k] = lean(v);
      }
      return out;
   }
   return typeof value === 'string' && value.length > 1500 ? `${value.slice(0, 1500)}…` : value;
};

export const loadCallBrief = async (svc: SupabaseClient, userId: string): Promise<{ brief: CallBrief; createdAt: string } | null> => {
   const { data } = await svc.from('call_briefs').select('brief, created_at').eq('user_id', userId).maybeSingle();
   return data?.brief ? { brief: data.brief as CallBrief, createdAt: data.created_at } : null;
};

export const makeCallBrief = async (svc: SupabaseClient, userId: string): Promise<{ brief: CallBrief; createdAt: string }> => {
   const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
   if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');

   const [userRes, screenRes, botRes, docsRes, requestRes, sheetRes, loansRes] = await Promise.all([
      svc
         .from('users')
         .select(
            'display_name, facebook_name, market, location, about_gender, about_age, about_kids, profession, income_type, monthly_income, monthly_expenses, other_income, income_description, gap_reasons, created_at'
         )
         .eq('id', userId)
         .maybeSingle(),
      svc
         .from('pre_screenings')
         .select('name, score, verdict, grade, questions, followup_questions, followup_answers, auto_check, team_reason, created_at')
         .eq('user_id', userId)
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle(),
      svc.from('booking_bot_answers').select('kind, items, fit_verdict, fit_reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
      svc
         .from('income_documents')
         .select('doc_type, status, verdict, ai_note, memo, extracted, flags, questions, answers, created_at')
         .eq('user_id', userId)
         .order('created_at', { ascending: false })
         .limit(3),
      svc.from('loan_access_requests').select('kind, reason, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(2),
      svc.from('call_screenings').select('answers, notes, red_flags, call_starts_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      svc.from('loans').select('loan_amount, loan_status, repayment_status, reason, created_at').eq('borrower_user_id', userId).order('created_at', { ascending: false }).limit(5)
   ]);
   if (!userRes.data) throw new Error('No account with this id');

   const sections = [
      ['PROFILE THEY FILLED IN', userRes.data],
      ['PRE-SCREENING (their recorded answers, transcribed and graded)', screenRes.data],
      ['BOOKING BOT CHAT ANSWERS', botRes.data],
      ['PROOF OF INCOME (what our reader saw)', docsRes.data],
      ['WHY THEY ASKED TO BORROW', requestRes.data],
      ['EARLIER CALL SHEET (if they had a call before)', sheetRes.data],
      ['LOANS SO FAR', loansRes.data]
   ]
      .filter(([, value]) => value && (!Array.isArray(value) || value.length))
      .map(([title, value]) => `${title}:\n${JSON.stringify(lean(value), null, 1)}`)
      .join('\n\n')
      .slice(0, MAX_INPUT_CHARS);

   const ctrl = new AbortController();
   const timer = setTimeout(() => ctrl.abort(), 60_000);
   let res: Response;
   try {
      res = await fetch('https://api.deepseek.com/chat/completions', {
         method: 'POST',
         signal: ctrl.signal,
         headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
            model: MODEL,
            thinking: { type: 'disabled' },
            temperature: 0.2,
            max_tokens: 900,
            response_format: { type: 'json_object' },
            messages: [
               { role: 'system', content: withToday(SYSTEM_PROMPT) },
               { role: 'user', content: sections }
            ]
         })
      });
   } finally {
      clearTimeout(timer);
   }
   if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
   const body = await res.json();
   const parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;
   const brief: CallBrief = {
      headline: typeof parsed.headline === 'string' ? parsed.headline.trim().slice(0, 200) : '',
      say_back: strings(parsed.say_back, 7),
      ask: strings(parsed.ask, 4),
      watch: strings(parsed.watch, 3)
   };
   if (!brief.say_back.length && !brief.ask.length) throw new Error('The AI returned an empty brief');
   const createdAt = new Date().toISOString();
   const { error } = await svc.from('call_briefs').upsert({ user_id: userId, brief, model: MODEL, created_at: createdAt });
   if (error) throw new Error(`saving brief: ${error.message}`);
   return { brief, createdAt };
};
