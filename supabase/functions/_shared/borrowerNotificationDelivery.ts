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
import { sendTelegramMessage } from './telegram.ts';

export type BorrowerNotificationDeliveryResult = {
   emailSent: boolean;
   telegramSent: boolean;
   pushSent: boolean;
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
   const { data, error } = await supabase
      .from('telegram_bot_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

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
      return { emailSent: false, telegramSent: false, pushSent: false };
   }

   let emailSent = false;
   let telegramSent = false;
   let pushSent = false;
   const recipientEmail = recipient.email?.trim();
   const telegramActionLabel =
      type === 'request_expired'
         ? 'Contact Support'
         : type === 'weekly_digest' || type === 'repayment_received'
           ? 'Open Dashboard'
           : 'Open Repay';

   if (recipientEmail) {
      const { subject, text, html } = buildLoanNotificationEmail(type, loan, recipient, aggregate);
      await sendEmail(recipientEmail, subject, text, html);
      emailSent = true;
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

         if (!emailSent) {
            throw error;
         }
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

   return { emailSent, telegramSent, pushSent };
};
