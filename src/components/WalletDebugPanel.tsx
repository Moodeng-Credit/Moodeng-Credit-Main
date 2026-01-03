import { useCallback, useEffect, useState } from 'react';

import { useAccount, useChainId, useConfig } from 'wagmi';
import { reconnect } from '@wagmi/core';

import { ALLOWED_CHAIN_ID, ALLOWED_CHAIN_DISPLAY_NAME } from '@/config/wagmiConfig';

interface LogEntry {
   time: string;
   message: string;
   type: 'info' | 'error' | 'success' | 'warn';
}

// Global log storage to capture logs from WalletSyncInitializer
const logs: LogEntry[] = [];
const MAX_LOGS = 50;

// Override console.log to capture wallet-related logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

const addLog = (message: string, type: LogEntry['type'] = 'info') => {
   const entry: LogEntry = {
      time: new Date().toLocaleTimeString(),
      message,
      type
   };
   logs.unshift(entry);
   if (logs.length > MAX_LOGS) logs.pop();
   // Trigger re-render via custom event
   window.dispatchEvent(new CustomEvent('wallet-debug-log'));
};

// Helper to safely stringify objects with BigInt
const safeStringify = (obj: unknown) => {
   try {
      return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v);
   } catch (e) {
      return String(obj);
   }
};

// Intercept console.log for relevant messages
console.log = (...args: unknown[]) => {
   originalConsoleLog(...args);
   const message = args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ');
   if (message.includes('[WalletSync]') || message.includes('[Wallet') || message.includes('[Lend]') || message.includes('[Transfer]') || message.includes('Security context')) {
      addLog(message.replace('[WalletSync] ', ''), 'info');
   }
};

console.error = (...args: unknown[]) => {
   originalConsoleError(...args);
   const message = args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ');
   if (message.includes('[WalletSync]') || message.includes('[Wallet') || message.includes('[Lend]') || message.includes('[Transfer]') || message.includes('Tx failed')) {
      addLog(message.replace('[WalletSync] ', ''), 'error');
   }
};

export function WalletDebugPanel() {
   const [isOpen, setIsOpen] = useState(false);
   const [, forceUpdate] = useState(0);
   const config = useConfig();
   
   const { isConnected, address, connector } = useAccount();
   const chainId = useChainId();
   useEffect(() => {
      const handleNewLog = () => forceUpdate(n => n + 1);
      window.addEventListener('wallet-debug-log', handleNewLog);
      return () => window.removeEventListener('wallet-debug-log', handleNewLog);
   }, []);
   
   // Add initial state log
   useEffect(() => {
      addLog(`Panel mounted - Chain: ${chainId}, Connected: ${isConnected}`, 'info');
   }, []);
   
   // Log chain changes
   useEffect(() => {
      if (chainId) {
         const isCorrect = chainId === ALLOWED_CHAIN_ID;
         addLog(`Chain ID changed: ${chainId} (expected: ${ALLOWED_CHAIN_ID}) ${isCorrect ? '✅' : '❌'}`, isCorrect ? 'success' : 'warn');
      }
   }, [chainId]);
   
   // Log connection changes
   useEffect(() => {
      if (isConnected) {
         addLog(`✅ Connected to: ${address?.slice(0, 6)}...${address?.slice(-4)}, Connector: ${connector?.name || 'none'}, Chain: ${chainId}`, 'success');
      } else {
         addLog(`❌ Disconnected from wallet`, 'warn');
      }
   }, [isConnected, connector, chainId, address]);
   
   const handleForceReconnect = useCallback(async () => {
      addLog('Manual reconnect triggered...', 'info');
      try {
         await reconnect(config);
         addLog('Reconnect completed', 'success');
      } catch (e) {
         addLog(`Reconnect error: ${e}`, 'error');
      }
   }, [config]);
   
   const handleClearLogs = () => {
      logs.length = 0;
      forceUpdate(n => n + 1);
   };
   
   // Detect if mobile
   const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
   
   if (!isMobile && !isOpen) {
      return null; // Only show toggle button on desktop if closed
   }

   return (
      <>
         {/* Toggle Button - Always visible */}
         <button
            onClick={() => setIsOpen(!isOpen)}
            className="fixed bottom-4 right-4 z-[9999] bg-gray-800 text-white px-3 py-2 rounded-full shadow-lg text-xs font-mono"
         >
            {isOpen ? '✕' : '🔧'} Debug
         </button>
         
         {/* Debug Panel */}
         {isOpen && (
            <div className="fixed bottom-16 right-2 left-2 md:left-auto md:w-96 z-[9998] bg-gray-900 text-white rounded-lg shadow-2xl max-h-[70vh] overflow-hidden flex flex-col">
               {/* Header */}
               <div className="bg-gray-800 px-3 py-2 flex justify-between items-center border-b border-gray-700">
                  <span className="font-bold text-sm">🔗 Wallet Debug</span>
                  <button onClick={handleClearLogs} className="text-xs bg-gray-700 px-2 py-1 rounded">Clear</button>
               </div>
               
               {/* Status */}
               <div className="px-3 py-2 bg-gray-850 border-b border-gray-700 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                     <span className="text-gray-400">Connected:</span>
                     <span className={isConnected ? 'text-green-400' : 'text-red-400'}>{isConnected ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-gray-400">Address:</span>
                     <span className="text-blue-400">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'none'}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-gray-400">Connector:</span>
                     <span className="text-purple-400">{connector?.name || 'none'} ({connector?.type || '-'})</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-gray-400">useChainId():</span>
                     <span className={chainId === ALLOWED_CHAIN_ID ? 'text-green-400' : 'text-red-400'}>{chainId || 'none'}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-gray-400">Expected:</span>
                     <span className="text-yellow-400">{ALLOWED_CHAIN_ID} ({ALLOWED_CHAIN_DISPLAY_NAME})</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-gray-400">Status:</span>
                     <span className={chainId === ALLOWED_CHAIN_ID ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {chainId === ALLOWED_CHAIN_ID ? '✅ CORRECT CHAIN' : '❌ WRONG CHAIN'}
                     </span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-gray-400">Mobile:</span>
                     <span className="text-cyan-400">{isMobile ? 'Yes' : 'No'}</span>
                  </div>
               </div>
               
               {/* Action Buttons */}
               <div className="px-3 py-2 bg-gray-850 border-b border-gray-700 flex gap-2">
                  <button
                     onClick={handleForceReconnect}
                     className="flex-1 bg-blue-600 text-white text-xs py-2 rounded font-semibold hover:bg-blue-700"
                  >
                     🔄 Force Reconnect
                  </button>
                  <button
                     onClick={() => window.location.reload()}
                     className="flex-1 bg-orange-600 text-white text-xs py-2 rounded font-semibold hover:bg-orange-700"
                  >
                     ♻️ Reload Page
                  </button>
               </div>
               
               {/* Logs */}
               <div className="flex-1 overflow-y-auto p-2 text-[10px] font-mono space-y-1 max-h-48">
                  {logs.length === 0 ? (
                     <div className="text-gray-500 text-center py-4">No logs yet...</div>
                  ) : (
                     logs.map((log, i) => (
                        <div 
                           key={i} 
                           className={`px-2 py-1 rounded ${
                              log.type === 'error' ? 'bg-red-900/50 text-red-300' :
                              log.type === 'success' ? 'bg-green-900/50 text-green-300' :
                              log.type === 'warn' ? 'bg-yellow-900/50 text-yellow-300' :
                              'bg-gray-800 text-gray-300'
                           }`}
                        >
                           <span className="text-gray-500">[{log.time}]</span> {log.message}
                        </div>
                     ))
                  )}
               </div>
            </div>
         )}
      </>
   );
}
