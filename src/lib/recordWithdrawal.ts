import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Record a completed withdrawal and fire its notification. Non-critical (the money has already
 * left the user's wallet) and fire-and-forget by design — it logs and swallows errors rather
 * than throwing, so a failed record never blocks the confirmation UI. Shared by the withdraw
 * flow and the Base Pay reconciler ([[base-pay-migration]]).
 */
export async function recordWithdrawal(args: { userId: string; amount: number; exchange: string; address: string; txHash: string }) {
   try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
         .from('withdrawals')
         .insert({
            borrower_user_id: args.userId,
            amount: args.amount,
            exchange: args.exchange,
            destination_address: args.address,
            tx_hash: args.txHash
         })
         .select('id')
         .single();
      if (error) {
         console.error('[withdraw] record failed:', error.message);
         return;
      }
      const { error: notifyError } = await supabase.functions.invoke('withdrawal-notification', {
         body: { withdrawalId: data.id }
      });
      if (notifyError) console.error('[withdraw] notification failed:', notifyError.message);
   } catch (err) {
      console.error('[withdraw] record/notify error:', err instanceof Error ? err.message : err);
   }
}
