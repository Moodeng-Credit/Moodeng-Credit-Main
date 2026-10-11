import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { PaymentNotConfirmedError, type VerifiedTransfer, verifyPayment } from '../_shared/usdcTransfer.ts';

// Server-side recorder for a borrower cash-out. The client used to insert `withdrawals` rows
// directly (any amount / tx hash) and then trigger withdrawal-notification. Now the client only
// sends the tx hash; this function verifies on Base that it is a successful USDC transfer FROM one
// of the caller's wallets, records the on-chain amount and destination with the service role, and
// fires the "on its way" notification.
//
// Body: { txHash: string, exchange?: string }
// Response: { withdrawalId } | { error, retry?: true }

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// A plain transaction hash (embedded wallet) or a Base Account userOperation hash (Base Pay): try
// the transaction receipt first, then the bundler.
const verifyAny = async (hash: string): Promise<VerifiedTransfer> => {
   try {
      return await verifyPayment('wallet', hash);
   } catch (err) {
      if (!(err instanceof PaymentNotConfirmedError)) throw err;
   }
   return await verifyPayment('base', hash);
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

   const body = (await req.json().catch(() => ({}))) as { txHash?: unknown; exchange?: unknown };
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

   let transfer: VerifiedTransfer;
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

   const { error: notifyError } = await admin.functions.invoke('withdrawal-notification', { body: { withdrawalId: inserted.id } });
   if (notifyError) console.error('[record-withdrawal] notification failed:', notifyError.message);

   return jsonResponse({ withdrawalId: inserted.id, amount, destination: transfer.to });
});
