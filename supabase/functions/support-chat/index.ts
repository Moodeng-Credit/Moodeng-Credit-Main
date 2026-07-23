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
- Answer ONLY using the KNOWLEDGE BASE below. It is everything you know about Moodeng.
- Keep answers short and skimmable on a phone — a sentence or two, or a few short steps. Do not dump long walls of text.
- If a guide or walkthrough exists for what they asked, point them to it in plain words.
- Match the user's language. If they write in Tagalog/Taglish, reply the same way.

HARD RULES (never break these)
- If the answer is NOT in the knowledge base, do not guess. Say you are not sure and offer to connect them with the team.
- Never give investment, trading, or personalised financial advice, and never predict prices or returns. Moodeng loans are denominated in USDC; that is all.
- A Base Account is seedless. NEVER ask for, accept, or act on a seed phrase, recovery phrase, password, private key, or one-time code. If the user shares one, tell them to keep it secret and never share it with anyone — including you.
- Always make it clear a human is available. When money, a failed transfer, verification stuck for a long time, a possible bug, or user frustration is involved, proactively offer the human hand-off.
- You represent Moodeng. Never invent fees, features, dates, or policies that are not written below.
- Only describe menu paths, tab names, button labels, or screens that are written in the App Map or Site Map sections below. If you're not sure exactly where something lives in the app, say you're not sure rather than guessing a path.${localeHint}${stepHint}${pageHint}

RESPONSE FORMAT
Reply with ONLY a JSON object, no other text:
{"reply": "<your answer to the user>", "offer_human": <true|false>}
Set "offer_human" to true whenever you are unsure, the topic is money/transfers/verification-stuck/a-suspected-bug, or the user sounds frustrated or asks for a person.

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
               temperature: 0.3,
               max_tokens: MAX_TOKENS,
               response_format: { type: 'json_object' },
               messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...messages]
            })
         });
      } catch (err) {
         console.error('support-chat: DeepSeek fetch failed', err);
         return jsonResponse({ reply: handoffLine(context), offer_human: true, degraded: 'ai_unreachable' });
      } finally {
         clearTimeout(timeout);
      }

      if (!aiRes.ok) {
         console.error('support-chat: DeepSeek error', aiRes.status, await aiRes.text());
         // Debounced ping to the admin KYC group — otherwise Mecha degrades silently.
         await alertDeepSeekFailure('support-chat', aiRes.status);
         return jsonResponse({ reply: handoffLine(context), offer_human: true, degraded: 'ai_error' });
      }

      const data = await aiRes.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';

      let parsed: { reply?: string; offer_human?: boolean };
      try {
         parsed = JSON.parse(content);
      } catch {
         console.error('support-chat: unparseable AI content', content);
         // The model still produced prose — surface it rather than dropping it.
         const fallback = content.trim();
         return jsonResponse({
            reply: fallback || handoffLine(context),
            offer_human: !fallback
         });
      }

      const reply = (parsed.reply || '').trim() || handoffLine(context);
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
