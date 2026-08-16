import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Admin refund flow.
//
// An active admin repays a LENDER out of the admin's own wallet for an outstanding loan, and this
// function — the ONLY path allowed to write the loan money columns (a DB trigger rejects client
// writes) — records it and applies the fallout atomically-ish:
//   1. Verifies the on-chain USDC transfer to the lender's wallet (same gate as confirm-loan-payment).
//   2. Cancels the loan: repayment_status = 'Paid', repaid_amount = total (so it is never "due" again),
//      and stamps refunded_at / refund_reason / refunded_by / refund_hash as the real provenance.
//   3. Writes an immutable loan_refunds ledger row.
//   4. Bans the BORROWER: users.account_status = 'banned' AND a 'banned' admin_account_restrictions row.
//   5. KYC-blacklists the borrower: internal kyc_blacklist row + best-effort push to the DIDIT
//      provider blocklist (gated on DIDIT_BLOCKLIST_ID; failure is surfaced, not fatal).
//   6. Notifies the lender (admin_user_notices + email + Telegram) with the admin's free-text reason.
//   7. Writes admin_audit_logs for the refund, the ban, and the blacklist.
//
// Steps 1–3 are the transaction of record; if any of 4–7 fail the refund still stands and the error is
// returned in `errors` for the admin to follow up (mirrors confirm-loan-payment's side-effect contract).
//
// Body: { loanId: string, hash: string, method: 'wallet' | 'base', reason: string }
// Response: { ok: true, ... summary ..., errors: string[] } | { error: string, retry?: boolean }

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// --- On-chain verification (ported from confirm-loan-payment; kept identical on purpose) ---
const USDC_ADDRESS = (Deno.env.get('BASE_USDC_ADDRESS') || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BUNDLER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/S-fOd2n2Oi4fl4e1Crm83XeDXZ7tkg8O';
const ALCHEMY_ID = Deno.env.get('ALCHEMY_ID') ?? '';
const RPC_URL = ALCHEMY_ID ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` : 'https://mainnet.base.org';

const topicToAddress = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();
const hexToBigInt = (hex: string) => (hex && hex !== '0x' ? BigInt(hex) : 0n);

interface RawLog {
   address?: string;
   topics?: string[];
   data?: string;
}
interface DecodedTransfer {
   from: string;
   to: string;
   value: bigint;
}

const decodeUsdcTransfers = (logs: RawLog[] | undefined): DecodedTransfer[] => {
   const transfers: DecodedTransfer[] = [];
   for (const log of logs ?? []) {
      if ((log.address ?? '').toLowerCase() !== USDC_ADDRESS) continue;
      const topics = log.topics ?? [];
      if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC || topics.length < 3) continue;
      transfers.push({ from: topicToAddress(topics[1]), to: topicToAddress(topics[2]), value: hexToBigInt(log.data ?? '0x0') });
   }
   return transfers;
};

const rpcCall = async (url: string, method: string, params: unknown[]) => {
   const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
   });
   const j = await res.json();
   if (j.error) throw new Error(j.error.message || 'RPC error');
   return j.result;
};

class PaymentNotConfirmedError extends Error {
   constructor() {
      super('Payment is not confirmed on-chain yet');
   }
}

interface VerifiedTransfer {
   from: string;
   to: string;
   micros: bigint;
   blockNumber?: string;
   txHash?: string;
}

const verifyPayment = async (method: 'wallet' | 'base', hash: string): Promise<VerifiedTransfer> => {
   if (method === 'base') {
      const result = await rpcCall(BUNDLER_URL, 'eth_getUserOperationReceipt', [hash]);
      if (!result) throw new PaymentNotConfirmedError();
      if (!result.success) throw new Error('Payment failed on-chain');
      const transfers = decodeUsdcTransfers(result.receipt?.logs);
      if (transfers.length === 0) throw new Error('No USDC transfer found in this payment');
      const sender = (result.sender ?? '').toLowerCase();
      const chosen = transfers.filter((t) => t.from === sender)[0] ?? transfers[0];
      return { from: chosen.from, to: chosen.to, micros: chosen.value, blockNumber: result.receipt?.blockNumber, txHash: result.receipt?.transactionHash };
   }
   const receipt = await rpcCall(RPC_URL, 'eth_getTransactionReceipt', [hash]);
   if (!receipt) throw new PaymentNotConfirmedError();
   if (receipt.status !== '0x1') throw new Error('Transaction failed on-chain');
   const transfers = decodeUsdcTransfers(receipt.logs);
   if (transfers.length === 0) throw new Error('No USDC transfer found in this transaction');
   return { from: transfers[0].from, to: transfers[0].to, micros: transfers[0].value, blockNumber: receipt.blockNumber, txHash: receipt.transactionHash ?? hash };
};

const getBlockTimestampMs = async (blockNumber?: string): Promise<number | null> => {
   if (!blockNumber) return null;
   try {
      const block = await rpcCall(RPC_URL, 'eth_getBlockByNumber', [blockNumber, false]);
      if (!block?.timestamp) return null;
      return Number(BigInt(block.timestamp)) * 1000;
   } catch {
      return null;
   }
};

const money = (v: number) => `$${Number(v || 0).toFixed(2)}`;

// Best-effort push of a blocklist entry to the DIDIT provider. Gated on DIDIT_BLOCKLIST_ID; the exact
// v3 lists-entry endpoint/body should be confirmed against your DIDIT account before relying on it —
// the internal kyc_blacklist row is the authoritative record either way.
const pushToDiditBlocklist = async (
   entries: Array<{ entry_type: string; value: string }>,
   reason: string
): Promise<{ pushed: boolean; response: unknown }> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   const listId = Deno.env.get('DIDIT_BLOCKLIST_ID');
   if (!apiKey || !listId) return { pushed: false, response: { skipped: 'DIDIT_API_KEY or DIDIT_BLOCKLIST_ID not configured' } };
   const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');
   const results: unknown[] = [];
   let anyOk = false;
   for (const entry of entries) {
      if (!entry.value) continue;
      try {
         const res = await fetch(`${apiBase}/lists/${listId}/entries/`, {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ entry_type: entry.entry_type, value: entry.value, reason })
         });
         const bodyJson = await res.json().catch(() => null);
         results.push({ entry_type: entry.entry_type, status: res.status, body: bodyJson });
         if (res.ok) anyOk = true;
      } catch (e) {
         results.push({ entry_type: entry.entry_type, error: e instanceof Error ? e.message : String(e) });
      }
   }
   return { pushed: anyOk, response: results };
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   let body: { loanId?: string; hash?: string; method?: string; reason?: string };
   try {
      body = await req.json();
   } catch {
      return json({ error: 'Invalid JSON body' }, 400);
   }

   const { loanId, hash } = body;
   const method = body.method;
   const reason = (body.reason ?? '').trim();
   if (!loanId || !hash || (method !== 'wallet' && method !== 'base')) {
      return json({ error: 'Missing or invalid loanId, hash, or method' }, 400);
   }
   if (!reason) return json({ error: 'A refund reason is required' }, 400);

   const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
   const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
   const admin = createClient(supabaseUrl, serviceRoleKey);

   // --- Verify caller is an active Moodeng admin (mirrors admin-loan-notify) ---
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);
   const { data: userData, error: userError } = await admin.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);
   const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);

   // --- Load and validate the loan ---
   const { data: loan, error: loanError } = await admin.from('loans').select('*').eq('id', loanId).single();
   if (loanError || !loan) return json({ error: 'Loan not found' }, 404);
   if (loan.loan_status !== 'Lent') return json({ error: 'Only a funded (Lent) loan can be refunded' }, 409);
   if (loan.refunded_at) return json({ error: 'This loan has already been refunded' }, 409);
   if (loan.repayment_status === 'Paid') return json({ error: 'This loan is already fully repaid — nothing to refund' }, 409);
   if (!loan.lender_wallet) return json({ error: 'Loan is missing a lender wallet to refund to' }, 409);

   // The refund returns the lender's PRINCIPAL. The on-chain transfer must land on the lender wallet
   // for at least loan_amount, and (freshness) must post-date the funding it unwinds.
   const requiredMicros = BigInt(Math.round(Number(loan.loan_amount) * 1e6));
   const expectedRecipient = loan.lender_wallet.toLowerCase();

   // Replay protection: a hash may only ever back ONE money event, across funding/repayment/refund.
   const { data: existingHash } = await admin.from('used_payment_hashes').select('hash').eq('hash', hash).maybeSingle();
   if (existingHash) return json({ error: 'This transaction has already been used' }, 409);

   let transfer: VerifiedTransfer;
   try {
      transfer = await verifyPayment(method, hash);
   } catch (err) {
      if (err instanceof PaymentNotConfirmedError) return json({ error: err.message, retry: true }, 202);
      return json({ error: err instanceof Error ? err.message : 'Payment verification failed' }, 402);
   }
   if (transfer.to !== expectedRecipient) return json({ error: 'Refund was not sent to the lender wallet' }, 402);
   if (transfer.micros < requiredMicros) return json({ error: 'Refund amount is less than the loan principal' }, 402);

   const stateFloorIso = loan.funded_at ?? loan.created_at ?? null;
   if (stateFloorIso) {
      const blockTsMs = await getBlockTimestampMs(transfer.blockNumber);
      const floorMs = new Date(stateFloorIso).getTime();
      const GRACE_MS = 10 * 60 * 1000;
      if (blockTsMs !== null && Number.isFinite(floorMs) && blockTsMs < floorMs - GRACE_MS) {
         return json({ error: 'This payment predates the loan and cannot be used to refund it' }, 402);
      }
   }

   const { error: insertHashError } = await admin.from('used_payment_hashes').insert({ hash, loan_id: loanId });
   if (insertHashError) return json({ error: 'This transaction has already been used' }, 409);

   const recordHash = transfer.txHash ?? hash;
   const nowIso = new Date().toISOString();
   const refundAmount = Number(loan.loan_amount);
   const errors: string[] = [];

   // --- (2) Cancel the loan — the transaction of record ---
   const { data: updatedLoan, error: updateError } = await admin
      .from('loans')
      .update({
         repayment_status: 'Paid',
         repaid_amount: loan.total_repayment_amount,
         refunded_at: nowIso,
         refund_reason: reason,
         refunded_by: callerId,
         refund_hash: recordHash,
         hash: [...(loan.hash ?? []), recordHash]
      })
      .eq('id', loanId)
      .select()
      .single();
   if (updateError || !updatedLoan) return json({ error: updateError?.message || 'Failed to cancel the loan' }, 500);

   // --- (3) Refund ledger ---
   const { error: ledgerError } = await admin.from('loan_refunds').insert({
      loan_id: loanId,
      lender_user_id: loan.lender_user_id,
      borrower_user_id: loan.borrower_user_id,
      lender_wallet: loan.lender_wallet,
      amount: refundAmount,
      coin: loan.coin ?? 'USDC',
      reason,
      tx_hash: recordHash,
      method,
      refunded_by: callerId
   });
   if (ledgerError) errors.push(`ledger: ${ledgerError.message}`);

   // --- (4) Ban the borrower ---
   const borrowerId = loan.borrower_user_id as string | null;
   let borrowerBanned = false;
   let kycBlacklisted = false;
   let diditPushed = false;
   let borrower: { id: string; username?: string | null; email?: string | null } | null = null;

   if (borrowerId) {
      const { data: b } = await admin.from('users').select('id, username, email, wallet_address').eq('id', borrowerId).maybeSingle();
      borrower = b as typeof borrower;

      const { error: banError } = await admin.from('users').update({ account_status: 'banned' }).eq('id', borrowerId);
      if (banError) errors.push(`ban(account_status): ${banError.message}`);
      else borrowerBanned = true;

      const { error: restrictionError } = await admin.from('admin_account_restrictions').upsert(
         {
            user_id: borrowerId,
            status: 'banned',
            reason: 'default',
            risk_level: 'high',
            evidence_summary: `Refund issued on loan ${loan.tracking_id}; borrower banned. ${reason}`,
            admin_note: reason,
            restricted_at: nowIso,
            created_by: callerId,
            updated_by: callerId,
            updated_at: nowIso
         },
         { onConflict: 'user_id' }
      );
      if (restrictionError) errors.push(`ban(restriction): ${restrictionError.message}`);

      // --- (5) KYC blacklist: revoke KYC, internal record, then best-effort DIDIT push ---
      const { error: kycRevokeError } = await admin.from('users').update({ is_didit: 'INACTIVE' }).eq('id', borrowerId);
      if (kycRevokeError) errors.push(`kyc(revoke): ${kycRevokeError.message}`);

      const diditResult = await pushToDiditBlocklist(
         [
            { entry_type: 'wallet_address', value: (b as { wallet_address?: string } | null)?.wallet_address ?? loan.borrower_wallet ?? '' },
            { entry_type: 'email', value: b?.email ?? '' }
         ],
         `Admin refund on loan ${loan.tracking_id}: ${reason}`
      );
      diditPushed = diditResult.pushed;
      if (!diditResult.pushed) errors.push('didit: blocklist push skipped or failed (see kyc_blacklist.didit_response)');

      const { error: blacklistError } = await admin.from('kyc_blacklist').upsert(
         {
            user_id: borrowerId,
            wallet_address: (b as { wallet_address?: string } | null)?.wallet_address ?? loan.borrower_wallet,
            email: b?.email ?? null,
            reason,
            source: 'admin_refund',
            didit_pushed: diditResult.pushed,
            didit_response: diditResult.response as Record<string, unknown>,
            created_by: callerId
         },
         { onConflict: 'user_id' }
      );
      if (blacklistError) errors.push(`kyc(blacklist): ${blacklistError.message}`);
      else kycBlacklisted = true;
   } else {
      errors.push('borrower: loan has no borrower_user_id — could not ban / blacklist');
   }

   // --- (6) Notify the lender: persisted notice + email + Telegram ---
   let lenderEmailSent = false;
   let lenderTelegramSent = false;
   let lenderNoticeStored = false;
   const lenderId = loan.lender_user_id as string | null;
   if (lenderId) {
      const { data: lender } = await admin.from('users').select('id, username, email, chat_id').eq('id', lenderId).maybeSingle();
      const title = 'Your loan has been refunded';
      const bodyText =
         `We've refunded loan ${loan.tracking_id}. ${money(refundAmount)} (${loan.coin ?? 'USDC'}) has been sent back to your wallet. ` +
         `This loan is now closed and nothing further is owed to you on it.\n\nReason: ${reason}`;

      const { error: noticeError } = await admin.from('admin_user_notices').insert({
         recipient_user_id: lenderId,
         audience: 'lender',
         notice_type: 'refund',
         title,
         body: bodyText,
         metadata: { loan_id: loanId, tracking_id: loan.tracking_id, amount: refundAmount, coin: loan.coin ?? 'USDC', tx_hash: recordHash },
         created_by: callerId
      });
      if (noticeError) errors.push(`notice: ${noticeError.message}`);
      else lenderNoticeStored = true;

      if (lender?.email?.trim()) {
         try {
            const emailHtml =
               `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">` +
               `<p>Hi ${lender.username ?? 'there'},</p>` +
               `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` +
               `<p>— The Moodeng Credit team</p></div>`;
            await sendEmail(lender.email.trim(), title, `Hi ${lender.username ?? 'there'},\n\n${bodyText}\n\n— The Moodeng Credit team`, emailHtml);
            lenderEmailSent = true;
         } catch (e) {
            errors.push(`email: ${e instanceof Error ? e.message : String(e)}`);
         }
      }
      if (lender?.chat_id) {
         try {
            await sendTelegramMessage(lender.chat_id, `${title}\n\n${bodyText}`);
            lenderTelegramSent = true;
         } catch (e) {
            errors.push(`telegram: ${e instanceof Error ? e.message : String(e)}`);
         }
      }
   } else {
      errors.push('lender: loan has no lender_user_id — could not notify');
   }

   // --- (7) Audit logs ---
   const auditRows = [
      {
         actor_user_id: callerId,
         action: 'loan_refunded',
         target_table: 'loans',
         target_id: loanId,
         target_user_id: lenderId,
         metadata: { tracking_id: loan.tracking_id, amount: refundAmount, coin: loan.coin ?? 'USDC', tx_hash: recordHash, reason }
      },
      ...(borrowerId
         ? [
              { actor_user_id: callerId, action: 'borrower_banned', target_table: 'users', target_id: borrowerId, target_user_id: borrowerId, metadata: { loan_id: loanId, reason } },
              { actor_user_id: callerId, action: 'kyc_blacklisted', target_table: 'kyc_blacklist', target_id: borrowerId, target_user_id: borrowerId, metadata: { loan_id: loanId, didit_pushed: diditPushed, reason } }
           ]
         : [])
   ];
   const { error: auditError } = await admin.from('admin_audit_logs').insert(auditRows);
   if (auditError) errors.push(`audit: ${auditError.message}`);

   return json({
      ok: true,
      loan: updatedLoan,
      refund: { amount: refundAmount, coin: loan.coin ?? 'USDC', txHash: recordHash },
      borrowerBanned,
      kycBlacklisted,
      diditPushed,
      lender: { noticeStored: lenderNoticeStored, emailSent: lenderEmailSent, telegramSent: lenderTelegramSent },
      errors
   });
});
