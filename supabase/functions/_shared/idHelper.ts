// Indonesia track: the AI helper (docs/INDONESIA_TRACK.md "Hand-holding").
//
// An Indonesia-track borrower types a question in the bot's private chat (not the menu words, and not
// while a human support chat is open): DeepSeek Flash answers in very simple Bahasa (or English) from
// the step-by-step guides and their own loan's state, and suggests the guide to open. When it isn't
// sure, or it's about money that's missing, a complaint, changing a loan or anything only a person can
// do, it hands off: the webhook opens a support chat and forwards the question to the team.
//
// It only explains. It never records, approves, changes amounts or dates, or asks for PINs/codes.
// Every question is logged in id_ai_questions (rate limit: id_ai_daily_limit per borrower per day).
// Switch: telegram_bot_settings.id_ai_helper = on|off. Never throws.

import { GUIDES, guideButton, helpButton, waltButton } from './idGuides.ts';
import { formatRp, ID_GUIDE_KEYS, type IdGuideKey, idCallback, idUsdLeft, isIdMenuText, isIdQuestionText } from './idLoanMath.ts';
import { idLocaleOf, type IdLocale, loadIdStatus } from './idTrack.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const MODEL = 'deepseek-flash';
const TIMEOUT_MS = 9_000;

export type HelperReply = { answer: string; guide: IdGuideKey | null; handoff: boolean };

/**
 * Parse and sanity-check the model's JSON. Anything odd → hand off. Exported for tests.
 * `allowedHandles`: the only @usernames an answer may name (Moodeng's Walt, @wallet, our bot).
 */
export const parseHelperReply = (raw: unknown, allowedHandles: string[] = []): HelperReply => {
   const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
   const answer = typeof o.answer === 'string' ? o.answer.trim().slice(0, 900) : '';
   const guide = typeof o.guide === 'string' && (ID_GUIDE_KEYS as readonly string[]).includes(o.guide) ? (o.guide as IdGuideKey) : null;
   const confident = o.confident === true;
   const handoff = o.handoff === true || !confident || !answer;
   // Belt and braces: never pass on an answer that points money somewhere else (an address, or an
   // @username that isn't ours).
   const allowed = new Set(['wallet', ...allowedHandles].map((h) => h.replace(/^@/, '').toLowerCase()));
   const handles = [...answer.matchAll(/@([A-Za-z0-9_]{3,32})/g)].map((m) => m[1].toLowerCase());
   const unsafe = /0x[0-9a-f]{6,}/i.test(answer) || handles.some((h) => !allowed.has(h));
   return { answer: unsafe ? '' : answer, guide, handoff: handoff || unsafe };
};

const guideDigest = (waltUsername: string) =>
   ID_GUIDE_KEYS.map((k) => {
      const g = GUIDES[k];
      return `[${k}] ${g.title.en}\n${g.steps.map((s, i) => `${i + 1}. ${s.text.en.replaceAll('{walt}', waltUsername)}`).join('\n')}${g.warning ? `\n${g.warning.en}` : ''}`;
   }).join('\n\n');

const systemPrompt = (waltUsername: string) => `You help Indonesian borrowers of Moodeng, a small-loan app that lives inside Telegram.
Most have never used a crypto wallet and many read slowly. Write like you're explaining to a 10-year-old:
very short sentences, one idea per line, no jargon, max 5 lines. Use the borrower's language: Bahasa Indonesia
(casual, "kamu") unless they write English.

Facts (never contradict them):
- Loans are $5 first, $10 after repaying on time. They pick a rupiah total to pay back; it never changes.
- The loan arrives in their Walt (the wallet inside Telegram, @wallet) as USDT (1 USDT = 1 dollar). USDC = same thing.
- In Walt the balance shows as "Dollars" (USDT). Walt's home buttons: Transfer, Deposit, Withdraw, Exchange.
- To get rupiah: Walt → Withdraw → P2P Express → "Dollars" → Continue → check IDR at the top → amount (in Rp, minimum
  about 1.7 USDT) → "Sell … USDT" → bank or e-wallet (DANA, GoPay, OVO). P2P only works in the Telegram phone or
  desktop app, not Telegram Web.
- To buy USDT: Walt → Deposit → (IDR) P2P Express → "Dollars" → Continue → amount → "Choose payment method" (DANA, BRI,
  SEA Bank; more under "Show more") → "Search for a seller" → pay the seller exactly → "I've paid". QRIS is also offered.
- To pay back: tap 💰 Bayar in the bot menu, buy USDT if needed, then Walt → Transfer → type/paste the amount →
  "Choose Recipient" → 4-digit wallet passcode → @${waltUsername} (free), then tap "✅ Sudah kirim". Never Withdraw to an
  address to pay us (it has a fee). Never pay anyone else.
- Forgot the Walt passcode: Walt shows "Forgot passcode?" on that screen; we can't reset it.
- Moodeng never asks for a PIN, password or code. Moodeng takes no fees from the loan.
- Late payments are recorded and can close the account.

Guides you can point to (key in brackets):
${guideDigest(waltUsername)}

Their account right now is in the user message. Answer ONLY from these facts and that state.
Hand off to a human (handoff=true) when: money they sent or expected is missing, a payment isn't recorded,
they want a different amount/date/extension, complaints, account closed, anything about approval decisions,
anything you're not sure of, or they ask for a person.

Reply with only this JSON:
{"answer":"...","guide":"how|uname|walt|cash|buy|send|null","confident":true,"handoff":false}
- answer: what to tell them (when handoff=true: one kind line saying the team will reply here soon).
- guide: the one guide that helps most, or null.`;

const ask = async (system: string, user: string): Promise<{ data: unknown; ms: number; error?: string }> => {
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
            temperature: 0.2,
            max_tokens: 400,
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

const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   try {
      const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
      return (data?.value as string | undefined) ?? null;
   } catch {
      return null;
   }
};

/** A plain-English line about their loan for the model (no names, no numbers it could mis-copy beyond these). */
const accountState = async (svc: Svc, userId: string): Promise<string> => {
   try {
      const { data: loans } = await svc
         .from('loans')
         .select('loan_status, repayment_status, loan_amount, repay_idr, repaid_idr, total_repayment_amount, repaid_amount, due_date, created_at')
         .eq('borrower_user_id', userId)
         .is('refunded_at', null)
         .order('created_at', { ascending: false })
         .limit(3);
      const list = (loans ?? []) as Array<Record<string, unknown>>;
      const active = list.find((l) => l.loan_status === 'Lent' && l.repayment_status !== 'Paid');
      const open = list.find((l) => l.loan_status === 'Requested');
      const { data: rate } = await svc.rpc('current_usd_idr');
      if (active) {
         const left = idUsdLeft(active as never, Number(rate) || null);
         return `Active loan: $${active.loan_amount}, due ${String(active.due_date ?? '').slice(0, 10)}, left to pay ${left.idr != null ? formatRp(left.idr) : ''} (≈ $${left.usd}).`;
      }
      if (open) return `Loan request for $${open.loan_amount} posted ${String(open.created_at).slice(0, 10)}, waiting to be sent to their Walt.`;
      const paid = list.find((l) => l.repayment_status === 'Paid');
      const next = (await loadIdStatus(svc, userId))?.next;
      return paid ? 'No loan now; their last loan is fully paid.' : `No loan yet.${next ? ` Sign-up next step: ${next}.` : ''}`;
   } catch {
      return 'Unknown.';
   }
};

export type HelperOutcome = 'answered' | 'handoff' | false;

/**
 * A typed question in the private chat. 'answered' = we replied; 'handoff' = the caller should open a
 * support chat and forward the message; false = not ours (not an ID user, helper off, not a question).
 * The caller checks first that no human support chat is open.
 */
export const handleIdFreeText = async (
   svc: Svc,
   message: { text?: string; chat: { id: number; type?: string }; from?: { id: number } },
   user: { id: string; preferred_locale: string | null } | null
): Promise<HelperOutcome> => {
   if (!user || message.chat.type !== 'private') return false;
   const text = String(message.text ?? '').trim();
   if (!isIdQuestionText(text) || isIdMenuText(text)) return false;
   if (String((await getSetting(svc, 'id_ai_helper')) ?? 'on').trim().toLowerCase() === 'off') return false;
   const l: IdLocale = /^[ -~\s]*$/.test(text) && /\b(the|how|what|my|loan|pay|money|when|where|why|help)\b/i.test(text) ? 'en' : idLocaleOf(user.preferred_locale);

   // Rate limit: past it, a person answers.
   const limit = Math.max(0, Number(await getSetting(svc, 'id_ai_daily_limit')) || 20);
   const { count } = await svc
      .from('id_ai_questions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
   if ((count ?? 0) >= limit) return 'handoff';

   const waltUsername = ((await getSetting(svc, 'id_walt_username')) ?? 'jimmymoodengcredit').replace(/^@/, '');
   const state = await accountState(svc, user.id);
   const r = await ask(systemPrompt(waltUsername), `Their account: ${state}\n\nTheir message: ${text.slice(0, 600)}`);
   const botUsername = (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? 'moodengnewbranchbot').trim();
   const reply = r.data ? parseHelperReply(r.data, [waltUsername, botUsername]) : { answer: '', guide: null, handoff: true };
   await svc
      .from('id_ai_questions')
      .insert({ user_id: user.id, question: text.slice(0, 1000), answer: reply.answer || null, guide: reply.guide, handoff: reply.handoff, ms: r.ms, error: r.error ?? null })
      .then(
         () => undefined,
         () => undefined
      );

   const keyboard: TelegramInlineKeyboard = [];
   if (reply.guide) keyboard.push([guideButton(l, reply.guide)]);
   if (reply.guide === 'cash' || reply.guide === 'buy' || reply.guide === 'send' || reply.guide === 'walt') keyboard.push([waltButton(l)]);
   if (reply.handoff) {
      const line =
         reply.answer ||
         (l === 'en' ? '🙋 I’ll pass this to our team — they’ll reply right here soon.' : '🙋 Saya sambungkan ke tim kami — mereka akan balas di chat ini sebentar lagi.');
      await sendTelegramMessage(message.chat.id, line, keyboard.length ? { inlineKeyboard: keyboard } : {}).catch(() => undefined);
      return 'handoff';
   }
   keyboard.push([helpButton(l)], [{ text: '☰ Menu', callback_data: idCallback.menu('menu') }]);
   const footer = l === 'en' ? '\n\n🤖 Automatic answer. Still stuck? Tap "Chat with us".' : '\n\n🤖 Jawaban otomatis. Masih bingung? Tekan "Chat tim".';
   await sendTelegramMessage(message.chat.id, `${reply.answer}${footer}`, { inlineKeyboard: keyboard }).catch(() => undefined);
   return 'answered';
};
