import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Admin refund flow.
//
// An active admin repays a LENDER out of the admin's own wallet for an outstanding loan, and this
// function — the ONLY path allowed to write the loan money columns (a DB trigger rejects client
// writes) — records it and applies the fallout:
//   1. Verifies the on-chain USDC transfer to the lender's wallet (same gate as confirm-loan-payment).
//   2. Cancels the loan: repayment_status = 'Paid', repaid_amount = total (never "due" again),
//      + refunded_at/refund_reason/refunded_by/refund_hash provenance stamp.
//   3. Immutable loan_refunds ledger row.
//   4. Bans the BORROWER: users.account_status = 'banned' AND a 'banned' admin_account_restrictions row.
//   5. KYC-blacklists the borrower: internal kyc_blacklist row + push to the DIDIT provider blocklists
//      (wallet address, email, and vendor_data/user), so a future KYC session auto-declines.
//   6. Notifies the lender (admin_user_notices + email + Telegram) with the admin's free-text reason.
//   7. admin_audit_logs for the refund, the ban, and the blacklist.
//
// This same function also RECONCILES an already-sent refund: pass the hash of a transfer that already
// went out and it records everything above without sending money (the send happens client-side first).
//
// Body: { loanId: string, hash: string, method: 'wallet' | 'base', reason: string }

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// --- On-chain verification (identical to confirm-loan-payment) ---
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

// --- Inlined email (Resend) + Telegram helpers, so this function deploys as a single file ---
const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
   const key = Deno.env.get('RESEND_API_KEY');
   const from = Deno.env.get('RESEND_FROM') || 'support@moodeng.app';
   if (!key) throw new Error('Missing RESEND_API_KEY');
   const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) })
   });
   if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
};

const sendTelegramMessage = async (chatId: number | string, text: string) => {
   const token = Deno.env.get('TELEGRAM_API_TOKEN') ?? Deno.env.get('TELEGRAM_BOT_TOKEN');
   const apiUrl = Deno.env.get('TELEGRAM_API_URL');
   const url = apiUrl ?? (token ? `https://api.telegram.org/bot${token}/sendMessage` : null);
   if (!url) throw new Error('TELEGRAM token not configured');
   const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
   });
   const r = await res.json().catch(() => null);
   if (!res.ok || !r?.ok) throw new Error(r?.description ?? `Telegram failed ${res.status}`);
};

// --- DIDIT provider blocklists (production app). Each entry type has its own list UUID; overridable
// via env. Endpoint: POST {DIDIT_API_BASE}/lists/{uuid}/entries/ with x-api-key and { value, comment }.
// vendor_data we send to DIDIT is the Supabase user id, so the user-blocklist value is the borrower id.
const DIDIT_API_BASE = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');
const DIDIT_WALLET_BLOCKLIST_ID = Deno.env.get('DIDIT_WALLET_BLOCKLIST_ID') || '323dda80-f5f9-443e-9cfc-5da7c2cac979';
const DIDIT_EMAIL_BLOCKLIST_ID = Deno.env.get('DIDIT_EMAIL_BLOCKLIST_ID') || '05115446-d867-4f93-a474-65bbc4725bd4';
const DIDIT_USER_BLOCKLIST_ID = Deno.env.get('DIDIT_USER_BLOCKLIST_ID') || 'ba4003b8-a9a5-4df0-9343-f2101598b4f5';

const pushToDiditBlocklist = async (
   entries: Array<{ listUuid: string; type: string; value: string; label: string }>,
   comment: string
): Promise<{ pushed: boolean; response: unknown }> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) return { pushed: false, response: { skipped: 'DIDIT_API_KEY not configured' } };
   const results: unknown[] = [];
   let anyOk = false;
   for (const e of entries) {
      if (!e.value || !e.listUuid) continue;
      try {
         const res = await fetch(`${DIDIT_API_BASE}/lists/${e.listUuid}/entries/`, {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ value: e.value, comment, display_label: e.label })
         });
         const body = await res.json().catch(() => null);
         results.push({ type: e.type, status: res.status, body });
         if (res.ok) anyOk = true;
      } catch (err) {
         results.push({ type: e.type, error: err instanceof Error ? err.message : String(err) });
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
   if (!loanId || !hash || (method !== 'wallet' && method !== 'base')) return json({ error: 'Missing or invalid loanId, hash, or method' }, 400);
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

   const requiredMicros = BigInt(Math.round(Number(loan.loan_amount) * 1e6));
   const expectedRecipient = loan.lender_wallet.toLowerCase();

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

   // --- (2) Cancel the loan ---
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

   // --- (3) Ledger ---
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

   // --- (4) Ban borrower + (5) KYC blacklist ---
   const borrowerId = loan.borrower_user_id as string | null;
   let borrowerBanned = false;
   let kycBlacklisted = false;
   let diditPushed = false;

   if (borrowerId) {
      const { data: b } = await admin.from('users').select('id, username, email, wallet_address').eq('id', borrowerId).maybeSingle();
      const borrowerWallet = (b as { wallet_address?: string } | null)?.wallet_address ?? loan.borrower_wallet ?? '';
      const borrowerEmail = b?.email ?? '';

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

      const { error: kycRevokeError } = await admin.from('users').update({ is_didit: 'INACTIVE' }).eq('id', borrowerId);
      if (kycRevokeError) errors.push(`kyc(revoke): ${kycRevokeError.message}`);

      const diditResult = await pushToDiditBlocklist(
         [
            { listUuid: DIDIT_WALLET_BLOCKLIST_ID, type: 'wallet_address', value: borrowerWallet, label: `Refund ${loan.tracking_id}` },
            { listUuid: DIDIT_EMAIL_BLOCKLIST_ID, type: 'email', value: borrowerEmail, label: `Refund ${loan.tracking_id}` },
            { listUuid: DIDIT_USER_BLOCKLIST_ID, type: 'user', value: borrowerId, label: `Refund ${loan.tracking_id}` }
         ],
         `Admin refund on loan ${loan.tracking_id}: ${reason}`
      );
      diditPushed = diditResult.pushed;
      if (!diditResult.pushed) errors.push('didit: blocklist push failed (see kyc_blacklist.didit_response)');

      const { error: blacklistError } = await admin.from('kyc_blacklist').upsert(
         {
            user_id: borrowerId,
            wallet_address: borrowerWallet || null,
            email: borrowerEmail || null,
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

   // --- (6) Notify the lender ---
   let lenderEmailSent = false;
   let lenderTelegramSent = false;
   let lenderNoticeStored = false;
   const lenderId = loan.lender_user_id as string | null;
   if (lenderId) {
      const { data: lender } = await admin.from('users').select('id, username, email, chat_id').eq('id', lenderId).maybeSingle();
      const title = 'Your loan has been refunded';
      const bodyText =
         `We've refunded loan ${loan.tracking_id}. ${money(refundAmount)} (${loan.coin ?? 'USDC'}) has been sent back to your wallet. ` +
         `This loan is now closed and nothing further is owed to you on it.\n\nReason: ${reason}\n\nOn-chain proof: ${recordHash}`;

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
