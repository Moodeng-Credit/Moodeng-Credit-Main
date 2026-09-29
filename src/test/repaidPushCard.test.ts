import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Browser push state the tests flip: whether push works here, the permission, and whether this is
// iPhone Safari (push only from the Home Screen).
const env = vi.hoisted(() => ({
   supported: true,
   permission: 'default' as string,
   needsHomeScreen: false,
   enable: vi.fn(async () => 'subscribed')
}));

vi.mock('@/lib/push/webPushClient', () => ({
   isPushSupported: () => env.supported,
   isPushConfigured: () => true,
   getPushPermission: () => (env.supported ? env.permission : 'unsupported'),
   needsHomeScreenForPush: () => env.needsHomeScreen
}));

vi.mock('@/hooks/usePushNotifications', () => ({
   usePushNotifications: () => ({ isSupported: env.supported, isBusy: false, enable: env.enable })
}));

const { default: RepaidPushCard } = await import('@/components/funding/RepaidPushCard');

const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

describe('RepaidPushCard', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async () => {
      await act(async () => {
         root.render(createElement(RepaidPushCard, { userId: 'lender-1', borrowerName: 'Mimi' }));
      });
   };

   const remount = async () => {
      await act(async () => root.unmount());
      root = createRoot(container);
      await render();
   };

   beforeEach(() => {
      window.localStorage.clear();
      env.supported = true;
      env.permission = 'default';
      env.needsHomeScreen = false;
      env.enable.mockClear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
   });

   it('asks once, and never again on this device even if the lender ignores it', async () => {
      await render();
      expect(container.textContent).toContain('Get notified when you’re repaid');
      expect(container.textContent).toContain('the moment Mimi pays you back');

      await remount();
      expect(container.textContent).toBe('');
   });

   it('"Not now" hides it without asking the browser', async () => {
      await render();
      await act(async () => buttonByText(container, 'Not now')?.click());
      expect(container.textContent).toBe('');
      expect(env.enable).not.toHaveBeenCalled();
   });

   it('"Turn on" asks the browser and confirms', async () => {
      await render();
      await act(async () => buttonByText(container, 'Turn on')?.click());
      expect(env.enable).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain('We’ll notify you when Mimi repays');
   });

   it('hides itself if the lender then declines the browser dialog', async () => {
      env.enable.mockResolvedValueOnce('permission-denied');
      await render();
      await act(async () => buttonByText(container, 'Turn on')?.click());
      expect(container.textContent).toBe('');
   });

   it('stays hidden when the browser already allowed or blocked notifications', async () => {
      env.permission = 'granted';
      await render();
      expect(container.textContent).toBe('');

      env.permission = 'denied';
      await remount();
      expect(container.textContent).toBe('');
   });

   it('on iPhone Safari explains Add to Home Screen instead of offering a button', async () => {
      env.supported = false;
      env.needsHomeScreen = true;
      await render();
      expect(container.textContent).toContain('Add to Home Screen');
      expect(buttonByText(container, 'Turn on')).toBeUndefined();
      expect(buttonByText(container, 'Got it')).toBeTruthy();
   });
});
