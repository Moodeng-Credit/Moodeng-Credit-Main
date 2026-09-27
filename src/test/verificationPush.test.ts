import { beforeAll, describe, expect, it } from 'vitest';

import {
   buildVerificationDecisionPushPayload,
   PUSH_LOCALES,
   type VerificationPushOutcome
} from '../../supabase/functions/_shared/pushMessages';

const OUTCOMES: VerificationPushOutcome[] = ['approved', 'review', 'declined', 'abandoned'];

describe('buildVerificationDecisionPushPayload', () => {
   // The shared push module reads Deno.env for the site URL; shim it for the Node/vitest run.
   beforeAll(() => {
      (globalThis as unknown as { Deno?: { env: { get: () => undefined } } }).Deno ??= {
         env: { get: () => undefined }
      };
   });

   it('tells an approved user, in every locale, that they are verified and unlocked', () => {
      const en = buildVerificationDecisionPushPayload('approved', 'en');
      expect(en.type).toBe('verification_decision');
      expect(en.title.toLowerCase()).toContain('verified');
      expect(en.body.toLowerCase()).toContain('unlocked');
      // Approved is actionable good news — keep it on the lock screen.
      expect(en.requireInteraction).toBe(true);
      // Every locale renders both title and body for the approved verdict.
      for (const locale of PUSH_LOCALES) {
         const payload = buildVerificationDecisionPushPayload('approved', locale);
         expect(payload.title.trim().length).toBeGreaterThan(0);
         expect(payload.body.trim().length).toBeGreaterThan(0);
      }
   });

   it('routes every outcome to the verify page under one collapse tag', () => {
      for (const outcome of OUTCOMES) {
         const payload = buildVerificationDecisionPushPayload(outcome, 'en');
         expect(payload.url).toMatch(/\/verify$/);
         expect(payload.tag).toBe('verification-status');
      }
   });

   it('appends the decline reason to the body only when one is given', () => {
      const withReason = buildVerificationDecisionPushPayload('declined', 'en', 'document expired');
      expect(withReason.body).toContain('document expired');

      const withoutReason = buildVerificationDecisionPushPayload('declined', 'en');
      expect(withoutReason.body).not.toContain('(');
   });

   it('does not force the reassuring "in review" notification to persist', () => {
      expect(buildVerificationDecisionPushPayload('review', 'en').requireInteraction).toBe(false);
   });
});
