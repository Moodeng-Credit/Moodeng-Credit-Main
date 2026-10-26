import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null })));
// Only the sign-up source calls (a ?src visit also counts a post-link click).
const sourceCalls = () => rpc.mock.calls.filter(([name]) => name === 'record_signup_source');
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ rpc }) }));

import { captureFirstTouch, recordSignupSource } from '@/lib/attribution';

const visit = (url: string) => window.history.replaceState({}, '', url);

describe('attribution', () => {
   beforeEach(() => {
      window.localStorage.clear();
      rpc.mockClear();
   });

   it('keeps the ?src tag of the first visit and saves it once for the new account', () => {
      visit('/?src=FB-Bonds-Oct8&utm_campaign=Bonds');
      captureFirstTouch();
      visit('/?src=other');
      captureFirstTouch(); // a later tagged visit doesn't replace the first tagged one
      recordSignupSource('user-1');
      recordSignupSource('user-1');
      expect(sourceCalls()).toHaveLength(1);
      expect(sourceCalls()[0][1]).toMatchObject({ p_source: 'fb-bonds-oct8', p_campaign: 'bonds', p_landing: '/' });
   });

   it('a tagged visit replaces an earlier untagged one', () => {
      visit('/about');
      captureFirstTouch();
      visit('/?src=poster-qc-mall');
      captureFirstTouch();
      recordSignupSource('user-2');
      expect(sourceCalls()[0][1]).toMatchObject({ p_source: 'poster-qc-mall' });
   });
});
