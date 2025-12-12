'use client';

import { useEffect, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useDisconnect } from 'wagmi';

import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

/**
 * Hook to synchronize wallet connection with user's stored wallet address
 *
 * This hook handles:
 * 1. Showing a reminder to connect wallet if user has one stored but not connected
 * 2. Updating user's wallet address when they connect a new wallet
 * 3. Disconnecting wallet if user switches to a different account with a different/no wallet
 * 4. Warning users if they connect a wallet that doesn't match their stored address
 */
export function useWalletSync() {
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { disconnect } = useDisconnect();
   const { openConnectModal } = useConnectModal();

   const username = useSelector((state: RootState) => state.auth.username);
   const storedWalletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const [hasShownWalletPrompt, setHasShownWalletPrompt] = useState(false);

   // Check for wallet mismatch and handle disconnection when switching accounts
   useEffect(() => {
      if (!username) {
         setHasShownWalletPrompt(false);
         return;
      }

      // If user logged in with a different account and wagmi has a wallet connected
      if (account.isConnected && account.address) {
         const connectedAddress = account.address.toLowerCase();

         // If user has NO stored wallet, disconnect any connected wallet
         if (!storedWalletAddress) {
            console.log('User has no stored wallet - disconnecting current wallet');
            disconnect();
            return;
         }

         const storedAddress = storedWalletAddress.toLowerCase();

         // If the connected wallet doesn't match the stored wallet, disconnect it
         if (connectedAddress !== storedAddress) {
            console.log('Wallet mismatch - disconnecting current wallet');
            disconnect();
         }
      }
   }, [username, storedWalletAddress, account.isConnected, account.address, disconnect]);

   // Show wallet connection reminder if user has stored wallet but not connected
   useEffect(() => {
      if (!username || !storedWalletAddress || account.isConnected || hasShownWalletPrompt) {
         return;
      }

      // Show a console message reminding user to connect their wallet
      console.log(`Reminder: You have a wallet address stored (${storedWalletAddress.slice(0, 6)}...${storedWalletAddress.slice(-4)}). Please connect your wallet.`);
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
            });
      }
   }, [account.isConnected, account.address, username, storedWalletAddress, dispatch]);

   return {
      isWalletConnected: account.isConnected,
      walletAddress: account.address,
      storedWalletAddress,
      shouldConnectWallet: Boolean(username && storedWalletAddress && !account.isConnected),
      openConnectModal
   };
}
