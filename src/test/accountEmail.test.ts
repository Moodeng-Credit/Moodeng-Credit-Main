import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Phone sign-ups give an email in the Instant Wallet card and confirm it LATER with a code
// (they're in Facebook's browser; leaving for the inbox may not bring them back).
const h = vi.hoisted(() => ({
   user: { email: '', new_email: null as string | null } as Record<string, unknown>,
   profileEmail: 'phone_abc@moodeng.app',
   updateUser: vi.fn(),
   resend: vi.fn(),
   confirmEmailChange: vi.fn((args: unknown) => ({ type: 'confirmEmailChange', args })),
   unwrap: vi.fn(),
   showToast: vi.fn()
}));
vi.mock('@/lib/supabase/client', () => ({
   isSupabaseBrowserConfigured: () => true,
   getSupabaseBrowserClient: () => ({
      auth: { getUser: async () => ({ data: { user: h.user } }), updateUser: h.updateUser, resend: h.resend }
   })
}));
vi.mock('@/lib/authRedirect', () => ({ getAuthRedirectUrl: () => 'https://moodeng.app/auth/confirm' }));
vi.mock('react-redux', () => ({
   useSelector: (select: (state: unknown) => unknown) => select({ auth: { user: { email: h.profileEmail } } }),
   useDispatch: () => () => ({ unwrap: h.unwrap })
}));
vi.mock('@/store/slices/authSlice', () => ({ confirmEmailChange: h.confirmEmailChange }));
vi.mock('@/components/ToastSystem/hooks/useToast', () => ({ useToast: () => ({ showToast: h.showToast }) }));

const { DUPLICATE_EMAIL_MESSAGE, describeEmailChangeError, dismissConfirmEmailReminder, hasRealEmail, isConfirmEmailReminderDismissed } =
   await import('@/lib/accountEmail');
const { WalletEmailField } = await import('@/components/account/WalletEmailField');
const { AddEmailCard } = await import('@/components/account/AddEmailCard');
const { ConfirmEmailReminder } = await import('@/components/account/ConfirmEmailReminder');

describe('account email helpers', () => {
   it('a real email is one that is set and not a telegram_/line_/phone_ placeholder', () => {
      expect(hasRealEmail('', 'phone_abc@moodeng.app')).toBe(false);
      expect(hasRealEmail(null, null)).toBe(false);
      expect(hasRealEmail('telegram_1@moodeng.app', 'telegram_1@moodeng.app')).toBe(false);
      expect(hasRealEmail('maria@example.com', 'phone_abc@moodeng.app')).toBe(true);
   });

   it('an email used by another account says so plainly', () => {
      expect(
         describeEmailChangeError({ code: 'email_exists', message: 'A user with this email address has already been registered' })
      ).toEqual({
         message: DUPLICATE_EMAIL_MESSAGE,
         duplicate: true
      });
      expect(DUPLICATE_EMAIL_MESSAGE).toBe('This email already has a Moodeng account. Log in with it instead?');
   });

   it('the dashboard reminder can be put away for 3 days, per address', () => {
      const now = 1_000_000_000_000;
      dismissConfirmEmailReminder('a@example.com', now);
      expect(isConfirmEmailReminderDismissed('a@example.com', now + 60_000)).toBe(true);
      expect(isConfirmEmailReminderDismissed('b@example.com', now + 60_000)).toBe(false);
      expect(isConfirmEmailReminderDismissed('a@example.com', now + 4 * 24 * 3600_000)).toBe(false);
   });
});

describe('email in the Instant Wallet card, confirmed later', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async (element: ReturnType<typeof createElement>) => {
      await act(async () => root.render(element));
      await act(async () => {});
   };
   const type = async (input: HTMLInputElement, value: string) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
         setValue?.call(input, value);
         input.dispatchEvent(new Event('input', { bubbles: true }));
      });
   };
   const submit = async (form: HTMLFormElement | null) => {
      await act(async () => {
         form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
   };
   const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

   beforeEach(() => {
      h.user = { email: '', new_email: null };
      h.profileEmail = 'phone_abc@moodeng.app';
      h.updateUser.mockReset();
      h.resend.mockReset();
      h.confirmEmailChange.mockClear();
      h.unwrap.mockReset();
      h.showToast.mockClear();
      localStorage.clear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   it('phone-only account: asks for an email and says it is confirmed later', async () => {
      await render(createElement(WalletEmailField));
      expect(container.textContent).toContain('Your email (for your wallet and receipts)');
      expect(container.textContent).toContain("We'll ask you to confirm it later.");
   });

   it('accounts with a real email see nothing', async () => {
      h.user = { email: 'maria@example.com', new_email: null };
      h.profileEmail = 'maria@example.com';
      await render(createElement(WalletEmailField));
      expect(container.innerHTML).toBe('');
   });

   it('saving sends a pending email change (updateUser) and shows the address', async () => {
      h.updateUser.mockResolvedValue({ data: { user: { new_email: 'maria@example.com' } }, error: null });
      await render(createElement(WalletEmailField));
      await type(container.querySelector('#wallet-email') as HTMLInputElement, ' Maria@Example.com ');
      await submit(container.querySelector('form'));
      expect(h.updateUser).toHaveBeenCalledWith({ email: 'maria@example.com' }, { emailRedirectTo: 'https://moodeng.app/auth/confirm' });
      expect(container.textContent).toContain("We'll ask you to confirm maria@example.com later.");
   });

   it('typing an email then leaving the field (tapping Create Instant Wallet) saves it too, once', async () => {
      h.updateUser.mockResolvedValue({ data: { user: { new_email: 'maria@example.com' } }, error: null });
      await render(createElement(WalletEmailField));
      const input = container.querySelector('#wallet-email') as HTMLInputElement;
      await type(input, 'maria@example.com');
      await act(async () => {
         input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });
      expect(h.updateUser).toHaveBeenCalledTimes(1);
   });

   it('dashboard card (after the first loan request): asks phone-only accounts for an email', async () => {
      await render(createElement(AddEmailCard));
      expect(container.textContent).toContain('Add your email');
      expect(container.textContent).toContain('For loan receipts and payment reminders.');
      expect(container.textContent).toContain("We'll send a code to confirm it.");
   });

   it('dashboard card hides for real emails and once an email is pending (the confirm card takes over)', async () => {
      h.user = { email: 'maria@example.com', new_email: null };
      h.profileEmail = 'maria@example.com';
      await render(createElement(AddEmailCard));
      expect(container.innerHTML).toBe('');

      h.user = { email: '', new_email: 'maria@example.com' };
      h.profileEmail = 'phone_abc@moodeng.app';
      await render(createElement(AddEmailCard));
      expect(container.innerHTML).toBe('');
   });

   it('an email that already has an account gets the log-in hint', async () => {
      h.updateUser.mockResolvedValue({
         data: { user: null },
         error: { code: 'email_exists', message: 'A user with this email address has already been registered' }
      });
      await render(createElement(WalletEmailField));
      await type(container.querySelector('#wallet-email') as HTMLInputElement, 'taken@example.com');
      await submit(container.querySelector('form'));
      expect(container.textContent).toContain('This email already has a Moodeng account. Log in with it instead?');
   });

   it('reminder: confirms with the code inside the app (email_change)', async () => {
      h.user = { email: '', new_email: 'maria@example.com' };
      h.unwrap.mockResolvedValue({});
      await render(createElement(ConfirmEmailReminder, { placement: 'dashboard' }));
      expect(container.textContent).toContain('Confirm your email');
      expect(container.textContent).toContain('We sent a code to maria@example.com');
      await type(container.querySelector('input[aria-label="Code from the email"]') as HTMLInputElement, '12345678');
      await submit(container.querySelector('form'));
      expect(h.confirmEmailChange).toHaveBeenCalledWith({ email: 'maria@example.com', token: '12345678' });
      expect(h.showToast).toHaveBeenCalled();
   });

   it('reminder: Resend asks for a new email_change code', async () => {
      h.user = { email: '', new_email: 'maria@example.com' };
      h.resend.mockResolvedValue({ error: null });
      await render(createElement(ConfirmEmailReminder, { placement: 'dashboard' }));
      await act(async () => button('Resend')?.click());
      expect(h.resend).toHaveBeenCalledWith({ type: 'email_change', email: 'maria@example.com' });
      expect(container.textContent).toContain('New code sent to maria@example.com.');
   });

   it('reminder: Change fixes a typo with a new pending email', async () => {
      h.user = { email: '', new_email: 'maria@exmaple.com' };
      h.updateUser.mockResolvedValue({ data: { user: { new_email: 'maria@example.com' } }, error: null });
      await render(createElement(ConfirmEmailReminder, { placement: 'settings' }));
      await act(async () => button('Change')?.click());
      await type(container.querySelector('input[aria-label="New email address"]') as HTMLInputElement, 'maria@example.com');
      await submit(container.querySelector('form'));
      expect(h.updateUser).toHaveBeenCalledWith({ email: 'maria@example.com' }, { emailRedirectTo: 'https://moodeng.app/auth/confirm' });
   });

   it('reminder: dismissible on the dashboard, always shown in settings', async () => {
      h.user = { email: '', new_email: 'maria@example.com' };
      await render(createElement(ConfirmEmailReminder, { placement: 'dashboard' }));
      await act(async () => (container.querySelector('button[aria-label="Hide for now"]') as HTMLButtonElement).click());
      expect(container.textContent).not.toContain('Confirm your email');
      await render(createElement(ConfirmEmailReminder, { placement: 'settings' }));
      expect(container.textContent).toContain('Confirm your email');
   });

   it('reminder: nothing pending, nothing shown', async () => {
      await render(createElement(ConfirmEmailReminder, { placement: 'dashboard' }));
      expect(container.innerHTML).toBe('');
   });
});
