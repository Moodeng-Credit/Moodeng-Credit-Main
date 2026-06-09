import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { formatPointsMajor } from '@/shared/points';

interface UseTrustPointTotalArgs {
   userId?: string | null;
   fallbackPoints: number;
   enabled: boolean;
}

const parseMajorPoints = (value: number | string | bigint | null | undefined) => {
   const formatted = formatPointsMajor(value);
   const parsed = Number(formatted);

   return Number.isFinite(parsed) ? parsed : 0;
};

export function useTrustPointTotal({ userId, fallbackPoints, enabled }: UseTrustPointTotalArgs) {
   const [pointsTotal, setPointsTotal] = useState(fallbackPoints);
   // Starts true whenever a fetch is going to happen, so callers can avoid
   // rendering a fallback value (e.g. "0 points") as if it were real data.
   const [isLoading, setIsLoading] = useState(() => enabled && !!userId && isSupabaseBrowserConfigured());

   useEffect(() => {
      setPointsTotal(fallbackPoints);
   }, [fallbackPoints]);

   useEffect(() => {
      if (!enabled || !userId || !isSupabaseBrowserConfigured()) {
         setIsLoading(false);
         return;
      }

      let isActive = true;
      setIsLoading(true);

      const fetchTrustPoints = async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.from('user_trust_points').select('points_total').eq('user_id', userId).maybeSingle();

         if (!isActive) return;

         if (error) {
            console.error('Failed to fetch Trust Points:', error.message);
            setPointsTotal(fallbackPoints);
            setIsLoading(false);
            return;
         }

         setPointsTotal(data ? parseMajorPoints(data.points_total) : fallbackPoints);
         setIsLoading(false);
      };

      void fetchTrustPoints();

      return () => {
         isActive = false;
      };
   }, [enabled, fallbackPoints, userId]);

   return { pointsTotal, isLoading };
}
