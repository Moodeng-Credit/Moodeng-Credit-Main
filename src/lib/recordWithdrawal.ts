import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const RECORD_ATTEMPTS = 6;
const RECORD_RETRY_DELAY_MS = 5000;

/**
 * Record a completed withdrawal and fire its notification. Non-critical (the money has already
 * left the user's wallet) and fire-and-forget by design — it logs and swallows errors rather
 * than throwing, so a failed record never blocks the confirmation UI. Shared by the withdraw
 * flow and the Base Pay reconciler ([[base-pay-migration]]).
 *
 * `consumeCashoutFaceCheck: true` spends this transfer's cash-out face-gate approval, if any
 * (see cashout_face_gate/consume_cashout_face_check) — a no-op when the gate never fired for
 * this send. Pass it only from the embedded-wallet cash-out path; Base Pay/wagmi sends were
 * never gated, so there's nothing to spend there.
 */
export async function recordWithdrawal(args: {
   userId: string;
   amount: number;
   exchange: string;
   address: string;
   txHash: string;
   consumeCashoutFaceCheck?: boolean;
}) {
   try {
      const supabase = getSupabaseBrowserClient();
      // Recorded server-side: record-withdrawal verifies the transfer on Base (from one of this
      // user's wallets), stores the on-chain amount/destination and sends the notification.
      // A just-broadcast transfer may not be mined yet (202 + retry): poll a few times.
      for (let attempt = 0; attempt < RECORD_ATTEMPTS; attempt++) {
         const { data, error } = await supabase.functions.invoke<{ retry?: boolean }>('record-withdrawal', {
            body: { txHash: args.txHash, exchange: args.exchange }
         });
         if (error) {
            console.error('[withdraw] record failed:', error.message);
            break;
         }
         if (!data?.retry) break;
         await new Promise((resolve) => setTimeout(resolve, RECORD_RETRY_DELAY_MS));
      }

      if (args.consumeCashoutFaceCheck) {
         const { data: latest } = await supabase
            .from('cashout_face_checks')
            .select('id')
            .eq('user_id', args.userId)
            .eq('destination_address', args.address)
            .eq('amount', args.amount)
            .eq('status', 'APPROVED')
            .is('consumed_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
         if (latest?.id) {
            const { error: consumeError } = await supabase.rpc('consume_cashout_face_check', {
               p_check_id: latest.id,
               p_destination: args.address,
               p_amount: args.amount
            });
            if (consumeError) console.error('[withdraw] failed to consume face check:', consumeError.message);
         }
      }
   } catch (err) {
      console.error('[withdraw] record/notify error:', err instanceof Error ? err.message : err);
   }
}
