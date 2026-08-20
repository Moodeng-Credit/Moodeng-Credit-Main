import { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { erc20Abi, formatUnits } from 'viem';
import { useReadContract } from 'wagmi';

import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
   buildRecentWalletActivity,
   buildRepaymentDestinations,
   getDistinctWalletCount,
   hasMeaningfulWalletHistory,
   normalizeWalletAddress,
   type WalletAccountRole,
   type WalletActivityItem,
   type WalletConnectionEvent,
   type WalletLoanRecord,
   type RepaymentRouteLoanRecord,
   type WalletTransferRecord
} from '@/views/account/walletAccountData';

const RAW_ALCHEMY_ID = (import.meta.env.VITE_ALCHEMY_ID ?? '').trim();
// A build that shipped the setup placeholder ("your_alchemy_id") or an undecrypted
// dotenvx value ("encrypted:…") would 401 on every request. Treat those as unconfigured
// so on-chain fetches are skipped cleanly instead of surfacing a broken retry loop.
const ALCHEMY_ID = RAW_ALCHEMY_ID === 'your_alchemy_id' || RAW_ALCHEMY_ID.startsWith('encrypted:') ? '' : RAW_ALCHEMY_ID;
const MAX_TRANSFER_ROWS = 8;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const ACTIVITY_TITLES: Record<WalletActivityItem['kind'], string> = {
   loan_received: 'Loan received',
   loan_funded: 'Loan funded',
   loan_repaid: 'Loan repaid',
   repayment_sent: 'Repayment sent',
   repayment_received: 'Repayment received',
   usdc_received: 'USDC received',
   usdc_sent: 'USDC sent'
};

const LOAN_SELECT =
   'id, tracking_id, borrower_user_id, borrower_wallet, lender_user_id, lender_wallet, loan_amount, total_repayment_amount, repaid_amount, loan_status, repayment_status, funded_at, repaid_at, updated_at, hash';

type WalletAccountInsightsProps = {
   userId: string;
   address?: string | null;
   role: WalletAccountRole;
   preview?: boolean;
};

type AlchemyTransfer = {
   value: number | null;
   hash: string;
   metadata?: { blockTimestamp?: string };
};

type AlchemyResponse = {
   error?: { message?: string };
   result?: { transfers?: AlchemyTransfer[] };
};

const PREVIEW_ADDRESS = '0x71c92A46A238AEeB8D4502aE43B709d7E75B9d42';
const PREVIEW_OLD_ADDRESS = '0x6420A32b8349A085a3A7b45B93A5699c6f2A2855';

const PREVIEW_LOANS: WalletLoanRecord[] = [
   {
      id: 'preview-loan',
      tracking_id: 'LOAN-1042',
      borrower_user_id: 'preview-borrower',
      borrower_wallet: PREVIEW_ADDRESS,
      lender_user_id: 'preview-lender',
      lender_wallet: PREVIEW_OLD_ADDRESS,
      loan_amount: 25,
      total_repayment_amount: 25,
      repaid_amount: 8.75,
      loan_status: 'Lent',
      repayment_status: 'Partial',
      funded_at: '2026-07-25T09:00:00.000Z',
      repaid_at: null,
      updated_at: '2026-07-28T13:30:00.000Z',
      hash: ['0xpreviewfunding', '0xpreviewrepayment']
   }
];

const PREVIEW_TRANSFERS: WalletTransferRecord[] = [
   {
      direction: 'out',
      amount: 8.75,
      timestamp: '2026-07-28T13:30:00.000Z',
      hash: '0xpreviewrepayment'
   },
   {
      direction: 'in',
      amount: 25,
      timestamp: '2026-07-25T09:00:00.000Z',
      hash: '0xpreviewfunding'
   }
];

const PREVIEW_HISTORY: WalletConnectionEvent[] = [
   {
      id: 'preview-current',
      event_type: 'connected',
      wallet_address: PREVIEW_ADDRESS.toLowerCase(),
      previous_wallet_address: null,
      wallet_provider: 'base_wallet',
      wallet_connector_name: 'Base Account',
      wallet_chain_id: ALLOWED_CHAIN_ID,
      occurred_at: '2026-07-28T08:15:00.000Z'
   },
   {
      id: 'preview-previous',
      event_type: 'historical',
      wallet_address: PREVIEW_OLD_ADDRESS.toLowerCase(),
      previous_wallet_address: null,
      wallet_provider: null,
      wallet_connector_name: null,
      wallet_chain_id: ALLOWED_CHAIN_ID,
      occurred_at: '2026-07-20T11:30:00.000Z'
   }
];

function shortenAddress(address: string) {
   return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function formatDate(value: string) {
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return '';
   return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getHistorySummary(event: WalletConnectionEvent | undefined, currentEventId: string | undefined) {
   if (!event) return 'Show wallet history';
   const date = formatDate(event.occurred_at);
   if (!date) return 'Show wallet history';

   if (event.event_type === 'changed') return `Changed ${date}`;
   if (event.event_type === 'disconnected') return `Disconnected ${date}`;
   if (event.event_type === 'connected') return `Connected ${date}`;
   return event.id === currentEventId ? `Recorded ${date}` : `Last used ${date}`;
}

function formatUsdcAmount(value: number) {
   return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRawUsdcBalance(value: bigint) {
   if (value > 0n && value < 10_000n) return '<0.01';
   const [whole, fraction = ''] = formatUnits(value, 6).split('.');
   const groupedWhole = BigInt(whole || '0').toLocaleString();
   return `${groupedWhole}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

async function fetchTransfers(address: string, direction: 'in' | 'out', signal?: AbortSignal) {
   const response = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
         id: 1,
         jsonrpc: '2.0',
         method: 'alchemy_getAssetTransfers',
         params: [
            {
               fromBlock: '0x0',
               toBlock: 'latest',
               [direction === 'in' ? 'toAddress' : 'fromAddress']: address,
               contractAddresses: [BASE_USDC_ADDRESS],
               category: ['erc20'],
               withMetadata: true,
               order: 'desc',
               maxCount: `0x${MAX_TRANSFER_ROWS.toString(16)}`
            }
         ]
      })
   });

   if (!response.ok) throw new Error(`Wallet activity request failed (${response.status})`);
   const body = (await response.json()) as AlchemyResponse;
   if (body.error) throw new Error(body.error.message || 'Wallet activity request failed');
   if (!Array.isArray(body.result?.transfers)) throw new Error('Wallet activity response was incomplete');

   return body.result.transfers
      .filter((transfer) => typeof transfer.hash === 'string' && typeof transfer.value === 'number' && transfer.value > 0)
      .map<WalletTransferRecord>((transfer) => ({
         direction,
         amount: transfer.value as number,
         timestamp: transfer.metadata?.blockTimestamp ?? '',
         hash: transfer.hash
      }));
}

async function fetchWalletAccountData(userId: string, role: WalletAccountRole) {
   const supabase = getSupabaseBrowserClient();
   const activeLenderLoansQuery =
      role === 'lender'
         ? supabase
              .from('loans')
              .select('lender_user_id, lender_wallet, loan_status, repayment_status')
              .eq('lender_user_id', userId)
              .eq('loan_status', 'Lent')
              .or('repayment_status.is.null,repayment_status.neq.Paid')
         : Promise.resolve({ data: [], error: null });
   const [loanResult, historyResult, activeLenderLoansResult] = await Promise.all([
      supabase
         .from('loans')
         .select(LOAN_SELECT)
         .or(`borrower_user_id.eq.${userId},lender_user_id.eq.${userId}`)
         .order('updated_at', { ascending: false })
         .limit(30),
      supabase.rpc('get_my_wallet_connection_history', { p_limit: 50 }),
      activeLenderLoansQuery
   ]);

   if (loanResult.error) throw new Error(loanResult.error.message);
   if (activeLenderLoansResult.error) throw new Error(activeLenderLoansResult.error.message);

   return {
      loans: (loanResult.data ?? []) as WalletLoanRecord[],
      activeLenderLoans: (activeLenderLoansResult.data ?? []) as RepaymentRouteLoanRecord[],
      history: historyResult.error ? [] : ((historyResult.data ?? []) as WalletConnectionEvent[]),
      historyUnavailable: Boolean(historyResult.error)
   };
}

function WalletSection({ label, children }: { label: string; children: React.ReactNode }) {
   return (
      <section>
         <h2 className="mb-md-2 px-1 text-md-h5 font-semibold text-md-heading">{label}</h2>
         <div className="divide-y divide-md-neutral-400 overflow-hidden rounded-md-lg border border-md-neutral-600 bg-md-neutral-100 shadow-md-card">
            {children}
         </div>
      </section>
   );
}

function BalanceRow({ address, preview }: { address: string; preview: boolean }) {
   const isValidAddress = ADDRESS_PATTERN.test(address);
   const {
      data: rawBalance,
      isLoading,
      isFetching,
      isError,
      refetch
   } = useReadContract({
      abi: erc20Abi,
      address: BASE_USDC_ADDRESS,
      functionName: 'balanceOf',
      args: isValidAddress ? [address as `0x${string}`] : undefined,
      chainId: ALLOWED_CHAIN_ID,
      query: {
         enabled: isValidAddress && !preview,
         refetchInterval: 30_000
      }
   });

   const previewRawBalance = 23_750_000n;
   const displayBalance = preview ? formatRawUsdcBalance(previewRawBalance) : rawBalance != null ? formatRawUsdcBalance(rawBalance) : null;
   const showUnavailable = !preview && (!isValidAddress || isError || (!isLoading && rawBalance == null));

   return (
      <WalletSection label="Balance">
         <div className="px-md-3 py-md-3">
            <div className="flex flex-col gap-md-2 min-[350px]:flex-row min-[350px]:items-start min-[350px]:justify-between min-[350px]:gap-md-3">
               <div className="min-w-0">
                  <div className="flex items-center gap-2">
                     <img src="/icons/balance-coin-3d.png" alt="" className="size-9 shrink-0 object-contain" />
                     <div>
                        <p className="text-md-b2 font-semibold text-md-neutral-1200">USDC on Base</p>
                        {isLoading && !preview ? (
                           <div className="mt-1 h-8 w-32 animate-pulse rounded-md-xs bg-md-neutral-300" aria-label="Loading USDC balance" />
                        ) : showUnavailable ? (
                           <p className="mt-1 text-md-h5 font-semibold text-md-heading">Balance unavailable</p>
                        ) : (
                           <p className="mt-0.5 text-md-h3 font-semibold text-md-heading">
                              {displayBalance} <span className="text-md-b2 font-semibold text-md-neutral-1000">USDC</span>
                           </p>
                        )}
                     </div>
                  </div>
                  <p className="mt-md-2 text-md-b3 font-medium leading-5 text-md-neutral-1000">
                     {showUnavailable
                        ? 'We could not load this wallet’s USDC balance.'
                        : displayBalance === '0.00'
                          ? 'No USDC in this wallet on Base.'
                          : 'Only this wallet’s USDC balance on Base is shown.'}
                  </p>
               </div>
               {showUnavailable ? (
                  <button
                     type="button"
                     onClick={() => void refetch()}
                     disabled={isFetching || !isValidAddress}
                     className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 disabled:opacity-50"
                  >
                     <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
                     Try again
                  </button>
               ) : (
                  <a
                     href={`https://basescan.org/address/${address}`}
                     target="_blank"
                     rel="noreferrer"
                     className="inline-flex min-h-11 shrink-0 self-end items-center gap-1.5 rounded-md-input px-md-1 text-md-b3 font-semibold text-md-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 min-[350px]:self-auto"
                  >
                     BaseScan
                     <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
               )}
            </div>
         </div>
      </WalletSection>
   );
}

function ActivityIcon({ direction }: { direction: WalletActivityItem['direction'] }) {
   // 3D icons carry their own tile/badge background, so they render bare (no wrapper).
   const src =
      direction === 'in'
         ? '/icons/tx-received-3d.png'
         : direction === 'out'
           ? '/icons/tx-sent-3d.png'
           : '/icons/verified-check-3d.png';
   return <img src={src} alt="" className="size-9 shrink-0 object-contain" />;
}

function ActivityRow({ item }: { item: WalletActivityItem }) {
   const detail = item.trackingId ? `${item.trackingId} · ${formatDate(item.occurredAt)}` : formatDate(item.occurredAt);
   return (
      <div className="grid min-h-[68px] grid-cols-[36px_minmax(0,1fr)] items-center gap-x-md-2 px-md-3 py-md-2 min-[350px]:grid-cols-[36px_minmax(0,1fr)_auto]">
         <ActivityIcon direction={item.direction} />
         <div className="min-w-0 flex-1">
            <p className="truncate text-md-b1 font-semibold text-md-heading">{ACTIVITY_TITLES[item.kind]}</p>
            <p className="truncate text-md-b3 font-medium text-md-neutral-1000">{detail}</p>
         </div>
         <p
            className={`col-start-2 mt-1 shrink-0 text-md-b1 font-semibold min-[350px]:col-auto min-[350px]:mt-0 ${
               item.direction === 'in' ? 'text-md-green-900' : 'text-md-heading'
            }`}
         >
            {item.direction === 'in' ? '+' : item.direction === 'out' ? '−' : ''}
            {formatUsdcAmount(item.amount)}
            <span className="ml-1 text-md-b3 font-semibold text-md-neutral-1000">USDC</span>
         </p>
      </div>
   );
}

function HistoryEventRow({ event, isCurrent }: { event: WalletConnectionEvent; isCurrent: boolean }) {
   const title =
      event.event_type === 'changed'
         ? 'Wallet changed'
           : event.event_type === 'disconnected'
             ? 'Wallet disconnected'
             : event.event_type === 'connected'
               ? 'Wallet connected'
               : isCurrent
                 ? 'Current wallet recorded'
                 : 'Previously used';
   const addressCopy =
      event.event_type === 'changed' && event.previous_wallet_address
         ? `${shortenAddress(event.previous_wallet_address)} to ${shortenAddress(event.wallet_address)}`
         : shortenAddress(event.wallet_address);

   return (
      <div className="flex min-h-[68px] items-center gap-md-2 px-md-3 py-md-2">
         <img
            src={isCurrent ? '/icons/wallet-3d.png' : '/icons/wallet-previous-3d.png'}
            alt=""
            className="size-9 shrink-0 object-contain"
         />
         <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
               <p className="truncate text-md-b2 font-semibold text-md-heading">{title}</p>
               {isCurrent ? (
                  <span className="shrink-0 rounded-md-pill bg-md-green-100 px-2 py-0.5 text-md-b4 font-semibold text-md-green-900">
                     Current
                  </span>
               ) : null}
            </div>
            <p className="truncate font-mono text-md-b3 font-medium text-md-neutral-1000">{addressCopy}</p>
         </div>
         <p className="shrink-0 text-right text-md-b3 font-medium text-md-neutral-1000">{formatDate(event.occurred_at)}</p>
      </div>
   );
}

export default function WalletAccountInsights({ userId, address, role, preview = false }: WalletAccountInsightsProps) {
   const [showHistory, setShowHistory] = useState(false);
   const effectiveAddress = preview ? PREVIEW_ADDRESS : (address ?? '');
   const isValidAddress = ADDRESS_PATTERN.test(effectiveAddress);

   const accountQuery = useQuery({
      queryKey: ['wallet-account-insights', userId, role, normalizeWalletAddress(address)],
      queryFn: () => fetchWalletAccountData(userId, role),
      enabled: Boolean(userId) && !preview,
      staleTime: 30_000,
      retry: 1
   });

   const transferQuery = useQuery({
      queryKey: ['wallet-usdc-transfers', effectiveAddress],
      queryFn: async ({ signal }) => {
         const [incoming, outgoing] = await Promise.all([
            fetchTransfers(effectiveAddress, 'in', signal),
            fetchTransfers(effectiveAddress, 'out', signal)
         ]);
         return [...incoming, ...outgoing];
      },
      enabled: isValidAddress && Boolean(ALCHEMY_ID) && !preview,
      staleTime: 30_000,
      retry: 1
   });

   const loans = useMemo(() => (preview ? PREVIEW_LOANS : (accountQuery.data?.loans ?? [])), [accountQuery.data?.loans, preview]);
   const history = useMemo(
      () => (preview ? PREVIEW_HISTORY : (accountQuery.data?.history ?? [])),
      [accountQuery.data?.history, preview]
   );
   const routingLoans = useMemo(
      () => (preview ? PREVIEW_LOANS : (accountQuery.data?.activeLenderLoans ?? [])),
      [accountQuery.data?.activeLenderLoans, preview]
   );
   const transfers = preview ? PREVIEW_TRANSFERS : transferQuery.data;

   const activity = useMemo(
      () =>
         buildRecentWalletActivity({
            loans,
            transfers,
            userId,
            role,
            currentAddress: effectiveAddress,
            limit: 3
         }),
      [effectiveAddress, loans, role, transfers, userId]
   );
   const repaymentDestinations = useMemo(
      () =>
         role === 'lender'
            ? buildRepaymentDestinations({
                 loans: routingLoans,
                 userId,
                 currentAddress: effectiveAddress
              })
            : [],
      [effectiveAddress, role, routingLoans, userId]
   );
   const reportedWalletCount = Number(history.find((event) => event.total_wallets != null)?.total_wallets ?? 0);
   const walletCount = Math.max(
      Number.isFinite(reportedWalletCount) ? reportedWalletCount : 0,
      getDistinctWalletCount(history, effectiveAddress)
   );
   const currentEventId = history.find(
      (event) =>
         event.event_type !== 'disconnected' &&
         normalizeWalletAddress(event.wallet_address) === normalizeWalletAddress(effectiveAddress)
   )?.id;
   const showHistorySection =
      accountQuery.data?.historyUnavailable ||
      preview ||
      walletCount > 1 ||
      hasMeaningfulWalletHistory(history, effectiveAddress);
   const historySummary = getHistorySummary(history[0], currentEventId);

   const isAccountDataLoading = !preview && accountQuery.isLoading;
   const isActivityLoading = isAccountDataLoading || (!preview && isValidAddress && Boolean(ALCHEMY_ID) && transferQuery.isLoading);
   const activityUnavailable = !preview && accountQuery.isError;
   const transferDataUnavailable = !preview && isValidAddress && (!ALCHEMY_ID || transferQuery.isError);

   return (
      <>
         {effectiveAddress ? <BalanceRow address={effectiveAddress} preview={preview} /> : null}

         {repaymentDestinations.length > 0 ? (
            <div className="rounded-md-lg border border-md-yellow-700 bg-md-yellow-100 p-md-3">
               <div className="flex items-start gap-md-2">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-md-yellow-700" strokeWidth={2.1} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                     <p className="text-md-b1 font-semibold text-md-heading">Some repayments go to another wallet</p>
                     <p className="mt-1 text-md-b2 font-medium leading-5 text-md-heading">
                        {repaymentDestinations.reduce((total, item) => total + item.activeLoanCount, 0)} active{' '}
                        {repaymentDestinations.reduce((total, item) => total + item.activeLoanCount, 0) === 1 ? 'loan' : 'loans'} will keep
                        sending repayments to {repaymentDestinations.map((item) => shortenAddress(item.walletAddress)).join(', ')}.
                     </p>
                     <Link
                        to="/history"
                        className="mt-md-2 inline-flex min-h-11 items-center text-md-b2 font-semibold text-md-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
                     >
                        View loan history
                     </Link>
                  </div>
               </div>
            </div>
         ) : null}

         {effectiveAddress ? (
            <WalletSection label="Recent activity">
               {isActivityLoading ? (
                  <div className="flex min-h-[68px] items-center gap-md-2 px-md-3 py-md-2" aria-label="Loading recent wallet activity">
                     <span className="size-9 animate-pulse rounded-full bg-md-neutral-300" />
                     <span className="h-4 w-36 animate-pulse rounded-md-xs bg-md-neutral-300" />
                  </div>
               ) : activityUnavailable ? (
                  <div className="px-md-3 py-md-3">
                     <p className="text-md-b1 font-semibold text-md-heading">Activity unavailable</p>
                     <p className="mt-1 text-md-b2 font-medium leading-5 text-md-neutral-1000">
                        Your wallet is still connected. Try again to load recent activity.
                     </p>
                     <button
                        type="button"
                        onClick={() => {
                           void accountQuery.refetch();
                           if (ALCHEMY_ID) void transferQuery.refetch();
                        }}
                        className="mt-md-2 inline-flex min-h-11 items-center gap-1.5 text-md-b2 font-semibold text-md-primary-900"
                     >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Try again
                     </button>
                  </div>
               ) : activity.length === 0 ? (
                  // Empty wallet is the common, healthy case — lead with a calm "nothing yet"
                  // message. A failed on-chain transfer fetch is demoted to a small secondary
                  // note so a brand-new wallet never reads as if something is broken.
                  <div className="px-md-3 py-md-3">
                     <p className="text-md-b1 font-semibold text-md-heading">No activity yet</p>
                     <p className="mt-1 text-md-b2 font-medium text-md-neutral-1000">Loans and repayments will appear here.</p>
                     {transferDataUnavailable && ALCHEMY_ID ? (
                        <button
                           type="button"
                           onClick={() => void transferQuery.refetch()}
                           className="mt-md-2 inline-flex min-h-11 items-center gap-1.5 text-md-b3 font-semibold text-md-neutral-1000"
                        >
                           <RefreshCw className="size-4" aria-hidden="true" />
                           Check for on-chain transfers
                        </button>
                     ) : null}
                  </div>
               ) : (
                  <>
                     {activity.map((item) => (
                        <ActivityRow key={item.id} item={item} />
                     ))}
                     {transferDataUnavailable ? (
                        <div className="px-md-3 py-md-2">
                           <p className="text-md-b3 font-semibold text-md-neutral-1000">
                              On-chain transfers could not load. Confirmed loan events are shown.
                           </p>
                           {ALCHEMY_ID ? (
                              <button
                                 type="button"
                                 onClick={() => void transferQuery.refetch()}
                                 className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-md-b2 font-semibold text-md-primary-900"
                              >
                                 <RefreshCw className="size-4" aria-hidden="true" />
                                 Try again
                              </button>
                           ) : null}
                        </div>
                     ) : null}
                  </>
               )}
               <Link
                  to="/history"
                  className="flex min-h-[52px] items-center justify-between px-md-3 py-md-1 text-md-b2 font-semibold text-md-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary-900"
               >
                  View all loan activity
                  <ChevronRight className="size-4" aria-hidden="true" />
               </Link>
            </WalletSection>
         ) : null}

         {showHistorySection ? (
            <WalletSection label="Wallet history">
               {accountQuery.data?.historyUnavailable ? (
                  <div className="px-md-3 py-md-3">
                     <p className="text-md-b1 font-semibold text-md-heading">Wallet history unavailable</p>
                     <p className="mt-1 text-md-b2 font-medium leading-5 text-md-neutral-1000">
                        We could not load wallets previously used with this account.
                     </p>
                     <button
                        type="button"
                        onClick={() => void accountQuery.refetch()}
                        className="mt-md-2 inline-flex min-h-11 items-center gap-1.5 text-md-b2 font-semibold text-md-primary-900"
                     >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Try again
                     </button>
                  </div>
               ) : (
                  <>
                     <button
                        type="button"
                        onClick={() => setShowHistory((value) => !value)}
                        aria-expanded={showHistory}
                        className="flex min-h-[68px] w-full items-center gap-md-2 px-md-3 py-md-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary-900"
                     >
                        <img src="/icons/wallet-history-3d.png" alt="" className="size-9 shrink-0 object-contain" />
                        <span className="min-w-0 flex-1">
                           <span className="block text-md-b1 font-semibold text-md-heading">
                              {walletCount} {walletCount === 1 ? 'wallet' : 'wallets'} used
                           </span>
                           <span className="block text-md-b3 font-medium text-md-neutral-1000">
                              {showHistory ? 'Hide wallet history' : historySummary}
                           </span>
                        </span>
                        <ChevronDown
                           className={`size-[18px] shrink-0 text-md-neutral-800 transition-transform duration-200 ${
                              showHistory ? 'rotate-180' : ''
                           }`}
                           aria-hidden="true"
                        />
                     </button>
                     {showHistory
                        ? history
                             .slice(0, 6)
                             .map((event) => <HistoryEventRow key={event.id} event={event} isCurrent={event.id === currentEventId} />)
                        : null}
                  </>
               )}
            </WalletSection>
         ) : null}
      </>
   );
}
