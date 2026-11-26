// Loan-timing questions typed to the Page by a known borrower (George 2026-11-20):
//
//   "kailan ko babayaran?" / "can I pay in 1 week?"   → we're not loan sharks: every loan has a set term (theirs),
//                                                       pay in the 2nd half of your loan (since 2026-11-27; was
//                                                       "the last week"), by the due day
//   "I want to repay now" (in the first half)          → please pay in the 2nd half; paying in the first
//                                                       half doesn't help your limit
//   "can I borrow again?" / 2 loans in one month        → we're for long-term credit builders; fast
//                                                       borrow-repay loops to push the limit don't work
//
// A cheap word check first, then Gemini says which one it is (no AI answer → a person handles it). Early repays
// and quick re-borrows are flagged to the team (⚠️ may be gaming the limit). Every message still becomes
// a support ticket; extension / can't-pay / problems aren't answered here at all.
import { secondHalfStartAt } from './creditAndPoints.ts';
import { GEMINI_MODEL } from './geminiPreScreen.ts';
import { getAdminChatId } from './loanAccess.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export type TimingIntent = 'term' | 'early' | 'again' | 'other';
export type Locale = 'en' | 'fil';

const DAY = 86_400_000;
/** Fallback when a loan has no funding time: the 2nd half of a 30-day loan. */
export const REPAY_WINDOW_DAYS = 15;
export const LOAN_TERM_DAYS = 31;

/** Worth asking the AI about at all? Pure. */
export const mentionsLoanTiming = (text: string) =>
   /\b(pay|repay|bayad|bayaran|magbayad|babayaran|balik|ibalik|due|deadline|kailan|when|days?|araw|week|linggo|month|buwan|early|maaga|agad|now|ngayon|borrow|hiram|utang|loan|pautang|again|ulit)\b/i.test(text);

/** Word-check fallback when the AI isn't available. Pure. */
export const guessIntent = (text: string): TimingIntent => {
   const t = text.toLowerCase();
   if (/\b(extend|extension|late|delay|hindi ko kaya|can'?t pay|cannot pay|walang pambayad|palugit)\b/.test(t)) return 'other';
   if (/\b(borrow|hiram|loan|utang|pautang)\b.*\b(again|ulit|another|isa pa|next)\b|\b(again|ulit|another|isa pa)\b.*\b(borrow|hiram|loan|utang)\b/.test(t)) return 'again';
   if (/\b(early|maaga|agad|now|ngayon|today|bukas|tomorrow)\b/.test(t) && /\b(pay|repay|bayad|bayaran|magbayad|balik)\b/.test(t)) return 'early';
   if (/\b(kailan|when|how long|ilang araw|how many days|deadline|due)\b/.test(t)) return 'term';
   return 'other';
};

export type OpenLoan = { funded_at: string | null; due_date: string | null; due_timezone: string | null; owed: number };

export const fmtDate = (iso: string, tz: string | null, locale: Locale) =>
   new Intl.DateTimeFormat(locale === 'fil' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric', timeZone: tz || 'Asia/Manila' }).format(new Date(iso));

/** When the loan's 2nd half starts (the best days to pay), same as the app's "Your next loan" card. Pure. */
export const payFromAt = (loan: Pick<OpenLoan, 'funded_at' | 'due_date' | 'due_timezone'> | null): Date | null => {
   if (!loan?.due_date) return null;
   return secondHalfStartAt(loan.funded_at, loan.due_date, loan.due_timezone) ?? new Date(Date.parse(loan.due_date) - REPAY_WINDOW_DAYS * DAY);
};

/** Before the 2nd half starts (so "paying now" is early). Pure. */
export const isEarly = (loan: OpenLoan | null, now: number) => {
   const from = payFromAt(loan);
   return from !== null && now < from.getTime();
};

/** The reply text. Pure. */
export const timingReply = (intent: Exclude<TimingIntent, 'other'>, loan: OpenLoan | null, locale: Locale, now: number): string => {
   const fil = locale === 'fil';
   const due = loan?.due_date ? fmtDate(loan.due_date, loan.due_timezone, locale) : null;
   const fromAt = payFromAt(loan);
   const from = fromAt ? fmtDate(fromAt.toISOString(), loan?.due_timezone ?? null, locale) : null;
   // Terms differ per loan (mostly ~30 days, some shorter): quote theirs, never one fixed number.
   const termDays = loan?.funded_at && loan.due_date ? Math.round((Date.parse(loan.due_date) - Date.parse(loan.funded_at)) / DAY) : null;
   const notShark = fil
      ? `Hindi kami loan shark 🙂 May takdang haba ang bawat Moodeng loan${termDays ? ` (ang sa iyo ay ${termDays} araw)` : ` (kadalasan mga isang buwan, hanggang ${LOAN_TERM_DAYS} araw)`}, at sumusunod kami sa patakaran para sa mga nagpapautang.`
      : `We're not a loan shark 🙂 Every Moodeng loan has a set term${termDays ? ` (yours is ${termDays} days)` : ` (usually about a month, up to ${LOAN_TERM_DAYS} days)`}, and we follow the rules for lenders.`;
   const window = due
      ? fil
         ? `Ang due date mo ay ${due}. Pinakamainam magbayad sa 2nd half ng loan mo: ${from} hanggang ${due}.`
         : `Your due date is ${due}. The best time to pay is the 2nd half of your loan: ${from} to ${due}.`
      : fil
        ? 'Pinakamainam magbayad sa 2nd half ng loan mo, hanggang sa due date.'
        : 'The best time to pay is the 2nd half of your loan, by your due date.';
   const builder = fil
      ? 'Para kami sa mga gustong bumuo ng credit nang pangmatagalan. Ganito tumataas ang limit mo: hiramin ang buong limit mo, at bayaran sa 2nd half ng loan.'
      : "We're here for long-term credit builders. This is how your limit grows: borrow your full limit, and pay it back in the 2nd half of the loan.";

   if (intent === 'term') return [notShark, window, builder].join('\n\n');
   if (intent === 'early') {
      if (!isEarly(loan, now)) {
         return fil
            ? `Salamat! Tamang oras na para magbayad. ${due ? `Due date: ${due}.` : ''} I-tap ang Repay sa ibaba.`
            : `Thank you! This is a good time to pay. ${due ? `Due date: ${due}.` : ''} Tap Repay below.`;
      }
      return [
         fil ? 'Salamat sa gustong magbayad agad! 🙏' : 'Thanks for wanting to pay early! 🙏',
         window,
         fil
            ? 'Ang pagbayad sa unang kalahati ng loan ay hindi nakakatulong sa limit mo, at puwede kang hindi makakuha ng rewards. Hindi rin namin tinatanggap ang paghiram at pagbayad nang mabilis para lang tumaas ang limit.'
            : "Paying in the first half of your loan doesn't help your limit, and you can miss rewards. Borrowing and repaying fast just to push your limit up doesn't work here.",
         builder
      ].join('\n\n');
   }
   // again
   return [
      fil
         ? 'Puwede kang humiram ulit, pero hindi maganda ang 2 loan sa isang buwan para sa credit mo. Tinatanggap namin ito, pero hindi kung para lang i-game ang system.'
         : "You can borrow again, but 2 loans in one month isn't good for your credit. We can accept it, just not when it's to game the system.",
      builder,
      loan?.due_date ? window : fil ? 'Pinakamainam magbayad sa 2nd half ng loan mo, hanggang sa due date.' : 'The best time to pay is the 2nd half of your loan, by your due date.'
   ].join('\n\n');
};

async function askGemini(svc: Svc, text: string): Promise<TimingIntent | null> {
   try {
      const { data: key } = await svc.rpc('gemini_api_key');
      if (typeof key !== 'string' || !key) return null;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
         signal: AbortSignal.timeout(8000),
         body: JSON.stringify({
            systemInstruction: {
               parts: [
                  {
                     text:
                        'A borrower of a small-loan app (Philippines, English/Tagalog/Taglish) messaged the support page. Classify the message. ' +
                        'Return JSON {"intent": one of "term" (asks how long the loan is / when they must pay back / how many days), ' +
                        '"early" (wants to pay back now or early, soon after borrowing), "again" (ONLY a plain question whether or when they can borrow again / take a second loan this month), ' +
                        '"other" (anything else, INCLUDING an app error or cooldown, uploading documents, asking for a higher limit, a limit that went down, vouchers or rewards, asking for more time, an extension, saying they cannot pay, a payment problem, or a complaint)}.'
                  }
               ]
            },
            contents: [{ role: 'user', parts: [{ text }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingLevel: 'low' } }
         })
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      const out = (json.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
      const intent = (JSON.parse(out || '{}') as { intent?: string }).intent;
      return intent === 'term' || intent === 'early' || intent === 'again' || intent === 'other' ? intent : null;
   } catch {
      return null;
   }
}

/** Answers loan-timing questions. Always false, so the message still becomes a support ticket for the team. */
export const handleLoanTimingMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      if (text.trim().length < 6 || !mentionsLoanTiming(text)) return false;
      const { data: switchRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'bot_loan_timing').maybeSingle();
      if (String((switchRow as { value?: string } | null)?.value ?? 'on').toLowerCase() === 'off') return false;

      // No AI answer → leave it to a person (the word check alone would swallow real support questions).
      const intent = await askGemini(svc, text);
      if (!intent || intent === 'other') return false;

      const now = Date.now();
      const [{ data: user }, { data: contact }, { data: loans }] = await Promise.all([
         svc.from('users').select('username, display_name, preferred_locale').eq('id', userId).maybeSingle(),
         svc.from('messenger_contacts').select('locale').eq('contact_id', contactId).maybeSingle(),
         svc
            .from('loans')
            .select('funded_at, due_date, due_timezone, total_repayment_amount, repaid_amount, repayment_status, loan_status, repaid_at, repayment_schedule')
            .eq('borrower_user_id', userId)
            .is('refunded_at', null)
            .order('created_at', { ascending: false })
            .limit(6)
      ]);
      type L = { repayment_schedule?: unknown; funded_at: string | null; due_date: string | null; due_timezone: string | null; total_repayment_amount: number | string | null; repaid_amount: number | string | null; repayment_status: string | null; loan_status: string | null; repaid_at: string | null };
      const rows = (loans ?? []) as L[];
      const openRow = rows.find((l) => l.loan_status === 'Lent' && l.repayment_status !== 'Paid');
      // Two-payment loans have their own part dates: a person answers those.
      if (openRow && (openRow as { repayment_schedule?: unknown }).repayment_schedule) return false;
      const open: OpenLoan | null = openRow
         ? {
              funded_at: openRow.funded_at,
              due_date: openRow.due_date,
              due_timezone: openRow.due_timezone,
              owed: Math.max(0, Number(openRow.total_repayment_amount ?? 0) - Number(openRow.repaid_amount ?? 0))
           }
         : null;
      // "early" with nothing open to pay: answer the timing rules instead.
      const asked: Exclude<TimingIntent, 'other'> = intent === 'early' && !open ? 'term' : intent;
      const locale: Locale = ((contact as { locale?: string } | null)?.locale ?? user?.preferred_locale) === 'fil' ? 'fil' : 'en';
      const reply = timingReply(asked, open, locale, now);
      const res = await sendMessengerMessage(contactId, {
         text: reply,
         card:
            asked === 'early' && open && !isEarly(open, now)
               ? { title: 'Repay on Moodeng Credit', button: { title: 'Repay', url: 'https://moodeng.app/repay' } }
               : undefined
      });
      if (!res.ok) {
         console.error('messenger-loan-timing: send failed', res.reason);
         return false; // let it become a ticket so a person answers
      }

      // ⚠️ Possible limit-gaming: wants to repay well before the last week, or another loan soon after one.
      const recentRepaid = rows.filter((l) => l.repaid_at && now - Date.parse(l.repaid_at) < 30 * DAY).length;
      const gaming = (asked === 'early' && isEarly(open, now)) || (asked === 'again' && recentRepaid > 0);
      if (gaming) {
         const who = user?.username ? `@${user.username}` : (user?.display_name ?? userId);
         const fundedDays = open?.funded_at ? Math.floor((now - Date.parse(open.funded_at)) / DAY) : null;
         const why =
            asked === 'early'
               ? `wants to repay now${fundedDays != null ? `, ${fundedDays} day${fundedDays === 1 ? '' : 's'} after funding` : ''}${open?.due_date ? ` (due ${fmtDate(open.due_date, open.due_timezone, 'en')})` : ''}`
               : `asks for another loan — ${recentRepaid} repaid in the last 30 days`;
         const chat = await getAdminChatId(svc);
         if (chat) {
            await sendTelegramMessage(
               chat,
               `⚠️ ${who} ${why}. May be gaming the limit.\nThe bot told them: pay in the last week before the due date; fast borrow-repay doesn't grow the limit.\nThey wrote: “${text.slice(0, 300)}”`
            ).catch(() => undefined);
         }
      }
      // Still a support ticket: the team sees the question and the bot's answer never hides a real problem.
      return false;
   } catch (err) {
      console.error('messenger-loan-timing: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
