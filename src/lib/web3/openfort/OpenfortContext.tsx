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

import { getOpenfortClient } from '@/lib/web3/openfort/client';
import {
   OPENFORT_CHAIN_ID,
   OPENFORT_CONNECTOR_NAME,
   OPENFORT_WALLET_PROVIDER,
   isOpenfortConfigured
} from '@/lib/web3/openfort/config';
import {
   exportEmbeddedPrivateKey,
   logoutEmbeddedWallet,
   provisionEmbeddedWallet,
   sendUsdcFromEmbeddedWallet
} from '@/lib/web3/openfort/embeddedWallet';
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
   /** Provision (or recover) the wallet from a user tap, lock it to the account, resolve to the address. */
   connect: () => Promise<string | null>;
   /** Clear the local signer + Openfort auth (does not unlock or delete the wallet). */
   disconnect: () => Promise<void>;
   /** Send USDC as a sponsored, gasless userOp. Returns the tx/userOp hash. */
   sendUsdc: (args: { to: string; usdAmount: string }) => Promise<`0x${string}`>;
   /** Reveal the private key so the borrower can leave for MetaMask/Trust. */
   exportPrivateKey: () => Promise<string>;
}

const OpenfortContext = createContext<OpenfortContextValue | null>(null);

const toMessage = (err: unknown): string =>
   err instanceof Error ? err.message : typeof err === 'string' ? err : 'Something went wrong creating your wallet.';

export function OpenfortProvider({ children }: { children: ReactNode }) {
   const dispatch = useDispatch<AppDispatch>();
   const storedWalletProvider = useSelector((state: RootState) => state.auth.user?.walletProvider);
   const configured = isOpenfortConfigured();

   const [status, setStatus] = useState<OpenfortStatus>(configured ? 'idle' : 'unconfigured');
   const [address, setAddress] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);

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

   const connect = useCallback(async (): Promise<string | null> => {
      if (!configured) {
         setError('Instant wallet is not available right now.');
         return null;
      }
      setStatus('connecting');
      setError(null);
      try {
         const account = await provisionEmbeddedWallet();
         setAddress(account.address);
         setStatus('ready');

         // Lock the borrower to this smart account (mirrors useWalletSync for wagmi wallets).
         // A failure here doesn't invalidate a successfully-created wallet — the address is
         // deterministic per user, so a later retry re-locks the same address idempotently.
         try {
            await dispatch(
               updateUser({
                  walletAddress: account.address,
                  walletProvider: OPENFORT_WALLET_PROVIDER,
                  walletConnectorName: OPENFORT_CONNECTOR_NAME,
                  walletChainId: OPENFORT_CHAIN_ID
               })
            ).unwrap();
         } catch (syncErr) {
            console.error('[Openfort] wallet-lock sync failed', syncErr);
         }

         return account.address;
      } catch (err) {
         setError(toMessage(err));
         setStatus('error');
         return null;
      }
   }, [configured, dispatch]);

   const disconnect = useCallback(async () => {
      try {
         await logoutEmbeddedWallet();
      } finally {
         setAddress(null);
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
         connect,
         disconnect,
         sendUsdc,
         exportPrivateKey: exportEmbeddedPrivateKey
      }),
      [configured, status, address, error, connect, disconnect, sendUsdc]
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
