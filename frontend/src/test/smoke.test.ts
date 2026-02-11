import { describe, expect, it } from 'vitest';

describe('smoke test', () => {
   it('handles a mocked request', async () => {
      const response = await fetch('https://example.test/ping');
      const data = await response.json();

      expect(data).toEqual({ status: 'ok' });
   });
});
