import { describe, expect, it } from 'vitest';

import { buildAuthRedirectUrl } from '@/lib/authRedirect';

describe('buildAuthRedirectUrl', () => {
   it('keeps the configured production origin while honoring the requested reset-password path', () => {
      expect(
         buildAuthRedirectUrl('/reset-password', 'https://staging.dashboard.moodeng.app/auth/confirm', {
            hostname: 'staging.dashboard.moodeng.app',
            origin: 'https://staging.dashboard.moodeng.app'
         })
      ).toBe('https://staging.dashboard.moodeng.app/reset-password');
   });

   it('preserves the default auth confirm path for signup and social auth redirects', () => {
      expect(
         buildAuthRedirectUrl('/auth/confirm', 'https://staging.dashboard.moodeng.app/auth/confirm', {
            hostname: 'staging.dashboard.moodeng.app',
            origin: 'https://staging.dashboard.moodeng.app'
         })
      ).toBe('https://staging.dashboard.moodeng.app/auth/confirm');
   });

   it('uses the current local origin during localhost development', () => {
      expect(
         buildAuthRedirectUrl('/reset-password', 'https://staging.dashboard.moodeng.app/auth/confirm', {
            hostname: '127.0.0.1',
            origin: 'http://127.0.0.1:5215'
         })
      ).toBe('http://127.0.0.1:5215/reset-password');
   });

   it('keeps auth redirects on the active Vercel preview instead of sending users to staging', () => {
      expect(
         buildAuthRedirectUrl('/auth/confirm', 'https://staging.dashboard.moodeng.app/auth/confirm', {
            hostname: 'moodeng-credit-main-git-codex-repay-54c445-snak2etechs-projects.vercel.app',
            origin: 'https://moodeng-credit-main-git-codex-repay-54c445-snak2etechs-projects.vercel.app'
         })
      ).toBe('https://moodeng-credit-main-git-codex-repay-54c445-snak2etechs-projects.vercel.app/auth/confirm');
   });
});
