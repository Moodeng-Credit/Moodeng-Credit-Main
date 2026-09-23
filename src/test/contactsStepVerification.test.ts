import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMessengerVerifyLink, buildWhatsAppVerifyLink } from '@/config/contactVerification';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Shared, mutable Supabase behaviour the test flips between assertions: the users row the
// component reads on load and on every poll, and the code start_*_verification hands back.
const supa = vi.hoisted(() => {
   const state = {
      usersRow: { whatsapp_verified_at: null as string | null, messenger_verified_at: null as string | null },
      rpcResult: { data: 'MDNG-ABC123' as unknown, error: null as unknown }
   };
   return {
      state,
      rpc: vi.fn(async () => state.rpcResult),
      maybeSingle: vi.fn(async () => ({ data: state.usersRow }))
   };
});

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) }),
      rpc: supa.rpc
   })
}));

// Imported after the mock is registered so the component picks up the mocked client.
const { default: ContactsStep } = await import('@/views/dashboard/components/ContactsStep');

const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

const continueButton = (container: HTMLElement) => {
   const btn = buttonByText(container, 'Continue');
   expect(btn).toBeTruthy();
   return btn as HTMLButtonElement;
};

describe('ContactsStep — WhatsApp OR Messenger verified line', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onContinue: ReturnType<typeof vi.fn>;
   let openSpy: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      vi.useFakeTimers();
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: null };
      supa.state.rpcResult = { data: 'MDNG-ABC123', error: null };
      supa.rpc.mockClear();
      onContinue = vi.fn();
      openSpy = vi.fn();
      vi.stubGlobal('open', openSpy);
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      vi.useRealTimers();
   });

   const render = async (userId = 'user-1', whatsappEnabled?: boolean) => {
      await act(async () => {
         root.render(createElement(ContactsStep, { userId, onBack: vi.fn(), onContinue, whatsappEnabled }));
      });
      // Flush the initial "already verified?" load.
      await act(async () => {
         await Promise.resolve();
      });
   };

   it('keeps Continue disabled until a channel verifies, then enables it after Messenger confirms', async () => {
      await render();
      expect(continueButton(container).disabled).toBe(true);

      const verifyBtn = buttonByText(container, 'Verify via Messenger');
      expect(verifyBtn).toBeTruthy();
      await act(async () => {
         verifyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });

      // Uses the generic starter with the messenger channel, and opens the m.me code link.
      expect(supa.rpc).toHaveBeenCalledWith('start_contact_verification', { p_channel: 'messenger' });
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0]).toContain('m.me');
      expect(openSpy.mock.calls[0][0]).toContain('__mdng_code=MDNG-ABC123');

      // Still disabled until the webhook stamps the column the poll reads.
      expect(continueButton(container).disabled).toBe(true);

      supa.state.usersRow.messenger_verified_at = '2026-09-22T00:00:00Z';
      await act(async () => {
         await vi.advanceTimersByTimeAsync(3100);
      });

      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain('Verified');
   });

   it('enables Continue immediately for a returning borrower whose WhatsApp is already verified', async () => {
      supa.state.usersRow.whatsapp_verified_at = '2026-09-01T00:00:00Z';
      await render();
      expect(continueButton(container).disabled).toBe(false);
   });

   it('calls onContinue when Continue is clicked after a channel is verified', async () => {
      supa.state.usersRow.messenger_verified_at = '2026-09-01T00:00:00Z';
      await render();
      await act(async () => {
         continueButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
   });

   it('hides WhatsApp by default (Facebook first) and offers only Messenger', async () => {
      await render();
      expect(buttonByText(container, 'Verify via WhatsApp')).toBeUndefined();
      expect(buttonByText(container, 'Verify via Messenger')).toBeTruthy();
      expect(container.textContent).not.toContain('(one option)');
   });

   it('still shows WhatsApp to a returning borrower who already verified it', async () => {
      supa.state.usersRow.whatsapp_verified_at = '2026-09-01T00:00:00Z';
      await render();
      expect(container.textContent).toContain('WhatsApp');
      expect(container.textContent).toContain('Verified');
   });

   it('WhatsApp button keeps the original RPC entry point and opens a wa.me link', async () => {
      await render('user-1', true);
      const verifyBtn = buttonByText(container, 'Verify via WhatsApp');
      await act(async () => {
         verifyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
      expect(supa.rpc).toHaveBeenCalledWith('start_whatsapp_verification');
      expect(openSpy.mock.calls[0][0]).toContain('wa.me');
   });
});

describe('contact verification link builders', () => {
   it('builds a wa.me link with the code in the prefilled text', () => {
      const link = buildWhatsAppVerifyLink('MDNG-ABC123');
      expect(link.startsWith('https://wa.me/')).toBe(true);
      expect(decodeURIComponent(link)).toContain('MDNG-ABC123');
   });

   it('builds an m.me link that launches the SendPulse flow with the code as mdng_code', () => {
      const link = buildMessengerVerifyLink('MDNG-ABC123');
      // SendPulse's format: ref={flow_id}__{variable}={value}, unencoded.
      expect(link).toMatch(/^https:\/\/m\.me\/\d+\?ref=[0-9a-f-]{36}__mdng_code=MDNG-ABC123$/);
   });
});
