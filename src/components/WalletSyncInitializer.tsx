'use client';

import { useWalletSync } from '@/hooks/useWalletSync';

/**
 * Component to initialize wallet synchronization
 * Must be inside WagmiProvider and Redux Provider
 */
export function WalletSyncInitializer() {
   useWalletSync();
   return null;
}
