import { useCallback, useState } from 'react';

import { ArrowLeft, Check, ChevronDown, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { arbitrum, base, bsc, optimism, polygon } from 'wagmi/chains';

import { getNetworkSvg } from '@/config/wagmiConfig';

const SOURCE_CHAINS = [
   { id: 1, name: 'Ethereum', shortName: 'ETH' },
   { id: arbitrum.id, name: 'Arbitrum', shortName: 'ARB' },
   { id: optimism.id, name: 'Optimism', shortName: 'OP' },
   { id: polygon.id, name: 'Polygon', shortName: 'POL' },
   { id: bsc.id, name: 'BNB Chain', shortName: 'BNB' },
] as const;

const ETH_ICON = (
   <svg width="30px" height="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g fill="#627EEA">
         <polygon points="12,2 12,8.5 18,11.5" />
         <polygon points="12,2 6,11.5 12,8.5" />
         <polygon points="12,15.5 12,22 18,13.5" />
         <polygon points="12,22 6,13.5 12,15.5" />
         <polygon points="12,14 18,11.5 12,8.5" />
         <polygon points="6,11.5 12,14 12,8.5" />
      </g>
   </svg>
);

function getChainIcon(chainId: number) {
   if (chainId === 1) return ETH_ICON;
   return getNetworkSvg(chainId);
}

interface MockQuote {
   inputAmount: string;
   outputAmount: string;
   fee: string;
   estimatedTime: string;
}

export default function FundBridge() {
   const navigate = useNavigate();
   const [selectedChain, setSelectedChain] = useState<number | null>(null);
   const [amount, setAmount] = useState('');
   const [isLoadingQuote, setIsLoadingQuote] = useState(false);
   const [quote, setQuote] = useState<MockQuote | null>(null);
   const [showChainPicker, setShowChainPicker] = useState(false);

   const selectedChainInfo = SOURCE_CHAINS.find((c) => c.id === selectedChain);

   const handleGetQuote = useCallback(async () => {
      if (!selectedChain || !amount || parseFloat(amount) <= 0) return;
      setIsLoadingQuote(true);
      setQuote(null);

      // Mock: simulate API latency, real Eco Routes call goes here
      await new Promise((r) => setTimeout(r, 1500));

      const inputNum = parseFloat(amount);
      const feeRate = 0.003;
      const fee = inputNum * feeRate;
      setQuote({
         inputAmount: inputNum.toFixed(2),
         outputAmount: (inputNum - fee).toFixed(2),
         fee: fee.toFixed(4),
         estimatedTime: '~2 min',
      });
      setIsLoadingQuote(false);
   }, [selectedChain, amount]);

   const canGetQuote = selectedChain !== null && amount !== '' && parseFloat(amount) > 0;

   return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col bg-white px-5 pb-10 pt-4">
         {/* Header */}
         <div className="flex items-center gap-3 pb-6">
            <button
               onClick={() => navigate(-1)}
               className="rounded-full p-1.5 transition-colors hover:bg-md-neutral-200 active:bg-md-neutral-300"
               aria-label="Go back"
            >
               <ArrowLeft className="h-5 w-5 text-md-heading" strokeWidth={2} />
            </button>
            <h1 className="text-md-h5 font-semibold text-md-heading">Bridge to Base</h1>
         </div>

         {/* Source chain picker */}
         <div className="flex flex-col gap-2 pb-5">
            <label className="text-md-b3 font-semibold text-md-neutral-1400">From chain</label>
            <button
               onClick={() => setShowChainPicker(!showChainPicker)}
               className="flex items-center justify-between rounded-2xl border border-md-neutral-400 bg-white px-4 py-3.5 transition-all hover:border-md-primary-400 active:scale-[0.99]"
            >
               <div className="flex items-center gap-3">
                  {selectedChainInfo ? (
                     <>
                        <div className="shrink-0">{getChainIcon(selectedChainInfo.id)}</div>
                        <span className="text-md-b2 font-medium text-md-heading">{selectedChainInfo.name}</span>
                     </>
                  ) : (
                     <span className="text-md-b2 font-normal text-md-neutral-800">Select a chain</span>
                  )}
               </div>
               <ChevronDown className={`h-5 w-5 text-md-neutral-800 transition-transform ${showChainPicker ? 'rotate-180' : ''}`} />
            </button>

            {showChainPicker && (
               <div className="flex flex-col gap-1 rounded-2xl border border-md-neutral-300 bg-md-neutral-100 p-2">
                  {SOURCE_CHAINS.map((chain) => (
                     <button
                        key={chain.id}
                        onClick={() => {
                           setSelectedChain(chain.id);
                           setShowChainPicker(false);
                           setQuote(null);
                        }}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                           selectedChain === chain.id
                              ? 'bg-md-primary-100'
                              : 'hover:bg-md-neutral-200'
                        }`}
                     >
                        <div className="shrink-0">{getChainIcon(chain.id)}</div>
                        <span className="flex-1 text-md-b2 font-medium text-md-heading">{chain.name}</span>
                        {selectedChain === chain.id && (
                           <Check className="h-4 w-4 text-md-primary-1200" strokeWidth={2.5} />
                        )}
                     </button>
                  ))}
               </div>
            )}
         </div>

         {/* Amount input */}
         <div className="flex flex-col gap-2 pb-5">
            <label htmlFor="bridge-amount" className="text-md-b3 font-semibold text-md-neutral-1400">
               Amount (USDC)
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-md-neutral-400 bg-white px-4 py-3.5 focus-within:border-md-primary-400 focus-within:shadow-[0_0_0_3px_rgba(96,16,210,0.12)]">
               <span className="text-md-b2 font-medium text-md-neutral-800">$</span>
               <input
                  id="bridge-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                     setAmount(e.target.value);
                     setQuote(null);
                  }}
                  className="flex-1 bg-transparent text-md-b1 font-medium text-md-heading outline-none placeholder:text-md-neutral-600 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
               />
               <span className="text-md-b3 font-semibold text-md-neutral-800">USDC</span>
            </div>
         </div>

         {/* Destination (read-only) */}
         <div className="flex flex-col gap-2 pb-6">
            <label className="text-md-b3 font-semibold text-md-neutral-1400">To chain</label>
            <div className="flex items-center gap-3 rounded-2xl border border-md-neutral-300 bg-md-neutral-100 px-4 py-3.5">
               <div className="shrink-0">{getNetworkSvg(base.id)}</div>
               <span className="text-md-b2 font-medium text-md-heading">Base (USDC)</span>
            </div>
         </div>

         {/* Get Quote button */}
         <button
            onClick={handleGetQuote}
            disabled={!canGetQuote || isLoadingQuote}
            className="mb-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-md-primary-1200 px-6 py-3.5 text-md-b1 font-semibold text-white shadow-md-card transition-all hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
         >
            {isLoadingQuote ? (
               <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Getting quote...
               </>
            ) : (
               'Get Quote'
            )}
         </button>

         {/* Quote result */}
         {quote && (
            <div className="flex flex-col gap-3 rounded-2xl border border-md-neutral-300 bg-md-neutral-100 p-4">
               <p className="text-md-b3 font-semibold text-md-neutral-1400">Quote Details</p>
               <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                     <span className="text-md-b3 font-normal text-md-neutral-800">You send</span>
                     <span className="text-md-b2 font-medium text-md-heading">{quote.inputAmount} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-md-b3 font-normal text-md-neutral-800">You receive</span>
                     <span className="text-md-b2 font-semibold text-md-heading">{quote.outputAmount} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-md-b3 font-normal text-md-neutral-800">Bridge fee</span>
                     <span className="text-md-b3 font-normal text-md-neutral-800">{quote.fee} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-md-b3 font-normal text-md-neutral-800">Estimated time</span>
                     <span className="text-md-b3 font-normal text-md-neutral-800">{quote.estimatedTime}</span>
                  </div>
               </div>
               <div className="border-t border-md-neutral-300 pt-3">
                  <button
                     disabled
                     className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-md-neutral-400 px-6 py-3 text-md-b2 font-semibold text-md-neutral-800"
                  >
                     Bridge — Coming Soon
                  </button>
                  <p className="mt-2 text-center text-[12px] font-normal text-md-neutral-800">
                     Powered by Eco &middot; Hyperlane
                  </p>
               </div>
            </div>
         )}
      </div>
   );
}
