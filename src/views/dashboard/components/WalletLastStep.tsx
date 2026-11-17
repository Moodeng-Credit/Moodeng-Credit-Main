import { useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDisconnect } from 'wagmi';

import type { WalletSetupPhase } from '@/lib/web3/openfort/embeddedWallet';
import { useOpenfort } from '@/lib/web3/openfort/OpenfortContext';
import { isCashoutHoldCode } from '@/lib/web3/openfort/walletFaceGate';
import { ConnectHero, GhostButton, PrimaryButton, StepTrail } from '@/views/dashboard/components/connectKit';
import GrowingWalletHippo from '@/views/onboarding/GrowingWalletHippo';

// Wallet last (src/hooks/useWalletLast.ts): the very last step of sending a loan request. Everything
// else is done (terms, contacts, bio, proof, ID check); one tap makes their Instant Wallet (Openfort,
// the same setup as /onboarding/wallet) and the request then sends itself. If it fails, nothing they
// filled in is lost: the loan form keeps its draft, and they can try again or come back later.

export default function WalletLastStep({ onDone, onClose }: { onDone: (address: string) => void; onClose: () => void }) {
   const navigate = useNavigate();
   const openfort = useOpenfort();
   const { disconnectAsync } = useDisconnect();
   const [phase, setPhase] = useState<WalletSetupPhase | null>(null);
   const [busy, setBusy] = useState(false);

   const create = async () => {
      setBusy(true);
      // Same as useCreateInstantWallet: drop any live wagmi session first, or useWalletSync re-locks
      // them onto that wallet instead of the new one.
      await disconnectAsync().catch(() => undefined);
      const address = await openfort.connect(setPhase);
      if (address) {
         onDone(address);
         return;
      }
      setPhase(null);
      setBusy(false);
   };

   const needsFaceCheck = Boolean(openfort.gateCode);

   return (
      <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
         <div className="connect-ui flex w-full max-w-[440px] flex-col gap-4 rounded-t-[24px] bg-white px-5 pb-8 pt-5 dark:bg-dv2-card sm:rounded-[24px]">
            <ConnectHero
               image="/hippos/hippo-wallet.png"
               subtitle="Your loan arrives here. It takes a few seconds."
               title="Last step: your wallet"
               trail={<StepTrail current={3} steps={['Loan', 'ID check', 'Wallet', 'Live']} />}
            />
            <div className="flex justify-center">
               <GrowingWalletHippo idleSrc="/hippos/hippo-wallet.png" phase={busy ? phase : null} />
            </div>
            {openfort.error && !busy ? <p className="text-center text-[14px] font-semibold text-[#c2410c]">{openfort.error}</p> : null}
            {needsFaceCheck && !busy ? (
               <PrimaryButton
                  onClick={() =>
                     navigate(isCashoutHoldCode(openfort.gateCode) ? '/withdraw/face-check' : '/onboarding/wallet/face-check', {
                        state: { returnTo: 'loan-request' }
                     })
                  }
               >
                  Quick face check
               </PrimaryButton>
            ) : (
               <PrimaryButton disabled={busy || !openfort.isConfigured} onClick={() => void create()}>
                  {busy ? <Loader2 aria-label="Making your wallet" className="mx-auto size-5 animate-spin" /> : 'Make my wallet & send'}
               </PrimaryButton>
            )}
            {busy ? null : <GhostButton onClick={onClose}>Not now</GhostButton>}
         </div>
      </div>
   );
}
