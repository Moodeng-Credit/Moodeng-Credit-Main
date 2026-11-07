/**
 * Explorer link for a loan transaction hash (loans.hash entries). Base is the default; an entry
 * written as "bsc:0x…" is on BNB Chain — the Indonesia track's Walt payouts, paid by hand from
 * Binance TH (supabase/functions/_shared/idManualFunding.ts).
 */
export const BSC_TX_PREFIX = 'bsc:';

export const txExplorerUrl = (tx: string): string =>
   tx.startsWith(BSC_TX_PREFIX) ? `https://bscscan.com/tx/${tx.slice(BSC_TX_PREFIX.length)}` : `https://basescan.org/tx/${tx}`;

/** The bare 0x hash, without the chain prefix. */
export const bareTxHash = (tx: string): string => (tx.startsWith(BSC_TX_PREFIX) ? tx.slice(BSC_TX_PREFIX.length) : tx);
