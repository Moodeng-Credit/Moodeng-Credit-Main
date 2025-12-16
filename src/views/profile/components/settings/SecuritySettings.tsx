import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits } from 'viem';
import { useAccount, useReadContract } from 'wagmi';

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
   const { address, chain } = useAccount();

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
                  const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

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

                           if (currentChain?.unsupported) {
                              return (
                                 <button
                                    onClick={openChainModal}
                                    type="button"
                                    className="w-full bg-red-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                                 >
                                    Wrong network
                                 </button>
                              );
                           }

                           return (
                              <div className="flex items-center justify-between w-full">
                                 <div className="flex flex-col gap-1">
                                    <div className="text-sm font-medium text-gray-700">{account.displayName}</div>
                                    <div className="text-xs text-gray-500">
                                       {currentChain?.name} • {formattedUsdcBalance}
                                    </div>
                                 </div>
                                 <button
                                    onClick={openAccountModal}
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
