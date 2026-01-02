import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAccount, useSwitchChain, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import Loading from './Loading';
import type { RootState } from '@/store/store';

export const WalletConnectionLoader: React.FC = () => {
  const { isConnecting, isConnected, isReconnecting, status, address } = useAccount();
  const { isPending: isSwitchingChain } = useSwitchChain();
  const { isPending: isDisconnecting } = useDisconnect();
  const { connectModalOpen, chainModalOpen } = useConnectModal();
  const isWalletSyncing = useSelector((state: RootState) => state.auth.isWalletSyncing);
  
  // MOST CRITICAL CHECK: If we have an address, the wallet IS connected
  // This is the most reliable indicator on mobile - address presence
  const hasAddress = Boolean(address);
  
  // Track connection intent from sessionStorage - this is set when user clicks connect
  const [connectionIntent, setConnectionIntent] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('wallet_connection_intent') === 'true';
  });
  
  // Poll sessionStorage for connection intent changes
  useEffect(() => {
    const checkIntent = () => {
      const intent = sessionStorage.getItem('wallet_connection_intent') === 'true';
      setConnectionIntent(intent);
    };
    
    // Check immediately and set up interval
    checkIntent();
    const interval = setInterval(checkIntent, 200);
    
    return () => clearInterval(interval);
  }, []);
  
  // CRITICAL: Clear connection intent when wallet becomes connected
  // This handles the mobile case where useAccountEffect's onConnect may not fire
  useEffect(() => {
    if ((hasAddress || isConnected || status === 'connected') && connectionIntent) {
      sessionStorage.removeItem('wallet_connection_intent');
      setConnectionIntent(false);
    }
  }, [hasAddress, isConnected, status, connectionIntent]);
  
  // If we have an address and not doing other operations, hide the loader
  if (hasAddress && !isSwitchingChain && !isDisconnecting && !isWalletSyncing) {
    return null;
  }
  
  // SECONDARY CHECK: status === 'connected' is another reliable indicator
  if (status === 'connected' && !isSwitchingChain && !isDisconnecting && !isWalletSyncing) {
    return null;
  }
  
  // isConnected boolean check
  if (isConnected && !isSwitchingChain && !isDisconnecting && !isWalletSyncing) {
    return null;
  }
  
  // Don't show loader during automatic reconnection (page reload, etc)
  if (isReconnecting) {
    return null;
  }
  
  // IMPORTANT: Only show loader for connections if we have connectionIntent
  // This prevents showing loader from stale wagmi isConnecting state
  const showForConnection = connectionIntent && isConnecting && !hasAddress && !isConnected;
  const showForChainSwitch = isSwitchingChain;
  const showForDisconnect = isDisconnecting;
  const showForSync = isWalletSyncing;
  
  // CRITICAL: If any RainbowKit modal is open, hide our loader
  // This prevents the loader from covering the RainbowKit wallet selection or "Connecting..." screens
  // which is a common cause of "stuck" UI on mobile.
  if (connectModalOpen || chainModalOpen) {
    return null;
  }
  
  const shouldShow = showForConnection || showForChainSwitch || showForDisconnect || showForSync;
  
  if (!shouldShow) {
    return null;
  }

  let title = 'Connecting Wallet';
  let description = 'Please follow the instructions in your wallet to complete the connection.';

  if (isSwitchingChain) {
    title = 'Switching Network';
    description = 'Please confirm the network switch in your wallet...';
  } else if (isWalletSyncing) {
    title = 'Syncing Wallet';
    description = 'Finalizing connection and syncing with your profile...';
  } else if (isDisconnecting) {
    title = 'Disconnecting';
    description = 'Disconnecting your wallet...';
  }

  const handleDismiss = () => {
    sessionStorage.removeItem('wallet_connection_intent');
    setConnectionIntent(false);
    // If we are syncing, we can't easily stop the backend call, 
    // but we can at least hide the loader for the user.
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-[#1a1b1f]/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-[90%] w-[350px] animate-in fade-in zoom-in duration-300 relative">
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="relative mb-4" style={{ fontSize: '16px' }}>
          <Loading fullPage={false} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-white text-2xl font-bold tracking-tight">{title}</h3>
          <p className="text-gray-400 text-base leading-relaxed">
            {description}
          </p>
        </div>
        
        {/* Cancel button for stuck states */}
        <button
          onClick={handleDismiss}
          className="mt-4 px-8 py-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm font-medium transition-all border border-white/10 active:scale-95"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};