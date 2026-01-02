import { useEffect } from 'react';

import { useAccount, useChainId } from 'wagmi';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import { useWalletSync } from '@/hooks/useWalletSync';

/**
 * Component to initialize wallet synchronization
 * Must be inside WagmiProvider and Redux Provider
 * 
 * With RainbowKit 2.x configured to only allow Base Sepolia,
 * wallet connection should be straightforward - no polling or auto-switching needed.
 */
export function WalletSyncInitializer() {
   useWalletSync();
   
   const { isConnected, address, connector } = useAccount();
   const chainId = useChainId();
   
   // Log connection state for debugging
   useEffect(() => {
      if (isConnected) {
         console.log('[WalletSync] Connected:', {
            address: address?.slice(0, 6) + '...' + address?.slice(-4),
            connector: connector?.name,
            chainId,
            expectedChainId: ALLOWED_CHAIN_ID,
            isCorrectChain: chainId === ALLOWED_CHAIN_ID
         });
      } else {
         console.log('[WalletSync] Disconnected');
      }
   }, [isConnected, address, connector, chainId]);
   
   return null;
}
