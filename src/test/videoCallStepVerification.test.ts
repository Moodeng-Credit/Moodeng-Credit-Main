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

const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

const continueButton = (container: HTMLElement) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('Continue')) as HTMLButtonElement;

describe('VideoCallStep — server-verified Cal.com booking gate', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onContinue: ReturnType<typeof vi.fn>;
   let calCalls: unknown[][];

   beforeEach(() => {
      vi.useFakeTimers();
      supa.state.usersRow = { video_call_scheduled_at: null, video_call_host: null, video_call_starts_at: null };
      onContinue = vi.fn();
      calCalls = [];
      // Stand in for Cal.com's embed loader so no script is injected and we can inspect the calls.
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

   const render = async () => {
      await act(async () => {
         root.render(createElement(VideoCallStep, { userId: 'user-1', onBack: vi.fn(), onContinue }));
      });
      await act(async () => {
         await Promise.resolve();
      });
   };

   const pickHost = async (name: string) => {
      await act(async () => {
         buttonByText(container, name)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
   };

   it('keeps Continue disabled, mounts the embed with borrower+host metadata, and enables once the webhook confirms', async () => {
      await render();
      expect(continueButton(container).disabled).toBe(true);

      await pickHost('George');

      // The Cal.com inline embed was initialized carrying the identifiers the webhook needs.
      const inlineCall = calCalls.find((c) => c[0] === 'inline');
      expect(inlineCall).toBeTruthy();
      const cfg = (inlineCall?.[1] ?? {}) as { calLink?: string; config?: { metadata?: Record<string, string> } };
      expect(cfg.config?.metadata).toEqual({ moodeng_user_id: 'user-1', moodeng_host: 'george' });

      // Still gated — the client never asserts the booking itself.
      expect(continueButton(container).disabled).toBe(true);

      // The webhook stamps the column; the poll picks it up.
      supa.state.usersRow = { video_call_scheduled_at: '2026-10-01T09:00:00Z', video_call_host: 'george', video_call_starts_at: '2026-10-01T09:00:00Z' };
      await act(async () => {
         await vi.advanceTimersByTimeAsync(3100);
      });

      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain("You're booked");
      expect(container.textContent).toContain('George');
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
