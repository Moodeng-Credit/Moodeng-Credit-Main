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

export const sendBorrowerLoanNotification = async (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   recipient: LoanNotificationRecipient,
   aggregate?: LoanNotificationAggregate,
   options: { telegramEnabled: boolean } = { telegramEnabled: false }
): Promise<BorrowerNotificationDeliveryResult> => {
   let emailSent = false;
   let telegramSent = false;

   if (recipient.email) {
      const { subject, text } = buildLoanNotificationEmail(type, loan, recipient, aggregate);
      await sendEmail(recipient.email, subject, text);
      emailSent = true;
   }

   if (options.telegramEnabled && recipient.chat_id) {
      const { text, actionUrl } = buildLoanNotificationTelegram(type, loan, recipient, aggregate);
      await sendTelegramMessage(recipient.chat_id, text, {
         inlineKeyboard: [[{ text: type === 'weekly_digest' ? 'Open Dashboard' : 'Open Repay', url: actionUrl }]]
      });
      telegramSent = true;
   }

   return { emailSent, telegramSent };
};
