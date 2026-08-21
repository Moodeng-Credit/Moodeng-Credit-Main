import { useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

/**
 * Back navigation that still works when there is nothing to pop.
 *
 * `navigate(-1)` is a silent no-op when the entry was opened directly — a shared
 * link, a fresh tab, or a search result — which is the normal way people arrive
 * on the public guide pages. React Router tracks its own position in the history
 * stack as `history.state.idx`, so when we are sitting at the first entry there
 * is no in-app page behind us and we send the reader somewhere sensible instead.
 */
export function useGoBack(fallbackPath: string): () => void {
   const navigate = useNavigate();

   return useCallback(() => {
      const idx = (window.history.state as { idx?: number } | null)?.idx;

      if (typeof idx === 'number' && idx > 0) {
         navigate(-1);
         return;
      }

      navigate(fallbackPath, { replace: true });
   }, [navigate, fallbackPath]);
}
