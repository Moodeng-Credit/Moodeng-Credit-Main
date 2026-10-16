import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn(() => Promise.resolve({ error: null })) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ rpc: h.rpc }) }));

const { makePostSrc, postLinkUrl } = await import('@/app/admin/PostLinksSection');
const { captureFirstTouch, cleanSrc } = await import('@/lib/attribution');

describe('post links', () => {
   afterEach(() => {
      h.rpc.mockClear();
      localStorage.clear();
      window.history.replaceState(null, '', '/');
   });

   it('fb-<who>-<where>-<day>, in the characters the app keeps for ?src', () => {
      const src = makePostSrc('Juan Dela Cruz', 'Bonds Group (PH) 🇵🇭', new Date(2026, 9, 16));
      expect(src).toBe('fb-juan-dela-cruz-bonds-group-ph-oct16');
      expect(cleanSrc(src)).toBe(src);
      expect(makePostSrc('Ñiña', '', new Date(2026, 9, 1))).toBe('fb-nina-oct1');
      expect(postLinkUrl(src)).toBe('https://moodeng.app/?src=fb-juan-dela-cruz-bonds-group-ph-oct16');
   });

   it('a visit with ?src counts one click per browser', () => {
      window.history.replaceState(null, '', '/?src=fb-juan-bonds-oct16');
      captureFirstTouch();
      captureFirstTouch();
      expect(h.rpc).toHaveBeenCalledTimes(1);
      expect(h.rpc).toHaveBeenCalledWith('record_post_link_click', { p_src: 'fb-juan-bonds-oct16' });
   });

   it('no ?src, no click', () => {
      window.history.replaceState(null, '', '/?utm_source=x');
      captureFirstTouch();
      expect(h.rpc).not.toHaveBeenCalled();
   });
});
