// Walt bridge (Indonesia track) — the `relay` actions of stableyard-deposit-address.
//
// POST { relay: 'cashout_quote', amount: "12.50" }
//      → Base USDC (Moodeng wallet) → BNB Chain USDC to the caller's saved Walt address.
//        Returns a Relay one-time deposit address on Base; the app then sends exactly `amountIn`
//        USDC there through its normal cash-out path (face gate, sponsored send, recordWithdrawal).
// POST { relay: 'cashout_sent', transferId, txHash } → the app sent it: store the tx hash.
// POST { relay: 'repay_quote', amountUsdt: "15.30" }
//      → BNB Chain USDT (from Walt) → Base USDC into the caller's Moodeng wallet. Returns a one-time
//        deposit address on BNB Chain; the borrower withdraws USDT (BEP20) from Walt to it.
// POST { relay: 'status', transferId } → poll Relay, update the row, return it.
// POST { relay: 'latest', direction: 'cashout' | 'repay' } → the caller's newest transfer (to resume).
//
// Every address comes from the caller's own users row — never from the client: the cash-out
// recipient is ALWAYS users.walt_address, the repay recipient ALWAYS users.wallet_address.
// Only accounts with a Walt address can use it (only the Indonesia track can save one).
// Kill switch, no deploy: telegram_bot_settings.walt_bridge = 'off'.
import {
   BASE_CHAIN_ID,
   BASE_USDC,
   BASE_USDC_DECIMALS,
   BSC_TOKEN_DECIMALS,
   fromUnits,
   RelayError,
   type RelayQuote,
   relayQuoteCashout,
   relayQuoteRepay,
   relayStatus,
   rowStatusFor,
   toUnits
} from '../_shared/relay.ts';
import { RPC_URL, rpcCall } from '../_shared/usdcTransfer.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
type Json = (body: Record<string, unknown>, status?: number) => Response;

const ACTIONS = new Set(['cashout_quote', 'cashout_sent', 'repay_quote', 'status', 'latest']);
export const isRelayAction = (value: unknown) => typeof value === 'string' && ACTIONS.has(value);

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Dollar amounts from the app: 2 decimals for USDC cash-outs, up to 6 for USDT repay amounts.
const USD_2DP = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?$/;
const USD_6DP = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,6})?$/;

const MIN_USD = 1;
const MAX_USD = 500;
// A still-unused quote for the same amount is handed out again for this long, so a retry (or the
// return from a face check, which approves one exact destination + amount) gets the same address.
const REUSE_MS = 30 * 60_000;

const ROW_FIELDS =
   'id, direction, status, amount_in, amount_out_quoted, deposit_address, recipient, refund_to, request_id, tx_hash, fill_tx_hash, quote, created_at, updated_at';

type Row = {
   id: string;
   direction: 'cashout' | 'repay';
   status: string;
   amount_in: string | number;
   amount_out_quoted: string | number | null;
   deposit_address: string;
   recipient: string;
   refund_to: string | null;
   request_id: string | null;
   tx_hash: string | null;
   fill_tx_hash: string | null;
   quote: {
      feeUsd?: number | null;
      timeEstimate?: number | null;
      amountOutMin?: string | null;
      amountIn?: string;
      amountInUnits?: string;
   } | null;
   created_at: string;
   updated_at: string;
};

const FINAL = new Set(['success', 'failure', 'refund', 'expired']);

/** Exact origin-token units of a row. PostgREST returns numeric as a JSON number, which loses
 *  precision at 18 decimals, so the exact string stored in `quote` wins. */
const rowUnits = (row: Row): bigint => {
   const stored = row.quote?.amountInUnits;
   if (stored && /^[0-9]+$/.test(stored)) return BigInt(stored);
   const raw = typeof row.amount_in === 'number' ? row.amount_in.toLocaleString('en-US', { useGrouping: false }) : String(row.amount_in);
   return BigInt(raw.split('.')[0] || '0');
};

/** What the app sees for a transfer. `amountIn` is human units of the origin token. */
const view = (row: Row) => {
   const decimals = row.direction === 'cashout' ? BASE_USDC_DECIMALS : BSC_TOKEN_DECIMALS;
   const units = rowUnits(row);
   return {
      transferId: row.id,
      direction: row.direction,
      status: row.status,
      depositAddress: row.deposit_address,
      recipient: row.recipient,
      amountIn: fromUnits(units, decimals),
      amountInUnits: units.toString(),
      amountOut: row.amount_out_quoted != null ? String(row.amount_out_quoted) : null,
      amountOutMin: row.quote?.amountOutMin ?? null,
      feeUsd: row.quote?.feeUsd ?? null,
      timeEstimate: row.quote?.timeEstimate ?? null,
      txHash: row.tx_hash,
      fillTxHash: row.fill_tx_hash,
      createdAt: row.created_at
   };
};

/** USDC balance (6dp units) of `wallet` on Base, or null if the RPC can't be read. */
const baseUsdcBalance = async (wallet: string): Promise<bigint | null> => {
   try {
      const data = '0x70a08231' + wallet.slice(2).toLowerCase().padStart(64, '0');
      const result = await Promise.race([
         rpcCall(RPC_URL, 'eth_call', [{ to: BASE_USDC, data }, 'latest']),
         new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
      ]);
      return typeof result === 'string' && /^0x[0-9a-fA-F]*$/.test(result) ? BigInt(result === '0x' ? '0x0' : result) : null;
   } catch {
      return null;
   }
};

const bridgeOff = async (admin: SupabaseClient) => {
   const { data } = await admin.from('telegram_bot_settings').select('value').eq('key', 'walt_bridge').maybeSingle();
   return (
      String(data?.value ?? 'on')
         .trim()
         .toLowerCase() === 'off'
   );
};

/** An unused quote for exactly this transfer, still waiting at Relay, made in the last 30 minutes. */
const reusableQuote = async (
   admin: SupabaseClient,
   userId: string,
   direction: 'cashout' | 'repay',
   units: bigint,
   recipient: string,
   refundTo: string
): Promise<Row | null> => {
   const { data } = await admin
      .from('relay_transfers')
      .select(ROW_FIELDS)
      .eq('user_id', userId)
      .eq('direction', direction)
      .is('loan_id', null) // the Telegram bot's repay rows (loan_id set, paid to the lender) are never the app's
      .eq('status', 'quoted')
      .eq('amount_in', units.toString())
      .gte('created_at', new Date(Date.now() - REUSE_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   const row = data as Row | null;
   if (!row?.request_id) return null;
   if (row.recipient.toLowerCase() !== recipient.toLowerCase() || (row.refund_to ?? '').toLowerCase() !== refundTo.toLowerCase())
      return null;
   try {
      const status = await relayStatus(row.request_id);
      return status.status === 'waiting' ? row : null;
   } catch {
      return null;
   }
};

const insertQuote = async (
   admin: SupabaseClient,
   userId: string,
   direction: 'cashout' | 'repay',
   q: RelayQuote,
   recipient: string,
   refundTo: string
) => {
   const { data, error } = await admin
      .from('relay_transfers')
      .insert({
         user_id: userId,
         direction,
         origin_chain_id: q.originChainId,
         destination_chain_id: q.destinationChainId,
         origin_token: q.originToken,
         destination_token: q.destinationToken,
         amount_in: q.amountInUnits,
         amount_out_quoted: q.amountOut,
         deposit_address: q.depositAddress,
         recipient,
         refund_to: refundTo,
         request_id: q.requestId,
         status: 'quoted',
         quote: {
            feeUsd: q.feeUsd,
            timeEstimate: q.timeEstimate,
            amountOutMin: q.amountOutMin,
            amountIn: q.amountIn,
            amountInUnits: q.amountInUnits,
            relay: q.raw
         }
      })
      .select(ROW_FIELDS)
      .single();
   if (error || !data) {
      console.error('[relay] store quote failed', error?.message);
      return null;
   }
   return data as Row;
};

export const handleRelay = async (
   admin: SupabaseClient,
   userId: string,
   action: string,
   body: Record<string, unknown>,
   json: Json
): Promise<Response> => {
   try {
      const { data: profile } = await admin
         .from('users')
         .select('wallet_address, wallet_chain_id, walt_address')
         .eq('id', userId)
         .maybeSingle();
      const wallet = String(profile?.wallet_address ?? '').trim();
      const walt = String(profile?.walt_address ?? '').trim();

      if (action === 'status' || action === 'cashout_sent') {
         const transferId = String(body.transferId ?? '').trim();
         if (!UUID.test(transferId)) return json({ ok: false, error: 'Invalid transfer.' }, 400);
         // Bot repay rows (loan_id set) belong to the 5-minute job (_shared/idRepayments.ts): the app
         // must never poll or flip them, or the payment would never be recorded on the loan.
         const { data } = await admin
            .from('relay_transfers')
            .select(ROW_FIELDS)
            .eq('id', transferId)
            .eq('user_id', userId)
            .is('loan_id', null)
            .maybeSingle();
         const row = data as Row | null;
         if (!row) return json({ ok: false, error: 'Transfer not found.' }, 404);

         if (action === 'cashout_sent') {
            const txHash = String(body.txHash ?? '').trim();
            if (!HASH.test(txHash)) return json({ ok: false, error: 'Invalid transaction.' }, 400);
            if (row.direction !== 'cashout') return json({ ok: false, error: 'Not a cash-out.' }, 400);
            if (row.tx_hash && row.tx_hash.toLowerCase() !== txHash.toLowerCase())
               return json({ ok: false, error: 'This transfer was already sent.' }, 409);
            const status = row.status === 'quoted' ? 'sent' : row.status;
            const { data: updated } = await admin
               .from('relay_transfers')
               .update({ tx_hash: txHash, status, updated_at: new Date().toISOString() })
               .eq('id', row.id)
               .eq('user_id', userId)
               .select(ROW_FIELDS)
               .single();
            return json({ ok: true, ...view((updated as Row) ?? { ...row, tx_hash: txHash, status }) });
         }

         // status
         if (FINAL.has(row.status) || !row.request_id) return json({ ok: true, relayStatus: null, ...view(row) });
         const status = await relayStatus(row.request_id);
         const next = rowStatusFor(status.status);
         const patch: Record<string, unknown> = {};
         if (next && next !== row.status) patch.status = next;
         if (status.fillTxHash && status.fillTxHash !== row.fill_tx_hash) patch.fill_tx_hash = status.fillTxHash;
         // A repay deposit comes from Walt, not from the app, so its in-tx is only known from Relay.
         if (!row.tx_hash && status.inTxHashes[0]) patch.tx_hash = status.inTxHashes[0];
         let current = row;
         if (Object.keys(patch).length) {
            patch.updated_at = new Date().toISOString();
            const { data: updated } = await admin
               .from('relay_transfers')
               .update(patch)
               .eq('id', row.id)
               .eq('user_id', userId)
               .select(ROW_FIELDS)
               .single();
            current = (updated as Row) ?? ({ ...row, ...patch } as Row);
         }
         return json({ ok: true, relayStatus: status.status, ...view(current) });
      }

      if (action === 'latest') {
         const direction = body.direction === 'repay' ? 'repay' : 'cashout';
         const { data } = await admin
            .from('relay_transfers')
            .select(ROW_FIELDS)
            .eq('user_id', userId)
            .eq('direction', direction)
            .is('loan_id', null) // never resume the Telegram bot's repay address in the app
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
         return json({ ok: true, transfer: data ? view(data as Row) : null, waltAddress: walt || null });
      }

      // New quotes from here on.
      if (await bridgeOff(admin)) return json({ ok: false, code: 'bridge_off', error: 'Walt transfers are paused for now.' }, 503);
      if (!EVM_ADDRESS.test(walt)) return json({ ok: false, code: 'no_walt', error: 'Save your Walt address first.' }, 409);
      if (!EVM_ADDRESS.test(wallet) || (profile?.wallet_chain_id && Number(profile.wallet_chain_id) !== BASE_CHAIN_ID)) {
         return json({ ok: false, code: 'no_wallet', error: 'Set up your Moodeng wallet first.' }, 409);
      }
      if (walt.toLowerCase() === wallet.toLowerCase())
         return json({ ok: false, code: 'no_walt', error: 'Save your Walt address first.' }, 409);

      if (action === 'cashout_quote') {
         const amount = String(body.amount ?? '').trim();
         if (!USD_2DP.test(amount)) return json({ ok: false, code: 'bad_amount', error: 'Enter an amount like 10 or 10.50.' }, 400);
         if (Number(amount) < MIN_USD) return json({ ok: false, code: 'amount_too_low', error: `The minimum is $${MIN_USD}.` }, 400);
         if (Number(amount) > MAX_USD) return json({ ok: false, code: 'amount_too_high', error: `The maximum is $${MAX_USD}.` }, 400);
         const units = toUnits(amount, BASE_USDC_DECIMALS);
         const balance = await baseUsdcBalance(wallet);
         if (balance != null && units > balance) {
            return json(
               {
                  ok: false,
                  code: 'insufficient',
                  error: 'Not enough USDC in your wallet.',
                  balance: fromUnits(balance, BASE_USDC_DECIMALS)
               },
               400
            );
         }
         const reused = await reusableQuote(admin, userId, 'cashout', units, walt, wallet);
         if (reused) return json({ ok: true, reused: true, waltAddress: walt, ...view(reused) });
         const q = await relayQuoteCashout({ amountUsdc: amount, user: wallet, recipient: walt, refundTo: wallet });
         const row = await insertQuote(admin, userId, 'cashout', q, walt, wallet);
         if (!row) return json({ ok: false, error: 'Could not start the transfer. Try again.' }, 500);
         return json({ ok: true, waltAddress: walt, ...view(row) });
      }

      // repay_quote
      const amountUsdt = String(body.amountUsdt ?? '').trim();
      if (!USD_6DP.test(amountUsdt)) return json({ ok: false, code: 'bad_amount', error: 'Enter an amount like 10 or 10.50.' }, 400);
      if (Number(amountUsdt) < MIN_USD) return json({ ok: false, code: 'amount_too_low', error: `The minimum is $${MIN_USD}.` }, 400);
      if (Number(amountUsdt) > MAX_USD) return json({ ok: false, code: 'amount_too_high', error: `The maximum is $${MAX_USD}.` }, 400);
      const units = toUnits(amountUsdt, BSC_TOKEN_DECIMALS);
      const reused = await reusableQuote(admin, userId, 'repay', units, wallet, walt);
      if (reused) return json({ ok: true, reused: true, waltAddress: walt, ...view(reused) });
      const q = await relayQuoteRepay({ amountUsdt, recipient: wallet, refundTo: walt });
      const row = await insertQuote(admin, userId, 'repay', q, wallet, walt);
      if (!row) return json({ ok: false, error: 'Could not get an address. Try again.' }, 500);
      return json({ ok: true, waltAddress: walt, ...view(row) });
   } catch (err) {
      if (err instanceof RelayError) {
         console.warn('[relay]', action, err.code, err.message);
         const userMessage =
            err.code === 'AMOUNT_TOO_LOW' || err.code === 'amount_too_low'
               ? 'That amount is too small to send.'
               : err.status === 400
                 ? err.message
                 : 'Could not get a price right now. Try again in a minute.';
         return json({ ok: false, code: err.code, error: userMessage }, err.status);
      }
      console.error('[relay] error', action, (err as Error)?.message);
      return json({ ok: false, error: 'Walt transfers are unavailable right now.' }, 500);
   }
};
