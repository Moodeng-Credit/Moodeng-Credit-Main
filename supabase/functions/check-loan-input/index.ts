import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { alertDeepSeekFailure } from '../_shared/deepseekAlert.ts';

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
const parseVerdict = (raw: string): { ok?: boolean; hint?: string } | null => {
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

// DeepSeek model id. The legacy `deepseek-chat` alias is deprecated (retired
// 2026-07-24) and now just points at v4-flash, so we name it explicitly. Flash
// is the cheap non-thinking model — right choice for this short classify task.
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
// Cap how long we'll wait on the AI before failing open, so a slow/hung DeepSeek
// call never stalls the borrower's form submission.
const AI_TIMEOUT_MS = 6000;

type Kind = 'reason' | 'profession' | 'situation';

// Each field the borrower types gets its own rubric. The shared goal: is the input
// specific and understandable enough for a lender, or is it low-effort filler?
// Note profession: a SHORT answer ("teacher") is fine — we only flag unclear
// abbreviations, gibberish, or blanks. We never penalize brevity here.
const PROMPTS: Record<Kind, string> = {
   reason: `You screen loan-request reasons on a micro-lending app. Borrowers write a short reason so lenders understand what the money is for. The lenders reading these are in the US and Europe.

Reject the reason if EITHER is true:
1. It is not written in English. Borrowers are mostly Filipino, so Tagalog and Taglish are the common case — reject them even when the meaning is perfectly clear and specific. One borrowed word inside an otherwise-English sentence ("buying gamot for my mother") is fine; a sentence built on Tagalog grammar is not.
2. It shows no real effort: vague, generic, placeholder, gibberish, or copy-paste filler that could apply to anyone, instead of naming something specific the money will be used for.

Reply with ONLY a JSON object, no other text:
{"ok": true}  when the reason is in English and is specific and genuine
{"ok": false, "hint": "<one short, friendly sentence telling them what to fix>"}

Examples:
"for personal use" -> {"ok": false, "hint": "Too vague — say what you'll actually use the money for."}
"CSR" -> {"ok": false, "hint": "That doesn't tell lenders anything — describe your real need."}
"asdfghjkl" -> {"ok": false, "hint": "This looks like random text — write a real reason."}
"Pambayad sa tuition ng anak ko, sahod ako sa Friday" -> {"ok": false, "hint": "Please write this in English — the lenders reading it don't speak Tagalog."}
"Kailangan ko ng pambili ng gamot para sa nanay ko" -> {"ok": false, "hint": "Please write this in English so lenders can understand your need."}
"Rent due Friday, I'm $30 short until payday" -> {"ok": true}
"Buying medicine for my mother and transport to the clinic" -> {"ok": true}`,

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
      const kind: Kind = body.kind && PROMPTS[body.kind] ? body.kind : 'reason';
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
               temperature: 0,
               // Headroom so a longer hint never truncates mid-JSON (which parses as garbage).
               max_tokens: 200,
               response_format: { type: 'json_object' },
               messages: [
                  { role: 'system', content: PROMPTS[kind] },
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

      const ok = verdict.ok !== false; // default to allowing unless explicitly rejected
      // Verdict log — visible in the Supabase function logs. Content is NOT logged (only
      // its length), so this stays privacy-safe while letting us see how often the check
      // fires and on which field, to tune the bar.
      console.log(JSON.stringify({ evt: 'loan_input_verdict', kind, len: text.length, ok, flagged: !ok }));
      return jsonResponse({
         ok,
         hint: ok ? '' : (verdict.hint || 'Add more detail so lenders can understand.')
      });
   } catch (err) {
      console.error('check-loan-input error:', err);
      return jsonResponse({ ok: true, skipped: 'exception' }); // fail open
   }
});
