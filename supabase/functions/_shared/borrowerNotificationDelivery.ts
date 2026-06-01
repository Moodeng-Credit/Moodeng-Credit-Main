import { sendEmail } from './email.ts';
import {
   buildLoanNotificationEmail,
   buildLoanNotificationTelegram,
   LoanNotificationAggregate,
   LoanNotificationLoan,
   LoanNotificationRecipient,
   LoanNotificationType
} from './loanNotifications.ts';
import { sendTelegramMessage } from './telegram.ts';

export type BorrowerNotificationDeliveryResult = {
   emailSent: boolean;
   telegramSent: boolean;
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
   options: { telegramEnabled: boolean } = { telegramEnabled: false }
): Promise<BorrowerNotificationDeliveryResult> => {
   let emailSent = false;
   let telegramSent = false;
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

   return { emailSent, telegramSent };
};
