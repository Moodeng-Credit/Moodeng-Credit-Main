import type { NextRequest } from 'next/server';

import { z } from 'zod';

import type { Prisma } from '@/generated/prisma/client/client';
import { prisma } from '@/lib/database';
import { objectIdSchema, usernameSchema, walletAddressSchema } from '@/lib/schemas/fields';
import { sendMail } from '@/lib/services/email';
import { sendBorrowerReminder, sendNewLoanNotification } from '@/lib/services/telegram';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

const assignLoanUserSchema = z.object({
   loanId: objectIdSchema,
   username: usernameSchema,
   wallet: walletAddressSchema
});

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         const loan = await prisma.loan.findUnique({ where: { id: data.loanId } });
         if (!loan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         if (!userId) {
            throw { code: ERROR_CODES.AUTH_UNAUTHORIZED, status: 401 };
         }

         const authenticatedUser = await prisma.user.findUnique({ where: { id: userId } });
         if (!authenticatedUser) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         if (data.username !== authenticatedUser.username) {
            throw { code: ERROR_CODES.LOAN_UNAUTHORIZED, status: 403 };
         }

         const user = await prisma.user.findUnique({ where: { username: data.username } });
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         if (loan.borrowerUser === data.username) {
            throw { code: ERROR_CODES.LOAN_SELF_LENDING_NOT_ALLOWED, status: 403 };
         }

         const updateData: Prisma.LoanUpdateInput = {};

         if (!loan.lenderUser) {
            updateData.lenderWallet = data.wallet;
            updateData.lenderUser = data.username;

            try {
               if (user.chatId) {
                  await sendNewLoanNotification(Number(user.chatId), user.username, loan.loanAmount.toNumber(), loan.reason);
               }

               await sendMail(
                  user.email,
                  'Your Support is Making a Difference!',
                  `Dear ${user.username},\nGreat news! The microloan you provided is now helping someone build a better future.\nLoan Details:\nAmount: ${loan.loanAmount.toString()}\nPurpose: ${loan.reason}\nThank you for being part of the global financial inclusion movement. We'll keep you updated on the repayment progress.\nBest regards, The Moodeng Team`
               );
            } catch (error) {
               console.error('Error occurred while sending lender notifications:', error);
            }
         } else if (!loan.borrowerUser) {
            updateData.borrowerWallet = data.wallet;
            updateData.borrowerUser = data.username;

            // Use transaction for user nal increment
            await prisma.user.update({
               where: { id: user.id },
               data: { nal: { increment: 1 } }
            });

            try {
               if (user.chatId) {
                  sendBorrowerReminder(Number(user.chatId), user.username, loan.loanAmount.toNumber(), loan.days.toString(), 168);
               }

               await sendMail(
                  user.email,
                  'Friendly Reminder: Your Loan Repayment is Due Soon',
                  `Dear ${user.username},\nThis is a friendly reminder that your loan repayment is due in ${loan.days} days.\nRepayment Details:\nAmount: ${loan.loanAmount.toString()}\nDays: ${loan.days} days\nTimely repayment helps build your credit score, opening doors to more financial opportunities in the future.\nBest regards, The Moodeng Team`
               );
            } catch (error) {
               console.error('Error occurred while sending borrower notifications:', error);
            }
         }

         return await prisma.loan.update({
            where: { id: data.loanId },
            data: updateData
         });
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
