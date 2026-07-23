import { describe, expect, it } from 'vitest';

import { friendlyConnectError } from '@/lib/web3/openfort/errors';

describe('friendlyConnectError', () => {
   it('never leaks a raw technical message to the user', () => {
      const raw = new Error('TypeError: Cannot read properties of undefined (reading iframe)');
      expect(friendlyConnectError(raw)).toBe("We couldn't finish creating your wallet. Please try again.");
   });

   it('maps auth/session failures to a sign-in prompt', () => {
      expect(friendlyConnectError(new Error('Authentication required'))).toMatch(/sign in again/i);
      expect(friendlyConnectError(new Error('Request failed with 401'))).toMatch(/sign in again/i);
      expect(friendlyConnectError('You need to be signed in to create your instant wallet.')).toMatch(/sign in again/i);
   });

   it('maps network/reachability failures to a connectivity hint', () => {
      expect(friendlyConnectError(new Error('Failed to fetch'))).toMatch(/reach the wallet service/i);
      expect(friendlyConnectError(new Error('Could not reach the wallet recovery service.'))).toMatch(/internet/i);
      expect(friendlyConnectError(new Error('gateway 503'))).toMatch(/internet/i);
   });

   it('maps misconfiguration to a try-later message (no config internals shown)', () => {
      expect(friendlyConnectError(new Error('Openfort Shield session endpoint is not configured.'))).toMatch(/try again in a little while/i);
   });

   it('handles non-Error inputs safely', () => {
      expect(friendlyConnectError(undefined)).toBe("We couldn't finish creating your wallet. Please try again.");
      expect(friendlyConnectError(null)).toBe("We couldn't finish creating your wallet. Please try again.");
      expect(friendlyConnectError({ weird: true })).toBe("We couldn't finish creating your wallet. Please try again.");
   });
});
