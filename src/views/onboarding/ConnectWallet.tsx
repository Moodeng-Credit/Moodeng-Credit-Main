import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectModal, WalletButton } from '@rainbow-me/rainbowkit';
import { useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAccount, useConnect } from 'wagmi';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import type { WalletConnectorKey } from '@/config/wagmiConfig';
import { WALLET_CONNECTOR_NAMES } from '@/config/wagmiConfig';
import { checkCoinbaseKeysReachability } from '@/lib/coinbaseReachability';
import { isStaleChunkError, reloadOnceForStaleChunk } from '@/lib/staleChunkReload';
import { getBaseAccountConnector, getBaseWalletLockStatus } from '@/lib/walletProvider';
import { useCreateInstantWallet, useOpenfort } from '@/lib/web3/openfort';
import type { RootState } from '@/store/store';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';
import WalletConnectHelp from '@/views/onboarding/WalletConnectHelp';
import { LENDER_WALLET_OPTIONS } from '@/views/onboarding/walletPickerOptions';

// RainbowKit wallet ids (`connector.id`) used by WalletButton.Custom. Routing the
// named lender tiles through WalletButton lets RainbowKit drive the connect — it
// pops the extension when injected and falls back to its own QR/instructions modal
// when the wallet isn't the top-level `window.ethereum` provider (or isn't installed),
// instead of the bare wagmi connect() that silently dead-ends on the WalletConnect path.
const RAINBOWKIT_WALLET_ID: Record<WalletConnectorKey, string> = {
   coinbase: 'baseAccount',
   metaMask: 'metaMask',
   phantom: 'phantom',
   walletConnect: 'walletConnect'
};

export default function ConnectWallet() {
   const user = useSelector((state: RootState) => state.auth.user);
   const navigate = useNavigate();
   const location = useLocation();
   const isPreview = import.meta.env.DEV && location.pathname.includes('wallet-preview');
   const { isConnected } = useAccount();
   const { connect, connectors, status, error } = useConnect();
   const { openConnectModal } = useConnectModal();
   const { showToast } = useToast();
   const openfort = useOpenfort();
   const [pendingKey, setPendingKey] = useState<WalletConnectorKey | null>(null);
   const [selectedKey, setSelectedKey] = useState<WalletConnectorKey | null>(null);
   const [userInitiatedConnection, setUserInitiatedConnection] = useState(false);
   // Borrowers lead with the instant wallet; we still probe the ISP block so we can hide the
   // secondary "connect an existing Base wallet" link on networks where Base is known-dead.
   const [keysBlocked, setKeysBlocked] = useState(false);
   const returnTo =
      (location.state as { returnTo?: string } | null)?.returnTo || new URLSearchParams(location.search).get('returnTo') || undefined;
   // Declared after returnTo — the hook needs it to route back once the wallet exists.
   const instantWallet = useCreateInstantWallet(returnTo);
   const previewRole = new URLSearchParams(location.search).get('role') === 'lender' ? 'lender' : 'borrower';
   const role = user?.userRole || (isPreview ? previewRole : undefined);

   const connectorsByName = useMemo(() => {
      const map = new Map<string, (typeof connectors)[number]>();
      connectors.forEach((c) => map.set(c.name, c));
      if (!map.has(WALLET_CONNECTOR_NAMES.coinbase)) {
         const baseConnector = getBaseAccountConnector(connectors);
         if (baseConnector) map.set(WALLET_CONNECTOR_NAMES.coinbase, baseConnector);
      }
      return map;
   }, [connectors]);

   const handleConnect = useCallback(
      (key: WalletConnectorKey) => {
         if (isPreview) {
            navigate('/onboarding/wallet-connected-preview', returnTo ? { state: { returnTo } } : undefined);
            return;
         }

         const connector = connectorsByName.get(WALLET_CONNECTOR_NAMES[key]);
         if (!connector) {
            showToast(TOAST_TYPES.ERROR, 'Wallet unavailable', `${WALLET_CONNECTOR_NAMES[key]} is not available right now.`);
            return;
         }
         setPendingKey(key);
         setUserInitiatedConnection(true);
         connect({ connector });
      },
      [connect, connectorsByName, isPreview, navigate, returnTo, showToast]
   );

   // Only a connection the user actually started HERE should advance the flow.
   //
   // This used to fire for any borrower whose wagmi session happened to be live
   // (`role === 'borrower' || userInitiatedConnection`), which is what stranded borrowers who
   // had connected Base under the old onboarding: after disconnecting their saved wallet in
   // Settings they'd tap "Connect", land here, and be bounced straight to the "connected"
   // screen by a leftover live session before they could ever see "Create wallet" — where
   // useWalletSync then re-saved the very Base wallet they had just removed. A borrower who
   // genuinely still has a confirmed wallet is caught by the redirect below, not by this.
   useEffect(() => {
      if (!isConnected || !userInitiatedConnection) return;
      setPendingKey(null);
      navigate('/onboarding/wallet/connected', { replace: true, state: { returnTo } });
   }, [isConnected, userInitiatedConnection, navigate, returnTo]);

   useEffect(() => {
      if (status === 'error' && error) {
         setPendingKey(null);
         setUserInitiatedConnection(false);
         if (isStaleChunkError(error.message)) {
            reloadOnceForStaleChunk();
            return;
         }
         const code = (error as { code?: number | string }).code;
         const isUserRejection = code === 4001 || /reject/i.test(error.message);
         if (!isUserRejection) {
            // A borrower who reaches a Base connect only via the secondary link already has the
            // instant wallet as the primary path on this screen, so just surface the error.
            showToast(TOAST_TYPES.ERROR, 'Connection failed', error.message || 'Could not connect wallet. Please try again.');
         }
      }
   }, [status, error, showToast]);

   // Borrower-only: passively detect the PLDT/Smart block on keys.coinbase.com so we can lead with
   // the instant wallet instead of a Base Account popup that would dead-end. Cached per session.
   useEffect(() => {
      if (role !== 'borrower' || !openfort.isConfigured || isPreview) return;
      let cancelled = false;
      checkCoinbaseKeysReachability()
         .then((result) => {
            if (!cancelled && result === 'blocked') setKeysBlocked(true);
         })
         .catch(() => {});
      return () => {
         cancelled = true;
      };
   }, [role, openfort.isConfigured, isPreview]);

   // Shared with Account Settings so the two entry points can't drift — the differences
   // between them are exactly what produced a working wallet on one screen and a dead end
   // on the other.
   const handleCreateInstantWallet = useCallback(async () => {
      if (isPreview) {
         navigate('/onboarding/wallet-connected-preview', returnTo ? { state: { returnTo } } : undefined);
         return;
      }
      await instantWallet.createInstantWallet();
   }, [instantWallet, isPreview, navigate, returnTo]);

   if (!role) {
      return <Navigate to="/onboarding/role" replace />;
   }

   // A borrower whose wallet is already locked (Base or instant) must never see this screen
   // again — offering "create" against an existing wallet only produces errors and confusion.
   if (!isPreview && role === 'borrower' && getBaseWalletLockStatus(user).isConfirmedBorrowerWallet) {
      return <Navigate to="/onboarding/wallet/connected" replace state={{ returnTo }} />;
   }

   if (role === 'borrower') {
      return (
         <BorrowerConnectView
            onPreviewConnect={() => navigate('/onboarding/wallet-connected-preview', returnTo ? { state: { returnTo } } : undefined)}
            onConnectBaseAccount={() => handleConnect('coinbase')}
            isPreview={isPreview}
            isConnecting={pendingKey === 'coinbase' || status === 'pending'}
            instantWalletConfigured={openfort.isConfigured}
            // Base is known-dead on ISP-blocked networks (PLDT/Smart) — hide the secondary
            // "connect existing wallet" link there so it can never dead-end.
            allowBaseConnect={!keysBlocked}
            onCreateInstantWallet={handleCreateInstantWallet}
            isCreatingInstantWallet={openfort.isConnecting}
            instantWalletError={openfort.error}
         />
      );
   }

   return (
      <LenderConnectView
         selectedKey={selectedKey}
         onSelect={setSelectedKey}
         onConnect={(key) => handleConnect(key)}
         onMarkUserInitiated={() => setUserInitiatedConnection(true)}
         isPreview={isPreview}
         onOpenOther={() => {
            setSelectedKey(null);
            setUserInitiatedConnection(true);
            openConnectModal?.();
         }}
         // Phantom connects through the same RainbowKit modal (live provider discovery +
         // QR/install), keeping the selected tile so the modal opens in context.
         onConnectViaModal={() => {
            setUserInitiatedConnection(true);
            openConnectModal?.();
         }}
         isConnecting={status === 'pending'}
         // Lenders lead with the Instant Wallet wherever Openfort is configured — it replaces
         // the removed WalletConnect tile as the "no app installed" path. The one-per-person
         // face check is enforced server-side by openfort-shield-session on mint, so this no
         // longer needs the build-time gate flag to be on to be safe to show.
         instantWalletConfigured={openfort.isConfigured}
         onCreateInstantWallet={handleCreateInstantWallet}
         isCreatingInstantWallet={openfort.isConnecting}
         instantWalletError={openfort.error}
      />
   );
}

const CONNECT_WALLET_SCREEN_CLASS =
   'min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full';

function BorrowerConnectView({
   onPreviewConnect,
   onConnectBaseAccount,
   isPreview,
   isConnecting,
   instantWalletConfigured,
   allowBaseConnect,
   onCreateInstantWallet,
   isCreatingInstantWallet,
   instantWalletError
}: {
   onPreviewConnect: () => void;
   onConnectBaseAccount: () => void;
   isPreview: boolean;
   isConnecting: boolean;
   instantWalletConfigured: boolean;
   allowBaseConnect: boolean;
   onCreateInstantWallet: () => void;
   isCreatingInstantWallet: boolean;
   instantWalletError: string | null;
}) {
   const connectBase = isPreview ? onPreviewConnect : onConnectBaseAccount;
   // Borrowers always start with the Moodeng instant wallet when it's available. It's the
   // lowest-friction path — one tap, no app, no seed phrase — and, unlike Base Account, it
   // can't be dead-ended by the PLDT/Smart ISP block that hijacks keys.coinbase.com in the
   // Philippines (that block cost us signups). Base stays reachable as a quiet secondary for
   // borrowers who already have a wallet, and only on networks where it isn't blocked. If the
   // instant rail somehow isn't configured, we fall back to the Base-primary screen so there
   // is always a way through.
   const leadWithInstant = instantWalletConfigured;

   if (leadWithInstant) {
      return (
         <div className={CONNECT_WALLET_SCREEN_CLASS}>
            <OnboardingHeader
               title="Create Your Wallet"
               tooltip="Your Moodeng wallet holds your USDC loans and builds your Trust Score. It's created instantly from your login — no app and no seed phrase — and it's fully yours: you can export its key anytime. We never ask for your private keys or seed phrase."
            />

            <div className="flex flex-1 flex-col items-center justify-center px-md-4 text-center">
               {/* Moodeng hippo holding a card — this screen creates the app's own embedded
                   wallet, so the brand mascot (never the Base logo) makes clear it's a Moodeng
                   wallet you're creating, not an external one you're connecting. */}
               <img
                  src="/hippos/hippo-wallet.png"
                  alt="Moodeng wallet"
                  className="mb-md-3 h-28 w-auto max-w-[200px] object-contain drop-shadow-[0_18px_40px_rgba(96,16,210,0.22)]"
               />
               <div className="mb-md-5 flex max-w-[320px] flex-col items-center gap-md-2">
                  <h2 className="text-[32px] font-semibold leading-[1.12] text-md-heading dark:text-md-neutral-100">
                     Create your wallet
                  </h2>
                  <p className="max-w-[280px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                     Hold your loans and build your Trust Score.
                  </p>
               </div>
               <InstantWalletButton onClick={onCreateInstantWallet} isDisabled={isCreatingInstantWallet} />
               {isCreatingInstantWallet && !instantWalletError ? (
                  <p className="mt-md-2 max-w-[360px] text-md-b3 font-medium text-md-neutral-700">
                     Setting up your wallet — this takes a few seconds. Keep this screen open.
                  </p>
               ) : null}
               {instantWalletError ? (
                  <p className="mt-md-2 max-w-[360px] text-md-b3 font-medium text-md-red-500">{instantWalletError}</p>
               ) : null}
               {/* Quiet secondary for the rare borrower who already has a Base wallet. Hidden when
                   the network is blocking keys.coinbase.com, since a Base connect would dead-end. */}
               {allowBaseConnect ? (
                  <button
                     type="button"
                     onClick={connectBase}
                     disabled={isConnecting || isCreatingInstantWallet}
                     className="mt-md-4 text-md-b2 font-semibold text-md-primary-1200 underline underline-offset-4 disabled:opacity-60 dark:text-md-primary-500"
                  >
                     {isConnecting ? 'Connecting…' : 'Already have a wallet? Connect it'}
                  </button>
               ) : null}
               <WalletConnectHelp />
            </div>
         </div>
      );
   }

   return (
      <div className={CONNECT_WALLET_SCREEN_CLASS}>
         <OnboardingHeader
            title="Add Base Wallet"
            tooltip="Connecting your wallet lets Moodeng read your on-chain activity to build your Trust Score and send USDC loans directly to you. We never ask for your private keys or seed phrase."
         />

         <div className="flex flex-1 flex-col items-center justify-center px-md-4 text-center">
            <img
               src="/icons/base-wallet.svg"
               alt="Base Wallet"
               className="mb-md-3 size-16 rounded-md-xl shadow-[0_18px_56px_rgba(96,16,210,0.22)]"
            />
            <div className="mb-md-4 flex max-w-[360px] flex-col items-center gap-md-2">
               <h2 className="text-[32px] font-semibold leading-[1.12] text-md-heading dark:text-md-neutral-100">
                  Connect Your Base Wallet
               </h2>
               <p className="max-w-[360px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                  Your wallet is used to build your Trust Score and receive USDC loans.
               </p>
            </div>
            <ConnectBaseAccountButton onClick={connectBase} isDisabled={isConnecting || isCreatingInstantWallet} />
            <WalletConnectHelp />
         </div>
      </div>
   );
}

function InstantWalletButton({ onClick, isDisabled }: { onClick: () => void; isDisabled: boolean }) {
   return (
      <button
         type="button"
         onClick={onClick}
         disabled={isDisabled}
         className="flex min-h-[56px] w-full items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 shadow-[0_18px_50px_rgba(96,16,210,0.24)] disabled:opacity-60 dark:shadow-[0_18px_60px_rgba(112,16,210,0.38)]"
      >
         {isDisabled ? 'Creating your wallet…' : 'Create wallet'}
         {isDisabled ? null : (
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
   );
}

function ConnectBaseAccountButton({ onClick, isDisabled }: { onClick: () => void; isDisabled: boolean }) {
   return (
      <button
         type="button"
         onClick={onClick}
         disabled={isDisabled}
         className="flex min-h-[56px] w-full items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 shadow-[0_18px_50px_rgba(96,16,210,0.24)] disabled:opacity-60 dark:shadow-[0_18px_60px_rgba(112,16,210,0.38)]"
      >
         {isDisabled ? 'Connecting...' : 'Connect Base Wallet'}
         {isDisabled ? null : (
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
   );
}

function LenderConnectView({
   selectedKey,
   onSelect,
   onConnect,
   onMarkUserInitiated,
   onOpenOther,
   onConnectViaModal,
   isPreview,
   isConnecting,
   instantWalletConfigured,
   onCreateInstantWallet,
   isCreatingInstantWallet,
   instantWalletError
}: {
   selectedKey: WalletConnectorKey | null;
   onSelect: (key: WalletConnectorKey) => void;
   onConnect: (key: WalletConnectorKey) => void;
   onMarkUserInitiated: () => void;
   onOpenOther: () => void;
   onConnectViaModal: () => void;
   isPreview: boolean;
   isConnecting: boolean;
   instantWalletConfigured: boolean;
   onCreateInstantWallet: () => void;
   isCreatingInstantWallet: boolean;
   instantWalletError: string | null;
}) {
   const canConnect = Boolean(selectedKey) && !isConnecting;
   // Base Account keeps its existing direct-connect path. MetaMask is the default injected
   // provider (window.ethereum), so RainbowKit's WalletButton resolves it correctly. Phantom
   // does NOT: RainbowKit resolves each injected wallet's provider once at page load and falls
   // back to window.ethereum (MetaMask) when phantom.ethereum isn't present yet — so a stale or
   // absent Phantom silently connected MetaMask instead. Phantom therefore goes through the
   // RainbowKit connect modal (onConnectViaModal), which rediscovers providers live and shows
   // the QR / install instructions when Phantom isn't installed.
   const rainbowKitWalletId = !isPreview && selectedKey === 'metaMask' ? RAINBOWKIT_WALLET_ID.metaMask : null;
   const connectsViaModal = !isPreview && selectedKey === 'phantom';

   const connectButtonRef = useRef<HTMLDivElement>(null);
   // Picking a tile only highlights it — the real Connect button lives below the "Other Wallets"
   // card and is easy to miss (it's what stranded a lender who tapped a tile and saw nothing
   // happen). Scroll it into view the moment a tile is selected so the next tap is obvious.
   const handleSelect = (key: WalletConnectorKey) => {
      onSelect(key);
      requestAnimationFrame(() => {
         connectButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
   };

   const renderConnectButton = (onClick: () => void, disabled: boolean) => (
      <button
         type="button"
         disabled={disabled}
         onClick={onClick}
         className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
      >
         {isConnecting ? 'Connecting…' : selectedKey ? 'Connect Wallet' : 'Select a wallet above'}
         {!isConnecting && selectedKey ? (
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
         ) : null}
      </button>
   );

   return (
      <div className={CONNECT_WALLET_SCREEN_CLASS}>
         <OnboardingHeader title="Connect Wallet" />

         <div className="flex flex-col gap-md-4 p-md-4">
            <img src="/hippos/role-selection.png" alt="Moodeng hippo" className="w-[110px] h-[96px] object-cover" />

            <div className="flex flex-col gap-md-0">
               <h2 className="text-md-display text-md-heading">Connect Your Wallet</h2>
               <p className="text-md-b1 font-medium text-md-neutral-700">Think of this as your digital checking account.</p>
            </div>

            {/* Lenders who don't already own a wallet had no way through this screen — every
                tile assumes an app they've installed. The instant wallet is that way through:
                created from the login they already have, no app and no seed phrase. It sits
                above the picker as its own action because it CREATES a wallet rather than
                connecting one, so it must not need the "Connect Wallet" button below. */}
            {instantWalletConfigured && !isPreview ? (
               <div className="flex flex-col gap-md-2 rounded-[12px] border border-md-primary-900 bg-md-primary-100 p-md-3">
                  <div className="flex items-start gap-md-2">
                     <img src="/hippos/hippo-wallet.png" alt="" className="size-10 shrink-0 object-contain" />
                     <div className="flex min-w-0 flex-1 flex-col gap-md-0">
                        <div className="flex flex-wrap items-center gap-md-1">
                           <span className="text-md-h5 text-md-heading">Instant Wallet</span>
                           <span className="inline-flex items-center justify-center rounded-md-sm bg-md-primary-1200 px-md-1 py-md-0 text-md-b3 font-semibold text-md-neutral-100">
                              No app needed
                           </span>
                        </div>
                        <p className="text-md-b2 font-medium text-md-slate-600">
                           Created from your Moodeng login in seconds. Fully yours — export the key anytime.
                        </p>
                     </div>
                  </div>
                  <button
                     type="button"
                     onClick={onCreateInstantWallet}
                     disabled={isCreatingInstantWallet || isConnecting}
                     className="flex min-h-11 w-full items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-4 py-md-2 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
                  >
                     {isCreatingInstantWallet ? 'Creating your wallet…' : 'Create Instant Wallet'}
                  </button>
                  {/* Set expectations before the camera opens, not after. */}
                  <p className="text-md-b3 font-medium text-md-slate-600">
                     Includes a ten-second face check, so instant wallets stay one per person.
                  </p>
                  {instantWalletError ? (
                     <p className="text-md-b3 font-medium text-md-red-500">{instantWalletError}</p>
                  ) : null}
               </div>
            ) : null}

            {instantWalletConfigured && !isPreview ? (
               <div className="flex items-center gap-md-2">
                  <span className="h-px flex-1 bg-md-neutral-600" />
                  <span className="text-md-b3 font-medium text-md-slate-600">or connect one you already own</span>
                  <span className="h-px flex-1 bg-md-neutral-600" />
               </div>
            ) : null}

            <div className="grid grid-cols-2 gap-md-4">
               {LENDER_WALLET_OPTIONS.map((option) => {
                  const isSelected = selectedKey === option.key;
                  return (
                     <button
                        key={option.key}
                        type="button"
                        onClick={() => handleSelect(option.key)}
                        className={[
                           'flex flex-col gap-md-3 items-start p-md-3 rounded-[12px] border text-left transition-colors',
                           isSelected ? 'bg-md-primary-900/10 border-md-primary-900' : 'bg-white border-md-neutral-600'
                        ].join(' ')}
                     >
                        <div className="size-8 rounded-md-xs inline-flex items-center justify-center overflow-hidden shrink-0">
                           <img src={option.iconSrc} alt={option.name} className="size-8 object-contain" />
                        </div>
                        <div className="flex flex-col gap-md-0 w-full">
                           <div className="flex flex-wrap items-center gap-md-1">
                              <span className="text-md-h5 text-md-heading">{option.name}</span>
                              {option.tag ? (
                                 <span
                                    className={`inline-flex items-center justify-center px-md-1 py-md-0 rounded-md-sm text-md-b3 font-semibold ${option.tag.bgClass} ${option.tag.textClass}`}
                                 >
                                    {option.tag.label}
                                 </span>
                              ) : null}
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
                  <span className="text-md-b2 font-medium text-md-slate-700">Trust, Rainbow, Argent &amp; more supported wallets</span>
               </div>
            </button>

            <div ref={connectButtonRef} className="flex flex-col gap-md-1 scroll-mt-md-4">
               {connectsViaModal ? (
                  renderConnectButton(onConnectViaModal, !canConnect)
               ) : rainbowKitWalletId ? (
                  <WalletButton.Custom wallet={rainbowKitWalletId}>
                     {({ connect, ready }) =>
                        renderConnectButton(() => {
                           onMarkUserInitiated();
                           void connect();
                        }, !canConnect || !ready)
                     }
                  </WalletButton.Custom>
               ) : (
                  renderConnectButton(() => selectedKey && onConnect(selectedKey), !canConnect)
               )}
               <p className="text-md-b3 text-md-slate-500 text-center">All wallets support gasless transactions on Base network</p>
            </div>

            <div className="flex justify-center">
               <WalletConnectHelp />
            </div>
         </div>
      </div>
   );
}
