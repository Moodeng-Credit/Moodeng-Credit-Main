import { describe, expect, it } from 'vitest';

import { isToastActionAvailable } from '@/components/ToastSystem/config/utils';

describe('isToastActionAvailable', () => {
   it('hides "Try again?" buttons that have no retry callback to run', () => {
      expect(isToastActionAvailable('retry_transaction')).toBe(false);
      expect(isToastActionAvailable('retry_transaction', { retry: () => undefined })).toBe(true);
   });

   it('hides actions nothing handles', () => {
      expect(isToastActionAvailable('acknowledge')).toBe(false);
      expect(isToastActionAvailable('verify_worldid')).toBe(false);
      expect(isToastActionAvailable(undefined)).toBe(false);
   });

   it('keeps support and routed actions', () => {
      expect(isToastActionAvailable('open_support_chat')).toBe(true);
      expect(isToastActionAvailable('go_to_signin')).toBe(true);
      expect(isToastActionAvailable('view_loans')).toBe(true);
   });
});
