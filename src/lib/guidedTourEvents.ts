import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

type GuidedTourEventType = 'shown' | 'completed' | 'skipped';

type RecordGuidedTourEventInput = {
   eventType: GuidedTourEventType;
   metadata?: Record<string, unknown>;
   shownCount?: number;
   tourId: string;
   userId?: string | null;
};

export const recordGuidedTourEvent = async ({
   eventType,
   metadata,
   shownCount,
   tourId,
   userId
}: RecordGuidedTourEventInput) => {
   if (!userId || !isSupabaseBrowserConfigured()) return;

   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.from('guided_tour_events').insert({
      event_type: eventType,
      metadata: metadata ?? {},
      shown_count: shownCount ?? null,
      tour_id: tourId,
      user_id: userId
   });

   if (error) {
      console.warn('[GuidedTour] Failed to record tour event', error);
   }
};
