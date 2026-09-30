// React surface for the Openfort embedded-wallet rail.
//
// Deliberately thin and self-contained: it owns the *live* connect session (provision from a
// tap, reflect READY state, expose send/export/disconnect) and writes the smart-account address
// into the borrower's wallet-lock via the existing `updateUser` path — the Openfort equivalent
// of what useWalletSync does for wagmi wallets. It never touches wagmi, so the Base rail is
// unaffected whether or not Openfort is configured.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { EmbeddedState } from '@openfort/openfort-js';
import { useDispatch, useSelector } from 'react-redux';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import { getOpenfortClient } from '@/lib/web3/openfort/client';
import { isOpenfortConfigured, OPENFORT_CHAIN_ID, OPENFORT_CONNECTOR_NAME, OPENFORT_WALLET_PROVIDER } from '@/lib/web3/openfort/config';
import {
   exportEmbeddedPrivateKey,
   logoutEmbeddedWallet,
   provisionEmbeddedWallet,
   sendUsdcFromEmbeddedWallet,
   type WalletSetupPhase
} from '@/lib/web3/openfort/embeddedWallet';
import { friendlyConnectError } from '@/lib/web3/openfort/errors';
import { reportInstantWalletFailure } from '@/lib/web3/openfort/reportFailure';
import { retryAsync } from '@/lib/web3/openfort/retry';
import { WalletGateError } from '@/lib/web3/openfort/walletFaceGate';
import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

export type OpenfortStatus = 'unconfigured' | 'idle' | 'connecting' | 'ready' | 'error';

interface OpenfortContextValue {
   /** Whether the rail is wired (env present). Consumers hide the escape hatch when false. */
   isConfigured: boolean;
   status: OpenfortStatus;
   isConnecting: boolean;
   /** The smart-account address once provisioned this session. */
   address: string | null;
   /** True when a signer is live and ready to send. */
   isConnected: boolean;
   error: string | null;
   /**
    * Set when the last connect was refused by the server-side face gate (FACE_REQUIRED,
    * FACE_DUPLICATE, …). Callers route on this: FACE_REQUIRED means "send them to the scan",
    * the others are terminal and need explaining. Null for ordinary failures.
    */
   gateCode: string | null;
   /**
    * Provision (or recover) the wallet from a user tap, lock it to the account, resolve to the address.
    * `onPhase` hears each real stage so the screen can show progress.
    */
   connect: (onPhase?: (phase: WalletSetupPhase) => void) => Promise<string | null>;
   /** Clear the local signer + Openfort auth (does not unlock or delete the wallet). */
   disconnect: () => Promise<void>;
   /** Send USDC as a sponsored, gasless userOp. Returns the tx/userOp hash. */
   sendUsdc: (args: { to: string; usdAmount: string }) => Promise<`0x${string}`>;
   /** Reveal the private key so the borrower can leave for MetaMask/Trust. */
   exportPrivateKey: () => Promise<string>;
}

const OpenfortContext = createContext<OpenfortContextValue | null>(null);

export function OpenfortProvider({ children }: { children: ReactNode }) {
   const dispatch = useDispatch<AppDispatch>();
   const { showToast } = useToast();
   const storedWalletProvider = useSelector((state: RootState) => state.auth.user?.walletProvider);
   const configured = isOpenfortConfigured();

   const [status, setStatus] = useState<OpenfortStatus>(configured ? 'idle' : 'unconfigured');
   const [address, setAddress] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [gateCode, setGateCode] = useState<string | null>(null);

   // Restore-on-reload (read-only): if this borrower is locked to Openfort and the SDK already
   // holds a READY signer for the session, hydrate the live address without a fresh tap or a
   // Shield mint. If it isn't ready, we stay 'idle' — the next connect/send provisions on demand.
   useEffect(() => {
      if (!configured || storedWalletProvider !== OPENFORT_WALLET_PROVIDER) return;
      let cancelled = false;
      (async () => {
         try {
            const openfort = getOpenfortClient();
            if ((await openfort.embeddedWallet.getEmbeddedState()) !== EmbeddedState.READY) return;
            const account = await openfort.embeddedWallet.get();
            if (!cancelled) {
               setAddress(account.address);
               setStatus('ready');
            }
         } catch {
            /* best-effort hydration; the connect/send path will provision if needed */
         }
      })();
      return () => {
         cancelled = true;
      };
   }, [configured, storedWalletProvider]);

   const connect = useCallback(async (onPhase?: (phase: WalletSetupPhase) => void): Promise<string | null> => {
      if (!configured) {
         setError('The Instant Wallet is not available right now.');
         return null;
      }
      setStatus('connecting');
      setError(null);
      setGateCode(null);
      try {
         const account = await provisionEmbeddedWallet(onPhase);
         setAddress(account.address);
         setStatus('ready');
         onPhase?.('saving');

         // Lock the borrower to this smart account (mirrors useWalletSync for wagmi wallets).
         // The wallet itself is fine if this fails — the address is deterministic per user, so a
         // later tap re-locks the same address idempotently — but swallowing the failure used to
         // leave people with a wallet on Openfort's side, nothing on their account, and a
         // "connected" screen anyway. Retry a couple of times for a flaky connection, and if it
         // still won't save, say so and stop instead of pretending it worked.
         try {
            await retryAsync(
               () =>
                  dispatch(
                     updateUser({
                        walletAddress: account.address,
                        walletProvider: OPENFORT_WALLET_PROVIDER,
                        walletConnectorName: OPENFORT_CONNECTOR_NAME,
                        walletChainId: OPENFORT_CHAIN_ID
                     })
                  ).unwrap(),
               { attempts: 3, delayMs: 700 }
            );
         } catch (syncErr) {
            console.error('[Openfort] wallet-lock sync failed', syncErr);
            reportInstantWalletFailure('link', syncErr);
            const message = "Your wallet was made, but we couldn't save it to your account. Tap the button again — you'll get the same wallet.";
            setAddress(null);
            setError(message);
            setStatus('error');
            showToast(TOAST_TYPES.ERROR, "Couldn't finish setting up your wallet", message);
            return null;
         }

         onPhase?.('done');
         return account.address;
      } catch (err) {
         console.error('[Openfort] connect failed', err);

         // The face gate refusing a mint is an expected outcome, not a failure. The caller
         // turns FACE_REQUIRED into a trip to the scan, so toasting "couldn't create your
         // wallet" here would contradict the screen we're about to show.
         if (err instanceof WalletGateError) {
            setGateCode(err.code);
            setError(err.message);
            setStatus('idle');
            return null;
         }

         reportInstantWalletFailure('create', err);
         const message = friendlyConnectError(err);
         setError(message);
         setStatus('error');
         // Inline message + an active toast, so a struggling borrower can't miss that it failed
         // and what to do next.
         showToast(TOAST_TYPES.ERROR, "Couldn't create your wallet", message);
         return null;
      }
   }, [configured, dispatch, showToast]);

   const disconnect = useCallback(async () => {
      try {
         await logoutEmbeddedWallet();
      } finally {
         setAddress(null);
         setGateCode(null);
         setStatus(configured ? 'idle' : 'unconfigured');
      }
   }, [configured]);

   const sendUsdc = useCallback(
      ({ to, usdAmount }: { to: string; usdAmount: string }) => sendUsdcFromEmbeddedWallet({ to, usdAmount }),
      []
   );

   const value = useMemo<OpenfortContextValue>(
      () => ({
         isConfigured: configured,
         status,
         isConnecting: status === 'connecting',
         address,
         isConnected: status === 'ready' && Boolean(address),
         error,
         gateCode,
         connect,
         disconnect,
         sendUsdc,
         exportPrivateKey: exportEmbeddedPrivateKey
      }),
      [configured, status, address, error, gateCode, connect, disconnect, sendUsdc]
   );

   return <OpenfortContext.Provider value={value}>{children}</OpenfortContext.Provider>;
}

export function useOpenfort(): OpenfortContextValue {
   const ctx = useContext(OpenfortContext);
   if (!ctx) {
      throw new Error('useOpenfort must be used within an OpenfortProvider');
   }
   return ctx;
}
