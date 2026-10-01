// A video-call no-show parks the borrower's open request (loans.on_hold_since, set by the
// trg_hold_requests_on_call_change trigger the moment video_call_outcome becomes 'no_show'); booking a
// new call or being marked "Showed up" puts it back. This only reads that state so the team post can
// say which request was parked. An unreferred first-timer's request ('awaiting_call') stays off the
// board until they attend, whatever happens with bookings.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/** "Request LOAN-… put on hold until they book a new call", or '' when nothing was parked. */
export const describeHeldRequests = async (svc: SupabaseClient, userId: string): Promise<string> => {
   try {
      const { data } = await svc
         .from('loans')
         .select('tracking_id, on_hold_reason')
         .eq('borrower_user_id', userId)
         .eq('loan_status', 'Requested')
         .in('on_hold_reason', ['no_show', 'awaiting_call'])
         .not('on_hold_since', 'is', null);
      const rows = (data ?? []) as Array<{ tracking_id: string | null; on_hold_reason: string | null }>;
      const parked = rows.filter((row) => row.on_hold_reason === 'no_show').map((row) => row.tracking_id).filter(Boolean);
      const waiting = rows.filter((row) => row.on_hold_reason === 'awaiting_call').map((row) => row.tracking_id).filter(Boolean);
      const lines: string[] = [];
      if (parked.length) lines.push(`${parked.length === 1 ? 'Request' : 'Requests'} ${parked.join(', ')} put on hold until they book a new call.`);
      if (waiting.length) lines.push(`${waiting.length === 1 ? 'Request' : 'Requests'} ${waiting.join(', ')} stays off the board until they attend a call.`);
      return lines.join('\n');
   } catch {
      return '';
   }
};
