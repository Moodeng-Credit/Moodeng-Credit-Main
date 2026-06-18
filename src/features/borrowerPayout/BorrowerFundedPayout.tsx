import { type ChangeEvent, useMemo, useState } from 'react';

import { Check, ChevronLeft, Clipboard, ExternalLink, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isAddress } from 'viem';

import { formatDate } from '@/utils/dateFormatters';
import { formatNumber } from '@/utils/decimalHelpers';

type BorrowerFundedPayoutProps = {
   amount: number;
   lenderName: string;
   dueDate: string;
   repaymentAmount?: number;
   exchangeName?: 'Binance' | 'Coins.ph';
   defaultAddress?: string;
   isPreview?: boolean;
   onSendWithdrawal?: (payload: {
      exchange: 'binance' | 'coins_ph';
      address: string;
      amount: string;
   }) => Promise<{ message: string; txHash?: string }>;
};

const BASE_USDC = {
   coin: 'USDC',
   network: 'Base'
} as const;

const EXCHANGES = [
   { label: 'Binance', value: 'binance' },
   { label: 'Coins.ph', value: 'coins_ph' }
] as const;

const compactAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

function ChecklistStep({
   number,
   label,
   complete,
   helper,
   mode = 'verified'
}: {
   number: number;
   label: string;
   complete: boolean;
   helper?: string;
   mode?: 'guide' | 'verified';
}) {
   return (
      <div className="grid grid-cols-[36px_1fr] gap-3">
         <div className="relative flex justify-center">
            <div
               className={`z-10 flex h-9 w-9 items-center justify-center rounded-full border text-md-b2 font-semibold ${
                  complete
                     ? 'border-md-green-700 bg-md-green-700 text-md-neutral-100'
                     : mode === 'guide'
                       ? 'border-md-blue-300 bg-md-blue-200 text-md-blue-900'
                       : 'border-md-neutral-500 bg-md-neutral-100 text-md-neutral-1200'
               }`}
            >
               {complete ? <Check className="h-4 w-4" /> : number}
            </div>
            {number < 6 ? <div className="absolute top-9 h-full w-px bg-md-green-700" /> : null}
         </div>
         <div className="pb-7">
            <div className="flex flex-wrap items-center gap-2">
               <p className="text-md-b1 font-semibold text-md-heading">{label}</p>
               <span
                  className={`rounded-md-pill px-2 py-0.5 text-md-b4 font-semibold ${
                     complete
                        ? 'bg-md-green-100 text-md-green-900'
                        : mode === 'guide'
                          ? 'bg-md-blue-200 text-md-blue-900'
                          : 'bg-md-neutral-300 text-md-neutral-1000'
                  }`}
               >
                  {complete ? 'Verified' : mode === 'guide' ? 'Guide' : 'Waiting'}
               </span>
            </div>
            {helper ? <p className="mt-1 text-md-b3 text-md-neutral-1000">{helper}</p> : null}
         </div>
      </div>
   );
}

export function BorrowerFundedPayout({
   amount,
   lenderName,
   dueDate,
   repaymentAmount,
   exchangeName = 'Binance',
   defaultAddress = '',
   isPreview = false,
   onSendWithdrawal
}: BorrowerFundedPayoutProps) {
   const defaultExchange = exchangeName === 'Coins.ph' ? 'coins_ph' : 'binance';
   const [exchange, setExchange] = useState<'binance' | 'coins_ph'>(defaultExchange);
   const [payoutAddress, setPayoutAddress] = useState(defaultAddress);
   const [withdrawAmount, setWithdrawAmount] = useState('');
   const [confirmed, setConfirmed] = useState(Boolean(defaultAddress));
   const [saved, setSaved] = useState(false);
   const [isSending, setIsSending] = useState(false);
   const [saveMessage, setSaveMessage] = useState('');
   const [saveError, setSaveError] = useState('');

   const trimmedAddress = payoutAddress.trim();
   const validAddress = isAddress(trimmedAddress);
   const parsedWithdrawAmount = Number(withdrawAmount);
   const validWithdrawAmount = parsedWithdrawAmount > 0 && parsedWithdrawAmount <= amount;
   const readyToWithdraw = validAddress && confirmed && validWithdrawAmount;
   const selectedExchangeName = exchange === 'coins_ph' ? 'Coins.ph' : 'Binance';
   const formattedDueDate = formatDate(dueDate);
   const formattedRepayment = repaymentAmount ? `$${formatNumber(repaymentAmount)}` : 'the agreed repayment amount';

   const steps = useMemo(
      () => [
         {
            label: `Open ${selectedExchangeName} and tap Deposit / Receive`,
            complete: false,
            mode: 'guide' as const,
            helper: 'Moodeng guides this step, but cannot see inside your exchange app.'
         },
         {
            label: `Select ${BASE_USDC.coin} as the coin`,
            complete: false,
            mode: 'guide' as const,
            helper: 'Use USDC only.'
         },
         {
            label: `Select ${BASE_USDC.network} as the network`,
            complete: false,
            mode: 'guide' as const,
            helper: 'Use Base only.'
         },
         {
            label: `Paste your ${selectedExchangeName} deposit address`,
            complete: validAddress,
            mode: 'verified' as const,
            helper: validAddress ? 'Moodeng verified this looks like a Base address.' : 'Moodeng can verify the address format after you paste it.'
         },
         {
            label: 'Enter the amount to withdraw',
            complete: validWithdrawAmount,
            mode: 'verified' as const,
            helper: validWithdrawAmount ? 'Moodeng verified this amount is within your funded balance.' : 'Enter an amount up to your funded balance.'
         },
         {
            label: 'Confirm this deposit address is yours',
            complete: confirmed && validAddress,
            mode: 'verified' as const,
            helper: 'This is your confirmation before continuing.'
         }
      ],
      [confirmed, selectedExchangeName, validAddress, validWithdrawAmount]
   );

   const handleAddressChange = (event: ChangeEvent<HTMLInputElement>) => {
      setPayoutAddress(event.target.value);
      setConfirmed(false);
      setSaved(false);
      setSaveMessage('');
      setSaveError('');
   };

   const handleWithdrawAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
      setWithdrawAmount(event.target.value);
      setSaved(false);
      setSaveMessage('');
      setSaveError('');
   };

   const handleSendWithdrawal = async () => {
      if (!readyToWithdraw || isSending) return;

      setIsSending(true);
      setSaveError('');
      setSaveMessage('');

      try {
         const result = onSendWithdrawal
            ? await onSendWithdrawal({ exchange, address: trimmedAddress, amount: withdrawAmount })
            : { message: `Preview: wallet would open to send ${withdrawAmount} USDC on Base to ${selectedExchangeName}.` };

         setSaved(true);
         setSaveMessage(result.txHash ? `USDC sent. Transaction: ${compactAddress(result.txHash)}` : result.message);
      } catch (error) {
         setSaveError(error instanceof Error ? error.message : 'Could not start the wallet transaction.');
      } finally {
         setIsSending(false);
      }
   };

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex min-h-screen max-w-[440px] flex-col gap-4 px-md-4 pb-28 pt-md-3">
            <div className="flex items-center gap-3">
               <Link
                  to="/dashboard"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-md-neutral-100 text-md-heading shadow-md-card"
                  aria-label="Back to dashboard"
               >
                  <ChevronLeft className="h-5 w-5" />
               </Link>
               <div>
                  <h1 className="text-md-h4 font-semibold text-md-heading">Loan funded</h1>
                  <p className="text-md-b2 text-md-neutral-700">Next step: withdraw from your wallet.</p>
               </div>
            </div>

            {isPreview ? (
               <div className="rounded-md-lg border border-md-primary-300 bg-md-primary-100 px-4 py-3 text-md-b3 font-medium text-md-primary-1500">
                  Preview data is showing. The live screen uses the borrower&apos;s latest funded loan.
               </div>
            ) : null}

            <section className="rounded-md-lg bg-md-neutral-100 p-5 shadow-md-card">
               <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-md-green-100 text-md-green-900">
                  <Check className="h-6 w-6" />
               </div>
               <p className="text-md-b2 font-semibold uppercase text-md-green-900">Well done</p>
               <h2 className="mt-2 text-md-h3 font-semibold text-md-heading">
                  You have been funded for ${formatNumber(amount)}
               </h2>
               <p className="mt-3 text-md-b1 text-md-neutral-1200">
                  {lenderName} funded your request. Repay {formattedRepayment} by {formattedDueDate} to keep building your Moodeng credit.
               </p>
            </section>

            <section className="rounded-md-lg bg-md-neutral-100 p-5 shadow-md-card">
               <div className="flex items-start justify-between gap-3">
                  <div>
                     <p className="text-md-b2 font-semibold uppercase text-md-blue-800">Withdraw</p>
                     <h2 className="mt-1 text-md-h4 font-semibold text-md-heading">Send to {selectedExchangeName}</h2>
                     <p className="mt-2 text-md-b2 text-md-neutral-1200">
                        Copy your {selectedExchangeName} USDC deposit address on Base. Moodeng will prepare the wallet transaction for you.
                     </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md-lg bg-md-blue-200 text-md-blue-800">
                     <Wallet className="h-5 w-5" />
                  </div>
               </div>

               <div className="mt-5 rounded-md-lg border border-md-neutral-300 bg-md-neutral-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                     <p className="text-md-b2 font-semibold text-md-heading">{selectedExchangeName}</p>
                     <p className="rounded-md-pill bg-md-green-100 px-3 py-1 text-md-b3 font-semibold text-md-green-900">
                        {BASE_USDC.coin} on {BASE_USDC.network}
                     </p>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-2">
                     {EXCHANGES.map((option) => (
                        <button
                           key={option.value}
                           type="button"
                           onClick={() => {
                              setExchange(option.value);
                              setSaved(false);
                              setSaveMessage('');
                              setSaveError('');
                           }}
                           className={`rounded-md-lg border px-3 py-3 text-md-b2 font-semibold transition ${
                              exchange === option.value
                                 ? 'border-md-blue-700 bg-md-blue-200 text-md-blue-1000'
                                 : 'border-md-neutral-500 bg-md-neutral-100 text-md-neutral-1200'
                           }`}
                        >
                           {option.label}
                        </button>
                     ))}
                  </div>

                  <div className="mt-5">
                     {steps.map((step, index) => (
                        <ChecklistStep
                           key={step.label}
                           number={index + 1}
                           label={step.label}
                           complete={step.complete}
                           helper={step.helper}
                           mode={step.mode}
                        />
                     ))}
                  </div>

                  <label className="block text-md-b2 font-semibold text-md-heading" htmlFor="payout-address">
                     {selectedExchangeName} deposit address
                  </label>
                  <div className="mt-2 rounded-md-lg border border-md-red-100 bg-md-red-100 px-3 py-2 text-md-b3 font-medium text-md-red-800">
                     Only paste a USDC on Base deposit address. Sending to the wrong network may lose your funds.
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-md-input border border-md-neutral-500 bg-md-neutral-100 px-3 py-3 focus-within:border-md-blue-600">
                     <Clipboard className="h-4 w-4 shrink-0 text-md-neutral-1000" />
                     <input
                        id="payout-address"
                        value={payoutAddress}
                        onChange={handleAddressChange}
                        placeholder="0x..."
                        className="min-w-0 flex-1 bg-transparent text-md-b1 text-md-heading outline-none placeholder:text-md-neutral-800"
                     />
                  </div>
                  {trimmedAddress && !validAddress ? (
                     <p className="mt-2 text-md-b3 font-medium text-md-red-600">Enter a valid Base wallet address.</p>
                  ) : null}
                  {validAddress ? (
                     <p className="mt-2 text-md-b3 text-md-neutral-1200">Address ready: {compactAddress(trimmedAddress)}</p>
                  ) : null}

                  <label className="mt-4 block text-md-b2 font-semibold text-md-heading" htmlFor="withdraw-amount">
                     Amount to withdraw
                  </label>
                  <div className="mt-2 flex items-center gap-2 rounded-md-input border border-md-neutral-500 bg-md-neutral-100 px-3 py-3 focus-within:border-md-blue-600">
                     <input
                        id="withdraw-amount"
                        value={withdrawAmount}
                        onChange={handleWithdrawAmountChange}
                        inputMode="decimal"
                        placeholder="0"
                        className="min-w-0 flex-1 bg-transparent text-md-b1 text-md-heading outline-none placeholder:text-md-neutral-800"
                     />
                     <span className="text-md-b2 font-semibold text-md-neutral-1200">USDC</span>
                  </div>
                  {withdrawAmount && !validWithdrawAmount ? (
                     <p className="mt-2 text-md-b3 font-medium text-md-red-600">
                        Enter an amount greater than 0 and up to ${formatNumber(amount)}.
                     </p>
                  ) : null}

                  <label className="mt-4 flex items-start gap-3 rounded-md-lg bg-md-neutral-100 p-3">
                     <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={!validAddress}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        className="mt-1 h-4 w-4 accent-md-green-700 disabled:opacity-40"
                     />
                     <span className="text-md-b2 text-md-neutral-1200">
                        I confirm this is my {selectedExchangeName} deposit address for USDC on Base.
                     </span>
                  </label>
               </div>

               {saved && saveMessage ? (
                  <div className="mt-4 rounded-md-lg border border-md-green-100 bg-md-green-100 px-4 py-3 text-md-b2 font-medium text-md-green-900">
                     {saveMessage}
                  </div>
               ) : null}

               {saveError ? (
                  <div className="mt-4 rounded-md-lg border border-md-red-100 bg-md-red-100 px-4 py-3 text-md-b2 font-medium text-md-red-800">
                     {saveError}
                  </div>
               ) : null}

               <button
                  type="button"
                  disabled={!readyToWithdraw || isSending}
                  onClick={handleSendWithdrawal}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-md-lg px-4 py-4 text-md-b1 font-semibold transition ${
                     readyToWithdraw && !isSending
                        ? 'bg-md-blue-700 text-md-neutral-100 hover:bg-md-blue-800'
                        : 'bg-md-neutral-400 text-md-neutral-800'
                  }`}
               >
                  {isSending ? 'Opening wallet...' : `Send USDC to ${selectedExchangeName}`}
                  {readyToWithdraw && !isSending ? <ExternalLink className="h-4 w-4" /> : null}
               </button>
            </section>
         </div>
      </div>
   );
}
