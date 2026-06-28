import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { ArrowLeft, Check, ChevronDown, ExternalLink, LoaderCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { createPublicClient, createWalletClient, custom, erc20Abi, fallback, formatUnits, http, parseUnits, type Address, type Chain, type Hex } from 'viem';
import { arbitrum, base, bsc, mainnet, optimism, polygon } from 'wagmi/chains';
import { useAccount, useConnect, useDisconnect, type Connector } from 'wagmi';

import { BASE_USDC_ADDRESS, getNetworkSvg } from '@/config/wagmiConfig';
import { getBaseAccountConnector } from '@/lib/walletProvider';
import type { RootState } from '@/store/store';

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

export default function FundBridge({ onClose }: { onClose: () => void }) {
   const { address, connector } = useAccount();
   const { connectAsync, connectors } = useConnect();
   const { openConnectModal } = useConnectModal();
   const { disconnect } = useDisconnect();
   const storedConnectorName = useSelector((s: RootState) => s.auth.user?.walletConnectorName);
   // The wallet to connect for the default one-tap bridge when disconnected: the lender's
   // last-used / saved wallet, so connecting + paying is a single action with no picker
   // (mirrors Repay). Falls back to Base Account, then whatever connector exists. The
   // "Bridge from a different wallet" checkbox opens the picker instead.
   const preferredConnector = useMemo(() => {
      const byName = storedConnectorName ? connectors.find((c) => c.name === storedConnectorName) : undefined;
      return byName ?? getBaseAccountConnector(connectors) ?? connectors[0];
   }, [connectors, storedConnectorName]);
   const [useDifferentWallet, setUseDifferentWallet] = useState(false);
   const [selectedChain, setSelectedChain] = useState<number | null>(null);
   const [amount, setAmount] = useState('');
   const [isLoadingQuote, setIsLoadingQuote] = useState(false);
   const [quote, setQuote] = useState<Quote | null>(null);
   const [quoteError, setQuoteError] = useState<string | null>(null);
   const [showChainPicker, setShowChainPicker] = useState(false);
   const [execState, setExecState] = useState<ExecState>('idle');
   const [execError, setExecError] = useState<string | null>(null);
   const [txHash, setTxHash] = useState<Hex | null>(null);
   // Set when the lender taps "Bridge to Base" while no wallet is connected: the picker
   // opens, and an effect fires the bridge once a wallet connects — connect + sign as one
   // intent, no second tap (mirrors Repay.tsx's pendingRepayRef).
   const pendingBridgeRef = useRef(false);
   // Set when "Change wallet" disconnects the current wallet so an effect can reopen the
   // picker for the lender to choose a different source wallet.
   const pendingPickRef = useRef(false);

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

   // Executes the bridge with an already-connected source wallet: switch to the source
   // chain, re-quote, approve USDC to the Portal, then publishAndFund. Uses a scoped viem
   // client built from the wallet's provider — the app's global wagmi config is untouched.
   // The lender bridges into the same wallet on Base (funder === recipient).
   const executeBridge = useCallback(
      async (sourceAddress: Address, sourceConnector: Connector) => {
         if (!selectedChainInfo || !amount || parseFloat(amount) <= 0) return;

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
            const provider = (await sourceConnector.getProvider()) as Parameters<typeof custom>[0];
            const walletClient = createWalletClient({ account: sourceAddress, chain: viemChain, transport: custom(provider) });
            // Read allowance + poll the receipt through the connected wallet's own RPC first.
            // A bare http() falls back to the chain's default public RPC (e.g. polygon-rpc.com),
            // which rate-limits/CORS-blocks browser calls — that surfaced as "HTTP request
            // failed" before any signing. The wallet provider always has a working RPC for the
            // chain it's on; http() stays only as a last-resort fallback. Works for every source
            // chain, including BNB (which Alchemy doesn't support).
            const publicClient = createPublicClient({ chain: viemChain, transport: fallback([custom(provider), http()]) });

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
            const data = await requestEcoQuote(selectedChainInfo, sourceAmount.toString(), sourceAddress);
            const qr = data.quoteResponse;
            const portal = data.contracts.sourcePortal;
            const amt = BigInt(qr.sourceAmount);

            // Approve the Portal to pull the source USDC, if the allowance is short.
            setExecState('approving');
            const allowance = (await publicClient.readContract({
               address: selectedChainInfo.usdc as Address,
               abi: erc20Abi,
               functionName: 'allowance',
               args: [sourceAddress, portal],
            })) as bigint;
            if (allowance < amt) {
               const approveHash = await walletClient.writeContract({
                  address: selectedChainInfo.usdc as Address,
                  abi: erc20Abi,
                  functionName: 'approve',
                  args: [portal, amt],
                  chain: viemChain,
                  account: sourceAddress,
               });
               await publicClient.waitForTransactionReceipt({ hash: approveHash });
            }

            // Publish + fund the intent on the source Portal. Solver fulfils on Base.
            setExecState('publishing');
            const reward = {
               deadline: BigInt(qr.deadline),
               creator: sourceAddress,
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
               account: sourceAddress,
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
      },
      [selectedChainInfo, amount]
   );

   // Keep a ref to the latest executor so the auto-continue effect (which reacts to the
   // connection landing, not to a render) always fires the freshly-connected closure.
   const executeBridgeRef = useRef(executeBridge);
   useEffect(() => {
      executeBridgeRef.current = executeBridge;
   }, [executeBridge]);

   // Auto-continue: once the wallet connects (via the default connectAsync, or the picker
   // for a different wallet), fire the bridge the lender already initiated — connect + sign
   // as one action, no second tap. Same pendingRef + effect pattern as Repay.tsx.
   useEffect(() => {
      if (address && connector && pendingBridgeRef.current) {
         pendingBridgeRef.current = false;
         void executeBridgeRef.current(address as Address, connector);
      }
   }, [address, connector]);

   // "Change wallet": after we disconnect, reopen the picker so the lender can pick a
   // different source wallet (e.g. the one holding their Arbitrum USDC).
   useEffect(() => {
      if (!address && pendingPickRef.current) {
         pendingPickRef.current = false;
         openConnectModal?.();
      }
   }, [address, openConnectModal]);

   // Primary action — one tap connects + pays. If a wallet is already connected, bridge with
   // it. If not, connect the lender's usual wallet directly (connectAsync, no picker) and the
   // auto-continue effect fires the bridge once connected — a single action, like Repay.
   // Choosing a non-default source wallet is the "Bridge from a different wallet" checkbox.
   const handleBridge = () => {
      if (!selectedChainInfo || !amount || parseFloat(amount) <= 0) return;
      if (address && connector) {
         void executeBridgeRef.current(address as Address, connector);
         return;
      }
      if (!preferredConnector) {
         setExecError('Wallet unavailable — refresh and try again.');
         setExecState('error');
         return;
      }
      pendingBridgeRef.current = true;
      connectAsync({ connector: preferredConnector }).catch(() => {
         // Lender dismissed the connect prompt — don't auto-bridge.
         pendingBridgeRef.current = false;
      });
   };

   // "Bridge from a different wallet": open the picker so the lender connects the wallet that
   // actually holds their source-chain USDC. Login is Supabase-based and independent of the
   // wagmi connection, so disconnecting here never logs them out.
   const handleChangeWallet = () => {
      resetExec();
      pendingBridgeRef.current = false;
      if (address) {
         pendingPickRef.current = true;
         disconnect();
      } else {
         openConnectModal?.();
      }
   };

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
            // When disconnected, the tap connects first — say so up front.
            return address ? 'Bridge to Base' : 'Connect & Bridge';
      }
   })();

   return (
      <div className="fixed inset-0 z-[90] flex items-end justify-center">
         <button
            className="absolute inset-0 bg-[#12071f]/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close overlay"
         />
         <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="fund-bridge-title"
            className="relative mx-auto flex max-h-[92dvh] w-full max-w-[440px] flex-col rounded-t-[28px] bg-white shadow-[0_-8px_32px_rgba(20,18,24,0.22)] animate-[slideUp_0.25s_ease-out]"
         >
            <div className="pt-2.5 pb-0.5">
               <div className="mx-auto h-1 w-10 rounded-full bg-[#c9c3d4]" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pb-4 pt-2">
               <button
                  onClick={onClose}
                  className="rounded-full p-1.5 transition-colors hover:bg-md-neutral-200 active:bg-md-neutral-300"
                  aria-label="Go back"
               >
                  <ArrowLeft className="h-5 w-5 text-md-heading" strokeWidth={2} />
               </button>
               <h2 id="fund-bridge-title" className="text-md-h5 font-semibold text-md-heading">Bridge to Base</h2>
            </div>

            <div className="flex flex-col overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
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

         {/* Source wallet. The default is one tap: bridge from the wallet you're already
             using, or — if disconnected — connect your usual wallet and pay in the same
             action. Only tick the box if your cross-chain USDC sits in a different wallet,
             which reveals the picker. */}
         <div className="mb-3 flex flex-col gap-1.5">
            {address ? (
               <p className="text-[12px] text-md-neutral-800">
                  Paying from{' '}
                  <span className="font-semibold text-md-heading">{connector?.name || 'your wallet'}</span>
                  <span className="text-md-neutral-1000"> · {`${address.slice(0, 6)}…${address.slice(-4)}`}</span>
               </p>
            ) : null}
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[12px] font-medium text-md-neutral-1000">
               <input
                  type="checkbox"
                  checked={useDifferentWallet}
                  disabled={isBridging}
                  onChange={(e) => {
                     setUseDifferentWallet(e.target.checked);
                     if (e.target.checked) handleChangeWallet();
                  }}
                  className="h-4 w-4 rounded border-md-neutral-400 accent-md-primary-1200"
               />
               Bridge from a different wallet
            </label>
         </div>

         {/* Single primary action — grey until a live quote is ready, then purple */}
         <button
            onClick={handleBridge}
            disabled={!quote || isLoadingQuote || isBridging || execState === 'done'}
            className={`mt-2 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-md-b1 font-semibold transition-all disabled:pointer-events-none ${
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
         </section>
      </div>
   );
}
