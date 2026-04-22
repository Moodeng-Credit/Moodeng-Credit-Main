import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAccount, useConnect } from 'wagmi';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import type { WalletConnectorKey } from '@/config/wagmiConfig';
import { WALLET_CONNECTOR_NAMES } from '@/config/wagmiConfig';
import type { RootState } from '@/store/store';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';
import { LENDER_WALLET_OPTIONS } from '@/views/onboarding/walletPickerOptions';

export default function ConnectWallet() {
   const user = useSelector((state: RootState) => state.auth.user);
   const navigate = useNavigate();
   const { isConnected } = useAccount();
   const { connect, connectors, status, error } = useConnect();
   const { openConnectModal } = useConnectModal();
   const { showToast } = useToast();
   const [pendingKey, setPendingKey] = useState<WalletConnectorKey | null>(null);
   const [selectedKey, setSelectedKey] = useState<WalletConnectorKey | null>(null);

   const connectorsByName = useMemo(() => {
      const map = new Map<string, (typeof connectors)[number]>();
      connectors.forEach((c) => map.set(c.name, c));
      return map;
   }, [connectors]);

   const handleConnect = useCallback(
      (key: WalletConnectorKey) => {
         const connector = connectorsByName.get(WALLET_CONNECTOR_NAMES[key]);
         if (!connector) {
            showToast(TOAST_TYPES.ERROR, 'Wallet unavailable', `${WALLET_CONNECTOR_NAMES[key]} is not available right now.`);
            return;
         }
         setPendingKey(key);
         connect({ connector });
      },
      [connect, connectorsByName, showToast]
   );

   useEffect(() => {
      if (isConnected) {
         setPendingKey(null);
         navigate('/onboarding/wallet/connected', { replace: true });
      }
   }, [isConnected, navigate]);

   useEffect(() => {
      if (status === 'error' && error) {
         setPendingKey(null);
         const code = (error as { code?: number | string }).code;
         if (code !== 4001 && !/reject/i.test(error.message)) {
            showToast(TOAST_TYPES.ERROR, 'Connection failed', error.message || 'Could not connect wallet. Please try again.');
         }
      }
   }, [status, error, showToast]);

   if (!user?.userRole) {
      return <Navigate to="/onboarding/role" replace />;
   }

   const role = user.userRole;

   if (role === 'borrower') {
      return (
         <BorrowerConnectView
            onConnect={() => handleConnect('coinbase')}
            isConnecting={pendingKey === 'coinbase' || status === 'pending'}
         />
      );
   }

   return (
      <LenderConnectView
         selectedKey={selectedKey}
         onSelect={setSelectedKey}
         onConnect={(key) => handleConnect(key)}
         onOpenOther={() => {
            setSelectedKey(null);
            openConnectModal?.();
         }}
         isConnecting={status === 'pending'}
      />
   );
}

function BorrowerConnectView({ onConnect, isConnecting }: { onConnect: () => void; isConnecting: boolean }) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title="Connect Wallet" />

         <div className="flex flex-col flex-1 items-center justify-center px-md-4 gap-md-4">
            <div className="size-16 rounded-md-xl bg-md-blue-700 inline-flex items-center justify-center">
               <img src="/icons/base-wallet.png" alt="Base Wallet" className="size-10" />
            </div>
            <h2 className="text-md-display text-md-heading text-center">Connect Your Coinbase Wallet</h2>
            <p className="text-md-b1 font-medium text-md-neutral-700 text-center">
               Your wallet is used to build your Trust Score and receive USDC loans.
            </p>
            <button
               type="button"
               onClick={onConnect}
               disabled={isConnecting}
               className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
            >
               {isConnecting ? 'Connecting…' : 'Connect Wallet'}
               {!isConnecting && (
                  <span
                     className="block size-6 bg-md-neutral-100"
                     style={{
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain'
                     }}
                  />
               )}
            </button>
         </div>
      </div>
   );
}

function LenderConnectView({
   selectedKey,
   onSelect,
   onConnect,
   onOpenOther,
   isConnecting
}: {
   selectedKey: WalletConnectorKey | null;
   onSelect: (key: WalletConnectorKey) => void;
   onConnect: (key: WalletConnectorKey) => void;
   onOpenOther: () => void;
   isConnecting: boolean;
}) {
   const canConnect = Boolean(selectedKey) && !isConnecting;

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title="Connect Wallet" />

         <div className="flex flex-col gap-md-4 p-md-4">
            <img
               src="/hippos/role-selection.png"
               alt="Moodeng hippo"
               className="w-[110px] h-[96px] object-cover"
            />

            <div className="flex flex-col gap-md-0">
               <h2 className="text-md-display text-md-heading">Connect Your Wallet</h2>
               <p className="text-md-b1 font-medium text-md-neutral-700">Think of this as your digital checking account.</p>
            </div>

            <div className="grid grid-cols-2 gap-md-4">
               {LENDER_WALLET_OPTIONS.map((option) => {
                  const isSelected = selectedKey === option.key;
                  return (
                     <button
                        key={option.key}
                        type="button"
                        onClick={() => onSelect(option.key)}
                        className={[
                           'flex flex-col gap-md-3 items-start p-md-3 rounded-[12px] border text-left transition-colors',
                           isSelected
                              ? 'bg-md-primary-900/10 border-md-primary-900'
                              : 'bg-white border-md-neutral-600'
                        ].join(' ')}
                     >
                        <div className="size-8 rounded-md-xs inline-flex items-center justify-center overflow-hidden shrink-0">
                           <img src={option.iconSrc} alt={option.name} className="size-8 object-contain" />
                        </div>
                        <div className="flex flex-col gap-md-0 w-full">
                           <div className="flex flex-wrap items-center gap-md-1">
                              <span className="text-md-h5 text-md-heading">{option.name}</span>
                              {option.tag && (
                                 <span
                                    className={`inline-flex items-center justify-center px-md-1 py-md-0 rounded-md-sm text-md-b3 font-semibold ${option.tag.bgClass} ${option.tag.textClass}`}
                                 >
                                    {option.tag.label}
                                 </span>
                              )}
                           </div>
                           <p
                              className={`text-md-b2 font-medium ${
                                 option.key === 'coinbase' ? 'text-md-primary-1500 font-normal' : 'text-md-slate-600'
                              }`}
                           >
                              {option.line1}
                           </p>
                           <p className="text-md-b2 font-medium text-md-slate-600">{option.line2}</p>
                        </div>
                     </button>
                  );
               })}
            </div>

            <button
               type="button"
               onClick={onOpenOther}
               className="flex gap-md-4 items-center p-md-3 rounded-[12px] border border-md-neutral-600 bg-md-neutral-200 w-full text-left"
            >
               <div className="size-8 rounded-md-xs bg-md-slate-600 inline-flex items-center justify-center shrink-0">
                  <span
                     className="block size-5 bg-white"
                     style={{
                        WebkitMaskImage: "url('/icons/grid-4.svg')",
                        maskImage: "url('/icons/grid-4.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain'
                     }}
                  />
               </div>
               <div className="flex flex-col gap-md-0 flex-1 min-w-0">
                  <span className="text-md-h5 text-md-heading">Other Wallets</span>
                  <span className="text-md-b2 font-medium text-md-slate-700">
                     Trust, Rainbow, Argent &amp; more supported wallets
                  </span>
               </div>
            </button>

            <div className="flex flex-col gap-md-1">
               <button
                  type="button"
                  disabled={!canConnect}
                  onClick={() => selectedKey && onConnect(selectedKey)}
                  className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
               >
                  {isConnecting ? 'Connecting…' : selectedKey ? 'Connect Wallet' : 'Select a wallet above'}
                  {!isConnecting && selectedKey && (
                     <span
                        className="block size-6 bg-md-neutral-100"
                        style={{
                           WebkitMaskImage: "url('/icons/chevron-right.svg')",
                           maskImage: "url('/icons/chevron-right.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                  )}
               </button>
               <p className="text-md-b3 text-md-slate-500 text-center">
                  All wallets support gasless transactions on Base network
               </p>
            </div>
         </div>
      </div>
   );
}
