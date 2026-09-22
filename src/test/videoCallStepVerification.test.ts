import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const supa = vi.hoisted(() => {
   const state = {
      usersRow: {
         video_call_scheduled_at: null as string | null,
         video_call_host: null as string | null,
         video_call_starts_at: null as string | null
      }
   };
   return { state, maybeSingle: vi.fn(async () => ({ data: state.usersRow })) };
});

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) })
   })
}));

const { default: VideoCallStep } = await import('@/views/dashboard/components/VideoCallStep');

const buttonByPrefix = (container: HTMLElement, prefix: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(prefix));
const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
const continueButton = (container: HTMLElement) => buttonByPrefix(container, 'Continue') as HTMLButtonElement;

const lastInlineHost = (calls: unknown[][]): string | undefined => {
   const inline = calls.filter((c) => c[0] === 'inline').at(-1);
   return ((inline?.[1] ?? {}) as { config?: { metadata?: { moodeng_host?: string } } }).config?.metadata?.moodeng_host;
};

describe('VideoCallStep — free self-assigned round-robin booking gate', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onContinue: ReturnType<typeof vi.fn>;
   let calCalls: unknown[][];

   beforeEach(() => {
      vi.useFakeTimers();
      supa.state.usersRow = { video_call_scheduled_at: null, video_call_host: null, video_call_starts_at: null };
      onContinue = vi.fn();
      calCalls = [];
      (window as unknown as { Cal?: unknown }).Cal = (...args: unknown[]) => calCalls.push(args);
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      delete (window as unknown as { Cal?: unknown }).Cal;
      vi.useRealTimers();
   });

   const render = async (userId = 'user-1') => {
      await act(async () => {
         root.render(createElement(VideoCallStep, { userId, onBack: vi.fn(), onContinue }));
      });
      await act(async () => {
         await Promise.resolve();
      });
   };

   it('mounts the matched host embed with borrower+host metadata, gated until the webhook confirms', async () => {
      await render();
      expect(continueButton(container).disabled).toBe(true);

      const inlineCall = calCalls.find((c) => c[0] === 'inline');
      const cfg = (inlineCall?.[1] ?? {}) as { calLink?: string; config?: { metadata?: Record<string, string> } };
      expect(cfg.calLink).toBeTruthy();
      expect(cfg.config?.metadata?.moodeng_user_id).toBe('user-1');
      expect(['george', 'emma']).toContain(cfg.config?.metadata?.moodeng_host);

      supa.state.usersRow = { video_call_scheduled_at: '2026-10-01T09:00:00Z', video_call_host: 'george', video_call_starts_at: '2026-10-01T09:00:00Z' };
      await act(async () => {
         await vi.advanceTimersByTimeAsync(3100);
      });

      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain("You're booked");
      expect(container.textContent).toContain('George');
   });

   it('lets the borrower switch to the other host, re-embedding with that host', async () => {
      await render();
      const firstHost = lastInlineHost(calCalls);
      expect(firstHost).toBeTruthy();

      const switchBtn = buttonByText(container, 'times instead');
      expect(switchBtn).toBeTruthy();
      await act(async () => {
         switchBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });

      const secondHost = lastInlineHost(calCalls);
      expect(secondHost).toBeTruthy();
      expect(secondHost).not.toBe(firstHost);
   });

   it('enables Continue on load for a borrower whose booking was already confirmed', async () => {
      supa.state.usersRow = { video_call_scheduled_at: '2026-09-01T09:00:00Z', video_call_host: 'emma', video_call_starts_at: '2026-09-01T09:00:00Z' };
      await render();
      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain('Emma');
   });

   it('calls onContinue only after the booking is confirmed', async () => {
      supa.state.usersRow = { video_call_scheduled_at: '2026-09-01T09:00:00Z', video_call_host: 'george', video_call_starts_at: null };
      await render();
      await act(async () => {
         continueButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
   });
});
