import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendTelegramMessage } from '../_shared/telegram.ts';
import { alertDeepSeekFailure } from '../_shared/deepseekAlert.ts';
// Statically imported so Supabase's bundler always ships it (a runtime file read
// of knowledge.md would find nothing on the deployed function). Regenerate both
// with: node tools/build-support-knowledge.mjs
import { KNOWLEDGE } from './knowledge.ts';

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

// DeepSeek model id. The legacy `deepseek-chat` alias is deprecated (retired
// 2026-07-24) and now just points at v4-flash, so we name it explicitly. Flash
// is the cheap, fast non-thinking model — right choice for short grounded Q&A.
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
// Chat answers are longer than the loan-input classifier, so give DeepSeek more
// room before we give up and hand the user to a human.
const AI_TIMEOUT_MS = 20000;

// Bound the token cost of a single turn: only the most recent turns are sent, and
// each message is truncated. A support chat never needs deep history.
const MAX_HISTORY_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 2000;
const MAX_TOKENS = 500;

// Human hand-off copy is centralised so every fallback path says the same thing.
// Localized to match the user's chosen language (the chat UI offers EN + TL).
const HANDOFF_LINE_EN =
   "I'm not totally sure about this one — I don't want to guess about anything to do with your money. I can connect you with the Moodeng team, who can help directly.";
const HANDOFF_LINE_FIL =
   'Hindi ako sigurado dito — ayokong manghula sa kahit anong may kinalaman sa pera mo. Puwede kitang ikonekta sa Moodeng team na makakatulong nang direkta.';
const handoffLine = (context: ChatContext): string => (context.locale === 'fil' ? HANDOFF_LINE_FIL : HANDOFF_LINE_EN);

// Warm fallback for the rare case where the model returns nothing usable even
// after retries (a v4-flash blank-output degeneration). It must NOT sound like a
// cold refusal — it invites a rephrase and offers the human, so the ~few-percent
// residual still feels cared-for rather than stonewalled.
const EMPTY_FALLBACK_EN =
   "I want to make sure I get this right for you 🙂 — could you say that once more in a few words? Or I can connect you with the Moodeng team right now and they'll help you directly.";
const EMPTY_FALLBACK_FIL =
   'Gusto kong masagot ito nang tama para sa iyo 🙂 — pwede mo bang ulitin sa maikling salita? O pwede rin kitang ikonekta agad sa Moodeng team para matulungan ka nang direkta.';
const emptyFallback = (context: ChatContext): string =>
   context.locale === 'fil' ? EMPTY_FALLBACK_FIL : EMPTY_FALLBACK_EN;

// Best-effort per-IP throttle. The help hub is public + shareable, so a burst
// cap keeps one visitor (or script) from burning DeepSeek credit. In-memory per
// isolate — good enough as an abuse brake, not a billing guarantee.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 20;
const rateBuckets = new Map<string, { start: number; count: number }>();
const isRateLimited = (ip: string): boolean => {
   const now = Date.now();
   const bucket = rateBuckets.get(ip);
   if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
      if (rateBuckets.size > 5000) rateBuckets.clear(); // don't grow unbounded
      rateBuckets.set(ip, { start: now, count: 1 });
      return false;
   }
   bucket.count += 1;
   return bucket.count > RATE_MAX_PER_WINDOW;
};

const buildSystemPrompt = (context: ChatContext): string => {
   const stepHint = context.step
      ? `\n\nThe user is currently on this step of the app: "${context.step}". If they seem stuck, gently pre-empt the most common mistake for that step (for example, on the Base Account step, remind them NOT to download the Coinbase app).`
      : '';
   const pageHint = context.page ? `\nThe user is on the "${context.page}" screen.` : '';
   const localeHint =
      context.locale === 'fil'
         ? '\n\nThe user chose Tagalog — reply in warm, natural Tagalog/Taglish (the way Filipinos actually chat), unless they clearly switch to English.'
         : '';

   return `You are Mecha, a Moodeng Support Officer for Moodeng Credit — Moodeng's little robot helper who already guides new users through the in-app Academy (Moodeng is the hippo; you are the robot). You are warm, calm, and encouraging. Many users are in the Philippines and new to crypto, so keep language simple and reassuring. A little warmth and the occasional emoji are welcome, but stay concise.

HOW TO ANSWER
- Answer using the KNOWLEDGE BASE below. It is everything you know about Moodeng. Be genuinely helpful: if the answer is in there, GIVE IT — clearly and directly.
- Money topics are your job, not a reason to stop. Cashing out, repaying, adding USDC, wallets, and verification all have step-by-step help in the knowledge base — walk the user through it. Offering a human is IN ADDITION to helping, never a substitute for an answer you already have.
- Keep answers short and skimmable on a phone — a sentence or two, or a few short numbered steps. Do not dump long walls of text.
- Lead with the most reassuring concrete fact when there is one (e.g. "your first loan is $15", "if you pay late the amount never grows", "it takes about 3 minutes", "Moodeng charges $0").
- Follow the conversation. A short reply like "yes please", "how?", "the first one", "and then?", "and then what?", "what next", or "ok" is the user CONTINUING your previous message. Re-read your own last message and give the very next step(s) from the knowledge base. A short follow-up is NEVER a reason to hand off or say you're unsure.
  Example — you said: "First, send your USDC to your Coins.ph deposit address on Base." User replies: "and then what?" → You continue: "Next, on Coins.ph sell your USDC for pesos, then withdraw the pesos to your bank or GCash." (You do NOT say "I'm not sure.")
  If a follow-up is genuinely too vague to place, ask one short clarifying question — still never the hand-off line.
- Never return an empty answer. Always put a real, helpful sentence in "reply".
- When you name the best option, also give its steps. Don't stop at "Coins.ph is cheapest" — follow with how to use it. Don't half-answer.
- Give the complete facts when the knowledge base has them. If it lists a full scale (e.g. the Trust Score points for on-time/75%/50%/25%/late/default, or the IOU rewards), give the whole thing, not a partial "e.g."
- If someone sounds scared, anxious, angry, or overwhelmed about their money, LEAD WITH REASSURANCE before anything else: their funds are their own (Moodeng never holds them), the amount they owe never grows, and a real person is here to help. Only after reassuring do you troubleshoot or ask a question. Never answer a distressed message with just a clarifying question — that reads as cold.
- Match the user's language. If they write in Tagalog/Taglish, reply the same way.

HARD RULES (never break these)
- Only say you are not sure when the SPECIFIC fact the user needs is genuinely absent from the knowledge base. Do not bail on a topic that is covered just because it involves money. When you are truly missing a fact, give what you do know, then offer to connect them with the team.
- Never give investment, trading, or personalised financial advice, and never predict prices or returns. Moodeng loans are denominated in USDC; that is all. (Explaining how to cash out or repay is help, not financial advice — that is always fine.)
- A Base Account is seedless. NEVER ask for, accept, or act on a seed phrase, recovery phrase, password, private key, or one-time code. If the user shares one, tell them to keep it secret and never share it with anyone — including you.
- A human is always available. When a transfer failed, verification is stuck for a long time, something looks like a bug, or the user is frustrated, first respond with empathy and the best next step you have, THEN warmly offer the human hand-off.
- You represent Moodeng. Never invent fees, features, dates, or policies that are not written below.
- Never invent menu paths. Only name tabs, buttons, and screens exactly as they appear in the App Map or Site Map sections. If you don't know the exact location of something but you DO know how to do it, explain the steps without inventing a menu path.${localeHint}${stepHint}${pageHint}

RESPONSE FORMAT
Reply with ONLY a single valid JSON object and nothing else — no markdown, no code fences, no text before or after:
{"reply": "<your answer to the user>", "offer_human": <true|false>}
The value of "reply" must be one plain string with the whole answer. Escape any double-quotes and newlines inside it. Do not nest another JSON object inside "reply".
Set "offer_human" to true when you genuinely cannot fully resolve the issue — a failed/stuck transfer, verification stuck a long time, a suspected bug, the user is frustrated, or they ask for a person. If you fully answered a normal how-to question, set it to false.

===== KNOWLEDGE BASE =====
${KNOWLEDGE}
===== END KNOWLEDGE BASE =====`;
};

type Role = 'user' | 'assistant';
interface ChatMessage {
   role: Role;
   content: string;
}
interface ChatContext {
   page?: string;
   step?: string;
   locale?: string;
}

// Resolve the George + Emma team feed the same way every other notifier does:
// the DB setting first, then the env fallback. Reuses the existing feed so
// escalated support questions land where the team already looks.
const getTeamChatId = async (): Promise<string | undefined> => {
   try {
      const url = Deno.env.get('SUPABASE_URL') ?? '';
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (url && key) {
         const supabase = createClient(url, key);
         const { data } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
         const fromDb = data?.value as string | undefined;
         if (fromDb) return fromDb;
      }
   } catch (err) {
      console.error('support-chat: could not read team_group_chat_id', err);
   }
   return Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
};

const siteUrl = () => (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://app.moodeng.credit').replace(/\/$/, '');

// Escalate a chat to the team feed. The user pressed "talk to a person", so we
// hand the whole transcript over with a deep link back into the app.
const handleEscalate = async (messages: ChatMessage[], context: ChatContext, contact?: string): Promise<Response> => {
   if (!messages.some((m) => m.role === 'user')) {
      return jsonResponse({ ok: false, error: 'nothing_to_escalate' }, 400);
   }

   const chatId = await getTeamChatId();
   if (!chatId) {
      console.error('support-chat: team chat id not configured — cannot escalate');
      return jsonResponse({ ok: false, error: 'not_configured' }, 200);
   }

   const transcript = messages
      .map((m) => `${m.role === 'user' ? '🙋 User' : '🤖 Mecha'}: ${m.content}`)
      .join('\n')
      .slice(0, 3500);
   const where = context.step ? `step: ${context.step}` : context.page ? `page: ${context.page}` : 'unknown screen';
   const contactLine = contact ? `\n📇 Reach them: ${contact}` : '';
   const text = `🆘 <b>Mecha hand-off</b> — a user asked for a human.\n<i>${where}</i>${contactLine}\n\n${transcript}`;

   try {
      await sendTelegramMessage(chatId, text, {
         inlineKeyboard: [[{ text: 'Open Moodeng', url: siteUrl() }]]
      });
   } catch (err) {
      console.error('support-chat: telegram escalation failed', err);
      return jsonResponse({ ok: false, error: 'send_failed' }, 200);
   }

   console.log(JSON.stringify({ evt: 'support_chat_escalate', turns: messages.length, step: context.step ?? null, hasContact: Boolean(contact) }));
   return jsonResponse({ ok: true });
};

// Turn the model's response into a clean {reply, offer_human}. DeepSeek is asked
// for a JSON object, but occasionally returns it fenced, prefixed with prose, or
// slightly malformed (e.g. a stray `":"` after "reply"). We (1) try strict parse,
// (2) strip code fences and retry, (3) regex-extract the reply string, and only
// then (4) give up — so a broken envelope becomes a clean hand-off, never raw
// JSON shown to the user. A recovered reply that still looks like JSON is rejected.
const looksLikeJson = (s: string): boolean => /^\s*[{[]/.test(s) || /"offer_human"\s*:/.test(s);

const parseAiReply = (content: string): { reply: string; offer_human?: boolean } => {
   const tryParse = (s: string): { reply: string; offer_human?: boolean } | null => {
      try {
         const o = JSON.parse(s);
         if (o && typeof o.reply === 'string') {
            const r = o.reply.trim();
            if (r && !looksLikeJson(r)) return { reply: r, offer_human: o.offer_human === true };
         }
      } catch {
         /* fall through */
      }
      return null;
   };

   const raw = (content ?? '').trim();
   if (!raw) return { reply: '' };

   // 1) strict, then 2) de-fenced
   const defenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
   const direct = tryParse(raw) || tryParse(defenced);
   if (direct) return direct;

   // 3) regex-pull the reply value out of a malformed envelope, unescaping the
   //    common sequences. Take the largest match so we get the whole message.
   const m = defenced.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
   if (m) {
      const r = m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\').trim();
      // drop a leading stray punctuation artifact like `:"` seen in one bad response
      const cleaned = r.replace(/^[:"\s]+/, '').trim();
      if (cleaned && !looksLikeJson(cleaned)) {
         const wantsHuman = /"offer_human"\s*:\s*true/.test(defenced);
         return { reply: cleaned, offer_human: wantsHuman };
      }
   }

   // 4) plain prose with no JSON at all → use it as-is; otherwise give up (hand off)
   if (!looksLikeJson(raw)) return { reply: raw };
   console.error('support-chat: unrecoverable AI content', content.slice(0, 300));
   return { reply: '' };
};

// One call to DeepSeek. Separated out so we can make a second, looser attempt
// when the first returns nothing usable (v4-flash occasionally degenerates to a
// blank string under strict JSON mode on short/ambiguous follow-ups like
// "and then what?"). jsonMode=false + a higher temperature reliably breaks that.
interface DeepSeekResult {
   ok: boolean;
   status?: number;
   content?: string;
   networkError?: boolean;
}
const callDeepSeek = async (
   apiKey: string,
   systemPrompt: string,
   messages: ChatMessage[],
   opts: { jsonMode: boolean; temperature: number }
): Promise<DeepSeekResult> => {
   const ctrl = new AbortController();
   const timeout = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
   try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
         method: 'POST',
         signal: ctrl.signal,
         headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            temperature: opts.temperature,
            max_tokens: MAX_TOKENS,
            ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            messages: [{ role: 'system', content: systemPrompt }, ...messages]
         })
      });
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json();
      return { ok: true, content: data?.choices?.[0]?.message?.content ?? '' };
   } catch (err) {
      console.error('support-chat: DeepSeek fetch failed', err);
      return { ok: false, networkError: true };
   } finally {
      clearTimeout(timeout);
   }
};

// Keep only well-formed, non-empty turns; truncate over-long content; keep the tail.
const sanitizeMessages = (raw: unknown): ChatMessage[] => {
   if (!Array.isArray(raw)) return [];
   const cleaned: ChatMessage[] = [];
   for (const m of raw) {
      if (!m || typeof m !== 'object') continue;
      const role = (m as { role?: unknown }).role;
      const content = (m as { content?: unknown }).content;
      if (role !== 'user' && role !== 'assistant') continue;
      if (typeof content !== 'string') continue;
      const text = content.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!text) continue;
      cleaned.push({ role, content: text });
   }
   return cleaned.slice(-MAX_HISTORY_MESSAGES);
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

   try {
      const body = (await req.json().catch(() => ({}))) as {
         messages?: unknown;
         context?: ChatContext;
         action?: string;
         contact?: string;
      };

      const messages = sanitizeMessages(body.messages);
      const context: ChatContext = body.context && typeof body.context === 'object' ? body.context : {};

      // Answer-quality telemetry from the 👍/👎 buttons. Votes only — message
      // content stays on the device (matches the lengths-only turn telemetry).
      if (body.action === 'feedback') {
         const vote = (body as { vote?: unknown }).vote === 'up' ? 'up' : 'down';
         console.log(JSON.stringify({ evt: 'support_chat_feedback', vote, step: context.step ?? null, locale: context.locale ?? null }));
         return jsonResponse({ ok: true });
      }

      const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
      if (isRateLimited(ip)) {
         console.warn(JSON.stringify({ evt: 'support_chat_rate_limited', action: body.action ?? 'chat' }));
         if (body.action === 'escalate') return jsonResponse({ ok: false, error: 'rate_limited' }, 200);
         const limitLine =
            context.locale === 'fil'
               ? 'Ang bilis natin mag-chat! 😅 Sandali lang muna bago ang susunod na tanong.'
               : "We're chatting fast! 😅 Give it a few seconds before the next question.";
         return jsonResponse({ reply: limitLine, offer_human: false, degraded: 'rate_limited' });
      }

      // Hand-off to a human: post the transcript to the team feed.
      if (body.action === 'escalate') {
         const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 200) : undefined;
         return await handleEscalate(messages, context, contact || undefined);
      }

      // Must end on a user turn — nothing to answer otherwise.
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      if (!lastUser) {
         return jsonResponse({
            reply: 'Hi! I\'m Mecha 🤖 — ask me anything about Moodeng: verifying, wallets, borrowing, or cashing out.',
            offer_human: false
         });
      }

      const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
      if (!apiKey) {
         console.error('support-chat: DEEPSEEK_API_KEY not set');
         return jsonResponse({ reply: handoffLine(context), offer_human: true, degraded: 'no_api_key' });
      }

      const systemPrompt = buildSystemPrompt(context);

      // First attempt: low temperature, and NOT strict JSON mode. DeepSeek
      // v4-flash's `response_format: json_object` is what makes it degenerate to
      // a blank string on short/ambiguous inputs ("the cheapest one", "and then
      // what?", scared one-liners). We ask for JSON in the prompt instead and
      // parse leniently (parseAiReply handles fences, prose, and malformed JSON),
      // which removes the degeneration at the source.
      const first = await callDeepSeek(apiKey, systemPrompt, messages, { jsonMode: false, temperature: 0.3 });
      if (first.networkError) {
         return jsonResponse({ reply: handoffLine(context), offer_human: true, degraded: 'ai_unreachable' });
      }
      if (!first.ok) {
         console.error('support-chat: DeepSeek error', first.status);
         // Debounced ping to the admin KYC group — otherwise Mecha degrades silently.
         await alertDeepSeekFailure('support-chat', first.status ?? 0);
         return jsonResponse({ reply: handoffLine(context), offer_human: true, degraded: 'ai_error' });
      }

      let parsed = parseAiReply(first.content ?? '');

      // Retry-on-empty: the first attempt gave us nothing usable (blank string or
      // unrecoverable JSON — a v4-flash degeneration that hits ~40% of vague
      // follow-ups and short emotional messages). Retrying once still leaves ~20%
      // failing, so we make up to two looser attempts: no JSON straitjacket, an
      // escalating temperature to break the blank-output loop, and an explicit
      // instruction appended to the user's own last turn (small models weight the
      // user message heavily). This drops the false hand-off rate to a few %.
      if (!parsed.reply) {
         const nudge =
            systemPrompt +
            "\n\nIMPORTANT: Respond to the user's LAST message now, in plain warm text (no JSON, no code fences, never blank). " +
            "If it is a short follow-up like \"and then?\", \"the first one\", or \"the cheapest one\", continue your previous message with the next concrete steps or the specific option from the knowledge base. " +
            "If they sound worried, scared, or frustrated, reassure them first (their funds are their own, the amount owed never grows, a real person can help) and offer to connect them with the team. " +
            'Always give a real, helpful sentence.';
         const retryTemps = [0.7, 0.95];
         for (const temperature of retryTemps) {
            // Re-anchor the model on the actual question by appending a short
            // instruction to the last user turn (does not change what we log).
            const augmented = messages.map((m, i) =>
               i === messages.length - 1 && m.role === 'user'
                  ? { ...m, content: `${m.content}\n\n(Please answer this directly and helpfully using the Moodeng knowledge base — give the concrete steps or facts, never a blank or a refusal.)` }
                  : m
            );
            const retry = await callDeepSeek(apiKey, nudge, augmented, { jsonMode: false, temperature });
            if (retry.ok && retry.content) {
               const retryParsed = parseAiReply(retry.content);
               if (retryParsed.reply) {
                  parsed = retryParsed;
                  break;
               }
            }
         }
      }

      // If we couldn't recover a clean human sentence even after retries, give the
      // WARM fallback (invites a rephrase + offers the team) rather than the cold
      // hand-off line or — worse — raw/braced JSON (a malformed model response once
      // leaked `{"reply":...}` straight into the chat).
      const reply = parsed.reply || emptyFallback(context);
      const offerHuman = parsed.offer_human === true || !parsed.reply;

      // Privacy-safe telemetry: lengths only, never the message content.
      console.log(
         JSON.stringify({
            evt: 'support_chat_turn',
            turns: messages.length,
            q_len: lastUser.content.length,
            a_len: reply.length,
            offer_human: offerHuman,
            step: context.step ?? null
         })
      );

      return jsonResponse({ reply, offer_human: offerHuman });
   } catch (err) {
      console.error('support-chat error:', err);
      return jsonResponse({ reply: HANDOFF_LINE_EN, offer_human: true, degraded: 'exception' });
   }
});
