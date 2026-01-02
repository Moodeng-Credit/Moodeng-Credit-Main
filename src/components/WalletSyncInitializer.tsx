

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAccount, useAccountEffect, useChainId, useConfig, useSwitchChain } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
import { reconnect } from '@wagmi/core';

import { ALLOWED_CHAIN_ID, getAllowedChainConfig } from '@/config/wagmiConfig';
import { useWalletSync } from '@/hooks/useWalletSync';

// Get chain config dynamically based on ALLOWED_CHAIN_ID
const getAllowedChainParams = () => {
   const chainConfig = getAllowedChainConfig();
   // Use baseSepolia or base depending on environment
   const chainDetails = ALLOWED_CHAIN_ID === baseSepolia.id ? baseSepolia : base;
   
   return {
      chainId: `0x${ALLOWED_CHAIN_ID.toString(16)}`,
      chainName: chainConfig.displayName || chainDetails.name,
      nativeCurrency: chainDetails.nativeCurrency,
      rpcUrls: [chainDetails.rpcUrls.default.http[0]],
      blockExplorerUrls: chainDetails.blockExplorers ? [chainDetails.blockExplorers.default.url] : []
   };
};

// Chain parameters for adding to wallet (computed once)
const ALLOWED_CHAIN_PARAMS = getAllowedChainParams();

/**
 * Component to initialize wallet synchronization
 * Must be inside WagmiProvider and Redux Provider
 */
export function WalletSyncInitializer() {
   useWalletSync();
   
   const config = useConfig();
   const { isConnected, chainId: accountChainId, connector } = useAccount();
   const chainId = useChainId(); // More reliable chain detection
   const { switchChain, isPending: isSwitching } = useSwitchChain();
   const [switchAttempted, setSwitchAttempted] = useState(false);
   const [manualSwitching, setManualSwitching] = useState(false);
   const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   
   // Log initial mount
   useEffect(() => {
      console.log(`[WalletSync] Mounted - useChainId: ${chainId}, accountChainId: ${accountChainId}, expected: ${ALLOWED_CHAIN_ID}`);
   }, []);
   
   // Reset state when disconnected
   useEffect(() => {
      if (!isConnected) {
         console.log('[WalletSync] Disconnected - resetting state');
         setSwitchAttempted(false);
         setManualSwitching(false);
         if (switchTimeoutRef.current) {
            clearTimeout(switchTimeoutRef.current);
            switchTimeoutRef.current = null;
         }
      }
   }, [isConnected]);
   
   // Timeout to clear stuck switching state and force reconnect
   useEffect(() => {
      if (isSwitching || manualSwitching) {
         console.log(`[WalletSync] Switching in progress - isSwitching: ${isSwitching}, manualSwitching: ${manualSwitching}`);
         const timeout = setTimeout(async () => {
            console.log('[WalletSync] Switch timeout (8s) - forcing reconnect to refresh state...');
            setManualSwitching(false);
            // Force wagmi to reconnect and refresh chain state
            try {
               const result = await reconnect(config);
               console.log('[WalletSync] Reconnect result:', JSON.stringify(result));
            } catch (e) {
               console.log('[WalletSync] Reconnect error:', e);
            }
         }, 8000); // 8 second timeout
         
         return () => clearTimeout(timeout);
      }
   }, [isSwitching, manualSwitching, config]);

   // Function to add chain to wallet and switch
   const addChainAndSwitch = useCallback(async () => {
      if (!connector || !window.ethereum) return;
      
      try {
         // First try to add the chain (will be ignored if already exists)
         const provider = await connector.getProvider?.();
         if (provider && 'request' in provider) {
            try {
               await (provider as { request: (args: { method: string; params: unknown[] }) => Promise<unknown> }).request({
                  method: 'wallet_addEthereumChain',
                  params: [ALLOWED_CHAIN_PARAMS]
               });
               console.log('[WalletSync] Chain added or already exists');
            } catch (addError) {
               // Chain might already exist, continue to switch
               console.log('[WalletSync] Add chain result:', addError);
            }
         }
      } catch (err) {
         console.error('[WalletSync] Error adding chain:', err);
      }
   }, [connector]);
   
   // Listen for connection events to handle mobile WalletConnect
   useAccountEffect({
      onConnect: async ({ chainId: connectedChainId, connector: connectedConnector }) => {
         console.log(`[WalletSync] Connected! Chain: ${connectedChainId}, Expected: ${ALLOWED_CHAIN_ID}`);
         
         if (connectedChainId !== ALLOWED_CHAIN_ID) {
            console.log('[WalletSync] Wrong chain on connect, will switch...');
            setSwitchAttempted(false);
            
            // Small delay for mobile WalletConnect session to fully establish
            switchTimeoutRef.current = setTimeout(async () => {
               setManualSwitching(true);
               
               // For mobile/WalletConnect, use direct RPC calls for better reliability
               const isMobileOrWalletConnect = 
                  connectedConnector?.type === 'walletConnect' || 
                  connectedConnector?.id?.includes('walletConnect') ||
                  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
               
               if (isMobileOrWalletConnect) {
                  console.log('[WalletSync] Mobile/WalletConnect detected, using direct RPC');
                  
                  try {
                     const provider = await connectedConnector.getProvider?.();
                     if (provider && 'request' in provider) {
                        const rpcProvider = provider as { request: (args: { method: string; params: unknown[] }) => Promise<unknown> };
                        
                        // First try wallet_switchEthereumChain
                        try {
                           await rpcProvider.request({
                              method: 'wallet_switchEthereumChain',
                              params: [{ chainId: `0x${ALLOWED_CHAIN_ID.toString(16)}` }]
                           });
                           console.log('[WalletSync] wallet_switchEthereumChain succeeded');
                        } catch (switchError: unknown) {
                           // If chain doesn't exist (error 4902), add it first
                           if ((switchError as { code?: number })?.code === 4902) {
                              console.log('[WalletSync] Chain not found, adding it first...');
                              await rpcProvider.request({
                                 method: 'wallet_addEthereumChain',
                                 params: [ALLOWED_CHAIN_PARAMS]
                              });
                           } else {
                              console.log('[WalletSync] wallet_switchEthereumChain error:', switchError);
                              // Fall back to wagmi's switchChain
                              switchChain?.({ chainId: ALLOWED_CHAIN_ID });
                           }
                        }
                     }
                  } catch (err) {
                     console.error('[WalletSync] Direct RPC error, falling back:', err);
                     switchChain?.({ chainId: ALLOWED_CHAIN_ID });
                  }
               } else {
                  // Desktop: use wagmi's switchChain
                  await addChainAndSwitch();
                  switchChain?.({ chainId: ALLOWED_CHAIN_ID });
               }
               
               setSwitchAttempted(true);
            }, 500); // Reduced delay for faster UX
         }
      }
   });
   
   // Clear switching state when chain actually changes to correct one
   // useChainId() is the reliable source - if it shows correct chain, we're good
   useEffect(() => {
      if (chainId === ALLOWED_CHAIN_ID && (manualSwitching || isSwitching)) {
         console.log('[WalletSync] useChainId() shows correct chain:', chainId);
         setManualSwitching(false);
         setSwitchAttempted(true);
      }
   }, [chainId, manualSwitching, isSwitching]);
   
   // Poll provider directly for chain changes (WalletConnect doesn't always emit events)
   useEffect(() => {
      if (!isConnected || !connector) return;
      
      // If useChainId() already shows correct chain, no need to poll
      if (chainId === ALLOWED_CHAIN_ID) {
         console.log('[WalletSync] Already on correct chain per useChainId(), skipping poll');
         return;
      }
      
      let pollInterval: NodeJS.Timeout | null = null;
      
      const pollChainFromProvider = async () => {
         try {
            const provider = await connector.getProvider?.();
            if (provider && 'request' in provider) {
               const hexChainId = await (provider as { request: (args: { method: string }) => Promise<string> }).request({
                  method: 'eth_chainId'
               });
               const providerChainId = parseInt(hexChainId, 16);
               console.log(`[WalletSync] Provider reports chain: ${providerChainId}, useChainId: ${chainId}, accountChainId: ${accountChainId}`);
               
               // If provider reports correct chain but wagmi doesn't know
               if (providerChainId === ALLOWED_CHAIN_ID && chainId !== ALLOWED_CHAIN_ID) {
                  console.log(`[WalletSync] Provider on correct chain (${providerChainId}) but wagmi shows ${chainId} - forcing reconnect`);
                  await reconnect(config);
               }
            }
         } catch (e) {
            console.log('[WalletSync] Poll error:', e);
         }
      };
      
      // Start polling after a switch attempt
      if (switchAttempted || manualSwitching) {
         console.log('[WalletSync] Starting provider chain polling...');
         pollInterval = setInterval(pollChainFromProvider, 2000); // Poll every 2 seconds
         
         // Also poll immediately
         pollChainFromProvider();
      }
      
      return () => {
         if (pollInterval) {
            clearInterval(pollInterval);
         }
      };
   }, [isConnected, connector, chainId, accountChainId, switchAttempted, manualSwitching, config]);
   
   // Fallback: Only trigger switch if useChainId() shows wrong chain
   // Don't use accountChainId as it can be stale on mobile
   useEffect(() => {
      if (isConnected && chainId !== ALLOWED_CHAIN_ID && !isSwitching && !manualSwitching && !switchAttempted) {
         console.log(`[WalletSync] useChainId() mismatch (${chainId} vs ${ALLOWED_CHAIN_ID}), triggering switch...`);
         
         // Debounce to avoid multiple rapid switches
         if (switchTimeoutRef.current) {
            clearTimeout(switchTimeoutRef.current);
         }
         
         switchTimeoutRef.current = setTimeout(() => {
            setManualSwitching(true);
            switchChain?.({ chainId: ALLOWED_CHAIN_ID });
            setSwitchAttempted(true);
         }, 500);
      }
   }, [isConnected, chainId, isSwitching, manualSwitching, switchAttempted, switchChain]);
   
   // Cleanup
   useEffect(() => {
      return () => {
         if (switchTimeoutRef.current) {
            clearTimeout(switchTimeoutRef.current);
         }
      };
   }, []);
   
   return null;
}
