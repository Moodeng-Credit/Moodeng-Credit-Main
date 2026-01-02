import { useState } from 'react';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits } from 'viem';
import { useAccount, useChainId, useConfig, useDisconnect, useReadContract, useSwitchChain } from 'wagmi';
import { reconnect } from '@wagmi/core';

import FormField from '@/components/forms/FormField';
import WorldIDVerificationStatus from '@/components/worldId/WorldIDVerificationStatus';

import { ALLOWED_CHAIN_DISPLAY_NAME, ALLOWED_CHAIN_ID, getNetworkSvg, getTokenAddresses } from '@/config/wagmiConfig';

// ERC20 ABI for balanceOf function
const erc20Abi = [
   {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
   },
   {
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      stateMutability: 'view',
      type: 'function'
   }
] as const;

interface SecuritySettingsProps {
   password: string;
   walletAddress?: string;
   onPasswordChange: (value: string) => void;
   onUpdate: () => void;
}

export default function SecuritySettings({ password, walletAddress, onPasswordChange, onUpdate }: SecuritySettingsProps) {
   const config = useConfig();
   const { address, chain, connector, isConnected } = useAccount();
   const { switchChain, isPending: isSwitching } = useSwitchChain();
   const { disconnect } = useDisconnect();
   const [isManualSwitching, setIsManualSwitching] = useState(false);
   
   // Use wagmi's useChainId() - this is reliable, unlike useAccount().chainId which can be stale on mobile
   const wagmiChainId = useChainId();
   
   // Log disconnect attempts
   const handleDisconnect = () => {
      console.log('[SecuritySettings:Disconnect] Disconnect button clicked');
      console.log('[SecuritySettings:Disconnect] Current state:', { 
         isConnected, 
         address, 
         connector: connector?.name,
         wagmiChainId 
      });
      try {
         disconnect();
         console.log('[SecuritySettings:Disconnect] disconnect() called successfully');
      } catch (e) {
         console.error('[SecuritySettings:Disconnect] Error calling disconnect():', e);
      }
   };

   // Get USDC balance
   const usdcAddress = getTokenAddresses(chain?.id || ALLOWED_CHAIN_ID)?.USDC;
   const { data: usdcBalance } = useReadContract({
      address: usdcAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
      query: {
         enabled: !!address && !!usdcAddress
      }
   });

   const { data: usdcDecimals } = useReadContract({
      address: usdcAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'decimals',
      query: {
         enabled: !!usdcAddress
      }
   });

   const formattedUsdcBalance =
      usdcBalance && usdcDecimals ? `${parseFloat(formatUnits(usdcBalance, usdcDecimals)).toFixed(2)} USDC` : '0.00 USDC';

   return (
      <form className="flex flex-col md:flex-row gap-8">
         <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <section>
               <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">Security</h2>
               <p>This information will be shown publicly so be careful what information you provide</p>
            </section>
         </div>
         <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <FormField
               id="password"
               label="Password"
               type="password"
               value={password}
               onChange={onPasswordChange}
               placeholder="New Password"
               actionButton={{
                  label: 'Change Password',
                  onClick: onUpdate
               }}
            />
            <div className="grid grid-cols-12 items-center gap-3">
               <label htmlFor="wallet" className="col-span-3 text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none">
                  Wallet
               </label>
               <input
                  id="wallet"
                  type="text"
                  value={walletAddress || ''}
                  placeholder={walletAddress || ''}
                  disabled
                  className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#4a4a4a] text-[10px] font-normal leading-[12px] outline-none"
               />
            </div>
            <div className="grid grid-cols-12 items-center gap-3">
               <label htmlFor="network" className="col-span-3 text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none">
                  Network
               </label>
               <div className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#4a4a4a] text-[10px] font-normal leading-[12px] flex items-center gap-2 cursor-default pointer-events-none">
                  {getNetworkSvg(ALLOWED_CHAIN_ID)}
                  <span>{ALLOWED_CHAIN_DISPLAY_NAME}</span>
               </div>
            </div>
            <ConnectButton.Custom>
               {({ account, chain: currentChain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
                  const ready = mounted && authenticationStatus !== 'loading';
                  const connected = ready && account && currentChain && (!authenticationStatus || authenticationStatus === 'authenticated');
                  
                  const isChainSupported = wagmiChainId === ALLOWED_CHAIN_ID;
                  
                  // Handler for manual switch via wagmi (bypasses RainbowKit modal)
                  const handleManualSwitch = async () => {
                     setIsManualSwitching(true);
                     try {
                        switchChain?.({ chainId: ALLOWED_CHAIN_ID });
                        // After 5 seconds, try to refresh the connection state
                        setTimeout(async () => {
                           try {
                              await reconnect(config);
                           } catch (e) {
                              console.log('Reconnect after switch:', e);
                           }
                           setIsManualSwitching(false);
                        }, 5000);
                     } catch (e) {
                        console.error('Switch error:', e);
                        setIsManualSwitching(false);
                     }
                  };
                  
                  // Handler to refresh/reconnect
                  const handleRefresh = async () => {
                     try {
                        await reconnect(config);
                     } catch (e) {
                        console.log('Refresh error:', e);
                     }
                  };

                  const showSwitching = isSwitching || isManualSwitching;

                  return (
                     <div
                        {...(!ready && {
                           'aria-hidden': true,
                           style: {
                              opacity: 0,
                              pointerEvents: 'none',
                              userSelect: 'none'
                           }
                        })}
                     >
                        {/* Debug Info Panel - Remove after debugging */}
                        <div className="mb-3 p-2 bg-gray-100 rounded text-[9px] font-mono text-gray-600 border border-gray-300">
                           <div><strong>🔍 Debug Info (Mobile):</strong></div>
                           <div>mounted: {String(mounted)}</div>
                           <div>authStatus: {authenticationStatus || 'none'}</div>
                           <div>ready: {String(ready)}</div>
                           <div>connected: {String(connected)}</div>
                           <div>account: {account?.address ? `${account.address.slice(0,6)}...${account.address.slice(-4)}` : 'null'}</div>
                           <div>currentChain (connector): id={currentChain?.id}, name={currentChain?.name || 'undefined'}</div>
                           <div><strong>wagmiChainId (reliable): {wagmiChainId}</strong></div>
                           <div>ALLOWED_CHAIN_ID: {ALLOWED_CHAIN_ID}</div>
                           <div>isChainSupported: {String(isChainSupported)}</div>
                           <div>connector: {connector?.name || 'none'} ({connector?.type || 'unknown'})</div>
                           <div>isSwitching: {String(isSwitching)} | manual: {String(isManualSwitching)}</div>
                           <div>Match: {wagmiChainId === ALLOWED_CHAIN_ID ? '✅ YES' : '❌ NO'}</div>
                        </div>
                        
                        {(() => {
                           if (!connected) {
                              return (
                                 <button
                                    onClick={openConnectModal}
                                    type="button"
                                    className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
                                 >
                                    Connect Wallet
                                 </button>
                              );
                           }

                           // Use wagmiChainId for chain validation (reliable source)
                           if (!isChainSupported) {
                              return (
                                 <div className="flex flex-col gap-2">
                                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                       <strong>⚠️ Wrong Network!</strong>
                                       <p>Required: {ALLOWED_CHAIN_DISPLAY_NAME}</p>
                                    </div>
                                    <button
                                       onClick={handleManualSwitch}
                                       disabled={showSwitching}
                                       type="button"
                                       className="w-full bg-orange-500 text-white rounded px-3 py-2 text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                                    >
                                       {showSwitching ? 'Switching... (check MetaMask)' : `🔄 Switch to ${ALLOWED_CHAIN_DISPLAY_NAME}`}
                                    </button>
                                    {showSwitching && (
                                       <button
                                          onClick={handleRefresh}
                                          type="button"
                                          className="w-full bg-blue-500 text-white rounded px-3 py-1 text-xs font-medium hover:bg-blue-600 transition-colors"
                                       >
                                          🔃 Already switched? Tap to refresh
                                       </button>
                                    )}
                                    <button
                                       onClick={openChainModal}
                                       type="button"
                                       className="w-full bg-gray-500 text-white rounded px-3 py-1 text-xs font-medium hover:bg-gray-600 transition-colors"
                                    >
                                       Open Network Selector
                                    </button>
                                 </div>
                              );
                           }

                           return (
                              <div className="flex items-center justify-between w-full">
                                 <div className="flex flex-col gap-1">
                                    <div className="text-sm font-medium text-gray-700">{account.displayName}</div>
                                    <div className="text-xs text-gray-500">
                                       Network: {currentChain?.name} (ID: {currentChain?.id}) • {formattedUsdcBalance}
                                    </div>
                                 </div>
                                 <button
                                    onClick={handleDisconnect}
                                    type="button"
                                    className="bg-gray-100 text-gray-700 rounded px-3 py-1 text-sm hover:bg-gray-200 transition-colors"
                                 >
                                    Disconnect
                                 </button>
                              </div>
                           );
                        })()}
                     </div>
                  );
               }}
            </ConnectButton.Custom>
            <WorldIDVerificationStatus />
         </div>
      </form>
   );
}
