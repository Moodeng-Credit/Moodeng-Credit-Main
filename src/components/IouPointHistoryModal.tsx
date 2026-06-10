import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { pointsAwardRules } from '@/shared/points';

interface IouPointHistoryModalProps {
   userId?: string | null;
   isOpen: boolean;
   onClose: () => void;
}

/**
 * Bottom-sheet modal showing a lender's IOU point history — what each event
 * was for, who it came from (when funded a borrower's loan), and when it
 * happened. Reused anywhere a lender's "IOU <points>" badge is shown.
 */
export default function IouPointHistoryModal({ userId, isOpen, onClose }: IouPointHistoryModalProps) {
   const { data: pointEvents } = useQuery({
      queryKey: ['iou-point-events', userId],
      queryFn: async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase
            .from('point_events')
            .select('id,created_at,delta,event_type,metadata,source_type,source_id')
            .eq('user_id', userId!)
            .order('created_at', { ascending: false })
            .limit(50);
         if (error) throw error;
         return data ?? [];
      },
      enabled: Boolean(userId) && isOpen
   });

   const loanSourceIds = pointEvents?.filter((e) => e.source_type === 'loan' && e.source_id).map((e) => e.source_id!) ?? [];
   const { data: loanBorrowerMap } = useQuery({
      queryKey: ['iou-point-event-borrowers', loanSourceIds],
      queryFn: async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase
            .from('loan_requests')
            .select('id,borrower_user_id,users!loan_requests_borrower_user_id_fkey(display_name,username)')
            .in('id', loanSourceIds);
         if (error) throw error;
         const map: Record<string, string> = {};
         for (const row of data ?? []) {
            const u = Array.isArray(row.users) ? row.users[0] : row.users;
            const name = u?.display_name || u?.username || null;
            if (name) map[row.id] = name;
         }
         return map;
      },
      enabled: loanSourceIds.length > 0
   });

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
         <div
            className="bg-white dark:bg-[#1a1425] rounded-t-[24px] w-full max-w-[440px] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex items-center justify-between px-md-5 py-md-3 border-b border-md-neutral-400">
               <h2 className="text-md-h5 font-semibold text-md-heading dark:text-white">IOU Point History</h2>
               <button type="button" onClick={onClose} className="text-md-b1 font-semibold text-md-primary-900">
                  Done
               </button>
            </div>
            <div className="overflow-y-auto flex-1 px-md-4 py-md-3 flex flex-col gap-md-2">
               {!pointEvents || pointEvents.length === 0 ? (
                  <p className="text-md-b1 text-md-neutral-1200 dark:text-md-neutral-800 text-center py-md-5">
                     No IOU points yet. Fund loan requests to start earning.
                  </p>
               ) : (
                  pointEvents.map((event) => {
                     const date = new Date(event.created_at);
                     const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                     const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                     const fromName = event.source_type === 'loan' && event.source_id ? (loanBorrowerMap?.[event.source_id] ?? null) : null;
                     const rule = pointsAwardRules.find((r) => r.eventType === event.event_type && r.sourceType === event.source_type);
                     const eventLabel = rule?.action ?? event.event_type.replace(/_/g, ' ');
                     return (
                        <div
                           key={event.id}
                           className="flex items-center justify-between gap-md-3 py-md-2 border-b border-md-neutral-400 last:border-0"
                        >
                           <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span className="text-md-b2 font-semibold text-md-neutral-1900 dark:text-white capitalize">
                                 {eventLabel}
                              </span>
                              {fromName ? <span className="text-md-b3 text-md-neutral-1000">From {fromName}</span> : null}
                              <span className="text-md-b3 text-md-neutral-700">
                                 {dateStr} · {timeStr}
                              </span>
                           </div>
                           <span className={`text-md-b1 font-semibold shrink-0 ${event.delta >= 0 ? 'text-md-green-700' : 'text-md-red-300'}`}>
                              {event.delta >= 0 ? '+' : ''}
                              {event.delta} IOU
                           </span>
                        </div>
                     );
                  })
               )}
            </div>
         </div>
      </div>
   );
}
