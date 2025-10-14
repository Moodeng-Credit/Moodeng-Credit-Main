import type { NextRequest } from 'next/server';

import Loan from '@/lib/models/Loan';
import User from '@/lib/models/User';
import { createLoanSchema } from '@/lib/schemas/loans';
import { sendMail } from '@/lib/services/email';
import { sendBorrowerReminder } from '@/lib/services/telegram';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const borrower = await User.findOne({ username: data.borrowerUserId });

         if (!borrower) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         borrower.nal = borrower.nal + 1;
         await borrower.save();

         const loan = new Loan({
            borrowerWallet: borrower?.walletAddress,
            lenderWallet: '',
            borrowerUser: data.borrowerUserId,
            lenderUser: '',
            loanAmount: data.loanAmount,
            repayedAmount: data.repayedAmount,
            reason: data.reason,
            loanStatus: LoanStatus.REQUESTED,
            repaymentStatus: RepaymentStatus.UNPAID,
            block: data.block,
            coin: data.coin,
            days: data.days
         });

         await loan.save();

         try {
            if (borrower.chatId) {
               sendBorrowerReminder(borrower.chatId, borrower.username, data.loanAmount, data.days.toString(), 168);
            }

            await sendMail(
               borrower.email,
               'Friendly Reminder: Your Loan Repayment is Due Soon',
               `Dear ${borrower.username},\nThis is a friendly reminder that your loan repayment is due in ${data.days} days.\nRepayment Details:\nAmount: ${data.loanAmount}\nDays: ${data.days} days\nTimely repayment helps build your credit score, opening doors to more financial opportunities in the future.\nBest regards, The Moodeng Team`
            );
         } catch (error) {
            console.error('Error occurred while sending borrower notifications:', error);
         }

         return loan;
      },
      {
         schema: createLoanSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.LOAN_CREATED
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
