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

   it('runs one reload at a time and queues one more for changes during it', async () => {
      let finish: () => void = () => undefined;
      reload.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
      act(() => {
         change('loans');
         vi.advanceTimersByTime(5000);
      });
      expect(reload).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 3; i++) {
         act(() => {
            change('loans');
            vi.advanceTimersByTime(5000);
         });
      }
      expect(reload).toHaveBeenCalledTimes(1);
      await act(async () => finish());
      expect(reload).toHaveBeenCalledTimes(2);
      reload.mockReset();
   });

   it('backs off polling while realtime is down', () => {
      act(() => onStatus?.('CHANNEL_ERROR'));
      // 30 s, 60 s, 120 s, 240 s, then capped at 300 s.
      const at = [30_000, 90_000, 210_000, 450_000, 750_000, 1_050_000];
      let elapsed = 0;
      for (const t of at) {
         act(() => vi.advanceTimersByTime(t - elapsed - 1));
         const before = reload.mock.calls.length;
         act(() => vi.advanceTimersByTime(1 + 5000));
         elapsed = t + 5000;
         expect(reload.mock.calls.length).toBe(before + 1);
         act(() => vi.advanceTimersByTime(0));
      }
      // Reconnecting stops polling.
      act(() => onStatus?.('SUBSCRIBED'));
      const calls = reload.mock.calls.length;
      act(() => vi.advanceTimersByTime(600_000));
      expect(reload.mock.calls.length).toBe(calls);
   });

   it('ignores changes to tables the section does not watch', () => {
      act(() => {
         change('voucher_claims');
         vi.advanceTimersByTime(5000);
      });
      expect(reload).not.toHaveBeenCalled();
   });
});
