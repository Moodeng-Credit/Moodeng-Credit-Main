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
}) => {
   try {
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) return;
      const { error } = await createClient(url, key).from('loan_input_checks').insert({ ...row, model: DEEPSEEK_MODEL });
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

      const body = (await req.json().catch(() => ({}))) as { text?: string; reason?: string; kind?: Kind };
      // Accept `text` (new) or `reason` (back-compat); default to the reason rubric.
      const text = (body.text ?? body.reason ?? '').trim();
      const kind: Kind = body.kind && KINDS.has(body.kind) ? body.kind : 'reason';
      const systemPrompt = kind === 'reason' ? `${LOAN_REASON_GUIDE}\n\n${REASON_OUTPUT_CONTRACT}` : PROMPTS[kind];
      if (!text) return jsonResponse({ ok: false, hint: 'Add a bit more so lenders can understand.' });

      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      let aiRes: Response;
      try {
         aiRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
               Authorization: `Bearer ${apiKey}`,
               'Content-Type': 'application/json'
            },
            body: JSON.stringify({
               model: DEEPSEEK_MODEL,
               // Thinking is on by default; this is a one-line classification, so skip it.
               thinking: { type: 'disabled' },
               temperature: 0,
               // Headroom for the hint and suggestion so the JSON never truncates.
               max_tokens: 400,
               response_format: { type: 'json_object' },
               messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `Input: "${text}"` }
               ]
            })
         });
      } catch (err) {
         // Timeout or network error — never block the borrower.
         console.error('check-loan-input: DeepSeek fetch failed', err);
         return jsonResponse({ ok: true, skipped: 'ai_unreachable' }); // fail open
      } finally {
         clearTimeout(timeout);
      }

      if (!aiRes.ok) {
         console.error('check-loan-input: DeepSeek error', aiRes.status, await aiRes.text());
         // Debounced ping to the admin KYC group — this check fails open, so
         // without the alert nobody would ever notice it's off.
         await alertDeepSeekFailure('check-loan-input', aiRes.status);
         return jsonResponse({ ok: true, skipped: 'ai_error' }); // fail open
      }

      const data = await aiRes.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const finishReason: string = data?.choices?.[0]?.finish_reason ?? '';

      const verdict = parseVerdict(content);
      if (!verdict) {
         // Log finish_reason so we can tell truncation ('length') from an empty/garbled body.
         console.error('check-loan-input: unparseable AI content', JSON.stringify({ finishReason, content }));
         return jsonResponse({ ok: true, skipped: 'parse_error' }); // fail open
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
         const suggestion = category === 'good' ? '' : (verdict.suggestion ?? '').trim().slice(0, 200);
         console.log(JSON.stringify({ evt: 'loan_input_verdict', kind, len: text.length, ok, category }));
         await recordCheck({ user_id: userId, kind, text, ok, category, hint, suggestion });
         return jsonResponse({ ok, category, hint, suggestion });
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
