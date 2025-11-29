import mongoose, { Schema } from 'mongoose';

import { type ILoan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

const LoanSchema = new Schema<ILoan>({
   trackingId: { type: String, required: true, unique: true },
   borrowerWallet: { type: String, ref: 'User', default: null },
   lenderWallet: { type: String, ref: 'User', default: null },
   borrowerUser: { type: String, ref: 'User', default: null },
   lenderUser: { type: String, ref: 'User', default: null },
   loanAmount: { type: Number, required: true },
   repayedAmount: { type: Number, required: true },
   repaymentAmount: { type: Number, default: 0 },
   reason: { type: String, required: true },
   loanStatus: { type: String, enum: Object.values(LoanStatus), required: true },
   repaymentStatus: { type: String, enum: Object.values(RepaymentStatus), required: true },
   days: { type: Number, required: true },
   block: { type: String, required: true, default: null },
   coin: { type: String, required: true, default: null },
   hash: { type: [String], default: [] },
   createdAt: { type: Date, default: Date.now },
   updatedAt: { type: Date, default: Date.now }
});

const Loan = mongoose.models.Loan || mongoose.model<ILoan>('Loan', LoanSchema);

export default Loan;
