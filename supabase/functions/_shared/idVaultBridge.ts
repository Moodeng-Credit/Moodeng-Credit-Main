// Indonesia track: fund Indonesian loans from the BitRepo vault (USDC on Base), and send repayments back
// (migration 20261112120000_id_vault_bridge.sql). LI.FI bridges; the Openfort payout wallet signs (same
// address on Base and BNB Chain, gas sponsored).
//
// Funding (admin → Requests → 🇮🇩 Pay to Walt → "Fund from vault"):
//   1. vaultDrawQuote   — server prices it: the loan amount must ARRIVE on BNB Chain, so the draw is LI.FI's
//                         "send this much" for that amount plus a small cushion (leftover stays in the wallet).
//   2. the admin's lending wallet draws that from the vault to the payout wallet's address on Base (browser).
//   3. recordVaultDraw  — checks the draw on Base, marks the loan as a vault loan, starts the bridge.
//   4. advance (card polling + the 5-minute job) — Openfort tx → LI.FI status → arrived → payNow() sends the
//                         borrower EXACTLY the loan amount from the payout wallet (idManualFunding.ts).
//
// Back to the vault (Telegram /idvault, admin chats):
//   repayments land in the payout wallet as USDT (idRepayments.ts) → one tap bridges them to USDC on Base
//   in the lending wallet (VAULT_OPERATOR) → Admin → Credit line → "Pay vault", as for any vault loan.
import { payNow } from './idManualFunding.ts';
import {
   balanceOf,
   BASE_CHAIN_ID,
   BSC_CHAIN_ID,
   BSC_USDC_CHECKSUM,
   BSC_USDT_CHECKSUM,
   type BscToken,
   getPayoutWallet,
   NotSentError,
   pollOpenfortTx,
   sendFromPayoutWallet
} from './idPayoutWallet.ts';
import { adminChatIds } from './idRepayments.ts';
import { BASE_USDC, encodeApprove, type LifiQuote, lifiQuote, lifiQuoteToAmount, lifiStatus } from './lifi.ts';
import { callTelegramApi, sendTelegramMessage } from './telegram.ts';
import { decodeUsdcTransfers, RPC_URL, rpcCall } from './usdcTransfer.ts';
import { VAULT_ADDRESS, VAULT_OPERATOR } from './vaultWatch.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const CB = 'idvb:';
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BSC_TOKEN: Record<BscToken, string> = { USDC: BSC_USDC_CHECKSUM, USDT: BSC_USDT_CHECKSUM };
/** Never send more than this through one bridge (USD). */
const MAX_BRIDGE_USD = 500;
/** Back to the vault: refuse a quote that loses more than this share on the way. */
const MAX_RETURN_LOSS = 0.02;

export type BridgeRow = {
   id: number;
   direction: 'to_bsc' | 'to_base';
   loan_id: string | null;
   card_key: string | null;
   draw_tx: string | null;
   from_token: string;
   from_units: string;
   to_token: string;
   to_min_units: string | null;
   to_address: string;
   openfort_tx: string | null;
   src_tx: string | null;
   dest_tx: string | null;
   received_units: string | null;
   status: 'drawn' | 'bridging' | 'bridged' | 'paid' | 'failed' | 'not_sent';
   error: string | null;
   by_admin: string | null;
   created_at: string;
   updated_at: string;
};

// ── pure helpers (idVaultBridge.test.ts) ─────────────────────────────────────────────────────────
/** USD → 6-decimal Base USDC units, exactly (string math). */
export const baseUnits = (usd: number | string): bigint => {
   const s = String(usd).trim();
   if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`bad amount ${s}`);
   const [w, f = ''] = s.split('.');
   return BigInt(w) * 1_000_000n + BigInt((f + '000000').slice(0, 6));
};

/** 6-decimal units → "15.20". */
export const baseUnitsText = (units: bigint): string => `${units / 1_000_000n}.${String((units % 1_000_000n) / 10_000n).padStart(2, '0')}`;

/**
 * What to draw so `quoteFromUnits` (LI.FI's price for the loan amount to arrive) is covered with room for the
 * price moving before the bridge is sent: +0.6% and 2 cents, rounded UP to whole cents.
 */
export const drawUnitsFor = (quoteFromUnits: bigint): bigint => {
   const padded = quoteFromUnits + (quoteFromUnits * 6n) / 1000n + 20_000n;
   return ((padded + 9_999n) / 10_000n) * 10_000n;
};

/** Smallest acceptable arrival for a bridge. to_bsc: the full loan (18 dec). to_base: within MAX_RETURN_LOSS (6 dec). */
export const minArrival = (direction: 'to_bsc' | 'to_base', fromUnits: bigint, loanUnits18?: bigint): bigint => {
   if (direction === 'to_bsc') {
      if (loanUnits18 == null) throw new Error('loan amount needed');
      return loanUnits18;
   }
   const asBase = fromUnits / 1_000_000_000_000n; // 18 → 6 decimals
   return asBase - (asBase * BigInt(Math.round(MAX_RETURN_LOSS * 10_000))) / 10_000n;
};

// ── shared bits ──────────────────────────────────────────────────────────────────────────────────
const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};

const tellTeam = async (svc: Svc, text: string) => {
   const [chat] = await adminChatIds(svc);
   if (chat) await sendTelegramMessage(chat, text).catch(() => undefined);
};

const patch = (svc: Svc, id: number, fields: Partial<BridgeRow>) =>
   svc
      .from('id_vault_bridges')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

type Loan = {
   id: string;
   tracking_id: string | null;
   borrower_user_id: string;
   loan_amount: number | string;
   total_repayment_amount: number | string | null;
   due_date: string | null;
   loan_status: string;
   lender_user_id: string | null;
   funded_at: string | null;
   market: string | null;
};

const loadLoan = async (svc: Svc, loanId: string): Promise<Loan | null> => {
   const { data } = await svc
      .from('loans')
      .select(
         'id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, due_date, loan_status, lender_user_id, funded_at, market'
      )
      .eq('id', loanId)
      .maybeSingle();
   return (data as Loan | null) ?? null;
};

const isOpen = (l: Loan) => l.loan_status === 'Requested' && !l.lender_user_id && !l.funded_at;
const loanUnits18 = (l: Loan) => baseUnits(Number(l.loan_amount).toFixed(2)) * 1_000_000_000_000n;
const loanLabel = (l: Pick<Loan, 'tracking_id' | 'id'>) => l.tracking_id ?? l.id.slice(0, 8);

export const bridgeForLoan = async (svc: Svc, loanId: string): Promise<BridgeRow | null> => {
   const { data } = await svc.from('id_vault_bridges').select('*').eq('loan_id', loanId).eq('direction', 'to_bsc').maybeSingle();
   return (data as BridgeRow | null) ?? null;
};

// ── 1. the draw price ────────────────────────────────────────────────────────────────────────────
export type DrawQuote =
   | {
        ok: true;
        recipient: string;
        amountUnits: string; // 6-dec Base USDC to draw
        amountText: string;
        totalDueUnits: string; // what the vault is owed: the draw + the borrower's interest
        dueTs: number; // unix seconds
        borrowerUserId: string;
        loanAmount: number;
        bridgeTool: string;
        bridgeFeeUsd: number;
     }
   | { ok: false; error: string };

export const vaultDrawQuote = async (svc: Svc, loanId: string): Promise<DrawQuote> => {
   const loan = await loadLoan(svc, loanId);
   if (!loan) return { ok: false, error: 'loan_not_found' };
   if (loan.market !== 'ID') return { ok: false, error: 'not_indonesia_loan' };
   if (!isOpen(loan)) return { ok: false, error: 'loan_not_open' };
   if (await bridgeForLoan(svc, loanId)) return { ok: false, error: 'already_drawn' };
   const wallet = await getPayoutWallet(svc);
   if (!wallet) return { ok: false, error: 'no_payout_wallet' };
   const { data: borrower } = await svc.from('users').select('walt_address').eq('id', loan.borrower_user_id).maybeSingle();
   if (!EVM_ADDRESS.test(String(borrower?.walt_address ?? ''))) return { ok: false, error: 'no_walt_address' };
   const amount = Number(loan.loan_amount);
   if (!(amount > 0) || amount > MAX_BRIDGE_USD) return { ok: false, error: 'bad_amount' };

   let q: LifiQuote;
   try {
      q = await lifiQuoteToAmount(svc, {
         fromChain: BASE_CHAIN_ID,
         toChain: BSC_CHAIN_ID,
         fromToken: BASE_USDC,
         toToken: BSC_USDC_CHECKSUM,
         fromAddress: wallet.address,
         toAddress: wallet.address,
         toAmount: loanUnits18(loan)
      });
   } catch (err) {
      return { ok: false, error: `lifi_quote_failed: ${errMsg(err)}` };
   }
   const draw = drawUnitsFor(q.fromAmount);
   const interest = baseUnits(Math.max(0, Number(loan.total_repayment_amount ?? amount) - amount).toFixed(2));
   const termDays = Number((await getSetting(svc, 'id_max_term_days')) ?? 14) || 14;
   const dueMs = loan.due_date && Date.parse(loan.due_date) > Date.now() ? Date.parse(loan.due_date) : Date.now() + termDays * 86_400_000;
   // End of the due day (UTC), like Vault Lend.
   const dueTs = Math.floor(new Date(new Date(dueMs).toISOString().slice(0, 10) + 'T23:59:59Z').getTime() / 1000);
   return {
      ok: true,
      recipient: wallet.address,
      amountUnits: draw.toString(),
      amountText: baseUnitsText(draw),
      totalDueUnits: (draw + interest).toString(),
      dueTs,
      borrowerUserId: loan.borrower_user_id,
      loanAmount: amount,
      bridgeTool: q.tool,
      bridgeFeeUsd: Math.round(q.feeUsd * 100) / 100
   };
};

// ── 2. recording the draw ────────────────────────────────────────────────────────────────────────
/** The vault's own record of the loan: principal drawn under this loan id (6 dec). */
const vaultPrincipal = async (loanId: string): Promise<bigint> => {
   const { encodeFunctionData, decodeFunctionResult, parseAbi } = await import('npm:viem@2');
   const abi = parseAbi(['function getLoan(string loanId) view returns (uint256, uint256, uint256, bool, uint256)']);
   const data = encodeFunctionData({ abi, functionName: 'getLoan', args: [loanId] });
   const out = await rpcCall(RPC_URL, 'eth_call', [{ to: VAULT_ADDRESS, data }, 'latest']);
   const [principal] = decodeFunctionResult({ abi, functionName: 'getLoan', data: out }) as readonly [bigint, ...unknown[]];
   return principal;
};

export type DrawResult = { ok: true; bridge: BridgeRow } | { ok: false; error: string; bridge?: BridgeRow | null };

export const recordVaultDraw = async (svc: Svc, loanId: string, txHash: string, adminUserId: string): Promise<DrawResult> => {
   if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, error: 'bad_txid' };
   const existing = await bridgeForLoan(svc, loanId);
   if (existing) {
      if (existing.draw_tx?.toLowerCase() === txHash.toLowerCase()) return { ok: true, bridge: await advanceBridge(svc, existing) };
      return { ok: false, error: 'already_drawn', bridge: existing };
   }
   const loan = await loadLoan(svc, loanId);
   if (!loan) return { ok: false, error: 'loan_not_found' };
   if (loan.market !== 'ID') return { ok: false, error: 'not_indonesia_loan' };
   const wallet = await getPayoutWallet(svc);
   if (!wallet) return { ok: false, error: 'no_payout_wallet' };

   const receipt = await rpcCall(RPC_URL, 'eth_getTransactionReceipt', [txHash]).catch(() => null);
   if (!receipt) return { ok: false, error: 'draw_not_found_on_base_yet' };
   if (receipt.status !== '0x1') return { ok: false, error: 'draw_failed_on_chain' };
   const vault = VAULT_ADDRESS.toLowerCase();
   const t = decodeUsdcTransfers(receipt.logs).find((x) => x.from === vault && x.to === wallet.address.toLowerCase());
   if (!t) return { ok: false, error: 'not_a_vault_draw_to_payout_wallet' };
   // The vault keys loans by our loan id: its principal for THIS loan must be what moved.
   const principal = await vaultPrincipal(loanId).catch(() => null);
   if (principal == null) return { ok: false, error: 'vault_unreadable_try_again' };
   if (principal !== t.value) return { ok: false, error: 'draw_not_for_this_loan' };

   const { data: ins, error } = await svc
      .from('id_vault_bridges')
      .insert({
         direction: 'to_bsc',
         loan_id: loanId,
         draw_tx: txHash.toLowerCase(),
         from_token: 'USDC',
         from_units: t.value.toString(),
         to_token: 'USDC',
         to_address: wallet.address.toLowerCase(),
         status: 'drawn',
         by_admin: adminUserId
      })
      .select('*')
      .single();
   if (error || !ins) {
      const again = await bridgeForLoan(svc, loanId);
      return again ? { ok: true, bridge: again } : { ok: false, error: `save_failed: ${error?.message ?? '?'}` };
   }
   // From here the vault watch counts it, and Admin → Credit line lists it for "Pay vault".
   await svc.from('loans').update({ vault_address: vault, updated_at: new Date().toISOString() }).eq('id', loanId);
   await tellTeam(svc, `🏦 Vault draw ${baseUnitsText(t.value)} USDC for 🇮🇩 ${loanLabel(loan)} → bridging to BNB Chain with LI.FI.`);
   return { ok: true, bridge: await advanceBridge(svc, ins as BridgeRow) };
};

// ── 3. bridging ──────────────────────────────────────────────────────────────────────────────────
const route = (row: BridgeRow) =>
   row.direction === 'to_bsc'
      ? { fromChain: BASE_CHAIN_ID, toChain: BSC_CHAIN_ID, fromToken: BASE_USDC, toToken: BSC_USDC_CHECKSUM }
      : { fromChain: BSC_CHAIN_ID, toChain: BASE_CHAIN_ID, fromToken: BSC_TOKEN[row.from_token as BscToken], toToken: BASE_USDC };

/** drawn → bridging: quote the exact amount we hold, check the arrival, send approve + bridge in one tx. */
const startBridge = async (svc: Svc, row: BridgeRow, deadline: number): Promise<BridgeRow> => {
   const { data: claimed } = await svc
      .from('id_vault_bridges')
      .update({ status: 'bridging', error: null, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'drawn')
      .select('*')
      .maybeSingle();
   if (!claimed) return row;
   const back = async (error: string) => {
      await patch(svc, row.id, { status: 'drawn', error });
      return { ...row, status: 'drawn' as const, error };
   };
   const wallet = await getPayoutWallet(svc);
   if (!wallet) return back('no_payout_wallet');
   const fromUnits = BigInt(row.from_units);
   let need: bigint;
   if (row.direction === 'to_bsc') {
      const loan = row.loan_id ? await loadLoan(svc, row.loan_id) : null;
      if (!loan) return back('loan_not_found');
      need = minArrival('to_bsc', fromUnits, loanUnits18(loan));
   } else {
      need = minArrival('to_base', fromUnits);
   }
   let q: LifiQuote;
   try {
      q = await lifiQuote(svc, { ...route(row), fromAddress: wallet.address, toAddress: row.to_address, fromAmount: fromUnits });
   } catch (err) {
      return back(`lifi_quote_failed: ${errMsg(err)}`);
   }
   if (q.fromAmount !== fromUnits) return back('lifi_amount_mismatch');
   if (q.tx.value !== 0n) return back('lifi_wants_native_value');
   if (q.toAmountMin < need) return back(`quote_short: min ${q.toAmountMin} < ${need}`);
   const r = route(row);
   try {
      const txId = await sendFromPayoutWallet(
         svc,
         r.fromChain,
         [
            { to: r.fromToken, data: encodeApprove(q.approvalAddress, fromUnits) },
            { to: q.tx.to, data: q.tx.data }
         ],
         deadline
      );
      await patch(svc, row.id, { openfort_tx: txId, to_min_units: q.toAmountMin.toString(), error: null });
      return { ...row, status: 'bridging', openfort_tx: txId, to_min_units: q.toAmountMin.toString(), error: null };
   } catch (err) {
      if (err instanceof NotSentError) return back(`not_sent: ${errMsg(err)}`);
      // It may have gone out: never resend automatically.
      const error = `send_failed_may_have_gone: ${errMsg(err)}`;
      await patch(svc, row.id, { status: 'failed', error });
      await tellTeam(
         svc,
         `⚠️ LI.FI bridge #${row.id} (${row.direction}) — the send failed and MAY have gone out: ${error}. Check the payout wallet before anything else.`
      );
      return { ...row, status: 'failed', error };
   }
};

/** Moves one bridge as far as it can go right now. Safe to call repeatedly (card polling + the job). */
export const advanceBridge = async (svc: Svc, row: BridgeRow, deadline = Date.now() + 50_000): Promise<BridgeRow> => {
   let cur = row;
   if (cur.status === 'drawn') {
      // A draw that keeps failing to quote/send is retried by the job, but not more than every 2 minutes.
      if (cur.error && Date.now() - Date.parse(cur.updated_at) < 120_000) return cur;
      cur = await startBridge(svc, cur, deadline);
      if (cur.status !== 'bridging') return cur;
   }
   if (cur.status === 'bridging' && cur.openfort_tx) {
      if (!cur.src_tx) {
         const s = await pollOpenfortTx(svc, cur.openfort_tx).catch(() => ({ state: 'pending' as const }));
         if (s.state === 'failed') {
            const error = `openfort_${s.error}`;
            await patch(svc, cur.id, { status: 'failed', error, src_tx: s.txHash ?? null });
            await tellTeam(
               svc,
               `⚠️ LI.FI bridge #${cur.id} (${cur.direction}) didn't go through: ${error}. The money is still in the payout wallet — check it, then ask the dev team to retry.`
            );
            return { ...cur, status: 'failed', error };
         }
         if (s.state !== 'succeeded') return cur;
         await patch(svc, cur.id, { src_tx: s.txHash });
         cur = { ...cur, src_tx: s.txHash };
      }
      const r = route(cur);
      const st = await lifiStatus(svc, cur.src_tx!, r.fromChain, r.toChain).catch(() => ({ state: 'pending' as const }));
      if (st.state === 'pending') return cur;
      if (st.state === 'failed' || (st.state === 'done' && st.partial)) {
         const error = st.state === 'failed' ? `lifi_${st.error}` : 'lifi_partial_or_refunded';
         await patch(svc, cur.id, { status: 'failed', error, dest_tx: st.state === 'done' ? st.destTx : null });
         await tellTeam(
            svc,
            `⚠️ LI.FI bridge #${cur.id} (${cur.direction}) ended badly: ${error}. Look up ${cur.src_tx} on https://scan.li.fi — the money is either refunded to the payout wallet or arrived as another token.`
         );
         return { ...cur, status: 'failed', error };
      }
      await patch(svc, cur.id, { status: 'bridged', dest_tx: st.destTx, received_units: st.receivedUnits, error: null });
      cur = { ...cur, status: 'bridged', dest_tx: st.destTx, received_units: st.receivedUnits, error: null };
      if (cur.direction === 'to_base') {
         const got = st.receivedUnits ? baseUnitsText(BigInt(st.receivedUnits)) : '?';
         await patch(svc, cur.id, { status: 'paid' });
         await tellTeam(
            svc,
            `✅ ${got} USDC arrived on Base in the lending wallet ${VAULT_OPERATOR.slice(0, 6)}…${VAULT_OPERATOR.slice(-4)}.\nNext: Admin → Finance → Credit line → “Pay vault”.`
         );
         return { ...cur, status: 'paid' };
      }
   }
   if (cur.status === 'bridged' && cur.direction === 'to_bsc' && cur.loan_id) {
      // Arrived on BNB Chain: the payout wallet sends the borrower exactly the loan amount (at most once).
      const res = await payNow(svc, cur.loan_id, cur.by_admin ?? 'vault-bridge');
      if (res.ok && res.state === 'found') {
         await patch(svc, cur.id, { status: 'paid', error: null });
         return { ...cur, status: 'paid', error: null };
      }
      const error = res.ok ? null : String(res.error ?? 'pay_failed');
      if (error && error !== cur.error) {
         await patch(svc, cur.id, { error });
         const loan = await loadLoan(svc, cur.loan_id);
         await tellTeam(
            svc,
            `🟡 Vault money for 🇮🇩 ${loan ? loanLabel(loan) : cur.loan_id} is on BNB Chain, but the payout didn't go: ${error}. Open the request in admin → Pay to Walt.`
         );
      }
      return { ...cur, error };
   }
   return cur;
};

/** The 5-minute job: every bridge still moving. */
export const runVaultBridges = async (svc: Svc, deadline = Date.now() + 40_000): Promise<number> => {
   const { data } = await svc.from('id_vault_bridges').select('*').in('status', ['drawn', 'bridging', 'bridged']).order('id').limit(10);
   let n = 0;
   for (const row of (data ?? []) as BridgeRow[]) {
      if (Date.now() > deadline - 30_000) break;
      try {
         await advanceBridge(svc, row, deadline);
         n += 1;
      } catch (err) {
         console.error(`idVaultBridge: advance #${row.id} failed`, err);
      }
   }
   return n;
};

/** Admin card: the bridge for a loan, moved on first. */
export const vaultBridgeStatus = async (svc: Svc, loanId: string): Promise<{ ok: true; bridge: BridgeRow | null }> => {
   const row = await bridgeForLoan(svc, loanId);
   if (!row || row.status === 'paid' || row.status === 'failed') return { ok: true, bridge: row };
   return { ok: true, bridge: await advanceBridge(svc, row, Date.now() + 40_000) };
};

// ── 4. back to the vault (Telegram) ──────────────────────────────────────────────────────────────
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const centsText = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

/**
 * /idvault               USDT in the payout wallet (repayments) → a card to send it back to Base
 * /idvault USDT 25 | all  /idvault USDC 10  (USDC there is the payout float — only when asked)
 */
export const handleVaultCommand = async (svc: Svc, message: { chat: { id: number | string }; text?: string }): Promise<boolean> => {
   const m = (message.text ?? '').trim().match(/^\/idvault(?:@\w+)?(?:\s+(\S+))?(?:\s+(\S+))?/i);
   if (!m) return false;
   const chatId = message.chat.id;
   const say = (text: string, extra: Record<string, unknown> = {}) => sendTelegramMessage(chatId, text, extra).catch(() => undefined);
   const done = async (text: string) => {
      await say(text);
      return true;
   };
   const wallet = await getPayoutWallet(svc);
   if (!wallet) return await done('No payout wallet yet.');
   const bal = await balanceOf(wallet.address).catch(() => null);
   if (!bal) return await done('⚠️ Can’t read BNB Chain right now. Try again in a minute.');
   const token = (m[1] ?? 'USDT').toUpperCase() as BscToken;
   if (token !== 'USDT' && token !== 'USDC') return await done('Usage: /idvault · /idvault USDT 25 · /idvault USDT all');
   const haveCents = Number((token === 'USDT' ? bal.usdtUnits : bal.usdcUnits) / 10n ** 16n);
   const raw = (m[2] ?? 'all').toLowerCase();
   const cents = raw === 'all' ? haveCents : /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : NaN;
   const head = `🏦 Back to the vault\nPayout wallet: ${bal.usdt.toFixed(2)} USDT · ${bal.usdc.toFixed(2)} USDC (BNB Chain)`;
   if (!Number.isFinite(cents) || cents <= 0) return await done(`${head}\n\nNothing to send. Usage: /idvault USDT 25 · /idvault USDT all`);
   if (cents > haveCents) return await done(`${head}\n\nOnly ${centsText(haveCents)} ${token} there.`);
   if (cents / 100 > MAX_BRIDGE_USD) return await done(`${head}\n\nAt most $${MAX_BRIDGE_USD} per send — split it.`);
   let q: LifiQuote;
   try {
      q = await lifiQuote(svc, {
         fromChain: BSC_CHAIN_ID,
         toChain: BASE_CHAIN_ID,
         fromToken: BSC_TOKEN[token],
         toToken: BASE_USDC,
         fromAddress: wallet.address,
         toAddress: VAULT_OPERATOR,
         fromAmount: BigInt(cents) * 10n ** 16n
      });
   } catch (err) {
      return await done(`${head}\n\n⚠️ LI.FI couldn’t price it: ${errMsg(err)}`);
   }
   const arrive = baseUnitsText(q.toAmountMin);
   await say(
      `${head}\n\nSend ${centsText(cents)} ${token} → at least ${arrive} USDC on Base, to the lending wallet ${short(VAULT_OPERATOR)} (via ${q.tool}, fees ≈ $${q.feeUsd.toFixed(2)}).\nThen: Admin → Credit line → “Pay vault”.`,
      { inlineKeyboard: [[{ text: `↩️ Send ${centsText(cents)} ${token} back to Base`, callback_data: `${CB}s:${token}:${cents}` }]] }
   );
   return true;
};

export const isVaultBridgeCallback = (data: string | undefined) => !!data && data.startsWith(CB);

export const handleVaultBridgeCallback = async (
   svc: Svc,
   query: {
      id: string;
      data?: string;
      from?: { username?: string; first_name?: string };
      message?: { chat: { id: number | string }; message_id: number; text?: string };
   }
): Promise<boolean> => {
   if (!isVaultBridgeCallback(query.data)) return false;
   const answer = (text: string) =>
      callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const chatId = query.message?.chat.id;
   if (chatId == null || !query.message || !(await adminChatIds(svc)).includes(String(chatId))) {
      await answer('Not allowed here.');
      return true;
   }
   const by = query.from?.username ? `@${query.from.username}` : (query.from?.first_name ?? 'admin');
   const finish = async (line: string) => {
      await answer(line);
      await callTelegramApi('editMessageText', {
         chat_id: chatId,
         message_id: query.message!.message_id,
         text: `${query.message!.text ?? ''}\n\n${line} — ${by}`.slice(0, 4000),
         reply_markup: { inline_keyboard: [] }
      }).catch(() => undefined);
   };
   const [, kind, token, centsRaw] = String(query.data).split(':');
   const cents = Number(centsRaw);
   if (kind !== 's' || (token !== 'USDT' && token !== 'USDC') || !Number.isInteger(cents) || cents <= 0 || cents / 100 > MAX_BRIDGE_USD) {
      await answer('Bad card.');
      return true;
   }
   const wallet = await getPayoutWallet(svc);
   if (!wallet) {
      await answer('No payout wallet.');
      return true;
   }
   // One send per card, even on double taps (card_key is unique).
   const { data: ins, error } = await svc
      .from('id_vault_bridges')
      .insert({
         direction: 'to_base',
         card_key: `${chatId}:${query.message.message_id}`,
         from_token: token,
         from_units: (BigInt(cents) * 10n ** 16n).toString(),
         to_token: 'USDC',
         to_address: VAULT_OPERATOR.toLowerCase(),
         status: 'drawn',
         by_admin: by
      })
      .select('*')
      .single();
   if (error || !ins) {
      await answer(error?.code === '23505' ? 'Already sent from this card.' : `Couldn’t start: ${error?.message ?? '?'}`);
      return true;
   }
   const row = await advanceBridge(svc, ins as BridgeRow, Date.now() + 50_000);
   if (row.status === 'bridging') {
      await finish(
         `✅ Sending ${centsText(cents)} ${token} to Base (bridge #${row.id}). I'll post here when it lands — usually under a minute.`
      );
   } else if (row.status === 'failed') {
      await finish(`⚠️ Send failed: ${row.error}`);
   } else {
      // Not sent (quote or Openfort refused before sending): drop the row so the card can be retried with /idvault.
      await svc.from('id_vault_bridges').update({ status: 'not_sent', updated_at: new Date().toISOString() }).eq('id', row.id);
      await finish(`Not sent: ${row.error ?? 'unknown'}. Send /idvault again to retry.`);
   }
   return true;
};
