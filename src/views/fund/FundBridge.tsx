import { useCallback, useState } from 'react';

import { ArrowLeft, Check, ChevronDown, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatUnits, parseUnits } from 'viem';
import { arbitrum, base, bsc, optimism, polygon } from 'wagmi/chains';
import { useAccount } from 'wagmi';

import { BASE_USDC_ADDRESS, getNetworkSvg } from '@/config/wagmiConfig';

// Eco Routes V3 quote API — permissionless, CORS-open (Access-Control-Allow-Origin: *),
// no auth needed for quotes. Returns a solver-guaranteed destinationAmount on Base.
const ECO_QUOTE_URL = 'https://quotes.eco.com/api/v3/quotes/single';
const ECO_DAPP_ID = 'moodeng-credit';
const BASE_CHAIN_ID = base.id; // 8453
const BASE_USDC_DECIMALS = 6;

// Each supported source chain + its native USDC (address + decimals). Note BNB USDC is
// 18 decimals; all others are 6 — the amount is encoded in the source token's units.
const SOURCE_CHAINS = [
   { id: 1, name: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
   { id: arbitrum.id, name: 'Arbitrum', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
   { id: optimism.id, name: 'Optimism', usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
   { id: polygon.id, name: 'Polygon', usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
   { id: bsc.id, name: 'BNB Chain', usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
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

const formatEta = (sec: number): string => {
   if (!Number.isFinite(sec) || sec <= 0) return '~1 min';
   if (sec < 90) return `~${Math.max(1, Math.round(sec))} sec`;
   return `~${Math.round(sec / 60)} min`;
};

interface Quote {
   sendAmount: string; // human, source USDC
   receiveAmount: string; // human, Base USDC
   costAmount: string; // human, send - receive
   estimatedTime: string;
}

export default function FundBridge() {
   const navigate = useNavigate();
   const { address } = useAccount();
   const [selectedChain, setSelectedChain] = useState<number | null>(null);
   const [amount, setAmount] = useState('');
   const [isLoadingQuote, setIsLoadingQuote] = useState(false);
   const [quote, setQuote] = useState<Quote | null>(null);
   const [quoteError, setQuoteError] = useState<string | null>(null);
   const [showChainPicker, setShowChainPicker] = useState(false);

   const selectedChainInfo = SOURCE_CHAINS.find((c) => c.id === selectedChain);

   const handleGetQuote = useCallback(async () => {
      if (!selectedChainInfo || !amount || parseFloat(amount) <= 0) return;

      setIsLoadingQuote(true);
      setQuote(null);
      setQuoteError(null);

      try {
         // Quotes are rate-only and address-independent, so we preview them before the
         // wallet is connected. The real bridge tx will use the connected wallet as
         // funder + recipient; until then a placeholder lets us fetch the live rate.
         const quoteAddress = address ?? '0x0000000000000000000000000000000000000001';
         const sourceAmount = parseUnits(amount, selectedChainInfo.decimals).toString();
         const res = await fetch(ECO_QUOTE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               dAppID: ECO_DAPP_ID,
               quoteRequest: {
                  sourceChainID: selectedChainInfo.id,
                  destinationChainID: BASE_CHAIN_ID,
                  sourceToken: selectedChainInfo.usdc,
                  destinationToken: BASE_USDC_ADDRESS,
                  sourceAmount,
                  funder: quoteAddress,
                  recipient: quoteAddress,
               },
            }),
         });

         const body = await res.json().catch(() => null);
         const q = body?.data?.quoteResponse;
         if (!res.ok || !q?.destinationAmount) {
            throw new Error(body?.message || 'No route available for this amount.');
         }

         const sendNum = parseFloat(amount);
         const receiveNum = parseFloat(formatUnits(BigInt(q.destinationAmount), BASE_USDC_DECIMALS));
         const cost = Math.max(0, sendNum - receiveNum);

         setQuote({
            sendAmount: sendNum.toFixed(2),
            receiveAmount: receiveNum.toFixed(2),
            costAmount: cost.toFixed(2),
            estimatedTime: formatEta(Number(q.estimatedFulfillTimeSec)),
         });
      } catch (err) {
         setQuoteError(err instanceof Error ? err.message : 'Could not fetch a quote. Please try again.');
      } finally {
         setIsLoadingQuote(false);
      }
   }, [selectedChainInfo, amount, address]);

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
                           setQuoteError(null);
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
                     setQuoteError(null);
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
            className="mb-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-md-primary-1200 px-6 py-3.5 text-md-b1 font-semibold text-white shadow-md-card transition-all hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
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

         {quoteError && (
            <p className="mb-3 text-center text-[13px] font-medium text-md-red-500" role="alert">
               {quoteError}
            </p>
         )}

         {/* Quote result */}
         {quote && (
            <div className="flex flex-col gap-3 rounded-2xl border border-md-neutral-300 bg-md-neutral-100 p-4">
               <p className="text-md-b3 font-semibold text-md-neutral-1400">Quote Details</p>
               <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                     <span className="text-md-b3 font-normal text-md-neutral-800">You send</span>
                     <span className="text-md-b2 font-medium text-md-heading">{quote.sendAmount} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-md-b3 font-normal text-md-neutral-800">You receive on Base</span>
                     <span className="text-md-b2 font-semibold text-md-heading">{quote.receiveAmount} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-md-b3 font-normal text-md-neutral-800">Network + bridge cost</span>
                     <span className="text-md-b3 font-normal text-md-neutral-800">{quote.costAmount} USDC</span>
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
                     Live quote &middot; Powered by Eco
                  </p>
               </div>
            </div>
         )}
      </div>
   );
}
