import { describe, expect, it } from 'vitest';

import {
   AFFILIATE_PERSONAL_SAMPLE,
   type AffiliateReferral,
   affiliateTotals,
   claimErrorText,
   parseAffiliateDashboard,
   referralStage
} from '@/lib/affiliateDashboard';
import { cleanSocialHandle, isValidSocialHandle, needsSocialHandles } from '@/lib/socialHandles';

const friend = (over: Partial<AffiliateReferral>): AffiliateReferral => ({
   first_name: 'Ana',
   code: 'MOODEN12345',
   joined_at: '2026-11-01T00:00:00Z',
   personal: true,
   borrowed: true,
   repaid: true,
   payout_amount: 5,
   payout_status: null,
   paid_at: null,
   ...over
});

describe('Moo affiliate stages', () => {
   it('locks a repaid friend until the inviter repays a loan themself', () => {
      expect(referralStage(friend({}), false)).toBe('locked');
      expect(referralStage(friend({}), true)).toBe('owed');
   });

   it('shows a $5 taken as a voucher as its own stage, counted as paid', () => {
      const r = friend({ payout_status: 'voucher', voucher_status: 'sent' });
      expect(referralStage(r)).toBe('voucher');
      expect(affiliateTotals([r]).paid).toBe(5);
   });

   it('counts locked money as on the way, not owed', () => {
      const totals = affiliateTotals([friend({})], false);
      expect(totals.owed).toBe(0);
      expect(totals.pending).toBe(5);
   });

   it('keeps team-made codes as before', () => {
      const belle = friend({ personal: false, payout_amount: 10, payout_status: 'unpaid' });
      expect(referralStage(belle, false)).toBe('owed');
   });

   it('reads an older server answer (no unlocked/voucher keys) safely', () => {
      const data = parseAffiliateDashboard({ codes: [{ code: 'BELLE', boost_amount: 5, payout_amount: 10, is_active: true }] });
      expect(data.unlocked).toBe(true);
      expect(data.voucher.available).toBe(false);
      expect(data.paused).toBe(false);
   });

   it('has a personal sample whose totals add up', () => {
      const t = affiliateTotals(AFFILIATE_PERSONAL_SAMPLE.referrals);
      expect(t.owed).toBe(5);
      expect(t.paid).toBe(10);
   });

   it('turns database claim errors into plain words', () => {
      expect(claimErrorText('facebook_invalid')).toMatch(/Facebook/);
      expect(claimErrorText('self_claim')).toMatch(/your own/);
   });
});

describe('Instagram / TikTok handles', () => {
   it('cleans @names and profile links', () => {
      expect(cleanSocialHandle('https://www.instagram.com/Moodeng.Credit/?hl=en', 'instagram')).toBe('moodeng.credit');
      expect(cleanSocialHandle('@moodeng.credit', 'tiktok')).toBe('moodeng.credit');
      expect(cleanSocialHandle('https://www.tiktok.com/@moodeng.credit?lang=en', 'tiktok')).toBe('moodeng.credit');
   });

   it('rejects what the apps would never allow', () => {
      expect(isValidSocialHandle('has space', 'instagram')).toBe(false);
      expect(isValidSocialHandle('a', 'tiktok')).toBe(false);
      expect(isValidSocialHandle('juan.dela_cruz', 'instagram')).toBe(true);
   });

   it('asks only when nothing is saved and they did not skip', () => {
      expect(needsSocialHandles({ instagram: null, tiktok: null, skipped: false, shared: false })).toBe(true);
      expect(needsSocialHandles({ instagram: null, tiktok: null, skipped: true, shared: false })).toBe(false);
      expect(needsSocialHandles({ instagram: 'x.y', tiktok: null, skipped: false, shared: false })).toBe(false);
      expect(needsSocialHandles(null)).toBe(false);
   });
});
