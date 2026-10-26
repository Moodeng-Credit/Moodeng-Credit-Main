import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { alertDeepSeekFailure } from '../_shared/deepseekAlert.ts';
import { LOAN_REASON_GUIDE } from './loanReasonGuide.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
   });

// DeepSeek json_object mode *usually* returns clean JSON, but v4-flash sometimes wraps
// it in ```json fences, prepends stray prose, or truncates. A naive JSON.parse throws on
// all of those and we fail open — which silently lets low-effort input through and makes
// the gate feel random (e.g. "for bills" flagged but "pay bills" waved through). Parse
// defensively so a real verdict is only discarded when there is genuinely no JSON.
type RawVerdict = { ok?: boolean; hint?: string; category?: string; suggestion?: string };

const parseVerdict = (raw: string): RawVerdict | null => {
   if (!raw || !raw.trim()) return null;
   let s = raw.trim();
   const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
   if (fenced) s = fenced[1].trim();
   try {
      return JSON.parse(s);
   } catch {
      // Model added text around the object — grab the first {...} block and try that.
      const start = s.indexOf('{');
      const end = s.lastIndexOf('}');
      if (start !== -1 && end > start) {
         try {
            return JSON.parse(s.slice(start, end + 1));
         } catch {
            return null;
         }
      }
      return null;
   }
};

// DeepSeek V4 Pro with thinking OFF. Thinking is on by default for DeepSeek's models, and
// with it on the hidden reasoning used up max_tokens before any answer was written: ~28% of
// checks came back empty and failed open, so borderline reasons passed or failed by luck.
// Pro costs ~$0.0005 per check (Sept 2026 pricing) — pennies a month at our volume.
const DEEPSEEK_MODEL = 'deepseek-v4-pro';
// Cap how long we'll wait on the AI before failing open, so a slow/hung DeepSeek
// call never stalls the borrower's form submission.
const AI_TIMEOUT_MS = 8000;

// Reason verdicts. `good`/`tip` pass (a tip is advice, not a block); the app stops the request
// for every other category until the borrower fixes it, showing the hint and suggestion.
const REASON_CATEGORIES = ['good', 'tip', 'vague', 'placeholder', 'not_english', 'not_allowed'] as const;
type ReasonCategory = (typeof REASON_CATEGORIES)[number];
const PASSING: ReadonlySet<string> = new Set(['good', 'tip']);

// The answer format lives in code, not in the guide, so editing the guide can never break
// the JSON the app depends on.
const REASON_OUTPUT_CONTRACT = `
Reply with ONLY a JSON object, no other text:
{"category": "good" | "tip" | "vague" | "placeholder" | "not_english" | "not_allowed", "hint": "<one short friendly sentence, empty for good>", "suggestion": "<a full English reason they could post as-is, or empty>"}`;

type Kind = 'reason' | 'profession' | 'situation';

// The hint must make the problem understood, so it explains in the language the borrower picked in
// the app. But writing the reason in English is part of the screening (lenders only read English),
// so example words are given in English and every flagged hint ends by asking for an English answer.
// Before: every hint was English, often a bare question, and people who couldn't tell what was wrong
// kept resubmitting (8 of 16 borrowers needed 3+ tries).
// `sample` shows the model the language to write in: on real DeepSeek, a Bahasa user who typed in
// English got an English explanation until it had a sample to follow.
const HINT_LANGUAGES: Record<string, { name: string; answerInEnglish: string; sample: string }> = {
   en: { name: 'simple English (8th-grade level)', answerInEnglish: '', sample: '' },
   fil: {
      name: 'natural, simple Taglish — everyday Tagalog mixed with English, like a friendly ate or kuya (8th-grade level)',
      answerInEnglish: 'Sagutin sa English.',
      sample: 'Kailangan malaman ng lenders kung saan mapupunta ang pera.'
   },
   id: {
      name: 'simple, friendly Bahasa Indonesia',
      answerInEnglish: 'Jawab dalam bahasa Inggris.',
      sample: 'Pemberi pinjaman perlu tahu uangnya akan dipakai untuk apa.'
   },
   th: { name: 'simple, friendly Thai', answerInEnglish: 'ตอบเป็นภาษาอังกฤษ', sample: 'ผู้ให้กู้ต้องรู้ว่าเงินจะนำไปใช้ทำอะไร' },
   vi: {
      name: 'simple, friendly Vietnamese',
      answerInEnglish: 'Hãy trả lời bằng tiếng Anh.',
      sample: 'Người cho vay cần biết số tiền sẽ được dùng vào việc gì.'
   }
};

const hintLanguageNote = (locale: string, kind: Kind) => {
   const language = HINT_LANGUAGES[locale] ?? HINT_LANGUAGES.en;
   const endWith = language.answerInEnglish
      ? `\n- End every non-empty hint with exactly: "${language.answerInEnglish}"`
      : '';
   const reasonRules =
      kind === 'reason'
         ? `
- Explain WHAT is wrong and WHY lenders need it, then show how to fix it. Assume they don't know what "vague" means.
- For "vague": say lenders need to know exactly what the money is for, ask about what they started to say, and give 2–3 example details as short ENGLISH phrases in quotes, e.g. Which bills? "electricity bill", "water bill", "rent".
- For "placeholder": say it looks like random or test text and lenders need their real reason; give 2 English example phrases.
- If the text looks cut off mid-sentence: kindly say to finish the sentence and say what the money is for.
- For "not_english": say lenders only read English, so the reason must be written in English; give only the open-ended English starter "I need this loan to pay for ..." — never fill in what their money is for, not even partly. Do NOT translate their text.
- For "not_allowed": say kindly which purpose we can't fund and why, in one sentence.
- For "tip": one short optional tip.
- "suggestion" stays in English, and is empty for "not_english".`
         : '';
   return `
HINT LANGUAGE AND STYLE: Write "hint" in ${language.name} — even when the borrower wrote in English or in another language.${language.sample ? ` Write it in that language like this sample sentence: "${language.sample}". Only the example phrases in quotes stay in English.` : ''} At most 2 short sentences plus the examples, friendly, never blaming, no jargon. Keep example phrases in English.${reasonRules}
- Never invent facts in "suggestion": if they wrote "bills", the suggestion says "bills", not which bills.${endWith}`;
};

// Each field the borrower types gets its own rubric. The shared goal: is the input
// specific and understandable enough for a lender, or is it low-effort filler?
// Note profession: a SHORT answer ("teacher") is fine — we only flag unclear
// abbreviations, gibberish, or blanks. We never penalize brevity here.
// The reason rubric lives in loan-reason-guide.md (bundled as LOAN_REASON_GUIDE). These two
// shorter rubrics still live here.
const PROMPTS: Record<Exclude<Kind, 'reason'>, string> = {
   profession: `You screen the job/profession a borrower typed on a micro-lending app used mainly in the Philippines, so lenders can understand what they do for work.

A GOOD answer names a real, understandable job. A SHORT answer is completely fine — "teacher", "nurse", "driver" are all good. Do NOT reject something just for being short.

Common Philippine terms are clear and understood — ACCEPT them: sari-sari store owner, palengke vendor, jeepney driver, tricycle driver, habal-habal driver, OFW (overseas Filipino worker), kasambahay, market vendor, farmer, fisherman.

REJECT only when it's unclear to an outsider: an ambiguous abbreviation or acronym a lender can't decode (like "CSR", "BPO", "VA", "CS"), gibberish, or blank filler.

Reply with ONLY a JSON object, no other text:
{"ok": true}  when it's a clear, understandable job
{"ok": false, "hint": "<one short, friendly sentence telling them to spell it out>"}

Examples:
"CSR" -> {"ok": false, "hint": "Spell it out so lenders get it — e.g. 'Customer service rep at a call center'."}
"BPO" -> {"ok": false, "hint": "Write the actual role — e.g. 'Call center agent'."}
"VA" -> {"ok": false, "hint": "Spell it out — e.g. 'Virtual assistant'."}
"sari-sari store owner" -> {"ok": true}
"habal-habal driver" -> {"ok": true}
"OFW in Dubai" -> {"ok": true}
"teacher" -> {"ok": true}
"asdf" -> {"ok": false, "hint": "This doesn't look like a real job — write what you do."}`,

   situation: `You screen a borrower's own description of how they earn money, typed on a micro-lending app. Lenders read it, and they are in the US and Europe.

A GOOD answer is written in English and specifically describes their income situation — what they do and how money comes in. Reject vague, generic, placeholder, or gibberish text that tells a lender nothing, and reject text that isn't in English (Tagalog and Taglish are the common case) even when it is specific.

Reply with ONLY a JSON object, no other text:
{"ok": true}  when it's in English and is a specific, genuine description
{"ok": false, "hint": "<one short, friendly sentence telling them what to fix>"}

Examples:
"i work" -> {"ok": false, "hint": "Add detail — what do you do, and how do you get paid?"}
"personal" -> {"ok": false, "hint": "Describe how you actually earn — a lender can't tell from this."}
"asdf" -> {"ok": false, "hint": "This looks like random text — describe how you earn."}
"Tindera ako sa palengke, kita ko araw araw" -> {"ok": false, "hint": "Please write this in English — the lenders reading it don't speak Tagalog."}
"I run a small online shop and income changes month to month" -> {"ok": true}`
};

const KINDS: ReadonlySet<string> = new Set<Kind>(['reason', 'profession', 'situation']);

// Second opinion for a borrower who is stuck: their reason was flagged on 2+ attempts, or they were
// stopped on submit again and again. Same model with thinking ON, which reasons before answering —
// slower and pricier, so it only runs for these few. It sees their earlier attempts, lets the reason
// through when it really does say what the money is for, and otherwise explains exactly what's missing.
// Measured on real DeepSeek (2026-10-14): second opinions took 2–12s, one ran past 25s. The quick
// check runs at the same time, so if the second opinion isn't back in 10s the borrower gets the quick
// verdict instead of waiting.
const SECOND_OPINION_TIMEOUT_MS = 10000;
const SECOND_OPINION_MODEL_LABEL = `${DEEPSEEK_MODEL}+thinking`;

type Attempt = { text: string; hint: string };

const secondOpinionNote = (history: Attempt[]) => `
SECOND OPINION: You are the senior reviewer. This borrower has already been asked to fix their reason ${history.length} time(s) and may be frustrated. Earlier attempts and what they were told:
${history.map((a, i) => `${i + 1}. "${a.text}" -> told: "${a.hint}"`).join('\n')}

- Judge only the latest input. Be fair: if it tells a lender what the money is for, it is "good" or "tip" — say so, even if an earlier check flagged something similar. Only flag it if there is really a problem a lender would mind.
- If you do flag it, the hint must be clearer than before: briefly acknowledge they've tried, say exactly what is still missing in plain words, and give one example sentence built from THEIR words, in English in quotes. Never translate a non-English reason for them, not even partly: for "not_english", give only the starter "I need this loan to pay for ..." and never fill in their purpose (on real DeepSeek, "Saya butuh uang untuk bayar listrik" got the example "I need this loan to pay for electricity." — that is a translation).`;

/** One DeepSeek call. Returns the parsed verdict, or why it couldn't be had. */
const askDeepSeek = async ({
   apiKey,
   systemPrompt,
   userContent,
   thinking,
   timeoutMs
}: {
   apiKey: string;
   systemPrompt: string;
   userContent: string;
   thinking: boolean;
   timeoutMs: number;
}): Promise<{ verdict: RawVerdict | null; failure?: 'unreachable' | 'error' | 'parse'; status?: number }> => {
   // The timer covers the whole answer: DeepSeek starts responding at once and keeps the connection
   // open while it thinks, so a timer cleared when the response starts never fired (a 10s second
   // opinion ran 19s on real DeepSeek).
   const ctrl = new AbortController();
   const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
   try {
      return await readDeepSeek({ apiKey, systemPrompt, userContent, thinking, signal: ctrl.signal });
   } catch (err) {
      console.error('check-loan-input: DeepSeek fetch failed', { thinking, err: String(err) });
      return { verdict: null, failure: 'unreachable' };
   } finally {
      clearTimeout(timeout);
   }
};

const readDeepSeek = async ({
   apiKey,
   systemPrompt,
   userContent,
   thinking,
   signal
}: {
   apiKey: string;
   systemPrompt: string;
   userContent: string;
   thinking: boolean;
   signal: AbortSignal;
}): Promise<{ verdict: RawVerdict | null; failure?: 'unreachable' | 'error' | 'parse'; status?: number }> => {
   const aiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
         model: DEEPSEEK_MODEL,
         // Thinking is on by default. The quick check is a one-line classification, so it skips it;
         // the second opinion keeps it, with room for the reasoning before the JSON answer.
         thinking: { type: thinking ? 'enabled' : 'disabled' },
         ...(thinking ? {} : { temperature: 0 }),
         max_tokens: thinking ? 4000 : 400,
         response_format: { type: 'json_object' },
         messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
         ]
      })
   });
   if (!aiRes.ok) {
      console.error('check-loan-input: DeepSeek error', aiRes.status, await aiRes.text());
      return { verdict: null, failure: 'error', status: aiRes.status };
   }
   const data = await aiRes.json();
   const content: string = data?.choices?.[0]?.message?.content ?? '';
   const verdict = parseVerdict(content);
   if (!verdict) {
      // Log finish_reason so we can tell truncation ('length') from an empty/garbled body.
      console.error('check-loan-input: unparseable AI content', JSON.stringify({ thinking, finishReason: data?.choices?.[0]?.finish_reason, content }));
      return { verdict: null, failure: 'parse' };
   }
   return { verdict };
};

// Who is asking, from the JWT the gateway already verified (verify_jwt = true), so no extra
// auth round trip. Anonymous calls (anon key) have no subject.
const callerUserId = (req: Request): string | null => {
   try {
      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      const payload = token.split('.')[1];
      if (!payload) return null;
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof json.sub === 'string' && json.role === 'authenticated' ? json.sub : null;
   } catch {
      return null;
   }
};

// Every judged input is kept privately (service role only, no client access) so the team can
// review what was turned away and tune loan-reason-guide.md. Best effort: a failed insert never
// affects the borrower.
const recordCheck = async (row: {
   user_id: string | null;
   kind: Kind;
   text: string;
   ok: boolean;
   category: string | null;
   hint: string;
   suggestion: string;
   model?: string;
}) => {
   try {
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) return;
      const { error } = await createClient(url, key).from('loan_input_checks').insert({ ...row, model: row.model ?? DEEPSEEK_MODEL });
      if (error) console.error('check-loan-input: failed to record check', error.message);
   } catch (err) {
      console.error('check-loan-input: failed to record check', err);
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

   try {
      const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
      // Fail open — if the key isn't configured, never block a borrower's input.
      if (!apiKey) {
         console.error('check-loan-input: DEEPSEEK_API_KEY not set');
         return jsonResponse({ ok: true, skipped: 'no_api_key' });
      }

      const body = (await req.json().catch(() => ({}))) as {
         text?: string;
         reason?: string;
         kind?: Kind;
         locale?: string;
         escalate?: boolean;
         history?: Attempt[];
      };
      // Accept `text` (new) or `reason` (back-compat); default to the reason rubric.
      const text = (body.text ?? body.reason ?? '').trim();
      const kind: Kind = body.kind && KINDS.has(body.kind) ? body.kind : 'reason';
      // Older app versions send no locale: they get English hints, as before.
      const locale = typeof body.locale === 'string' && body.locale in HINT_LANGUAGES ? body.locale : 'en';
      const basePrompt = kind === 'reason' ? `${LOAN_REASON_GUIDE}\n\n${REASON_OUTPUT_CONTRACT}` : PROMPTS[kind];
      const systemPrompt = `${basePrompt}\n${hintLanguageNote(locale, kind)}`;
      if (!text) return jsonResponse({ ok: false, hint: 'Add a bit more so lenders can understand.' });

      const userContent = `Input: "${text}"`;

      // Stuck borrower: try the second opinion first; if it fails or times out, fall back to the quick check.
      const history = (Array.isArray(body.history) ? body.history : [])
         .filter((a): a is Attempt => typeof a?.text === 'string')
         .slice(-5)
         .map((a) => ({ text: a.text.slice(0, 200), hint: typeof a.hint === 'string' ? a.hint.slice(0, 200) : '' }));
      let verdict: RawVerdict | null = null;
      let escalated = false;
      const wantsSecondOpinion = kind === 'reason' && body.escalate === true;
      // Started together with the second opinion (not after it), so a slow or failed second opinion
      // costs no extra wait.
      const quickCall = askDeepSeek({ apiKey, systemPrompt, userContent, thinking: false, timeoutMs: AI_TIMEOUT_MS });
      if (wantsSecondOpinion) {
         const second = await askDeepSeek({
            apiKey,
            systemPrompt: `${systemPrompt}\n${secondOpinionNote(history)}`,
            userContent,
            thinking: true,
            timeoutMs: SECOND_OPINION_TIMEOUT_MS
         });
         verdict = second.verdict;
         escalated = verdict !== null;
      }

      if (!verdict) {
         const quick = await quickCall;
         if (quick.failure === 'error') {
            // Debounced ping to the admin KYC group — this check fails open, so
            // without the alert nobody would ever notice it's off.
            await alertDeepSeekFailure('check-loan-input', quick.status ?? 0);
            return jsonResponse({ ok: true, skipped: 'ai_error' }); // fail open
         }
         if (quick.failure === 'unreachable') return jsonResponse({ ok: true, skipped: 'ai_unreachable' }); // fail open
         if (quick.failure === 'parse' || !quick.verdict) return jsonResponse({ ok: true, skipped: 'parse_error' }); // fail open
         verdict = quick.verdict;
      }

      const userId = callerUserId(req);

      if (kind === 'reason') {
         const category: ReasonCategory = (REASON_CATEGORIES as readonly string[]).includes(verdict.category ?? '')
            ? (verdict.category as ReasonCategory)
            : verdict.ok === false
              ? 'vague'
              : 'good';
         const ok = PASSING.has(category);
         const hint = category === 'good' ? '' : (verdict.hint ?? '').trim() || (ok ? '' : 'Tell lenders what the money will be used for.');
         // No English translation for a non-English reason: writing it in English is part of the screening.
         const suggestion = category === 'good' || category === 'not_english' ? '' : (verdict.suggestion ?? '').trim().slice(0, 200);
         console.log(JSON.stringify({ evt: 'loan_input_verdict', kind, len: text.length, ok, category, locale, escalated }));
         await recordCheck({
            user_id: userId,
            kind,
            text,
            ok,
            category,
            hint,
            suggestion,
            model: escalated ? SECOND_OPINION_MODEL_LABEL : DEEPSEEK_MODEL
         });
         return jsonResponse({ ok, category, hint, suggestion, escalated });
      }

      const ok = verdict.ok !== false; // default to allowing unless explicitly rejected
      const hint = ok ? '' : verdict.hint || 'Add more detail so lenders can understand.';
      console.log(JSON.stringify({ evt: 'loan_input_verdict', kind, len: text.length, ok, flagged: !ok }));
      await recordCheck({ user_id: userId, kind, text, ok, category: null, hint, suggestion: '' });
      return jsonResponse({ ok, hint });
   } catch (err) {
      console.error('check-loan-input error:', err);
      return jsonResponse({ ok: true, skipped: 'exception' }); // fail open
   }
});
