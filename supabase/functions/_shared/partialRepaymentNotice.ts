// Borrower-facing "we got your payment, $X left" for a repayment that doesn't close the loan.
//
// Why: until this existed a partial repayment told the borrower nothing. In Oct 2026 a borrower repaid
// her whole loan two days after being funded (most likely an accidental tap on Repay when she meant
// Cash out), and nobody, her included, found out until she asked why she couldn't withdraw.
//
// Email + push + Messenger, each best-effort and independent. Sent once per payment (confirm-loan-payment
// runs once per payment hash), so there's no loan_notifications row. Never throws.

import { sendEmail } from './email.ts';
import { isPlaceholderEmail } from './placeholderEmail.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { buildPartialRepaymentPushPayload } from './pushMessages.ts';
import { sendMessengerMessage } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const siteUrl = () => (Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
const money = (amount: number) => `$${amount.toFixed(2)}`;
// Due dates are stored as midnight UTC of the due day.
const dueDay = (value: string | null) =>
   value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;

export type PartialRepaymentCopy = { subject: string; text: string; html: string; messenger: string };

export const buildPartialRepaymentCopy = (args: {
   name: string | null;
   paid: number;
   repaid: number;
   total: number;
   dueDate: string | null;
}): PartialRepaymentCopy => {
   const left = Math.max(args.total - args.repaid, 0);
   const due = dueDay(args.dueDate);
   const hi = `Hi ${args.name?.trim() || 'there'},`;
   const got = `We received your repayment of ${money(args.paid)} USDC.`;
   const status = `You've now paid ${money(args.repaid)} of ${money(args.total)}. ${money(left)} is left${due ? `, due ${due}` : ''}.`;
   const oops =
      "Didn't mean to make this payment? (For example, you wanted to cash out your loan, not pay it back.) Reply to this email or message us on Messenger right away and we'll help.";
   const url = `${siteUrl()}/repay`;

   return {
      subject: `We got your ${money(args.paid)} payment, ${money(left)} left`,
      text: `${hi}\n\n${got}\n${status}\n\n${oops}\n\nSee your loan: ${url}\n\nMoodeng Credit`,
      html:
         `<p>${hi}</p><p>${got}<br>${status}</p>` +
         `<p style="background:#fff7e0;border-radius:8px;padding:12px">${oops}</p>` +
         `<p><a href="${url}">See your loan</a></p><p>Moodeng Credit</p>`,
      messenger:
         `✅ ${got}\n${status}\n\n` +
         `⚠️ Didn't mean to pay? Reply here right away and we'll help.\n` +
         `(Hindi mo sinasadyang magbayad? Mag-reply ka agad dito at tutulungan ka namin.)`
   };
};

export const notifyBorrowerPartialRepayment = async (
   svc: SupabaseClient,
   loan: { id: string; tracking_id?: string | null; borrower_user_id: string | null; repaid_amount: unknown; total_repayment_amount: unknown; due_date: string | null; is_test?: boolean | null },
   paidNow: number
): Promise<{ emailSent: boolean; pushSent: boolean; messengerSent: boolean }> => {
   const result = { emailSent: false, pushSent: false, messengerSent: false };
   if (!loan.borrower_user_id || loan.is_test) return result;

   const { data: user } = await svc
      .from('users')
      .select('username, email, notif_push, messenger_psid')
      .eq('id', loan.borrower_user_id)
      .maybeSingle();
   if (!user) return result;

   const total = Number(loan.total_repayment_amount ?? 0);
   const repaid = Number(loan.repaid_amount ?? 0);
   const copy = buildPartialRepaymentCopy({ name: user.username, paid: paidNow, repaid, total, dueDate: loan.due_date });

   const email = (user.email as string | null)?.trim();
   if (email && !isPlaceholderEmail(email)) {
      try {
         await sendEmail(email, copy.subject, copy.text, copy.html);
         result.emailSent = true;
      } catch (err) {
         console.error('partialRepaymentNotice: email failed', err instanceof Error ? err.message : err);
      }
   }

   if (user.notif_push !== false) {
      try {
         const push = await sendPushToUser(svc, loan.borrower_user_id, (locale) =>
            buildPartialRepaymentPushPayload({ paid: paidNow, left: Math.max(total - repaid, 0) }, locale)
         );
         result.pushSent = push.sent > 0;
      } catch (err) {
         console.error('partialRepaymentNotice: push failed', err instanceof Error ? err.message : err);
      }
   }

   if (user.messenger_psid) {
      const sent = await sendMessengerMessage(user.messenger_psid, { text: copy.messenger });
      result.messengerSent = sent.ok;
      console.log(`[partialRepaymentNotice] Messenger for ${loan.tracking_id ?? loan.id} → ${sent.ok ? 'sent' : `not sent (${sent.reason})`}`);
   }

   return result;
};
