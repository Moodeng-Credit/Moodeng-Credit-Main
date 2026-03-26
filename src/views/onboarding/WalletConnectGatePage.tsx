import type { JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ChevronLeft } from 'lucide-react';

/** Placeholder route for MOO-37 — dedicated wallet connect entry after onboarding. */
export default function WalletConnectGatePage(): JSX.Element {
   const navigate = useNavigate();

   return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12">
         <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full text-[#1A0B3B] hover:bg-gray-100"
            aria-label="Back"
         >
            <ChevronLeft className="h-6 w-6" />
         </button>

         <div className="w-full max-w-md text-center">
            <h1 className="mb-3 text-2xl font-bold text-[#0A0B1E]">Connect your wallet</h1>
            <p className="mb-8 text-base leading-relaxed text-[#6B7280]">
               Link a wallet to build your Trust Score on-chain and use USDC loans securely.
            </p>
            <div className="flex justify-center">
               <ConnectButton />
            </div>
            <p className="mt-8 text-sm text-[#6B7280]">
               Already connected?{' '}
               <Link to="/dashboard" className="font-semibold text-[#6010D2] hover:underline">
                  Go to request board
               </Link>
            </p>
         </div>
      </div>
   );
}
