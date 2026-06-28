import { useCallback, useEffect, useRef, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useAccountEffect, useDisconnect } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import {
   areWalletAddressesEqual,
   formatWalletAddressShort,
   getWalletProviderFromConnector,
   isBaseWalletProvider
} from '@/lib/walletProvider';
import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

/**
 * Hook to synchronize wallet connection with user's stored wallet address
 *
 * This hook handles:
 * 1. Keeping wallet connected when user logs in to the same account (stored wallet matches connected wallet)
 * 2. Disconnecting wallet when user switches to a different account (stored wallet differs from connected wallet)
 * 3. Allowing initial wallet connection when no stored wallet exists
 * 4. Saving the most recent wallet address as the stored wallet
 * 5. Showing error toast when wallet is already attached to another account
 */
export function useWalletSync() {
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { disconnect } = useDisconnect();
   const { openConnectModal } = useConnectModal();
   const { showToast } = useToast();

   const username = useSelector((state: RootState) => state.auth.username);
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const storedWalletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const storedWalletChainId = useSelector((state: RootState) => state.auth.user?.walletChainId);
   const storedWalletConnectorName = useSelector((state: RootState) => state.auth.user?.walletConnectorName);
   const storedWalletProvider = useSelector((state: RootState) => state.auth.user?.walletProvider);
   const userRole = useSelector((state: RootState) => state.auth.user?.userRole);
   const [hasShownWalletPrompt, setHasShownWalletPrompt] = useState(false);
   const isConnecting = useRef(false);

   const showSuccessToast = useCallback(
      (address: string) => {
         showToast(
            TOAST_TYPES.SUCCESS,
            'Wallet Connected',
            `Successfully connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
            undefined,
            undefined
         );
      },
      [showToast]
   );

   // Track connection intent to show success toast
   useAccountEffect({
      onConnect: () => {
         isConnecting.current = true;
      },
      onDisconnect: () => {
         isConnecting.current = false;
      }
   });

   // Consolidated Success Logic: Fires for BOTH initial connection (after DB update)
   // and reconnection (immediately on connect)
   useEffect(() => {
      if (!isConnecting.current || !account.address || !storedWalletAddress) return;

      if (account.address.toLowerCase() === storedWalletAddress.toLowerCase()) {
         showSuccessToast(account.address);
         isConnecting.current = false; // Reset intent so it doesn't fire again on re-renders
      }
   }, [account.address, storedWalletAddress, showSuccessToast]);

   useEffect(() => {
      if (!isAuthChecked || !username || !userId || !account.isConnected || !account.address) {
         return;
      }

      const connectedAddress = account.address.toLowerCase();
      const walletProvider = getWalletProviderFromConnector({
         connectorId: account.connector?.id,
         connectorName: account.connector?.name
      });

      if (userRole === 'borrower' && !isBaseWalletProvider(walletProvider)) {
         showToast(
            TOAST_TYPES.ERROR,
            'Use Base Account',
            'Borrowers must lock a Base Account so loans and repayments stay tied to one public record.',
            undefined,
            undefined
         );
         disconnect();
         return;
      }

      // Mismatch enforcement is borrower-only on purpose. A borrower's saved wallet is
      // their locked Base Account — their on-chain identity/repayment anchor — so a
      // different wallet must be rejected. A lender's saved wallet is NOT load-bearing:
      // funding uses the live-connected wallet (UserCard) and repayment uses the per-loan
      // lender_wallet snapshot (UserPay), so locking lenders to one address protects
      // nothing and only causes friction. Previously this ran for everyone, which showed
      // lenders a "reconnect your saved wallet" toast at the same instant the save effect
      // below silently overwrote that saved wallet — a contradiction. For lenders we let
      // the saved value simply follow the connected wallet; fraud is handled out-of-band
      // (detection + review), not by gating the wallet UX here.
      if (userRole === 'borrower' && storedWalletAddress) {
         if (!areWalletAddressesEqual(connectedAddress, storedWalletAddress)) {
            // Wallet mismatch - account switch detected, disconnect it
            showToast(
               TOAST_TYPES.ERROR,
               'Saved wallet mismatch',
               `This account is saved to ${formatWalletAddressShort(storedWalletAddress)}. Connect that Base Account, or update the saved wallet from Account Settings.`,
               undefined,
               undefined
            );
            disconnect();
         }
      }
      // Lenders, or anyone with no stored wallet: allow the connection.
   }, [
      account.address,
      account.connector?.id,
      account.connector?.name,
      account.isConnected,
      account.status,
      disconnect,
      isAuthChecked,
      showToast,
      storedWalletAddress,
      userId,
      username,
      userRole
   ]);

   // Track when wallet connection reminder has been shown
   useEffect(() => {
      if (!username || !storedWalletAddress || account.isConnected || hasShownWalletPrompt) {
         return;
      }

      setHasShownWalletPrompt(true);
   }, [username, storedWalletAddress, account.isConnected, hasShownWalletPrompt]);

   // Save wallet address when user connects a wallet
   useEffect(() => {
      if (!isAuthChecked || !username || !userId || !account.isConnected || !account.address) return;

      const connectedAddress = account.address.toLowerCase();
      const storedAddress = storedWalletAddress?.toLowerCase();
      const walletProvider = getWalletProviderFromConnector({
         connectorId: account.connector?.id,
         connectorName: account.connector?.name
      });
      const walletConnectorName = account.connector?.name ?? null;
      const walletChainId = account.chainId ?? null;

      if (userRole === 'borrower' && !isBaseWalletProvider(walletProvider)) {
         return;
      }

      const shouldUpdateAddress = connectedAddress !== storedAddress;
      const shouldUpdateProvider =
         connectedAddress === storedAddress &&
         (storedWalletProvider !== walletProvider ||
            storedWalletConnectorName !== walletConnectorName ||
            (walletChainId !== null && storedWalletChainId !== walletChainId));

      if (shouldUpdateAddress || shouldUpdateProvider) {
         dispatch(
            updateUser({
               walletAddress: account.address,
               walletChainId,
               walletConnectorName,
               walletProvider
            })
         )
            .unwrap()
            .then(() => {
               // wallet details saved successfully
            })
            .catch((error) => {
               console.error('Failed to save wallet address:', error);

               // Check if it's a duplicate wallet constraint error
               const errorMessage = error?.message || '';
               const errorCode = error?.code || '';

               if (errorCode === '23505' && errorMessage.includes('users_wallet_address_key')) {
                  // Wallet is already attached to another account
                  showToast(
                     TOAST_TYPES.ERROR,
                     'Wallet Already Attached',
                     'This wallet is already connected to another account. Please use a different wallet or disconnect it from the other account first.',
                     undefined,
                     undefined
                  );
               } else if (/auth|session|jwt|authenticated/i.test(errorMessage)) {
                  showToast(
                     TOAST_TYPES.ERROR,
                     'Sign in again',
                     'Your login session expired before Moodeng could lock this wallet. Please sign in again, then connect your Base wallet.',
                     undefined,
                     undefined
                  );
               } else {
                  // Generic error with logs
                  const errorDetails = `Code: ${errorCode}\nMessage: ${errorMessage}`;
                  showToast(
                     TOAST_TYPES.ERROR,
                     'Failed to Connect Wallet',
                     `Could not save wallet connection. This might occur if the wallet is already in use.\n\nError: ${errorMessage || 'Unknown error'}`,
                     undefined,
                     undefined
                  );
                  console.error('Wallet connection error details:', errorDetails);
               }

               // Disconnect the wallet on error
               disconnect();
            });
      }
   }, [
      account.isConnected,
      account.address,
      account.chainId,
      account.connector?.id,
      account.connector?.name,
      isAuthChecked,
      username,
      userId,
      storedWalletAddress,
      storedWalletChainId,
      storedWalletConnectorName,
      storedWalletProvider,
      userRole,
      dispatch,
      showToast,
      disconnect
   ]);

   return {
      isWalletConnected: account.isConnected,
      walletAddress: account.address,
      storedWalletAddress,
      shouldConnectWallet: Boolean(username && storedWalletAddress && !account.isConnected),
      openConnectModal
   };
}
