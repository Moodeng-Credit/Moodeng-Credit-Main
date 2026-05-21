import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

const showToastByConfigMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/ToastSystem/hooks/useToast', () => ({
   useToast: () => ({
      showToastByConfig: showToastByConfigMock
   })
}));

vi.mock('react-redux', () => ({
   useDispatch: () => dispatchMock
}));

vi.mock('react-router-dom', () => ({
   useNavigate: () => navigateMock
}));

vi.mock('@worldcoin/idkit', () => ({
   CredentialRequest: vi.fn(() => 'proof_of_human'),
   IDKitErrorCodes: {
      UserRejected: 'user_rejected'
   },
   IDKitRequestWidget: () => null
}));

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const duplicateWorldIdStorageKey = 'moodeng_worldid_error';

describe('WorldIDVerification duplicate account feedback', () => {
   let container: HTMLDivElement;
   let root: Root;

   beforeEach(() => {
      sessionStorage.clear();
      showToastByConfigMock.mockClear();
      dispatchMock.mockClear();
      navigateMock.mockClear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => {
         root.unmount();
      });
      container.remove();
      sessionStorage.clear();
   });

   it('shows the duplicate-account toast when a reused World ID returns to the app', async () => {
      sessionStorage.setItem(duplicateWorldIdStorageKey, 'already_used');

      await act(async () => {
         root.render(
            createElement(WorldIDVerification, {
               children: () => createElement('button', { type: 'button' }, 'Verify World ID')
            })
         );
      });

      expect(showToastByConfigMock).toHaveBeenCalledWith('worldid_already_used');
      expect(sessionStorage.getItem(duplicateWorldIdStorageKey)).toBeNull();
      expect(document.body.textContent).toContain('We do not allow duplicate accounts.');
   });
});
