import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminLiveProvider, useAdminLiveReload } from '@/app/admin/useAdminLive';

type Handler = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void;
const handlers = new Map<string, Handler>();
let onStatus: ((status: string) => void) | null = null;

vi.mock('@/lib/supabase/client', () => {
   const channel = {
      on: (_type: string, filter: { table: string }, handler: Handler) => {
         handlers.set(filter.table, handler);
         return channel;
      },
      subscribe: (cb: (status: string) => void) => {
         onStatus = cb;
         return channel;
      }
   };
   return {
      isSupabaseBrowserConfigured: () => true,
      getSupabaseBrowserClient: () => ({ channel: () => channel, removeChannel: async () => undefined })
   };
});

vi.mock('@/app/admin/adminLiveData', () => ({ getUsername: async () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (state: DocumentVisibilityState) => {
   visibility = state;
   document.dispatchEvent(new Event('visibilitychange'));
};
const change = (table: string) => handlers.get(table)?.({ new: { id: 'row-1', loan_status: 'Lent' }, old: {} });

describe('admin live reload batching', () => {
   let root: Root;
   let container: HTMLDivElement;
   const reload = vi.fn();

   function Probe() {
      useAdminLiveReload(['loans'], reload);
      return null;
   }

   beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
      visibility = 'visible';
      reload.mockClear();
      container = document.createElement('div');
      root = createRoot(container);
      act(() => root.render(createElement(AdminLiveProvider, null, createElement(Probe))));
      act(() => onStatus?.('SUBSCRIBED'));
   });

   afterEach(() => {
      act(() => root.unmount());
      vi.useRealTimers();
      vi.restoreAllMocks();
   });

   it('coalesces a burst of changes into one reload after the batch window', () => {
      act(() => {
         for (let i = 0; i < 20; i++) change('loans');
      });
      act(() => vi.advanceTimersByTime(4999));
      expect(reload).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(reload).toHaveBeenCalledTimes(1);
   });

   it('reloads at most once per window under a steady stream of changes', () => {
      for (let s = 0; s < 20; s++) {
         act(() => change('loans'));
         act(() => vi.advanceTimersByTime(1000));
      }
      expect(reload).toHaveBeenCalledTimes(4);
   });

   it('does not reload while the tab is hidden, then reloads once on return', () => {
      act(() => setVisibility('hidden'));
      act(() => {
         change('loans');
         vi.advanceTimersByTime(60_000);
         change('loans');
         vi.advanceTimersByTime(60_000);
      });
      expect(reload).not.toHaveBeenCalled();
      act(() => setVisibility('visible'));
      expect(reload).toHaveBeenCalledTimes(1);
   });

   it('ignores changes to tables the section does not watch', () => {
      act(() => {
         change('voucher_claims');
         vi.advanceTimersByTime(5000);
      });
      expect(reload).not.toHaveBeenCalled();
   });
});
