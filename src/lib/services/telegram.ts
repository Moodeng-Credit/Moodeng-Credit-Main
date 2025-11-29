import axios from '@/lib/axios';

export const sendTelegramMessage = async (chatId: number, message: string) => {
   try {
      await axios.post(process.env.TELEGRAM_API_URL!, {
         chat_id: chatId,
         text: message,
         parse_mode: 'Markdown'
      });
   } catch (error: unknown) {
      console.error('Error sending Telegram message:', error instanceof Error ? error.message : 'Unknown error');
   }
};

export const setWebhook = async () => {
   try {
      await axios
         .post(process.env.TELEGRAM_WEBHOOK_API!, {
            url: process.env.TELEGRAM_WEBHOOK_URL
         })
         .then(() => {
            console.log('Webhook set successfully');
         })
         .catch((error) => {
            console.error('Error setting webhook:', error.response ? error.response.data : error.message);
         });
   } catch (error: unknown) {
      console.error('Error setting webhook:', error instanceof Error ? error.message : 'Unknown error');
   }
};

export const sendNewLoanNotification = (chatId: number, username: string, loanAmount: number, loanPurpose: string) => {
   const message = `🎉 Great news, ${username}! 🎉 Your microloan is now helping someone build a better future! 💪
💰 Amount: ${loanAmount}
🎯 Purpose: ${loanPurpose}

We'll keep you posted on repayments. You're amazing for making a difference! 🌟`;

   sendTelegramMessage(chatId, message);
};

export const sendRepaymentNotification = (
   chatId: number,
   lenderName: string,
   totalRepaymentAmount: number,
   borrowerName: string,
   remainingBalance: number
) => {
   const message = `💰 Repayment Alert! 💰 Great news, ${lenderName}! The person you helped has made a repayment! 🙌
✅ Received: ${totalRepaymentAmount}
👤 From: ${borrowerName}
🔄 Remaining: ${remainingBalance}

Your support is changing lives! Keep it up! 🌟`;

   sendTelegramMessage(chatId, message);
};

export const sendFullRepaymentNotification = (
   chatId: number,
   lenderName: string,
   fullLoanAmount: number,
   borrowerName: string,
   originalLoanPurpose: string
) => {
   const message = `🎊 Woohoo! Full Repayment Achieved! 🎊 ${lenderName}, the loan you provided is now fully repaid! 🏆
💰 Total Repaid: ${fullLoanAmount}
👤 Borrower: ${borrowerName}
🎯 Purpose: ${originalLoanPurpose}

You've made a real impact! Ready to help someone else? 💪🌍
👉 [Tap here to see more microloan requests](YOUR_LINK_HERE)`;

   sendTelegramMessage(chatId, message);
};

export const sendBorrowerReminder = (
   chatId: number,
   borrowerName: string,
   totalRepaymentAmount: number,
   dueDate: string,
   hoursLeft: number
) => {
   let urgency: string;
   switch (hoursLeft) {
      case 168:
         urgency = `⏰ Friendly Reminder, ${borrowerName}! ⏰ Your loan repayment is due in 1 week. 📅`;
         break;
      case 48:
         urgency = `⚠️ Heads up, ${borrowerName}! ⚠️ Your loan repayment is due in 48 hours! ⏳`;
         break;
      case 24:
         urgency = `🚨 Urgent Reminder, ${borrowerName}! 🚨 Your loan repayment is due TOMORROW! ⏰`;
         break;
      case 12:
         urgency = `🔥 FINAL ALERT, ${borrowerName}! 🔥 Your loan repayment is due in 12 HOURS! ⏰`;
         break;
      case 1:
         urgency = `🚨🚨 URGENT: 1 HOUR LEFT, ${borrowerName}! 🚨🚨 Your loan repayment is due in 1 HOUR! ⏰`;
         break;
      default:
         urgency = `⏰ Reminder, ${borrowerName}! Your loan repayment is due soon. ⏰`;
   }

   const message = `${urgency}
💰 Amount: ${totalRepaymentAmount}
📆 Due: ${dueDate}

Don't risk your credit score! 📉 Pay on time to keep your financial future bright! ✨
👉 [Tap here to repay now](YOUR_LINK_HERE)`;

   sendTelegramMessage(chatId, message);
};

export const sendSuccessfulRepaymentNotification = (
   chatId: number,
   borrowerName: string,
   fullLoanAmount: number,
   finalPaymentDate: string
) => {
   const message = `🎉🎉 Congratulations, ${borrowerName}! 🎉🎉 You've successfully repaid your loan! 🏆
💰 Total Repaid: ${fullLoanAmount}
📅 Final Payment: ${finalPaymentDate}

Your credit score is smiling! 😊`;

   sendTelegramMessage(chatId, message);
};
