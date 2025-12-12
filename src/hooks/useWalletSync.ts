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
 * 1. Keeping wallet connected when user logs in to the same account (stored wallet matches connected wallet)
 * 2. Disconnecting wallet when user switches to a different account (stored wallet differs from connected wallet)
 * 3. Allowing initial wallet connection when no stored wallet exists
 * 4. Saving the most recent wallet address as the stored wallet
 */
export function useWalletSync() {
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { disconnect } = useDisconnect();
   const { openConnectModal } = useConnectModal();

   const username = useSelector((state: RootState) => state.auth.username);
   const storedWalletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const [hasShownWalletPrompt, setHasShownWalletPrompt] = useState(false);

   // Check for wallet mismatch with stored address and disconnect if needed
   // Account switch is detected when connected wallet doesn't match stored wallet
   useEffect(() => {
      if (!username || !account.isConnected || !account.address) {
         return;
      }

      const connectedAddress = account.address.toLowerCase();

      // If user has a stored wallet that doesn't match the connected one
      if (storedWalletAddress) {
         const storedAddress = storedWalletAddress.toLowerCase();
         
         if (connectedAddress !== storedAddress) {
            // Wallet mismatch - account switch detected, disconnect it
            console.log(`Wallet mismatch detected - disconnecting wallet (connected: ${connectedAddress.slice(0, 6)}..., stored: ${storedAddress.slice(0, 6)}...)`);
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
