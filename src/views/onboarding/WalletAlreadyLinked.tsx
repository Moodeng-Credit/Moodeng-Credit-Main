import { useNavigate } from 'react-router-dom';
import { useDisconnect } from 'wagmi';

import { SUPPORT_FACEBOOK_URL, TELEGRAM_SUPPORT_URL } from '@/views/support/constants';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

/**
 * Shown to a lender when the wallet they just connected is already linked to another
 * Moodeng account (the `users_wallet_address_key` unique constraint rejects the save with
 * Postgres error 23505). Each wallet may belong to only one account — this is what prevents
 * self-lending (one person acting as both borrower and lender on the same wallet) and the
 * fraud/security problems that come with it. Previously this case failed silently for
 * lenders (see useWalletSync), leaving the wallet connected in the browser but never saved,
 * which then broke downstream flows like the Coinbase onramp (no destination wallet on file).
 */
export default function WalletAlreadyLinked() {
   const navigate = useNavigate();
   const { disconnect } = useDisconnect();

   const openTelegram = () => window.open(TELEGRAM_SUPPORT_URL, '_blank', 'noopener,noreferrer');
   const openFacebook = () => window.open(SUPPORT_FACEBOOK_URL, '_blank', 'noopener,noreferrer');

   const useDifferentWallet = () => {
      disconnect();
      navigate('/onboarding/wallet', { replace: true });
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title="Wallet In Use" />

         <div className="flex flex-1 flex-col items-center px-md-4 pb-md-6 pt-md-2 text-center">
            <div className="mb-md-4 mt-md-2 size-16 rounded-md-xl bg-md-red-100 inline-flex items-center justify-center">
               <span
                  className="block size-10 bg-md-red-500"
                  style={{
                     WebkitMaskImage: "url('/icons/close.svg')",
                     maskImage: "url('/icons/close.svg')",
                     WebkitMaskRepeat: 'no-repeat',
                     maskRepeat: 'no-repeat',
                     WebkitMaskPosition: 'center',
                     maskPosition: 'center',
                     WebkitMaskSize: 'contain',
                     maskSize: 'contain'
                  }}
               />
            </div>

            <h2 className="mb-md-2 text-[28px] font-semibold leading-[1.14] text-md-heading">This wallet is already in use</h2>
            <p className="mb-md-4 max-w-[360px] text-md-b1 font-medium leading-7 text-md-neutral-700">
               This wallet is already linked to another Moodeng account. To keep lending fair and prevent self-lending, each
               wallet can belong to only one account.
            </p>

            <div className="mb-md-4 w-full rounded-[16px] border border-md-neutral-400 bg-white px-md-4 py-md-3 text-left">
               <p className="mb-md-2 text-md-h5 text-md-heading">What you can do</p>
               <ul className="flex flex-col gap-md-2 text-md-b2 font-medium leading-6 text-md-neutral-700">
                  <li>Connect a different wallet address to this lender account.</li>
                  <li>
                     If you created a borrower account by mistake, remove this wallet from it first — or ask us to delete that
                     account or switch its role.
                  </li>
               </ul>
            </div>

            <p className="mb-md-2 text-md-b2 font-medium text-md-neutral-700">Not sure what happened? Message us and we'll help.</p>
            <div className="mb-md-4 grid w-full grid-cols-2 gap-md-3">
               <button
                  type="button"
                  onClick={openTelegram}
                  className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-md-neutral-400 bg-white px-md-3 py-md-2 text-md-b2 font-semibold text-md-heading"
               >
                  Telegram
               </button>
               <button
                  type="button"
                  onClick={openFacebook}
                  className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-md-neutral-400 bg-white px-md-3 py-md-2 text-md-b2 font-semibold text-md-heading"
               >
                  Facebook
               </button>
            </div>

            <button
               type="button"
               onClick={useDifferentWallet}
               className="mt-auto flex min-h-[56px] w-full items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100"
            >
               Use a different wallet
            </button>
         </div>
      </div>
   );
}
