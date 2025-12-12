'use client';

import { useEffect } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useDisconnect, useReconnect } from 'wagmi';

import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

/**
 * Hook to synchronize wallet connection with user's stored wallet address
 * 
 * This hook handles:
 * 1. Auto-reconnecting wallet when user logs in (if they have a stored wallet)
 * 2. Updating user's wallet address when they connect a new wallet
 * 3. Disconnecting wallet if user switches to a different account with a different wallet
 */
export function useWalletSync() {
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { disconnect } = useDisconnect();
   const { reconnect } = useReconnect();
   const { openConnectModal } = useConnectModal();
   
   const username = useSelector((state: RootState) => state.auth.username);
   const storedWalletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);

   // Auto-reconnect wallet when user logs in
   useEffect(() => {
      if (!username) return;

      // If user has a stored wallet but wallet is not connected, try to reconnect
      if (storedWalletAddress && !account.isConnected) {
         // Attempt reconnect which uses wagmi's persisted state
         reconnect();
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
   }, [username, storedWalletAddress, account.isConnected, account.address, reconnect, disconnect]);

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
      openConnectModal
   };
}
