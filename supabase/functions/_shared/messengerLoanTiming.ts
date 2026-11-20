// Loan-timing questions typed to the Page by a known borrower (George 2026-11-20):
//
//   "kailan ko babayaran?" / "can I pay in 1 week?"   → we're not loan sharks: every loan is 31 days,
//                                                       pay in the last week before your due date
//   "I want to repay now" (days after borrowing)       → please pay in the week before your due date;
//                                                       paying right away doesn't help your limit
//   "can I borrow again?" / 2 loans in one month        → we're for long-term credit builders; fast
//                                                       borrow-repay loops to push the limit don't work
//
// A cheap word check first, then Gemini says which one it is (fallback: the word check). Early repays
// and quick re-borrows are flagged to the team (⚠️ may be gaming the limit). Extension / can't-pay
// messages are NOT answered here: they stay a support ticket for a person.
import { GEMINI_MODEL } from './geminiPreScreen.ts';
import { getAdminChatId } from './loanAccess.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export type TimingIntent = 'term' | 'early' | 'again' | 'other';
export type Locale = 'en' | 'fil';

const DAY = 86_400_000;
/** "Pay in the last week before your due date." */
export const REPAY_WINDOW_DAYS = 7;
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

const fmtDate = (iso: string, tz: string | null, locale: Locale) =>
   new Intl.DateTimeFormat(locale === 'fil' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric', timeZone: tz || 'Asia/Manila' }).format(new Date(iso));

/** Before the last-week window opens (so "paying now" is early). Pure. */
export const isEarly = (loan: OpenLoan | null, now: number) =>
   !!loan?.due_date && now < Date.parse(loan.due_date) - REPAY_WINDOW_DAYS * DAY;

/** The reply text. Pure. */
export const timingReply = (intent: Exclude<TimingIntent, 'other'>, loan: OpenLoan | null, locale: Locale, now: number): string => {
   const fil = locale === 'fil';
   const due = loan?.due_date ? fmtDate(loan.due_date, loan.due_timezone, locale) : null;
   const from = loan?.due_date ? fmtDate(new Date(Date.parse(loan.due_date) - REPAY_WINDOW_DAYS * DAY).toISOString(), loan.due_timezone, locale) : null;
   const notShark = fil
      ? `Hindi kami loan shark 🙂 Lahat ng Moodeng loan ay ${LOAN_TERM_DAYS} araw, at sumusunod kami sa patakaran para sa mga nagpapautang.`
      : `We're not a loan shark 🙂 Every Moodeng loan is ${LOAN_TERM_DAYS} days, and we follow the rules for lenders.`;
   const window = due
      ? fil
         ? `Ang due date mo ay ${due}. Pinakamainam magbayad sa huling linggo bago nito: ${from} hanggang ${due}.`
         : `Your due date is ${due}. The best time to pay is the last week before it: ${from} to ${due}.`
      : fil
        ? 'Pinakamainam magbayad sa huling linggo bago ang due date mo.'
        : 'The best time to pay is the last week before your due date.';
   const builder = fil
      ? 'Para kami sa mga gustong bumuo ng credit nang pangmatagalan. Ganito tumataas ang limit mo: isang loan, bayad sa tamang oras malapit sa due date.'
      : "We're here for long-term credit builders. This is how your limit grows: one loan, paid on time near the due date.";

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
            ? 'Ang pagbayad agad pagkatapos humiram ay hindi nakakatulong sa limit mo, at puwede kang hindi makakuha ng rewards. Hindi rin namin tinatanggap ang paghiram at pagbayad nang mabilis para lang tumaas ang limit.'
            : "Paying right after you borrow doesn't help your limit, and you can miss rewards. Borrowing and repaying fast just to push your limit up doesn't work here.",
         builder
      ].join('\n\n');
   }
   // again
   return [
      fil
         ? 'Puwede kang humiram ulit, pero hindi maganda ang 2 loan sa isang buwan para sa credit mo. Tinatanggap namin ito, pero hindi kung para lang i-game ang system.'
         : "You can borrow again, but 2 loans in one month isn't good for your credit. We can accept it, just not when it's to game the system.",
      builder,
      loan?.due_date ? window : fil ? `Ang bawat loan ay ${LOAN_TERM_DAYS} araw.` : `Each loan is ${LOAN_TERM_DAYS} days.`
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
                        '"early" (wants to pay back now or early, soon after borrowing), "again" (wants another loan right away, a second loan this month, or asks how to raise the limit fast), ' +
                        '"other" (anything else, INCLUDING asking for more time, an extension, saying they cannot pay, a payment problem, or a complaint)}.'
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

/** True when it was a loan-timing question and we answered it (so it isn't also a support ticket). */
export const handleLoanTimingMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      if (text.trim().length < 6 || !mentionsLoanTiming(text)) return false;
      const { data: switchRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'bot_loan_timing').maybeSingle();
      if (String((switchRow as { value?: string } | null)?.value ?? 'on').toLowerCase() === 'off') return false;

      const intent = (await askGemini(svc, text)) ?? guessIntent(text);
      if (intent === 'other') return false;

      const now = Date.now();
      const [{ data: user }, { data: contact }, { data: loans }] = await Promise.all([
         svc.from('users').select('username, display_name, preferred_locale').eq('id', userId).maybeSingle(),
         svc.from('messenger_contacts').select('locale').eq('contact_id', contactId).maybeSingle(),
         svc
            .from('loans')
            .select('funded_at, due_date, due_timezone, total_repayment_amount, repaid_amount, repayment_status, loan_status, repaid_at')
            .eq('borrower_user_id', userId)
            .is('refunded_at', null)
            .order('created_at', { ascending: false })
            .limit(6)
      ]);
      type L = { funded_at: string | null; due_date: string | null; due_timezone: string | null; total_repayment_amount: number | string | null; repaid_amount: number | string | null; repayment_status: string | null; loan_status: string | null; repaid_at: string | null };
      const rows = (loans ?? []) as L[];
      const openRow = rows.find((l) => l.loan_status === 'Lent' && l.repayment_status !== 'Paid');
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
      return true;
   } catch (err) {
      console.error('messenger-loan-timing: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
