import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { buildCashoutAlert, cashoutTxUrl, DEFAULT_CASHOUT_ALERT_CHAT_ID } from '../_shared/cashoutAlert.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { PaymentNotConfirmedError, type VerifiedTransfer, verifyPayment } from '../_shared/usdcTransfer.ts';

// Server-side recorder for a borrower cash-out. The client used to insert `withdrawals` rows
// directly (any amount / tx hash) and then trigger withdrawal-notification. Now the client only
// sends the tx hash; this function verifies on Base that it is a successful USDC transfer FROM one
// of the caller's wallets, records the on-chain amount and destination with the service role, and
// fires the "on its way" notification.
//
// Body: { txHash: string, exchange?: string }
// Response: { withdrawalId } | { error, retry?: true }
//
// Internal (secret key as Bearer/apikey): { replayAlert: <withdrawals.id> } re-posts that cash-out's
// team alert, marked as a resend — for a card that never landed (e.g. bot not yet in the group).

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// A plain transaction hash (embedded wallet) or a Base Account userOperation hash (Base Pay): try
// the transaction receipt first, then the bundler.
const verifyAny = async (hash: string): Promise<VerifiedTransfer & { wallet: 'embedded' | 'base' }> => {
   try {
      return { ...(await verifyPayment('wallet', hash)), wallet: 'embedded' };
   } catch (err) {
      if (!(err instanceof PaymentNotConfirmedError)) throw err;
   }
   return { ...(await verifyPayment('base', hash)), wallet: 'base' };
};

// deno-lint-ignore no-explicit-any
type AdminClient = any;

// Team alert in the Cash-outs group: who, how much, how, when. Never blocks the response.
const postCashoutAlert = async (
   admin: AdminClient,
   args: {
      userId: string;
      amount: number;
      exchange: string;
      destination: string;
      txHash: string;
      wallet: 'embedded' | 'base';
      // Replay only: when it happened, which cash-out it was, and a first line marking the resend.
      at?: Date;
      cashoutNumber?: number;
      prefix?: string;
   }
) => {
   try {
      const [setting, user, count] = await Promise.all([
         admin.from('telegram_bot_settings').select('value').eq('key', 'cashout_alert_chat_id').maybeSingle(),
         admin.from('users').select('username, display_name, telegram_username, email, market').eq('id', args.userId).maybeSingle(),
         admin.from('withdrawals').select('id', { count: 'exact', head: true }).eq('borrower_user_id', args.userId)
      ]);
      const chatId = ((setting.data as { value?: string } | null)?.value || '').trim() || DEFAULT_CASHOUT_ALERT_CHAT_ID;
      const u = (user.data ?? {}) as {
         username?: string | null;
         display_name?: string | null;
         telegram_username?: string | null;
         email?: string | null;
         market?: string | null;
      };
      const card = buildCashoutAlert({
         amount: args.amount,
         exchange: args.exchange,
         destination: args.destination,
         txHash: args.txHash,
         wallet: args.wallet,
         at: args.at ?? new Date(),
         user: {
            id: args.userId,
            username: u.username,
            displayName: u.display_name,
            telegramUsername: u.telegram_username,
            email: u.email,
            market: u.market
         },
         cashoutNumber: args.cashoutNumber ?? count.count ?? 0
      });
      const text = args.prefix ? `${args.prefix}\n${card}` : card;
      const sent = (await sendTelegramMessage(chatId, text, {
         inlineKeyboard: [[{ text: '🔎 View on Basescan', url: cashoutTxUrl(args.txHash) }]]
      })) as { message_id?: number; chat?: { id?: number; title?: string } } | undefined;
      return { chatId: sent?.chat?.id ?? chatId, chatTitle: sent?.chat?.title ?? null, messageId: sent?.message_id ?? null };
   } catch (err) {
      console.error('[record-withdrawal] cash-out alert failed:', err instanceof Error ? err.message : err);
      if (args.prefix) throw err;
   }
};

const isInternalCaller = async (admin: AdminClient, req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const secret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : (req.headers.get('apikey') ?? '').trim();
   if (!secret) return false;
   const expected = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expected && secret === expected) return true;
   const { data } = await admin.rpc('verify_internal_notification_secret', { candidate: secret });
   return data === true;
};

// Re-post one recorded cash-out's team alert, marked as a resend.
const replayAlert = async (admin: AdminClient, withdrawalId: string) => {
   const { data: row } = await admin
      .from('withdrawals')
      .select('id, borrower_user_id, amount, exchange, destination_address, tx_hash, created_at')
      .eq('id', withdrawalId)
      .maybeSingle();
   if (!row) return jsonResponse({ error: 'Withdrawal not found' }, 404);
   const { count } = await admin
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('borrower_user_id', row.borrower_user_id)
      .lte('created_at', row.created_at);
   try {
      const sent = await postCashoutAlert(admin, {
         userId: row.borrower_user_id,
         amount: Number(row.amount),
         exchange: row.exchange || 'Other',
         destination: row.destination_address || '',
         txHash: row.tx_hash,
         // The row doesn't keep which wallet sent it; most cash-outs are from the Moodeng wallet.
         wallet: 'embedded',
         at: new Date(row.created_at),
         cashoutNumber: count ?? 0,
         prefix: '🔁 Resent (missed when it happened)'
      });
      return jsonResponse({ ok: true, withdrawalId: row.id, ...sent });
   } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Send failed' }, 502);
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

   const body = (await req.json().catch(() => ({}))) as { txHash?: unknown; exchange?: unknown; replayAlert?: unknown };
   if (typeof body.replayAlert === 'string') {
      const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      if (!(await isInternalCaller(admin, req))) return jsonResponse({ error: 'Unauthorized' }, 401);
      return await replayAlert(admin, body.replayAlert);
   }
   const txHash = typeof body.txHash === 'string' ? body.txHash.toLowerCase() : '';
   if (!/^0x[0-9a-f]{64}$/.test(txHash)) return jsonResponse({ error: 'Invalid transaction hash' }, 400);
   const exchange = (typeof body.exchange === 'string' ? body.exchange.trim() : '').slice(0, 80) || 'Other';

   const authHeader = req.headers.get('Authorization');
   if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

   const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
   const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
   });
   const { data: userData, error: userError } = await callerClient.auth.getUser();
   if (userError || !userData?.user) return jsonResponse({ error: 'Not authenticated' }, 401);
   const callerId = userData.user.id;

   const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // Idempotent: a retry for an already-recorded hash returns the existing row (own rows only).
   // Older rows may hold a mixed-case hash, so match case-insensitively.
   const { data: existing } = await admin.from('withdrawals').select('id, borrower_user_id').ilike('tx_hash', txHash).limit(1).maybeSingle();
   if (existing) {
      if (existing.borrower_user_id !== callerId) return jsonResponse({ error: 'Transaction already recorded' }, 409);
      return jsonResponse({ withdrawalId: existing.id, duplicate: true });
   }

   let transfer: VerifiedTransfer & { wallet: 'embedded' | 'base' };
   try {
      transfer = await verifyAny(txHash);
   } catch (err) {
      if (err instanceof PaymentNotConfirmedError) return jsonResponse({ error: err.message, retry: true }, 202);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Verification failed' }, 422);
   }

   const [ownUser, ownUsage, ownGrants] = await Promise.all([
      admin.from('users').select('wallet_address').eq('id', callerId).maybeSingle(),
      admin.from('wallet_usage_log').select('wallet_address').eq('user_id', callerId),
      admin.from('embedded_wallet_grants').select('wallet_address').eq('user_id', callerId)
   ]);
   const callerWallets = new Set(
      [
         ownUser.data?.wallet_address,
         ...((ownUsage.data ?? []) as { wallet_address: string | null }[]).map((r) => r.wallet_address),
         ...((ownGrants.data ?? []) as { wallet_address: string | null }[]).map((r) => r.wallet_address)
      ]
         .filter((w): w is string => typeof w === 'string' && w.length > 0)
         .map((w) => w.toLowerCase())
   );
   if (!callerWallets.has(transfer.from.toLowerCase())) {
      return jsonResponse({ error: 'Transfer was not sent from your wallet' }, 403);
   }

   const amount = Number(transfer.micros) / 1_000_000;
   const { data: inserted, error: insertError } = await admin
      .from('withdrawals')
      .insert({
         borrower_user_id: callerId,
         amount,
         exchange,
         destination_address: transfer.to,
         tx_hash: txHash
      })
      .select('id')
      .single();
   if (insertError || !inserted) {
      // Lost a race with a concurrent retry: the unique tx_hash index already holds the row.
      const { data: raced } = await admin.from('withdrawals').select('id, borrower_user_id').eq('tx_hash', txHash).maybeSingle();
      if (raced && raced.borrower_user_id === callerId) return jsonResponse({ withdrawalId: raced.id, duplicate: true });
      console.error('[record-withdrawal] insert failed:', insertError?.message);
      return jsonResponse({ error: 'Failed to record withdrawal' }, 500);
   }

   const [{ error: notifyError }] = await Promise.all([
      admin.functions.invoke('withdrawal-notification', { body: { withdrawalId: inserted.id } }),
      postCashoutAlert(admin, {
         userId: callerId,
         amount,
         exchange,
         destination: transfer.to,
         txHash: transfer.txHash || txHash,
         wallet: transfer.wallet
      })
   ]);
   if (notifyError) console.error('[record-withdrawal] notification failed:', notifyError.message);

   return jsonResponse({ withdrawalId: inserted.id, amount, destination: transfer.to });
});
