import type { NextRequest } from 'next/server';

import { formatNumber } from '@/utils/decimalHelpers';

import type { Loan, Prisma, User } from '@/generated/prisma/client/client';
import { prisma } from '@/lib/database';
import type { UpdateLoanInput } from '@/lib/schemas/loans';
import { updateLoanSchema } from '@/lib/schemas/loans';
import { sendMail } from '@/lib/services/email';
import { sendNewLoanNotification } from '@/lib/services/telegram';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { RepaymentStatus } from '@/types/loanTypes';
import { SUCCESS_CODES } from '@/types/successCodes';

const addTransactionHash = (updateData: Prisma.LoanUpdateInput, hash?: string) => {
   if (hash) {
      updateData.hash = { push: hash };
   }
};

const verifyUserAuthorization = async (username: string, authenticatedUsername: string) => {
   if (username !== authenticatedUsername) {
      throw { code: ERROR_CODES.LOAN_UNAUTHORIZED, status: 403 };
   }

   const user = await prisma.user.findUnique({ where: { username } });
   if (!user) {
      throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
   }

   return user;
};

const sendNotificationEmail = async (email: string, subject: string, body: string, errorContext: string) => {
   try {
      await sendMail(email, subject, body);
   } catch (error) {
      console.error(`Error occurred while sending ${errorContext} email:`, error);
   }
};

const handleLenderPayment = async (
   data: UpdateLoanInput,
   loan: Loan,
   authenticatedUser: User,
   updateData: Prisma.LoanUpdateInput
): Promise<User> => {
   if (!data.username || !data.wallet) {
      throw { code: ERROR_CODES.LOAN_UNAUTHORIZED, status: 403, message: 'Username and wallet required' };
   }

   if (loan.borrowerUser === data.username) {
      throw { code: ERROR_CODES.LOAN_SELF_LENDING_NOT_ALLOWED, status: 403 };
   }

   if (loan.lenderUser && loan.lenderUser.trim() !== '') {
      throw { code: ERROR_CODES.LOAN_UNAUTHORIZED, status: 403, message: 'Lender already assigned' };
   }

   const lender = await verifyUserAuthorization(data.username, authenticatedUser.username);

   updateData.lenderWallet = data.wallet;
   updateData.lenderUser = data.username;
   updateData.loanStatus = 'Lent';
   addTransactionHash(updateData, data.hash);

   if (lender.chatId) {
      try {
         await sendNewLoanNotification(Number(lender.chatId), lender.username, loan.loanAmount.toNumber(), loan.reason);
      } catch (error) {
         console.error('Error sending lender Telegram notification:', error);
      }
   }

   await sendNotificationEmail(
      lender.email,
      'Your Support is Making a Difference!',
      `Dear ${lender.username},\nGreat news! The microloan you provided is now helping someone build a better future.\nLoan Details:\nAmount: $${formatNumber(loan.loanAmount)}\nPurpose: ${loan.reason}\nThank you for being part of the global financial inclusion movement. We'll keep you updated on the repayment progress.\nBest regards, The Moodeng Team`,
      'lender'
   );

   return lender;
};

// Helper: Handle borrower repayment (updates repayment status, amount, adds hash)
const handleBorrowerRepayment = (data: UpdateLoanInput, loan: Loan, authenticatedUser: User, updateData: Prisma.LoanUpdateInput) => {
   if (loan.borrowerUser !== authenticatedUser.username) {
      throw { code: ERROR_CODES.LOAN_UNAUTHORIZED, status: 403 };
   }

   if (data.repaymentStatus) {
      updateData.repaymentStatus = data.repaymentStatus;
   }
   if (data.repaidAmount !== undefined) {
      updateData.repaidAmount = data.repaidAmount;
   }
   addTransactionHash(updateData, data.hash);
};

const calculateBorrowerUpdates = (loan: Loan, borrower: User): Prisma.UserUpdateInput => {
   const borrowerUpdateData: Prisma.UserUpdateInput = {
      nal: { decrement: 1 }
   };

   if (loan.loanAmount.equals(borrower.cs)) {
      if (borrower.cs === 15) {
         borrowerUpdateData.cs = { increment: 5 };
      } else {
         borrowerUpdateData.cs = { increment: 20 };
      }
      if (borrower.mal < 3) {
         borrowerUpdateData.mal = { increment: 1 };
      }
   }

   return borrowerUpdateData;
};

const persistLoanUpdates = async (data: UpdateLoanInput, borrower: User | null, loan: Loan, updateData: Prisma.LoanUpdateInput) => {
   if (data.repaymentStatus === RepaymentStatus.PAID && borrower) {
      await prisma.$transaction(async (tx) => {
         const borrowerUpdateData = calculateBorrowerUpdates(loan, borrower);

         await tx.user.update({
            where: { id: borrower.id },
            data: borrowerUpdateData
         });

         await tx.loan.update({
            where: { id: data.loanId },
            data: updateData
         });
      });
   } else {
      await prisma.loan.update({
         where: { id: data.loanId },
         data: updateData
      });
   }
};

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

         const updateData: Prisma.LoanUpdateInput = {};
         let borrower = loan.borrowerUser ? await prisma.user.findUnique({ where: { username: loan.borrowerUser } }) : null;
         let lender = loan.lenderUser ? await prisma.user.findUnique({ where: { username: loan.lenderUser } }) : null;

         // CASE 1: Lender making payment (assigns lender, updates status to 'Lent', adds transaction hash)
         if (data.username && data.wallet && data.loanStatus === 'Lent') {
            lender = await handleLenderPayment(data, loan, authenticatedUser, updateData);
         }
         // CASE 2: Borrower making repayment (updates repayment status, repaid amount, adds transaction hash)
         else if (data.repaymentStatus || data.repaidAmount !== undefined) {
            handleBorrowerRepayment(data, loan, authenticatedUser, updateData);
         }

         await persistLoanUpdates(data, borrower, loan, updateData);

         const updatedLoan = await prisma.loan.findUnique({ where: { id: data.loanId } });
         if (!updatedLoan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         if (lender) {
            await sendNotificationEmail(
               lender.email,
               "You got asked for a Loan/You've Received a Repayment/Loan Fully Repaid - Your Impact is Growing",
               `Dear ${lender.username},\n${loan.reason}`,
               'lender follow-up'
            );
         }

         if (borrower) {
            await sendNotificationEmail(
               borrower.email,
               'Confirmation of Successful Loan Repayment/Your Loan has been Accepted',
               `Dear ${borrower.username},\n${loan.days}`,
               'borrower follow-up'
            );
         }

         return updatedLoan;
      },
      {
         schema: updateLoanSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.LOAN_UPDATED
      }
   );
}

export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
