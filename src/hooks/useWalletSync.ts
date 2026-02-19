

import { useCallback, useEffect, useRef, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useAccountEffect, useDisconnect } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

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
   const storedWalletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);
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
      onConnect: (data) => {
         console.log('[WalletSync] onConnect Event:', data);
         isConnecting.current = true;
      },
      onDisconnect: () => {
         console.log('[WalletSync] onDisconnect Event');
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
      console.log('[WalletSync] State Check:', {
         username,
         storedWalletAddress,
         isConnected: account.isConnected,
         accountAddress: account.address,
         status: account.status,
         connector: account.connector?.name
      });

      if (!username || !account.isConnected || !account.address) {
         if (account.status === 'reconnecting') {
            console.log('[WalletSync] Still reconnecting...');
         }
         return;
      }

      const connectedAddress = account.address.toLowerCase();

      // If user has a stored wallet that doesn't match the connected one
      if (storedWalletAddress) {
         const storedAddress = storedWalletAddress.toLowerCase();

         if (connectedAddress !== storedAddress) {
            // Wallet mismatch - account switch detected, disconnect it
            console.log(
               `Wallet mismatch detected - disconnecting wallet (connected: ${connectedAddress.slice(0, 6)}..., stored: ${storedAddress.slice(0, 6)}...)`
            );
            disconnect();
         }
      }
      // If no stored wallet, allow the connection (initial connection scenario)
   }, [username, storedWalletAddress, account.isConnected, account.address, disconnect]);

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

   // Save wallet address when user connects a wallet
   useEffect(() => {
      if (!username || !account.isConnected || !account.address) return;

      const connectedAddress = account.address.toLowerCase();
      const storedAddress = storedWalletAddress?.toLowerCase();

      // Only update if the address is different from what's stored
      if (connectedAddress !== storedAddress) {
         dispatch(updateUser({ walletAddress: account.address }))
            .unwrap()
            .then(() => {
               console.log('Wallet address saved successfully');
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
   }, [account.isConnected, account.address, username, storedWalletAddress, dispatch, showToast, disconnect]);

   return {
      isWalletConnected: account.isConnected,
      walletAddress: account.address,
      storedWalletAddress,
      shouldConnectWallet: Boolean(username && storedWalletAddress && !account.isConnected),
      openConnectModal
   };
}
