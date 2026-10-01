// A video-call no-show parks the borrower's open request (loans.on_hold_since, set by the
// trg_hold_requests_on_call_change trigger the moment video_call_outcome becomes 'no_show'); booking a
// new call or being marked "Showed up" puts it back. This only reads that state so the team post can
// say which request was parked.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/** "Request LOAN-… put on hold until they book a new call", or '' when nothing was parked. */
export const describeHeldRequests = async (svc: SupabaseClient, userId: string): Promise<string> => {
   try {
      const { data } = await svc
         .from('loans')
         .select('tracking_id')
         .eq('borrower_user_id', userId)
         .eq('loan_status', 'Requested')
         .eq('on_hold_reason', 'no_show')
         .not('on_hold_since', 'is', null);
      const ids = ((data ?? []) as Array<{ tracking_id: string | null }>).map((row) => row.tracking_id).filter(Boolean);
      if (!ids.length) return '';
      return `${ids.length === 1 ? 'Request' : 'Requests'} ${ids.join(', ')} put on hold until they book a new call.`;
   } catch {
      return '';
   }
};
