import { useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { getVerificationUiState } from '@/lib/verificationUiState';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

// Don't re-sync more often than this per browser session — the badge only needs to be
// honest, not real-time (the /verify page has its own faster polling).
const SYNC_THROTTLE_MS = 60_000;
const STORAGE_KEY = 'didit_status_synced_at';

/**
 * Keeps the verification badge honest on pages that show it (request board,
 * dashboard). The badge reads users.didit_id_status, which only changes when Didit's
 * webhook lands or the /verify page syncs — so a user who abandoned a session could
 * see a stale "Pending" here that flips to "Unfinished" only after visiting /verify.
 * This hook syncs the real status from Didit once per minute at most, and only while
 * the user is in a state that can actually change (submitted or in review).
 */
export function useVerificationStatusSync() {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const uiState = getVerificationUiState(user);
   const shouldSync = uiState === 'processing' || uiState === 'review';

   useEffect(() => {
      if (!shouldSync) return;
      try {
         const last = Number(window.sessionStorage.getItem(STORAGE_KEY) ?? 0);
         if (Date.now() - last < SYNC_THROTTLE_MS) return;
         window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
         // Storage unavailable — sync anyway; worst case is an extra call.
      }

      let cancelled = false;
      const supabase = getSupabaseBrowserClient();
      supabase.functions
         .invoke('check-didit-status', { body: { kind: 'id' } })
         .catch(() => null)
         .then(() => {
            if (!cancelled) void dispatch(fetchUser());
         });

      return () => {
         cancelled = true;
      };
   }, [shouldSync, dispatch]);
}
