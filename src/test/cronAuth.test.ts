import { describe, expect, it } from 'vitest';

import { CRON_TOKEN_HEADER, checkCronAuth } from '../../supabase/functions/_shared/cronAuth';

const request = (headers: Record<string, string> = {}) => new Request('https://example.test/fn', { method: 'POST', headers });

describe('checkCronAuth', () => {
   it('allows every caller while the secret is unconfigured, so deploying it cannot kill the crons', () => {
      expect(checkCronAuth(request(), undefined).ok).toBe(true);
      expect(checkCronAuth(request(), null).ok).toBe(true);
      expect(checkCronAuth(request(), '').ok).toBe(true);
      expect(checkCronAuth(request(), '   ').ok).toBe(true);
   });

   it('accepts a caller presenting the configured token', () => {
      expect(checkCronAuth(request({ [CRON_TOKEN_HEADER]: 'sekret' }), 'sekret').ok).toBe(true);
   });

   it('rejects the anon-key caller that has no token — the hole this closes', () => {
      const result = checkCronAuth(request(), 'sekret');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
   });

   it('rejects a wrong token', () => {
      expect(checkCronAuth(request({ [CRON_TOKEN_HEADER]: 'guess' }), 'sekret').ok).toBe(false);
   });

   it('ignores surrounding whitespace on both sides', () => {
      expect(checkCronAuth(request({ [CRON_TOKEN_HEADER]: '  sekret ' }), 'sekret\n').ok).toBe(true);
   });

   it('carries CORS headers onto the 401 so browser callers see the rejection', async () => {
      const result = checkCronAuth(request(), 'sekret', { 'Access-Control-Allow-Origin': '*' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.response.headers.get('Access-Control-Allow-Origin')).toBe('*');
         await expect(result.response.json()).resolves.toEqual({ error: 'unauthorized' });
      }
   });
});
