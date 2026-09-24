import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const supa = vi.hoisted(() => {
   const state = {
      usersRow: { video_call_scheduled_at: null as string | null, video_call_starts_at: null as string | null },
      slots: [] as string[],
      bookResult: { ok: true, start: '' } as { ok: boolean; start?: string; error?: string }
   };
   return {
      state,
      maybeSingle: vi.fn(async () => ({ data: state.usersRow })),
      invoke: vi.fn(async (_fn: string, opts: { body?: { action?: string; start?: string } }) => {
         const action = opts?.body?.action;
         if (action === 'slots') return { data: { slots: state.slots }, error: null };
         if (action === 'book') return { data: state.bookResult, error: null };
         return { data: null, error: null };
      })
   };
});

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) }),
      functions: { invoke: supa.invoke }
   })
}));

const { default: VideoCallStep } = await import('@/views/dashboard/components/VideoCallStep');

const allButtons = (c: HTMLElement) => Array.from(c.querySelectorAll('button'));
const continueButton = (c: HTMLElement) =>
   allButtons(c).find((b) => /^(Continue|Book a time|Pick a time)/.test(b.textContent?.trim() ?? '')) as HTMLButtonElement;
const timeButtons = (c: HTMLElement) => allButtons(c).filter((b) => !/^(Continue|Book a time|Pick a time|Back|Try again)/.test(b.textContent?.trim() ?? ''));

describe('VideoCallStep — free round-robin anonymous booking', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onContinue: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      supa.state.usersRow = { video_call_scheduled_at: null, video_call_starts_at: null };
      supa.state.slots = ['2026-10-01T09:00:00.000Z', '2026-10-01T09:30:00.000Z'];
      supa.state.bookResult = { ok: true, start: '2026-10-01T09:00:00.000Z' };
      supa.invoke.mockClear();
      onContinue = vi.fn();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   const render = async () => {
      await act(async () => {
         root.render(createElement(VideoCallStep, { userId: 'user-1', onBack: vi.fn(), onContinue }));
      });
      await act(async () => {
         await new Promise((r) => setTimeout(r, 0));
      });
   };

   it('shows anonymous team time slots (no host name) and books server-side on pick', async () => {
      await render();
      expect(continueButton(container).disabled).toBe(true);
      // No individual host is ever named.
      expect(container.textContent).not.toContain('George');
      expect(container.textContent).not.toContain('Emma');

      const slotButtons = timeButtons(container);
      expect(slotButtons.length).toBe(2);

      await act(async () => {
         slotButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await new Promise((r) => setTimeout(r, 0));
      });

      // Booked via the edge function, and the gate unlocks.
      const bookCall = supa.invoke.mock.calls.find((c) => (c[1] as { body?: { action?: string } })?.body?.action === 'book');
      expect(bookCall).toBeTruthy();
      expect((bookCall?.[1] as { body?: { start?: string } })?.body?.start).toBe('2026-10-01T09:00:00.000Z');
      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain("booked with the Moodeng team");
   });

   it('enables Continue on load for a borrower already booked', async () => {
      supa.state.usersRow = { video_call_scheduled_at: '2026-09-01T09:00:00Z', video_call_starts_at: '2026-09-01T09:00:00Z' };
      await render();
      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain("booked with the Moodeng team");
   });

   it('keeps the gate closed and warns when the slot was just taken', async () => {
      supa.state.bookResult = { ok: false, error: 'slot_taken' };
      await render();
      await act(async () => {
         timeButtons(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await new Promise((r) => setTimeout(r, 0));
      });
      expect(continueButton(container).disabled).toBe(true);
      expect(container.textContent).toContain('just taken');
   });

   it('calls onContinue once the call is booked', async () => {
      supa.state.usersRow = { video_call_scheduled_at: '2026-09-01T09:00:00Z', video_call_starts_at: null };
      await render();
      await act(async () => {
         continueButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
   });
});
