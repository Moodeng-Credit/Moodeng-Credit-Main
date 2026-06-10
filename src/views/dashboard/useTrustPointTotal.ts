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

const STORAGE_PREFIX = 'moodeng.trustScore';
const canUseLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const cacheKey = (userId: string) => `${STORAGE_PREFIX}.${userId}`;

// Last-known points total, persisted across sessions so returning users see
// their real score immediately instead of a "0 points" flash while the
// fresh value loads in the background.
const readCachedPoints = (userId?: string | null): number | null => {
   if (!userId || !canUseLocalStorage()) return null;

   try {
      const raw = window.localStorage.getItem(cacheKey(userId));
      if (raw === null) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
   } catch {
      return null;
   }
};

const writeCachedPoints = (userId: string, points: number) => {
   if (!canUseLocalStorage()) return;

   try {
      window.localStorage.setItem(cacheKey(userId), String(points));
   } catch {
      // Storage unavailable (private browsing, quota, etc.) — safe to ignore.
   }
};

export function useTrustPointTotal({ userId, fallbackPoints, enabled }: UseTrustPointTotalArgs) {
   const [pointsTotal, setPointsTotal] = useState(() => readCachedPoints(userId) ?? fallbackPoints);
   // Only true when there's nothing cached to show yet (a user's first-ever
   // load), so callers can avoid rendering "0 points" as if it were real.
   const [isLoading, setIsLoading] = useState(
      () => enabled && !!userId && isSupabaseBrowserConfigured() && readCachedPoints(userId) === null
   );

   useEffect(() => {
      setPointsTotal(readCachedPoints(userId) ?? fallbackPoints);
   }, [fallbackPoints, userId]);

   useEffect(() => {
      if (!enabled || !userId || !isSupabaseBrowserConfigured()) {
         setIsLoading(false);
         return;
      }

      let isActive = true;
      if (readCachedPoints(userId) === null) {
         setIsLoading(true);
      }

      const fetchTrustPoints = async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.from('user_trust_points').select('points_total').eq('user_id', userId).maybeSingle();

         if (!isActive) return;

         if (error) {
            console.error('Failed to fetch Trust Points:', error.message);
            setIsLoading(false);
            return;
         }

         const resolved = data ? parseMajorPoints(data.points_total) : fallbackPoints;
         setPointsTotal(resolved);
         writeCachedPoints(userId, resolved);
         setIsLoading(false);
      };

      void fetchTrustPoints();

      return () => {
         isActive = false;
      };
   }, [enabled, fallbackPoints, userId]);

   return { pointsTotal, isLoading };
}
