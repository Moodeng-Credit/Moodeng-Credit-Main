// LI.FI (li.quest) cross-chain quotes and status, for the Indonesia vault bridge (_shared/idVaultBridge.ts).
//
//   lifiQuote       — "send exactly X, at least Y arrives": a ready-to-send transaction (fromAmount)
//   lifiQuoteToAmount — "Y must arrive": how much to send (toAmount)
//   lifiStatus      — where a bridge stands, by its source-chain tx hash
//
// The API key (vault secret LIFI_API_KEY, read via lifi_api_key()) only raises rate limits; LI.FI answers
// without it. Cloudflare in front of li.quest refuses requests without a User-Agent.

// deno-lint-ignore no-explicit-any
type Svc = any;

const BASE = 'https://li.quest/v1';
export const LIFI_DIAMOND = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';

export const BASE_CHAIN_ID = 8453;
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

let keyCache: { at: number; key: string | null } | null = null;
const apiKey = async (svc: Svc): Promise<string | null> => {
   if (keyCache && Date.now() - keyCache.at < 300_000) return keyCache.key;
   let key: string | null = null;
   try {
      const { data } = await svc.rpc('lifi_api_key');
      key = typeof data === 'string' && data.trim() ? data.trim() : null;
   } catch {
      key = null;
   }
   keyCache = { at: Date.now(), key };
   return key;
};

const get = async <T>(svc: Svc, path: string, params: Record<string, string | number>): Promise<T> => {
   const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
   const key = await apiKey(svc);
   const res = await fetch(`${BASE}${path}?${qs}`, {
      headers: { accept: 'application/json', 'user-agent': 'moodeng-server/1', ...(key ? { 'x-lifi-api-key': key } : {}) },
      signal: AbortSignal.timeout(25_000)
   });
   const text = await res.text();
   let body: unknown = null;
   try {
      body = JSON.parse(text);
   } catch {
      body = null;
   }
   if (!res.ok) {
      const msg = (body as { message?: string } | null)?.message ?? text.slice(0, 200);
      throw new Error(`lifi_${res.status}: ${msg}`);
   }
   return body as T;
};

export type LifiQuote = {
   tool: string;
   fromAmount: bigint;
   toAmount: bigint;
   toAmountMin: bigint;
   approvalAddress: string;
   tx: { to: string; data: string; value: bigint; chainId: number };
   feeUsd: number;
};

type RawQuote = {
   tool?: string;
   estimate?: {
      fromAmount: string;
      toAmount: string;
      toAmountMin: string;
      approvalAddress: string;
      feeCosts?: Array<{ amountUSD?: string }>;
      gasCosts?: Array<{ amountUSD?: string }>;
   };
   transactionRequest?: { to: string; data: string; value?: string; chainId?: number };
};

const parseQuote = (q: RawQuote): LifiQuote => {
   const e = q.estimate;
   const t = q.transactionRequest;
   if (!e || !t?.to || !t.data) throw new Error('lifi_bad_quote');
   // The LI.FI contract is the only spender / target we ever approve or call.
   if (e.approvalAddress.toLowerCase() !== LIFI_DIAMOND.toLowerCase() || t.to.toLowerCase() !== LIFI_DIAMOND.toLowerCase()) {
      throw new Error(`lifi_unexpected_contract ${t.to}`);
   }
   const feeUsd = [...(e.feeCosts ?? []), ...(e.gasCosts ?? [])].reduce((s, f) => s + Number(f.amountUSD ?? 0), 0);
   return {
      tool: q.tool ?? '?',
      fromAmount: BigInt(e.fromAmount),
      toAmount: BigInt(e.toAmount),
      toAmountMin: BigInt(e.toAmountMin),
      approvalAddress: e.approvalAddress,
      tx: { to: t.to, data: t.data, value: BigInt(t.value ?? '0x0'), chainId: Number(t.chainId ?? 0) },
      feeUsd
   };
};

export type QuoteInput = {
   fromChain: number;
   toChain: number;
   fromToken: string;
   toToken: string;
   fromAddress: string;
   toAddress: string;
   slippage?: number;
};

/** Send exactly `fromAmount` (source units); the quote says the guaranteed minimum that arrives. */
export const lifiQuote = async (svc: Svc, input: QuoteInput & { fromAmount: bigint }): Promise<LifiQuote> =>
   parseQuote(
      await get<RawQuote>(svc, '/quote', {
         fromChain: input.fromChain,
         toChain: input.toChain,
         fromToken: input.fromToken,
         toToken: input.toToken,
         fromAddress: input.fromAddress,
         toAddress: input.toAddress,
         fromAmount: input.fromAmount.toString(),
         slippage: input.slippage ?? 0.005
      })
   );

/** `toAmount` (destination units) must arrive: the quote says how much to send. */
export const lifiQuoteToAmount = async (svc: Svc, input: QuoteInput & { toAmount: bigint }): Promise<LifiQuote> =>
   parseQuote(
      await get<RawQuote>(svc, '/quote/toAmount', {
         fromChain: input.fromChain,
         toChain: input.toChain,
         fromToken: input.fromToken,
         toToken: input.toToken,
         fromAddress: input.fromAddress,
         toAddress: input.toAddress,
         toAmount: input.toAmount.toString(),
         slippage: input.slippage ?? 0.005
      })
   );

export type LifiStatus =
   | { state: 'pending' }
   | { state: 'done'; destTx: string | null; receivedUnits: string | null; partial: boolean }
   | { state: 'failed'; error: string };

/** Where a bridge stands. NOT_FOUND right after sending is normal (LI.FI hasn't indexed it yet) → pending. */
export const lifiStatus = async (svc: Svc, txHash: string, fromChain: number, toChain: number): Promise<LifiStatus> => {
   let body: { status?: string; substatus?: string; substatusMessage?: string; receiving?: { txHash?: string; amount?: string } };
   try {
      body = await get(svc, '/status', { txHash, fromChain, toChain });
   } catch (err) {
      if (err instanceof Error && err.message.startsWith('lifi_404')) return { state: 'pending' };
      throw err;
   }
   const status = String(body.status ?? '');
   if (status === 'DONE') {
      return {
         state: 'done',
         destTx: body.receiving?.txHash ?? null,
         receivedUnits: body.receiving?.amount ?? null,
         // PARTIAL = arrived as a different token; REFUNDED = sent back to us on the source chain.
         partial: body.substatus === 'PARTIAL' || body.substatus === 'REFUNDED'
      };
   }
   if (status === 'FAILED' || status === 'INVALID')
      return { state: 'failed', error: `${status}: ${body.substatusMessage ?? body.substatus ?? ''}`.trim() };
   return { state: 'pending' };
};

/** ERC-20 approve(spender, units) calldata. */
export const encodeApprove = (spender: string, units: bigint): string => {
   if (!/^0x[0-9a-fA-F]{40}$/.test(spender)) throw new Error('bad spender');
   return `0x095ea7b3${spender.slice(2).toLowerCase().padStart(64, '0')}${units.toString(16).padStart(64, '0')}`;
};
