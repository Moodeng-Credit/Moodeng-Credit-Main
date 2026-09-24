import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// The users row ContactsStep reads (already Messenger-verified, so Continue is live) and the
// loan-access edge function's answer.
const supa = vi.hoisted(() => {
   const state = {
      usersRow: { whatsapp_verified_at: null as string | null, messenger_verified_at: '2026-09-24T00:00:00Z' as string | null },
      invokeResult: { data: { ok: true, status: 'pending' } as unknown, error: null as unknown },
      // What calcom-round-robin answers (call mode): open slots, then a successful booking.
      slots: ['2026-09-25T03:00:00.000Z', '2026-09-25T04:00:00.000Z']
   };
   return {
      state,
      invoke: vi.fn(async (fn: string, opts?: { body?: { action?: string; start?: string } }) => {
         if (fn === 'calcom-round-robin') {
            return opts?.body?.action === 'book'
               ? { data: { ok: true, start: opts.body.start }, error: null }
               : { data: { slots: state.slots }, error: null };
         }
         return state.invokeResult;
      }),
      maybeSingle: vi.fn(async () => ({ data: state.usersRow }))
   };
});

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) }),
      rpc: vi.fn(),
      functions: { invoke: supa.invoke }
   })
}));

const { default: ConnectStep, LoanAccessPendingCard } = await import('@/views/dashboard/components/ConnectStep');

const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;

const click = async (el?: HTMLElement) => {
   await act(async () => {
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
   });
};

const typeInto = async (el: HTMLTextAreaElement, value: string) => {
   await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
   });
};

describe('ConnectStep — PART 1 of Connect → Approve → Apply', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onSubmitted: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-09-24T00:00:00Z' };
      supa.state.invokeResult = { data: { ok: true, status: 'pending' }, error: null };
      supa.invoke.mockClear();
      onSubmitted = vi.fn();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   const render = async (props: Record<string, unknown> = {}) => {
      await act(async () => {
         root.render(
            createElement(ConnectStep, { userId: 'user-1', displayName: 'Maria', onBack: vi.fn(), onSubmitted, ...props })
         );
      });
      await act(async () => {
         await Promise.resolve();
      });
   };

   const goToIntro = async () => {
      await click(buttonByText(container, 'Continue'));
      expect(container.textContent).toContain("What's the loan for?");
   };

   it('opens with the "meet every borrower" pitch on the Messenger step', async () => {
      await render();
      expect(container.textContent).toContain('we like to meet every borrower');
      expect(container.textContent).toContain('Messenger');
   });

   it('shows the reach-out-again copy for a previously rejected borrower', async () => {
      await render({ wasRejected: true });
      expect(container.textContent).toContain('take another look');
   });

   it('keeps Send disabled until the intro is long enough, then submits to loan-access', async () => {
      await render({ referralCode: 'BELLE' });
      await goToIntro();

      const send = buttonByText(container, 'Send to the team');
      expect(send?.disabled).toBe(true);

      await typeInto(container.querySelector('textarea') as HTMLTextAreaElement, 'Rent is due before payday');
      expect(buttonByText(container, 'Send to the team')?.disabled).toBe(false);

      await click(buttonByText(container, 'Send to the team'));
      expect(supa.invoke).toHaveBeenCalledWith('loan-access', {
         body: { action: 'submit', reason: 'Rent is due before payday', displayName: 'Maria', referralCode: 'BELLE' }
      });
      expect(onSubmitted).toHaveBeenCalledWith('pending');
   });

   it('sends the borrower back to the Messenger step if the server says the line is not verified', async () => {
      supa.state.invokeResult = {
         data: null,
         error: { context: { json: async () => ({ ok: false, error: 'contact_not_verified' }) } }
      };
      await render();
      await goToIntro();
      await typeInto(container.querySelector('textarea') as HTMLTextAreaElement, 'Need help with school fees');
      await click(buttonByText(container, 'Send to the team'));

      expect(onSubmitted).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Messenger');
   });

   it('shows a retry message on an unexpected failure', async () => {
      supa.state.invokeResult = { data: { ok: false, error: 'internal_error' }, error: null };
      await render();
      await goToIntro();
      await typeInto(container.querySelector('textarea') as HTMLTextAreaElement, 'Need help with school fees');
      await click(buttonByText(container, 'Send to the team'));

      expect(onSubmitted).not.toHaveBeenCalled();
      expect(container.textContent).toContain("Couldn't send right now");
   });
});

describe('ConnectStep — call mode (request unlocks only after the call)', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onSubmitted: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-09-24T00:00:00Z' };
      supa.state.invokeResult = { data: { ok: true, status: 'pending' }, error: null };
      supa.invoke.mockClear();
      onSubmitted = vi.fn();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   it('goes Messenger → intro → book a call, and only then sends to the team', async () => {
      await act(async () => {
         root.render(createElement(ConnectStep, { userId: 'user-1', displayName: 'Maria', mode: 'call', onBack: vi.fn(), onSubmitted }));
      });
      await act(async () => {
         await Promise.resolve();
      });
      expect(container.textContent).toContain('15-min video call');

      await click(buttonByText(container, 'Continue'));
      await typeInto(container.querySelector('textarea') as HTMLTextAreaElement, 'Rent is due before payday');
      await click(buttonByText(container, 'Next: book your call'));
      expect(supa.invoke).not.toHaveBeenCalledWith('loan-access', expect.anything());

      // Slots load, pick the first one → booked → the continue button sends the request.
      await act(async () => {
         await Promise.resolve();
         await Promise.resolve();
      });
      const slotButton = Array.from(container.querySelectorAll('button')).find((b) => /AM|PM/.test(b.textContent ?? ''));
      expect(slotButton).toBeTruthy();
      await click(slotButton);
      await act(async () => {
         await Promise.resolve();
      });
      expect(container.textContent).toContain("You're booked");

      await click(buttonByText(container, 'Send to the team'));
      expect(supa.invoke).toHaveBeenCalledWith('loan-access', {
         body: { action: 'submit', reason: 'Rent is due before payday', displayName: 'Maria', referralCode: undefined }
      });
      expect(onSubmitted).toHaveBeenCalledWith('pending');
   });

   it('shows the "about you" bio page between Messenger and the intro when the bio is not saved yet', async () => {
      const renderAbout = vi.fn(({ onDone }: { onBack: () => void; onDone: () => void }) =>
         createElement('button', { type: 'button', onClick: onDone }, 'Bio done')
      );
      await act(async () => {
         root.render(
            createElement(ConnectStep, {
               userId: 'user-1',
               displayName: 'Maria',
               mode: 'call',
               needsAbout: true,
               renderAbout,
               onBack: vi.fn(),
               onSubmitted
            })
         );
      });
      await act(async () => {
         await Promise.resolve();
      });

      await click(buttonByText(container, 'Continue'));
      expect(renderAbout).toHaveBeenCalled();
      expect(container.textContent).not.toContain("What's the loan for?");

      await click(buttonByText(container, 'Bio done'));
      expect(container.textContent).toContain("What's the loan for?");
   });

   it('books a referred borrower\u2019s call with Emma only', async () => {
      await act(async () => {
         root.render(
            createElement(ConnectStep, { userId: 'user-1', displayName: 'Maria', mode: 'call', withEmma: true, onBack: vi.fn(), onSubmitted })
         );
      });
      await act(async () => {
         await Promise.resolve();
      });
      expect(container.textContent).toContain('call with Emma');

      await click(buttonByText(container, 'Continue'));
      await typeInto(container.querySelector('textarea') as HTMLTextAreaElement, 'Rent is due before payday');
      await click(buttonByText(container, 'Next: book your call'));
      await act(async () => {
         await Promise.resolve();
         await Promise.resolve();
      });
      expect(supa.invoke).toHaveBeenCalledWith('calcom-round-robin', { body: expect.objectContaining({ action: 'slots', host: 'emma' }) });
   });

   it('shows the booked time and this meeting\u2019s own join link on the waiting screen', async () => {
      supa.state.usersRow = {
         ...supa.state.usersRow,
         video_call_starts_at: '2026-09-25T03:00:00.000Z',
         video_call_join_url: 'https://us06web.zoom.us/j/123'
      } as typeof supa.state.usersRow;
      await act(async () => {
         root.render(createElement(LoanAccessPendingCard, { onClose: vi.fn(), mode: 'call', withEmma: true, userId: 'user-1' }));
      });
      await act(async () => {
         await Promise.resolve();
      });
      expect(container.textContent).toContain('Say hi to Emma on Facebook');
      const join = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Join the meeting');
      expect(join?.getAttribute('href')).toBe('https://us06web.zoom.us/j/123');
   });

   it('shows the "see you on the call" pending card in call mode', async () => {
      const onClose = vi.fn();
      await act(async () => {
         root.render(createElement(LoanAccessPendingCard, { onClose, mode: 'call' }));
      });
      expect(container.textContent).toContain('See you on the call');
      expect(container.textContent).toContain('right after the call');
   });
});

describe('LoanAccessPendingCard', () => {
   it('tells the borrower they are being reviewed and closes on "Got it"', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onClose = vi.fn();
      await act(async () => {
         root.render(createElement(LoanAccessPendingCard, { onClose }));
      });
      expect(container.textContent).toContain('We’re reviewing your request');
      await click(buttonByText(container, 'Got it'));
      expect(onClose).toHaveBeenCalledTimes(1);
      act(() => root.unmount());
      container.remove();
   });
});
