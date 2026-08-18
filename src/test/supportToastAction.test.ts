import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleToastAction } from '@/components/ToastSystem/config/utils';

// The support-reply toast's "Open chat" button was dead because LiveChatHost
// passed a *function* as buttonAction, while the toast system dispatches
// buttonAction as a *string key* through handleToastAction. These tests lock in
// the string-key contract so the button can't silently regress to a no-op.

vi.mock('@/lib/support/liveChat', () => ({
   openSupportChat: vi.fn()
}));

vi.mock('@/components/support/supportContacts', () => ({
   openSupportContacts: vi.fn()
}));

import { openSupportChat } from '@/lib/support/liveChat';

describe('support-reply toast action', () => {
   const navigate = vi.fn();

   beforeEach(() => {
      vi.clearAllMocks();
   });

   it('opens the chat widget for the open_support_chat action key', () => {
      handleToastAction('open_support_chat', {}, navigate);

      expect(openSupportChat).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
   });

   it('breaks when a function is passed instead of a key (the original bug)', () => {
      // This mirrors the pre-fix call shape. A function reaches the `retry_`
      // branch's action.startsWith() and throws, so the click handler blows up
      // and openSupportChat is never reached — that is why the button was dead.
      const asAction = (() => openSupportChat()) as unknown as string;

      expect(() => handleToastAction(asAction, {}, navigate)).toThrow(TypeError);
      expect(openSupportChat).not.toHaveBeenCalled();
   });
});
