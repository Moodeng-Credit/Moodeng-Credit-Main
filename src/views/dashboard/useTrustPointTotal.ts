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

   useEffect(() => {
      setPointsTotal(fallbackPoints);
   }, [fallbackPoints]);

   useEffect(() => {
      if (!enabled || !userId || !isSupabaseBrowserConfigured()) {
         return;
      }

      let isActive = true;

      const fetchTrustPoints = async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.from('user_trust_points').select('points_total').eq('user_id', userId).maybeSingle();

         if (!isActive) return;

         if (error) {
            console.error('Failed to fetch Trust Points:', error.message);
            setPointsTotal(fallbackPoints);
            return;
         }

         setPointsTotal(data ? parseMajorPoints(data.points_total) : fallbackPoints);
      };

      void fetchTrustPoints();

      return () => {
         isActive = false;
      };
   }, [enabled, fallbackPoints, userId]);

   return { pointsTotal };
}
