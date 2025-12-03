import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount } from 'wagmi';

import useToast from '@/components/ToastSystem/hooks/useToast';

import { useClickOutside } from '@/hooks/useClickOutside';

import { fetchUser } from '@/store/slices/authSlice';
import { createLoan } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import SuccessModal from '@/views/dashboard/components/SuccessModal';

type Props = {
   open: boolean;
   onHide: () => void;
};

const LoanRequestForm: React.FC<Props> = ({ open, onHide }) => {
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { showToastByConfig } = useToast();
   const [showPurple, setShowPurple] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);
   const showVerify = user?.isWorldId !== 'ACTIVE';
   const today = new Date().toISOString().split('T')[0];
   const borrowerUserId = user?.username || '';
   const lenderUserId = '';
   const [loanAmount, setLoanAmount] = useState('');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('');
   const [block, setBlock] = useState(account?.chain?.name);
   const [coin, setCoin] = useState('USDC');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');

   const loanRequestModalRef = useClickOutside<HTMLDivElement>(onHide, open) as RefObject<HTMLDivElement>;
   const successModalRef = useClickOutside<HTMLDivElement>(() => setShowPurple(false), showPurple) as RefObject<HTMLDivElement>;

   const { openConnectModal } = useConnectModal();

   const clear = () => {
      setTotalRepaymentAmount('');
      setLoanAmount('');
      setReason('');
      setDays('');
   };

   const handlePurple = () => {
      setShowPurple(true);
      onHide();
   };
   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (isSubmitting) {
         return;
      }

      if (!account.isConnected) {
         openConnectModal?.();
         e.stopPropagation();
         return;
      }

      if ((user.nal || 0) >= (user.mal || 0)) {
         console.log('Loan limit reached');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }

      if (user.isWorldId !== 'ACTIVE') {
         console.log('WorldId status not active');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WORLDID_REQUIRED));
         return;
      }

      if (!user.walletAddress || user.walletAddress.trim() === '') {
         console.log('Wallet address not connected');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WALLET_MISSING));
         return;
      }

      if (!block || !coin) {
         console.log('Network validation failed:', { block, coin, chainName: account?.chain?.name });
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      if (!loanAmount || parseFloat(loanAmount) <= 0) {
         console.log('Invalid loan amount');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_INVALID_AMOUNT));
         return;
      }

      if (parseFloat(loanAmount) > (user.cs || 0)) {
         console.log('Loan amount exceeds credit score');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT));
         return;
      }

      const loanData = {
         borrowerUserId: borrowerUserId || '',
         lenderUserId,
         loanAmount: parseFloat(loanAmount),
         totalRepaymentAmount: parseFloat(totalRepaymentAmount),
         block,
         coin,
         reason,
         days: parseInt(days)
      };

      if (
         user.isWorldId === 'ACTIVE' &&
         block &&
         coin &&
         (user.nal || 0) < (user.mal || 0) &&
         parseFloat(loanAmount) <= (user.cs || 0) &&
         parseFloat(loanAmount) > 0
      ) {
         setIsSubmitting(true);
         try {
            await dispatch(createLoan(loanData)).unwrap();
            clear();
            handlePurple();
            try {
               await dispatch(fetchUser()).unwrap();
               console.log('User fetched successfully');
            } catch (error) {
               console.error('Error fetching user:', (error as Error).message || error);
            }
         } catch (error) {
            console.error('Error creating loan:', (error as Error).message || error);
         } finally {
            setIsSubmitting(false);
         }
      }
   };

   const handleDays = (e: ChangeEvent<HTMLInputElement>) => {
      const selectedDate = e.target.value;

      const newToday = new Date();
      newToday.setHours(0, 0, 0, 0);

      const date = new Date(selectedDate);
      const timeDifference = date.getTime() - newToday.getTime();
      const differenceInDays = timeDifference / (1000 * 60 * 60 * 24);

      setDays(Math.round(differenceInDays).toString());
   };

   const handleSuccessModalClose = useCallback(() => {
      setShowPurple(false);
   }, []);

   useEffect(() => {
      if (account?.chain?.name) {
         setBlock(account.chain.name);
         setCoin('USDC');
      }
   }, [account?.chain?.name]);

   return (
      <>
         <LoanRequestModal
            isOpen={open}
            onClose={onHide}
            showVerify={showVerify}
            user={user}
            loanAmount={loanAmount}
            setLoanAmount={setLoanAmount}
            totalRepaymentAmount={totalRepaymentAmount}
            setTotalRepaymentAmount={setTotalRepaymentAmount}
            reason={reason}
            setReason={setReason}
            days={days}
            today={today}
            handleDays={handleDays}
            handleSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            clickOutsideRef={loanRequestModalRef}
         />
         <SuccessModal isOpen={showPurple} onClose={handleSuccessModalClose} clickOutsideRef={successModalRef} />
      </>
   );
};

export default LoanRequestForm;
