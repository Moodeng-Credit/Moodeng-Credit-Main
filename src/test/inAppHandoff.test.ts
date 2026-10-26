import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildArmedUrl, copyTextFromTap, hasStoredSession, resolveFbCodeAddress, stripFbCode } from '@/lib/inAppHandoff';

describe('hasStoredSession', () => {
   it('sees the Supabase session cookie, whole or chunked', () => {
      expect(hasStoredSession('sb-qplmmxynzxzkfxtayoqr-auth-token=base64-abc')).toBe(true);
      expect(hasStoredSession('ph_x=1; sb-qplmmxynzxzkfxtayoqr-auth-token.0=base64-abc; sb-qplmmxynzxzkfxtayoqr-auth-token.1=def')).toBe(
         true
      );
   });

   it('is false without one', () => {
      expect(hasStoredSession('')).toBe(false);
      expect(hasStoredSession('ph_x=1; md_theme=dark')).toBe(false);
      expect(hasStoredSession('sb-qplmmxynzxzkfxtayoqr-auth-token-code-verifier=x')).toBe(false);
   });
});

describe('Facebook ⋯ → Open in external browser (?fbcode=)', () => {
   it('adds and removes the code on the current address, keeping the rest', () => {
      const armed = buildArmedUrl('https://moodeng.app/onboarding/connect?src=fb-post#top', 'MDNG-EC3424');
      expect(armed).toBe('/onboarding/connect?src=fb-post&fbcode=MDNG-EC3424#top');
      expect(stripFbCode(`https://moodeng.app${armed}`)).toBe('/onboarding/connect?src=fb-post#top');
   });

   it('sends Safari (not signed in) to the code page', () => {
      expect(resolveFbCodeAddress('https://moodeng.app/onboarding/connect?fbcode=mdng-ec3424', false)).toBe('/fb/MDNG-EC3424?from=fb');
   });

   it('just tidies the address where they are signed in', () => {
      expect(resolveFbCodeAddress('https://moodeng.app/onboarding/connect?fbcode=MDNG-EC3424', true)).toBe('/onboarding/connect');
   });

   it('drops a code that is not one of ours', () => {
      expect(resolveFbCodeAddress('https://moodeng.app/onboarding/connect?fbcode=<script>', false)).toBe('/onboarding/connect');
   });

   it('leaves other addresses alone', () => {
      expect(resolveFbCodeAddress('https://moodeng.app/onboarding/connect?src=x', false)).toBeNull();
   });
});

describe('copyTextFromTap', () => {
   const exec = document.execCommand;
   afterEach(() => {
      document.execCommand = exec;
      vi.unstubAllGlobals();
   });

   it('uses the old copy command first (what Facebook’s iPhone browser still allows)', async () => {
      document.execCommand = vi.fn(() => true);
      await expect(copyTextFromTap('MDNG-1234')).resolves.toEqual({ ok: true, method: 'exec' });
   });

   it('falls back to the clipboard API', async () => {
      document.execCommand = vi.fn(() => false);
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
      await expect(copyTextFromTap('MDNG-1234')).resolves.toEqual({ ok: true, method: 'clipboard' });
      expect(writeText).toHaveBeenCalledWith('MDNG-1234');
   });

   it('says so when nothing could be copied', async () => {
      document.execCommand = vi.fn(() => false);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('NotAllowedError')) } });
      await expect(copyTextFromTap('MDNG-1234')).resolves.toEqual({ ok: false, method: 'none' });
   });
});
