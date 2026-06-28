import { useCallback, useEffect, useState } from 'react';

import { ArrowLeft, Check, ChevronDown, ExternalLink, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, http, parseUnits, type Address, type Chain, type Hex } from 'viem';
import { arbitrum, base, bsc, mainnet, optimism, polygon } from 'wagmi/chains';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

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
   { id: mainnet.id, name: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
   { id: arbitrum.id, name: 'Arbitrum', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
   { id: optimism.id, name: 'Optimism', usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
   { id: polygon.id, name: 'Polygon', usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
   { id: bsc.id, name: 'BNB Chain', usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
] as const;

// viem chain object per source chain id — used to build a scoped wallet/public client
// for the bridge tx, so the app's global wagmi (Base-only) login config is untouched.
const VIEM_CHAINS: Record<number, Chain> = {
   [mainnet.id]: mainnet,
   [arbitrum.id]: arbitrum,
   [optimism.id]: optimism,
   [polygon.id]: polygon,
   [bsc.id]: bsc,
};

// Eco "Portal" (a.k.a. IntentSource) publishAndFund — verified against the official
// @eco-foundation/routes-ts ABI. Locks the reward (the source USDC the funder approves)
// and publishes the intent; a solver then fulfils it on Base.
const PORTAL_ABI = [
   {
      type: 'function',
      name: 'publishAndFund',
      stateMutability: 'payable',
      inputs: [
         { name: 'destination', type: 'uint64' },
         { name: 'route', type: 'bytes' },
         {
            name: 'reward',
            type: 'tuple',
            components: [
               { name: 'deadline', type: 'uint64' },
               { name: 'creator', type: 'address' },
               { name: 'prover', type: 'address' },
               { name: 'nativeAmount', type: 'uint256' },
               {
                  name: 'tokens',
                  type: 'tuple[]',
                  components: [
                     { name: 'token', type: 'address' },
                     { name: 'amount', type: 'uint256' },
                  ],
               },
            ],
         },
         { name: 'allowPartial', type: 'bool' },
      ],
      outputs: [
         { name: 'intentHash', type: 'bytes32' },
         { name: 'vault', type: 'address' },
      ],
   },
] as const;

interface EcoQuoteData {
   quoteResponse: {
      destinationAmount: string;
      sourceAmount: string;
      sourceToken: Address;
      deadline: number;
      estimatedFulfillTimeSec: number;
      encodedRoute: Hex;
   };
   contracts: { sourcePortal: Address; prover: Address };
}

async function requestEcoQuote(
   chain: (typeof SOURCE_CHAINS)[number],
   sourceAmount: string,
   addr: Address
): Promise<EcoQuoteData> {
   const res = await fetch(ECO_QUOTE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         dAppID: ECO_DAPP_ID,
         quoteRequest: {
            sourceChainID: chain.id,
            destinationChainID: BASE_CHAIN_ID,
            sourceToken: chain.usdc,
            destinationToken: BASE_USDC_ADDRESS,
            sourceAmount,
            funder: addr,
            recipient: addr,
         },
      }),
   });
   const body = await res.json().catch(() => null);
   if (!res.ok || !body?.data?.quoteResponse?.destinationAmount) {
      throw new Error(body?.message || 'No route available for this amount.');
   }
   return body.data as EcoQuoteData;
}

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
   if (chainId === mainnet.id) return ETH_ICON;
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

type ExecState = 'idle' | 'preparing' | 'approving' | 'publishing' | 'submitted' | 'done' | 'error';
const IN_FLIGHT: ExecState[] = ['preparing', 'approving', 'publishing', 'submitted'];

export default function FundBridge() {
   const navigate = useNavigate();
   const { address, connector } = useAccount();
   const { openConnectModal } = useConnectModal();
   const [selectedChain, setSelectedChain] = useState<number | null>(null);
   const [amount, setAmount] = useState('');
   const [isLoadingQuote, setIsLoadingQuote] = useState(false);
   const [quote, setQuote] = useState<Quote | null>(null);
   const [quoteError, setQuoteError] = useState<string | null>(null);
   const [showChainPicker, setShowChainPicker] = useState(false);
   const [execState, setExecState] = useState<ExecState>('idle');
   const [execError, setExecError] = useState<string | null>(null);
   const [txHash, setTxHash] = useState<Hex | null>(null);

   const selectedChainInfo = SOURCE_CHAINS.find((c) => c.id === selectedChain);

   const resetExec = () => {
      setExecState('idle');
      setExecError(null);
      setTxHash(null);
   };

   const handleGetQuote = useCallback(async () => {
      if (!selectedChainInfo || !amount || parseFloat(amount) <= 0) return;

      setIsLoadingQuote(true);
      setQuote(null);
      setQuoteError(null);
      resetExec();

      try {
         // Quotes are rate-only and address-independent, so we preview them before the
         // wallet is connected. The real bridge tx re-quotes with the connected wallet.
         const quoteAddress = (address ?? '0x0000000000000000000000000000000000000001') as Address;
         const sourceAmount = parseUnits(amount, selectedChainInfo.decimals).toString();
         const data = await requestEcoQuote(selectedChainInfo, sourceAmount, quoteAddress);
         const q = data.quoteResponse;

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

   // Auto-fetch the quote (debounced) once a chain + valid amount are set, so there's no
   // separate "Get Quote" step — the rate just appears, then "Bridge to Base" lights up.
   useEffect(() => {
      if (!selectedChainInfo || !amount || parseFloat(amount) <= 0) {
         setQuote(null);
         setQuoteError(null);
         return;
      }
      const t = setTimeout(() => {
         handleGetQuote();
      }, 500);
      return () => clearTimeout(t);
   }, [selectedChain, amount, handleGetQuote, selectedChainInfo]);

   // Executes the bridge: switch to the source chain, re-quote with the real wallet,
   // approve USDC to the Portal, then publishAndFund. Uses a scoped viem client built
   // from the connected wallet's provider — the app's global wagmi config is untouched.
   const handleBridge = useCallback(async () => {
      if (!selectedChainInfo || !amount || parseFloat(amount) <= 0) return;
      if (!address || !connector) {
         openConnectModal?.();
         return;
      }
      const viemChain = VIEM_CHAINS[selectedChainInfo.id];
      if (!viemChain) {
         setExecError('Unsupported source chain.');
         setExecState('error');
         return;
      }

      setExecError(null);
      setTxHash(null);
      setExecState('preparing');

      try {
         const provider = (await connector.getProvider()) as Parameters<typeof custom>[0];
         const walletClient = createWalletClient({ account: address as Address, chain: viemChain, transport: custom(provider) });
         const publicClient = createPublicClient({ chain: viemChain, transport: http() });

         // Make sure the wallet is on the source chain.
         try {
            await walletClient.switchChain({ id: viemChain.id });
         } catch (switchErr) {
            const e = switchErr as { code?: number; message?: string };
            if (e?.code === 4902 || /unrecognized chain|not been added/i.test(e?.message ?? '')) {
               await walletClient.addChain({ chain: viemChain });
               await walletClient.switchChain({ id: viemChain.id });
            } else {
               throw switchErr;
            }
         }

         // Re-quote bound to the real wallet (correct recipient + a fresh deadline).
         const sourceAmount = parseUnits(amount, selectedChainInfo.decimals);
         const data = await requestEcoQuote(selectedChainInfo, sourceAmount.toString(), address as Address);
         const qr = data.quoteResponse;
         const portal = data.contracts.sourcePortal;
         const amt = BigInt(qr.sourceAmount);

         // Approve the Portal to pull the source USDC, if the allowance is short.
         setExecState('approving');
         const allowance = (await publicClient.readContract({
            address: selectedChainInfo.usdc as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address as Address, portal],
         })) as bigint;
         if (allowance < amt) {
            const approveHash = await walletClient.writeContract({
               address: selectedChainInfo.usdc as Address,
               abi: erc20Abi,
               functionName: 'approve',
               args: [portal, amt],
               chain: viemChain,
               account: address as Address,
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
         }

         // Publish + fund the intent on the source Portal. Solver fulfils on Base.
         setExecState('publishing');
         const reward = {
            deadline: BigInt(qr.deadline),
            creator: address as Address,
            prover: data.contracts.prover,
            nativeAmount: 0n,
            tokens: [{ token: qr.sourceToken, amount: amt }],
         };
         const hash = await walletClient.writeContract({
            address: portal,
            abi: PORTAL_ABI,
            functionName: 'publishAndFund',
            args: [BigInt(BASE_CHAIN_ID), qr.encodedRoute, reward, false],
            chain: viemChain,
            account: address as Address,
            value: 0n,
         });
         setTxHash(hash);
         setExecState('submitted');
         await publicClient.waitForTransactionReceipt({ hash });
         setExecState('done');
      } catch (err) {
         const e = err as { shortMessage?: string; message?: string };
         const msg = e?.shortMessage || e?.message || 'Bridge failed. Please try again.';
         setExecError(/User rejected|denied|cancell?ed/i.test(msg) ? 'Transaction cancelled.' : msg);
         setExecState('error');
      }
   }, [selectedChainInfo, amount, address, connector]);

   const isBridging = IN_FLIGHT.includes(execState);
   const explorerUrl =
      selectedChainInfo && txHash
         ? `${VIEM_CHAINS[selectedChainInfo.id]?.blockExplorers?.default.url}/tx/${txHash}`
         : null;

   const bridgeLabel = (() => {
      switch (execState) {
         case 'preparing':
            return 'Preparing…';
         case 'approving':
            return 'Approve USDC in wallet…';
         case 'publishing':
            return 'Confirm bridge in wallet…';
         case 'submitted':
            return 'Bridging to Base…';
         case 'done':
            return 'Sent to Base ✓';
         default:
            return 'Bridge to Base';
      }
   })();

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
                           resetExec();
                        }}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                           selectedChain === chain.id ? 'bg-md-primary-100' : 'hover:bg-md-neutral-200'
                        }`}
                     >
                        <div className="shrink-0">{getChainIcon(chain.id)}</div>
                        <span className="flex-1 text-md-b2 font-medium text-md-heading">{chain.name}</span>
                        {selectedChain === chain.id && <Check className="h-4 w-4 text-md-primary-1200" strokeWidth={2.5} />}
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
                     resetExec();
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

         {/* Quote area — appears automatically once a chain + amount are set */}
         {isLoadingQuote && (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-md-neutral-300 bg-md-neutral-100 px-4 py-5 text-md-b3 font-medium text-md-neutral-800">
               <LoaderCircle className="h-4 w-4 animate-spin" />
               Fetching best rate…
            </div>
         )}

         {quoteError && !isLoadingQuote && (
            <p className="mb-4 text-center text-[13px] font-medium text-md-red-500" role="alert">
               {quoteError}
            </p>
         )}

         {quote && !isLoadingQuote && (
            <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-md-neutral-300 bg-md-neutral-100 p-4">
               <p className="pb-1 text-md-b3 font-semibold text-md-neutral-1400">Quote Details</p>
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
         )}

         {/* Single primary action — grey until a live quote is ready, then purple */}
         <button
            onClick={handleBridge}
            disabled={!quote || isLoadingQuote || isBridging || execState === 'done'}
            className={`mt-auto inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-md-b1 font-semibold transition-all disabled:pointer-events-none ${
               execState === 'done'
                  ? 'bg-[#e6f9ef] text-[#1a8c4e]'
                  : quote && !isLoadingQuote && !isBridging
                    ? 'bg-md-primary-1200 text-white shadow-md-card hover:brightness-110 active:scale-[0.98]'
                    : isBridging
                      ? 'bg-md-primary-1200 text-white shadow-md-card'
                      : 'bg-md-neutral-400 text-md-neutral-800'
            }`}
         >
            {isBridging && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {bridgeLabel}
         </button>

         {execError && (
            <p className="mt-2 text-center text-[12px] font-medium text-md-red-500" role="alert">
               {execError}
            </p>
         )}

         {execState === 'submitted' && quote && (
            <p className="mt-2 text-center text-[12px] font-normal text-md-neutral-800">
               Submitted — funds arrive on Base in {quote.estimatedTime}.
            </p>
         )}

         {explorerUrl && (
            <a
               href={explorerUrl}
               target="_blank"
               rel="noopener noreferrer"
               className="mt-2 inline-flex w-full items-center justify-center gap-1 text-[12px] font-medium text-md-primary-1200"
            >
               View transaction <ExternalLink className="h-3 w-3" />
            </a>
         )}

         {quote && !isBridging && execState !== 'submitted' && execState !== 'done' && (
            <p className="mt-2 text-center text-[12px] font-normal text-md-neutral-800">
               Live quote &middot; Powered by Eco
            </p>
         )}
      </div>
   );
}
