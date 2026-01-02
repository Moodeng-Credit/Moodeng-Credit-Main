

import { useCallback, useEffect, useRef, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useAccountEffect, useDisconnect, useSwitchChain } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
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
   const { switchChainAsync } = useSwitchChain();
   const { openConnectModal, connectModalOpen } = useConnectModal();
   const { showToast } = useToast();

   const username = useSelector((state: RootState) => state.auth.username);
   const storedWalletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const [hasShownWalletPrompt, setHasShownWalletPrompt] = useState(false);
   
   // Use refs for internal state tracking
   const isConnecting = useRef(false);
   const chainSwitchAttempted = useRef(false);

   // Track connection intent when RainbowKit modal opens
   // This ensures that even if the user uses a standard ConnectButton,
   // we know they are intentionally connecting and won't trigger mismatch disconnects.
   useEffect(() => {
      if (connectModalOpen) {
         setConnectionIntent(true);
         isConnecting.current = true;
      }
   }, [connectModalOpen]);
   
   // Use state + effect to persist connection intent across mobile reloads
   const [connectionIntent, setConnectionIntent] = useState(() => {
      if (typeof window === 'undefined') return false;
      return sessionStorage.getItem('wallet_connection_intent') === 'true';
   });

   useEffect(() => {
      if (connectionIntent) {
         sessionStorage.setItem('wallet_connection_intent', 'true');
      } else {
         sessionStorage.removeItem('wallet_connection_intent');
      }
   }, [connectionIntent]);

   // Poll sessionStorage to stay in sync with WalletConnectionLoader
   useEffect(() => {
      const checkIntent = () => {
         const intent = sessionStorage.getItem('wallet_connection_intent') === 'true';
         if (intent !== connectionIntent) {
            setConnectionIntent(intent);
            if (intent) isConnecting.current = true;
         }
      };
      const interval = setInterval(checkIntent, 500);
      return () => clearInterval(interval);
   }, [connectionIntent]);

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

   // Wrap openConnectModal to track intent
   const handleOpenConnectModal = useCallback(() => {
      setConnectionIntent(true);
      isConnecting.current = true;
      openConnectModal?.();
   }, [openConnectModal]);

   // Track connection intent to show success toast
   useAccountEffect({
      onConnect: () => {
         // If we had intent, or if there's no stored wallet, we treat it as a fresh connection
         if (connectionIntent || !storedWalletAddress) {
            isConnecting.current = true;
         }
         setConnectionIntent(false);
         // Reset chain switch flag when wallet connects
         chainSwitchAttempted.current = false;
      },
      onDisconnect: () => {
         isConnecting.current = false;
         setConnectionIntent(false);
         chainSwitchAttempted.current = false;
      }
   });

   // Automatically switch to the allowed chain when wallet connects
   useEffect(() => {
      if (!account.isConnected || !account.address || account.chainId === ALLOWED_CHAIN_ID) {
         return;
      }

      // Only attempt once per connection
      if (chainSwitchAttempted.current) {
         return;
      }

      chainSwitchAttempted.current = true;

      // Auto-switch to the allowed chain
      switchChainAsync({ chainId: ALLOWED_CHAIN_ID }).catch((error) => {
         console.warn('Failed to auto-switch to allowed chain:', error);
         // This is a warning only - user can manually switch later
      });
   }, [account.isConnected, account.address, account.chainId, switchChainAsync]);

   // Consolidated Success Logic: Fires for BOTH initial connection (after DB update)
   // and reconnection (immediately on connect)
   useEffect(() => {
      if (!isConnecting.current || !account.address || !storedWalletAddress) return;

      if (account.address.toLowerCase() === storedWalletAddress.toLowerCase()) {
         showSuccessToast(account.address);
         isConnecting.current = false; // Reset intent so it doesn't fire again on re-renders
      }
   }, [account.address, storedWalletAddress, showSuccessToast]);

   // Sync wallet connection with user's stored wallet address
   useEffect(() => {
      // Skip check if we are in the middle of connecting or reconnecting
      // On mobile, we want to be more lenient with 'connecting' status to allow the DB update to trigger
      if (!username || !account.isConnected || !account.address || account.status === 'reconnecting') {
         return;
      }

      const connectedAddress = account.address.toLowerCase();
      const storedAddress = storedWalletAddress?.toLowerCase();

      // If we are in sync, we can clear the connection intent
      if (connectedAddress === storedAddress && connectionIntent) {
         setConnectionIntent(false);
      }

      // Only act if the address is different from what's stored
      if (connectedAddress !== storedAddress) {
         // If we have a stored address and we are NOT currently connecting (i.e. it's a stale auto-connect)
         // We also check connectionIntent as a fallback for mobile reloads
         if (storedAddress && !isConnecting.current && !connectionIntent && account.status !== 'connecting') {
            console.log(
               `Wallet mismatch detected - disconnecting stale wallet (connected: ${connectedAddress.slice(0, 6)}..., stored: ${storedAddress.slice(0, 6)}...)`
            );
            disconnect();
            return;
         }

         // Otherwise, we are either connecting for the first time or explicitly changing wallet
         console.log('Updating wallet address in database...');
         dispatch(updateUser({ walletAddress: account.address }))
            .unwrap()
            .then(() => {
               console.log('Wallet address saved successfully');
               setConnectionIntent(false); // Clear intent after successful DB update
            })
            .catch((error) => {
               console.error('Failed to save wallet address:', error);

               // Check if it's a duplicate wallet constraint error
               const errorMessage = error?.message || '';
               const errorCode = error?.code || '';

               if (errorCode === '23505' && errorMessage.includes('users_wallet_address_key')) {
                  showToast(
                     TOAST_TYPES.ERROR,
                     'Wallet Already Attached',
                     'This wallet is already connected to another account. Please use a different wallet or disconnect it from the other account first.',
                     undefined,
                     undefined
                  );
               } else {
                  showToast(
                     TOAST_TYPES.ERROR,
                     'Failed to Connect Wallet',
                     `Could not save wallet connection: ${errorMessage || 'Unknown error'}`,
                     undefined,
                     undefined
                  );
               }

               // Disconnect the wallet on error
               disconnect();
            });
      }
   }, [account.isConnected, account.address, username, storedWalletAddress, dispatch, showToast, disconnect]);

   // Show wallet connection reminder if user has stored wallet but not connected
   useEffect(() => {
      if (!username || !storedWalletAddress || account.isConnected || hasShownWalletPrompt) {
         return;
      }

      // Show a console message reminding user to connect their wallet
      console.log(
         `Reminder: You have a wallet address stored (${storedWalletAddress.slice(0, 6)}...${storedWalletAddress.slice(-4)}). Please connect your wallet.`
      );
      setHasShownWalletPrompt(true);
   }, [username, storedWalletAddress, account.isConnected, hasShownWalletPrompt]);

   return {
      isWalletConnected: account.isConnected,
      walletAddress: account.address,
      storedWalletAddress,
      shouldConnectWallet: Boolean(username && storedWalletAddress && !account.isConnected),
      openConnectModal: handleOpenConnectModal
   };
}
