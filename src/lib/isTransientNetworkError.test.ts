import { describe, expect, it } from 'vitest';

import { isTransientNetworkError } from '@/lib/isTransientNetworkError';

describe('isTransientNetworkError', () => {
   it('matches the mobile/abort fetch-failure signatures we saw in Error Tracking', () => {
      expect(isTransientNetworkError(new Error('TypeError: Load failed'))).toBe(true);
      expect(isTransientNetworkError(new TypeError('Failed to fetch'))).toBe(true);
      expect(isTransientNetworkError({ message: 'Load failed' })).toBe(true);
      expect(isTransientNetworkError('AbortError: The operation was aborted.')).toBe(true);
      expect(isTransientNetworkError(new Error('Network request failed'))).toBe(true);
   });

   it('does not swallow genuine application errors', () => {
      expect(isTransientNetworkError(new Error('Milestone criteria not met'))).toBe(false);
      expect(isTransientNetworkError({ message: 'permission denied for table users' })).toBe(false);
      expect(isTransientNetworkError(null)).toBe(false);
      expect(isTransientNetworkError(undefined)).toBe(false);
      expect(isTransientNetworkError({})).toBe(false);
   });
});
