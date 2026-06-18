import { useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import { BorrowerFundedPayout } from '@/features/borrowerPayout/BorrowerFundedPayout';
import useWallet from '@/hooks/useWallet';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

const DEMO_LOAN = {
   amount: 50,
   lenderName: 'Maria',
   dueDate: '2026-07-18T00:00:00.000Z',
   repaymentAmount: 55
};

const newestFirst = (a: Loan, b: Loan) => {
   const aTime = new Date(a.fundedAt ?? a.updatedAt ?? a.createdAt).getTime();
   const bTime = new Date(b.fundedAt ?? b.updatedAt ?? b.createdAt).getTime();
   return bTime - aTime;
};

export default function FundedSuccessPage({ preview = false }: { preview?: boolean }) {
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { Transfer } = useWallet();
   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoading = useSelector((state: RootState) => state.loans.isLoading);

   const fundedLoan = useMemo(
      () =>
         [...loans]
            .filter((loan) => loan.borrowerUser === user.id && loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid')
            .sort(newestFirst)[0],
      [loans, user.id]
   );

   useEffect(() => {
      if (!user.id || preview) return;
      dispatch(getUserLoans({ userId: user.id })).catch(() => undefined);
   }, [dispatch, preview, user.id]);

   useEffect(() => {
      if (!fundedLoan?.lenderUser || userProfiles[fundedLoan.lenderUser]) return;
      dispatch(fetchUserProfiles([fundedLoan.lenderUser])).catch(() => undefined);
   }, [dispatch, fundedLoan?.lenderUser, userProfiles]);

   if (preview) {
      return <BorrowerFundedPayout {...DEMO_LOAN} isPreview />;
   }

   if (!fundedLoan && isLoading) {
      return (
         <div className="min-h-screen bg-md-neutral-200 px-md-4 py-md-5">
            <div className="mx-auto max-w-[440px] rounded-md-lg bg-md-neutral-100 p-5 text-md-b1 text-md-neutral-1200 shadow-md-card">
               Loading your funded loan...
            </div>
         </div>
      );
   }

   if (!fundedLoan) {
      return (
         <div className="min-h-screen bg-md-neutral-200 px-md-4 py-md-5">
            <div className="mx-auto max-w-[440px] rounded-md-lg bg-md-neutral-100 p-5 shadow-md-card">
               <p className="text-md-h4 font-semibold text-md-heading">No funded loan yet</p>
               <p className="mt-2 text-md-b1 text-md-neutral-1200">
                  This screen appears after a lender funds your request.
               </p>
               <Link
                  to="/dashboard"
                  className="mt-5 inline-flex rounded-md-lg bg-md-blue-700 px-4 py-3 text-md-b2 font-semibold text-md-neutral-100"
               >
                  Go to dashboard
               </Link>
            </div>
         </div>
      );
   }

   const lenderName = fundedLoan.lenderUser
      ? userProfiles[fundedLoan.lenderUser]?.username ?? 'a lender'
      : 'a lender';

   const sendWithdrawal = async ({
      exchange,
      address,
      amount
   }: {
      exchange: 'binance' | 'coins_ph';
      address: string;
      amount: string;
   }) => {
      if (!account.address) {
         throw new Error('Connect your wallet before sending USDC.');
      }

      if (account.chain?.id !== ALLOWED_CHAIN_ID) {
         throw new Error('Switch your wallet to Base before sending USDC.');
      }

      const supabase = getSupabaseBrowserClient();
      const payoutMethodPayload = {
         user_id: user.id,
         exchange,
         token: 'USDC',
         network: 'base',
         address,
         confirmed_at: new Date().toISOString(),
         is_active: true
      };

      const { data: activeMethod, error: activeMethodError } = await supabase
         .from('user_payout_methods')
         .select('id')
         .eq('user_id', user.id)
         .eq('is_active', true)
         .maybeSingle();

      if (activeMethodError) {
         throw new Error(activeMethodError.message);
      }

      const { data: payoutMethod, error: payoutMethodError } = activeMethod
         ? await supabase
              .from('user_payout_methods')
              .update(payoutMethodPayload)
              .eq('id', activeMethod.id)
              .select('id')
              .single()
         : await supabase
              .from('user_payout_methods')
              .insert(payoutMethodPayload)
              .select('id')
              .single();

      if (payoutMethodError || !payoutMethod) {
         throw new Error(payoutMethodError?.message ?? 'Could not save payout address.');
      }

      const txHash = await Transfer(address, amount, fundedLoan.id, 'USDC');

      if (!txHash) {
         throw new Error('Wallet transaction was not completed.');
      }

      return {
         message: 'USDC sent. Moodeng saved this withdrawal address.',
         txHash
      };
   };

   return (
      <BorrowerFundedPayout
         amount={fundedLoan.loanAmount}
         lenderName={lenderName}
         dueDate={fundedLoan.dueDate}
         repaymentAmount={fundedLoan.totalRepaymentAmount}
         onSendWithdrawal={sendWithdrawal}
      />
   );
}
