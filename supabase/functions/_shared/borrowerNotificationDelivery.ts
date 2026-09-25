import { sendEmail } from './email.ts';
import {
   buildLoanNotificationEmail,
   buildLoanNotificationTelegram,
   LoanNotificationAggregate,
   LoanNotificationLoan,
   LoanNotificationRecipient,
   LoanNotificationType
} from './loanNotifications.ts';
import { sendPushToUser } from './pushDelivery.ts';
import {
   buildDuePushPayload,
   buildFundedPushPayload,
   buildRepaymentReceivedPushPayload,
   buildRequestExpiredPushPayload,
   type PushLocale,
   type PushPayload
} from './pushMessages.ts';
import { type MessengerCard, sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

export type BorrowerNotificationDeliveryResult = {
   emailSent: boolean;
   telegramSent: boolean;
   pushSent: boolean;
   messengerSent: boolean;
};

const REMINDER_TYPES: LoanNotificationType[] = ['urgent_reminder', 'final_reminder', 'due_today', 'overdue'];

const formatUsdcAmount = (value: number | string | null | undefined) =>
   toNumber(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatDueDate = (value: string | null | undefined) =>
   value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;

/** What goes to Messenger for this notification type, or null for the types we don't send there. */
export const buildMessengerContent = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   aggregate: LoanNotificationAggregate | undefined
): { text: string; card?: MessengerCard } | null => {
   if (type === 'funded' && loan) {
      const dashboardUrl = buildPushPayloadForType('funded', loan, aggregate, 'en')?.url;
      const due = formatDueDate(loan.due_date);
      const repay = toNumber(loan.total_repayment_amount) > 0 ? `Repay ${formatUsdcAmount(loan.total_repayment_amount)} USDC` : 'Repay on time';
      return {
         text:
            `🎉 Great news, your loan is funded! ${formatUsdcAmount(loan.loan_amount)} USDC has been sent to your wallet.\n\n` +
            `${repay}${due ? ` by ${due}` : ''} to grow your credit level and unlock bigger loans.`,
         ...(dashboardUrl ? { card: { title: 'Your loan is funded', button: { title: 'Open Moodeng', url: dashboardUrl } } } : {})
      };
   }

   if (REMINDER_TYPES.includes(type)) {
      const payload = buildPushPayloadForType(type, loan, aggregate, 'en');
      return payload
         ? { text: `${payload.title}\n${payload.body}`, card: { title: 'Repay on Moodeng Credit', button: { title: 'Repay now', url: payload.url } } }
         : null;
   }

   return null;
};

const toNumber = (value: number | string | null | undefined) => {
   const amount = Number(value ?? 0);
   return Number.isFinite(amount) ? amount : 0;
};

/**
 * Maps a loan notification onto its push payload, or null for the types that
 * have no business interrupting someone's lock screen (the weekly digest and the
 * internal team feed).
 *
 * The due/overdue reminders need the aggregate — a borrower with three loans
 * closing on the same day should get one notification naming the combined
 * amount, not three that each look like the whole debt.
 */
const buildPushPayloadForType = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   aggregate: LoanNotificationAggregate | undefined,
   locale: PushLocale
): PushPayload | null => {
   switch (type) {
      case 'final_reminder':
      case 'urgent_reminder':
      case 'due_today':
      case 'overdue': {
         if (!aggregate) {
            return null;
         }
         return buildDuePushPayload(
            type,
            { loanCount: aggregate.count, totalAmount: aggregate.totalAmount, dueLabel: aggregate.dueLabel ?? '' },
            locale
         );
      }
      case 'funded':
         return buildFundedPushPayload({ amount: toNumber(loan?.loan_amount ?? aggregate?.totalAmount) }, locale);
      case 'repayment_received':
         return buildRepaymentReceivedPushPayload(
            { amount: toNumber(loan?.repaid_amount ?? loan?.total_repayment_amount ?? aggregate?.totalAmount) },
            locale
         );
      case 'request_expired':
         return buildRequestExpiredPushPayload(locale);
      default:
         return null;
   }
};

export const getTelegramBotSettingEnabled = async (supabase: any, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();

   if (error) {
      throw new Error(error.message);
   }

   return data?.value === 'true';
};

export const getBorrowerTelegramNotificationsEnabled = async (supabase: any) =>
   getTelegramBotSettingEnabled(supabase, 'borrower_notifications_enabled');

export const sendBorrowerLoanNotification = async (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   recipient: LoanNotificationRecipient,
   aggregate?: LoanNotificationAggregate,
   options: {
      telegramEnabled: boolean;
      /** If false the notification is suppressed entirely for this recipient */
      notifEnabled?: boolean;
      /**
       * Supply both to also deliver over Web Push. Omitted by callers that have
       * no Supabase client to hand, in which case behaviour is unchanged.
       */
      push?: { supabase: any; userId: string };
   } = { telegramEnabled: false }
): Promise<BorrowerNotificationDeliveryResult> => {
   // If the user has opted out of this notification category, skip silently
   if (options.notifEnabled === false) {
      return { emailSent: false, telegramSent: false, pushSent: false, messengerSent: false };
   }

   let emailSent = false;
   let telegramSent = false;
   let pushSent = false;
   let messengerSent = false;
   const recipientEmail = recipient.email?.trim();
   const telegramActionLabel =
      type === 'request_expired'
         ? 'Contact Support'
         : type === 'weekly_digest' || type === 'repayment_received'
           ? 'Open Dashboard'
           : 'Open Repay';

   // Each channel is attempted independently: a broken email provider (e.g. a revoked Resend key)
   // must not stop the Telegram and push copies going out. Only when nothing at all was delivered
   // does the first channel error propagate, so callers still see a hard failure.
   let firstError: unknown = null;

   if (recipientEmail) {
      try {
         const { subject, text, html } = buildLoanNotificationEmail(type, loan, recipient, aggregate);
         await sendEmail(recipientEmail, subject, text, html);
         emailSent = true;
      } catch (error) {
         firstError = error;
         console.error('Borrower email notification failed', {
            type,
            error: error instanceof Error ? error.message : String(error)
         });
      }
   }

   if (options.telegramEnabled && recipient.chat_id) {
      try {
         const { text, actionUrl } = buildLoanNotificationTelegram(type, loan, recipient, aggregate);
         await sendTelegramMessage(recipient.chat_id, text, {
            inlineKeyboard: [
               [
                  {
                     text: telegramActionLabel,
                     url: actionUrl
                  }
               ]
            ]
         });
         telegramSent = true;
      } catch (error) {
         console.error('Borrower Telegram notification failed', {
            type,
            chat_id: recipient.chat_id,
            error: error instanceof Error ? error.message : String(error)
         });
         firstError = firstError ?? error;
      }
   }

   // `buildPushPayloadForType` returns null for the types that get no push (and
   // for a due reminder with no aggregate), so probe once before fanning out.
   const hasPushCopy = buildPushPayloadForType(type, loan, aggregate, 'en') !== null;

   // Push is additive: it never blocks or fails the email/Telegram result, and a
   // recipient with no registered device simply gets nothing here.
   if (options.push && recipient.notif_push !== false && hasPushCopy) {
      try {
         const result = await sendPushToUser(
            options.push.supabase,
            options.push.userId,
            (locale) => buildPushPayloadForType(type, loan, aggregate, locale) as PushPayload,
            { urgency: type === 'overdue' || type === 'final_reminder' ? 'high' : 'normal' }
         );
         pushSent = result.sent > 0;
      } catch (error) {
         console.error('Borrower push notification failed', {
            type,
            error: error instanceof Error ? error.message : String(error)
         });
      }
   }

   // Messenger, for borrowers who confirmed their Facebook with the Page. Messenger only allows
   // free-form messages within 24h of the borrower's last message to the Page, so this lands only
   // for someone who wrote to us recently (sendMessengerMessage checks and skips otherwise). Like
   // push, it's additive and never fails the other channels.
   const messengerContent = recipient.messenger_psid ? buildMessengerContent(type, loan, aggregate) : null;
   if (recipient.messenger_psid && messengerContent) {
      const result = await sendMessengerMessage(recipient.messenger_psid, messengerContent);
      messengerSent = result.ok;
      if (!result.ok && result.reason !== 'outside_24h_window') {
         console.error('Borrower Messenger notification failed', { type, reason: result.reason });
      }
   }

   if (firstError && !emailSent && !telegramSent && !pushSent && !messengerSent) {
      throw firstError;
   }

   return { emailSent, telegramSent, pushSent, messengerSent };
};
