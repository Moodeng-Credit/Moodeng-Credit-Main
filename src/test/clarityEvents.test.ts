import { afterEach, describe, expect, it, vi } from 'vitest';

// isClarityEnabled is read from the env when the module loads, so each case imports a fresh copy.
const loadClarity = async (enabled: boolean) => {
   vi.resetModules();
   vi.stubEnv('PROD', enabled);
   vi.stubEnv('VITE_PUBLIC_CLARITY_ID', enabled ? 'abc123xyz' : '');
   return import('@/lib/analytics/clarity');
};

describe('clarity onboarding events', () => {
   afterEach(() => {
      vi.unstubAllEnvs();
      delete window.clarity;
   });

   it('does nothing when Clarity is disabled', async () => {
      const clarity = vi.fn();
      window.clarity = clarity;
      const { clarityEvent, clarityTag } = await loadClarity(false);
      clarityEvent('signed_up');
      clarityTag('signup_method', 'Facebook');
      expect(clarity).not.toHaveBeenCalled();
   });

   it('does nothing before the Clarity tag is set up', async () => {
      const { clarityEvent, clarityTag } = await loadClarity(true);
      expect(() => {
         clarityEvent('signed_up');
         clarityTag('locale', 'en');
      }).not.toThrow();
   });

   it('sends events and tags, skipping empty values', async () => {
      const clarity = vi.fn();
      window.clarity = clarity;
      const { clarityEvent, clarityTag } = await loadClarity(true);
      clarityEvent('wallet_connected');
      clarityTag('signup_method', 'Phone code');
      clarityTag('signup_os', null);
      clarityTag('locale', '');
      expect(clarity.mock.calls).toEqual([
         ['event', 'wallet_connected'],
         ['set', 'signup_method', 'Phone code']
      ]);
   });

   it('never throws when Clarity itself fails', async () => {
      window.clarity = vi.fn(() => {
         throw new Error('blocked');
      });
      const { clarityEvent, clarityTag } = await loadClarity(true);
      expect(() => {
         clarityEvent('push_turned_on');
         clarityTag('locale', 'fil');
      }).not.toThrow();
   });
});

describe('signupMethodLabel', () => {
   it('matches the labels app_private.signup_method uses', async () => {
      const { signupMethodLabel } = await loadClarity(false);
      expect(signupMethodLabel({ app_metadata: { provider: 'facebook' } })).toBe('Facebook');
      expect(signupMethodLabel({ app_metadata: { provider: 'google' } })).toBe('Google');
      expect(signupMethodLabel({ app_metadata: { provider: 'phone' } })).toBe('Phone code');
      expect(signupMethodLabel({ email: 'phone_639171234567@moodeng.invalid', app_metadata: { provider: 'email' } })).toBe('Phone code');
      expect(signupMethodLabel({ email: 'telegram_123@x.invalid', app_metadata: { provider: 'email' } })).toBe('Telegram');
      expect(signupMethodLabel({ is_anonymous: true, app_metadata: { provider: 'anonymous' } })).toBe('Email (no code)');
      expect(signupMethodLabel({ app_metadata: { provider: 'email' }, user_metadata: { passwordless: true } })).toBe('Email code');
      expect(signupMethodLabel({ app_metadata: { provider: 'email' } })).toBe('Email + password');
      expect(signupMethodLabel({})).toBe('Unknown');
   });
});
