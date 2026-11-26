// The automatic first reply to a BORROWER on Messenger (George 2026-11-26): it reacts to what they
// actually wrote instead of the same canned line every time.
//
//   "My sari-sari store did great today!" → "Hi Ana! That's great news, congrats 🎉" + when the team replies
//   "I'm planning to pay on the 30th" → "Hi Ana! Thanks for telling us. Your due date is Dec 16, and the best
//                                       time to pay is Dec 9 to Dec 16." + when the team replies
//
// The AI writes ONE sentence; the "when George or Emma reply" line is ours, so hours are never made up.
// It never agrees to anything (dates, extensions, limits); a person still answers in the ticket.
// AI down, a bad answer or switch `messenger_smart_ack` = off → the old canned reply.
// People without an account keep the canned reply + sign-up card (buildAutoReply).
import { withToday } from './aiToday.ts';
import { GEMINI_MODEL } from './geminiModel.ts';
import { fmtDate, payFromAt } from './messengerLoanTiming.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

type Locale = 'en' | 'fil';

const DAY = 86_400_000;
// Earlier messages in the chat, so a short "if that's ok" makes sense to the AI.
const CONTEXT_WINDOW_MS = 3 * DAY;
const CONTEXT_MESSAGES = 6;
const MAX_REPLY_CHARS = 280;

export type AckLoan = { owed: number; due: string; payFrom: string };

export type AckFacts = {
   firstName: string | null;
   locale: Locale;
   /** Oldest first; the last one is what they just wrote. */
   messages: Array<{ from: 'them' | 'moodeng'; text: string }>;
   loan: AckLoan | null;
};

/** Ours, never the AI's: when a person will answer. Pure. */
export const ackStatusLine = (online: boolean, locale: Locale): string => {
   if (locale === 'fil') {
      return online
         ? 'Sasagot dito si George o Emma sa lalong madaling panahon.'
         : 'Offline kami hanggang 10 AM oras sa Thailand (11 AM sa Pilipinas), sasagot si George o Emma pagkatapos.';
   }
   return online
      ? 'George or Emma will reply right here soon.'
      : "We're offline until 10 AM Thai time (11 AM Philippine time), George or Emma will reply then.";
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** The system prompt. Pure. */
export const ackPrompt = (facts: AckFacts): string => {
   const hi = facts.firstName ? `Hi ${facts.firstName}!` : 'Hi!';
   const loan = facts.loan
      ? `Their open loan: they owe ${money(facts.loan.owed)}, due ${facts.loan.due}. The best time to pay is the 2nd half of the loan: ${facts.loan.payFrom} to ${facts.loan.due}.`
      : 'They have no open loan right now. Do not mention any amounts or dates.';
   return [
      'You write the automatic first reply from Moodeng Credit, a small-loan app for people in the Philippines, to a borrower who just messaged its Facebook Page.',
      'Write ONE short, warm sentence (at most 25 words). A second line saying when George or Emma from the team will reply is added after yours automatically, so do not say that, and do not say you are a bot.',
      `Rules:`,
      `- Start with "${hi}"`,
      '- React to what they actually wrote in their LAST message (earlier messages are only context): celebrate good news, thank them for an update, say you got the photo.',
      `- Write in ${facts.locale === 'fil' ? 'Filipino/Taglish' : 'the language of their message (English, Tagalog or Taglish)'}, simple words. At most one emoji. No links. Do not ask them anything.`,
      '- NEVER agree to, approve, promise or refuse anything: not a pay date, more time, an extension, a new loan, a higher limit, a reward, a call or a document. Never write "sure", "okay", "no problem" or "that\'s fine" to a request. If they ask or propose something, thank them and say the team will check.',
      '- If their message is about paying back or their due date (for example a date they plan to pay), thank them and tell them their due date and the best time to pay, from these facts and nothing else about money (otherwise do not mention money or dates):',
      `  ${loan}`,
      '- Never make up facts, numbers or dates.',
      'Return JSON {"reply": "<your sentence>"}.'
   ].join('\n');
};

/** Keeps a model answer only if it's safe to send as-is. Pure. */
export const cleanAck = (raw: string | null | undefined, facts: AckFacts): string | null => {
   let text = (raw ?? '').replace(/\s+/g, ' ').trim();
   text = text.replace(/^["“']+|["”']+$/g, '').trim();
   if (!text || text.length > MAX_REPLY_CHARS) return null;
   if (/https?:|www\.|\.com\b|\.app\b/i.test(text)) return null;
   // Agreeing to or deciding something is the team's call.
   if (/\b(approved?|na-?approve|extension|extend(ed)?|palugit|guarantee)\b/i.test(text)) return null;
   if (/^(hi\b[^.!?]*[.!?]\s*)?(sure|okay|ok|no problem|that'?s (fine|ok))\b/i.test(text)) return null;
   // Any amount must be the one they actually owe.
   const amounts = text.match(/\$\s?\d+(\.\d+)?/g) ?? [];
   if (amounts.length && (!facts.loan || amounts.some((a) => Number(a.replace(/[$\s]/g, '')) !== facts.loan!.owed))) return null;
   if (!/[.!?…🎉🙏💚👏🫶😊🙂]$/u.test(text)) text = `${text}.`;
   return text;
};

async function askGemini(svc: Svc, facts: AckFacts, now: number): Promise<string | null> {
   try {
      const { data: key } = await svc.rpc('gemini_api_key');
      if (typeof key !== 'string' || !key) return null;
      const chat = facts.messages.map((m) => `${m.from === 'them' ? 'Borrower' : 'Moodeng'}: ${m.text}`).join('\n');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
         signal: AbortSignal.timeout(8000),
         body: JSON.stringify({
            systemInstruction: { parts: [{ text: withToday(ackPrompt(facts), now) }] },
            contents: [{ role: 'user', parts: [{ text: chat }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 2000, thinkingConfig: { thinkingLevel: 'low' } }
         })
      });
      if (!res.ok) {
         console.error('messenger-smart-ack: gemini', res.status);
         return null;
      }
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      const out = (json.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
      return (JSON.parse(out || '{}') as { reply?: string }).reply ?? null;
   } catch (err) {
      console.error('messenger-smart-ack: failed', err instanceof Error ? err.message : err);
      return null;
   }
}

type LoanRow = {
   funded_at?: string | null;
   due_date: string | null;
   due_timezone: string | null;
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   repayment_status: string | null;
   loan_status: string | null;
   repayment_schedule: unknown;
};

/** Their one open loan, as the AI may quote it (two-payment loans: none, a person answers those). */
const loadLoan = async (svc: Svc, userId: string, locale: Locale): Promise<AckLoan | null> => {
   const { data } = await svc
      .from('loans')
      .select('funded_at, due_date, due_timezone, total_repayment_amount, repaid_amount, repayment_status, loan_status, repayment_schedule')
      .eq('borrower_user_id', userId)
      .is('refunded_at', null)
      .order('created_at', { ascending: false })
      .limit(6);
   const open = ((data ?? []) as LoanRow[]).filter((l) => l.loan_status === 'Lent' && l.repayment_status !== 'Paid');
   if (open.length !== 1 || open[0].repayment_schedule || !open[0].due_date) return null;
   const loan = open[0];
   const owed = Math.round(Math.max(0, Number(loan.total_repayment_amount ?? 0) - Number(loan.repaid_amount ?? 0)) * 100) / 100;
   if (!owed) return null;
   const from = payFromAt({ funded_at: loan.funded_at ?? null, due_date: loan.due_date, due_timezone: loan.due_timezone });
   return {
      owed,
      due: fmtDate(loan.due_date!, loan.due_timezone, locale),
      payFrom: fmtDate((from ?? new Date(loan.due_date!)).toISOString(), loan.due_timezone, locale)
   };
};

const loadChat = async (svc: Svc, conversationId: string, latest: string, at: number) => {
   const { data } = await svc
      .from('widget_messages')
      .select('sender, body, created_at')
      .eq('conversation_id', conversationId)
      .gte('created_at', new Date(at - CONTEXT_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(CONTEXT_MESSAGES + 1);
   const rows = ((data ?? []) as Array<{ sender: string; body: string | null }>).reverse();
   const messages = rows
      .filter((r) => r.body && r.sender !== 'system')
      .map((r) => ({ from: r.sender === 'visitor' ? ('them' as const) : ('moodeng' as const), text: r.body!.replace(/https:\/\/\S*fbcdn\.net\S*/g, '(photo)').slice(0, 400) }));
   // The message being answered may already be saved as the last row; make sure it's last either way.
   if (messages.at(-1)?.text !== latest) messages.push({ from: 'them', text: latest });
   return messages.slice(-CONTEXT_MESSAGES);
};

/** The smart reply text, or null → send the canned one. */
export const smartAckText = async (
   svc: Svc,
   opts: { userId: string; conversationId: string; firstName: string | null; locale: Locale; online: boolean; latest: string; at: number }
): Promise<string | null> => {
   try {
      const { data: switchRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'messenger_smart_ack').maybeSingle();
      if (String((switchRow as { value?: string } | null)?.value ?? 'on').toLowerCase() === 'off') return null;
      const latest = opts.latest.replace(/https:\/\/\S*fbcdn\.net\S*/g, '(photo)').trim();
      if (!latest) return null;
      const [loan, messages] = await Promise.all([loadLoan(svc, opts.userId, opts.locale), loadChat(svc, opts.conversationId, latest, opts.at)]);
      const facts: AckFacts = { firstName: opts.firstName, locale: opts.locale, messages, loan };
      const line = cleanAck(await askGemini(svc, facts, opts.at), facts);
      if (!line) return null;
      return `${line} ${ackStatusLine(opts.online, opts.locale)}`;
   } catch (err) {
      console.error('messenger-smart-ack: failed', err instanceof Error ? err.message : err);
      return null;
   }
};
