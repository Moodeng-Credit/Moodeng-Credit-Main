import type { NextRequest } from 'next/server';

import { z } from 'zod';

import Loan from '@/lib/models/Loan';
import User from '@/lib/models/User';
import { objectIdSchema, usernameSchema, walletAddressSchema } from '@/lib/schemas/fields';
import { sendMail } from '@/lib/services/email';
import { sendBorrowerReminder, sendNewLoanNotification } from '@/lib/services/telegram';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

const assignLoanUserSchema = z.object({
   _id: objectIdSchema,
   username: usernameSchema,
   wallet: walletAddressSchema
});

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const loan = await Loan.findById(data._id);
         if (!loan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         const user = await User.findOne({ username: data.username });
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         if (!loan.lenderUser) {
            loan.lenderWallet = data.wallet;
            loan.lenderUser = data.username;

            try {
               if (user.chatId) {
                  await sendNewLoanNotification(user.chatId, user.username, loan.loanAmount, loan.reason);
               }

               await sendMail(
                  user.email,
                  'Your Support is Making a Difference!',
                  `Dear ${user.username},\nGreat news! The microloan you provided is now helping someone build a better future.\nLoan Details:\nAmount: ${loan.loanAmount}\nPurpose: ${loan.reason}\nThank you for being part of the global financial inclusion movement. We'll keep you updated on the repayment progress.\nBest regards, The Moodeng Team`
               );
            } catch (error) {
               console.error('Error occurred while sending lender notifications:', error);
            }
         } else if (!loan.borrowerUser) {
            loan.borrowerWallet = data.wallet;
            loan.borrowerUser = data.username;
            user.nal = user.nal + 1;
            await user.save();

            try {
               if (user.chatId) {
                  sendBorrowerReminder(user.chatId, user.username, loan.loanAmount, loan.days.toString(), 168);
               }

               await sendMail(
                  user.email,
                  'Friendly Reminder: Your Loan Repayment is Due Soon',
                  `Dear ${user.username},\nThis is a friendly reminder that your loan repayment is due in ${loan.days} days.\nRepayment Details:\nAmount: ${loan.loanAmount}\nDays: ${loan.days} days\nTimely repayment helps build your credit score, opening doors to more financial opportunities in the future.\nBest regards, The Moodeng Team`
               );
            } catch (error) {
               console.error('Error occurred while sending borrower notifications:', error);
            }
         }

         loan.updatedAt = new Date();
         await loan.save();

         return loan;
      },
      {
         schema: assignLoanUserSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.LOAN_UPDATED
      }
   );
}

export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
