import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const env = vi.hoisted(() => ({
   homeScreenApp: true,
   permission: 'default' as string,
   enable: vi.fn(async () => 'subscribed'),
   locale: 'en' as string
}));

vi.mock('@/lib/push/webPushClient', () => ({
   isIosHomeScreenApp: () => env.homeScreenApp,
   isPushSupported: () => true,
   isPushConfigured: () => true,
   getPushPermission: () => env.permission
}));

vi.mock('@/hooks/usePushNotifications', () => ({
   usePushNotifications: () => ({ isSupported: true, isBusy: false, enable: env.enable })
}));

vi.mock('@/i18n', () => ({ useLocalization: () => ({ locale: env.locale }) }));

const { default: LenderHomeScreenPushPrompt } = await import('@/components/funding/LenderHomeScreenPushPrompt');

const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

describe('LenderHomeScreenPushPrompt', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async () => {
      await act(async () => {
         root.render(createElement(LenderHomeScreenPushPrompt, { userId: 'lender-1' }));
      });
   };

   const remount = async () => {
      await act(async () => root.unmount());
      root = createRoot(container);
      await render();
   };

   beforeEach(() => {
      window.localStorage.clear();
      env.homeScreenApp = true;
      env.permission = 'default';
      env.enable.mockClear();
      env.locale = 'en';
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
   });

   it('gives iPhone Home Screen lenders the one tap iOS needs, shows the green check, and asks only once', async () => {
      vi.useFakeTimers();
      try {
         await render();
         expect(container.textContent).toContain('Turn on notifications');
         await act(async () => buttonByText(container, 'Turn On')?.click());
         expect(env.enable).toHaveBeenCalledTimes(1);
         expect(buttonByText(container, 'Notifications On')).toBeTruthy();

         await act(async () => vi.advanceTimersByTime(1500));
         expect(container.textContent).toBe('');
      } finally {
         vi.useRealTimers();
      }

      await remount();
      expect(container.textContent).toBe('');
   });

   it('closing it also counts as asked', async () => {
      await render();
      await act(async () => (container.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click());
      expect(env.enable).not.toHaveBeenCalled();
      await remount();
      expect(container.textContent).toBe('');
   });

   it('stays away outside the Home Screen app, or once notifications are allowed or blocked', async () => {
      env.homeScreenApp = false;
      await render();
      expect(container.textContent).toBe('');

      env.homeScreenApp = true;
      env.permission = 'granted';
      await remount();
      expect(container.textContent).toBe('');

      env.permission = 'denied';
      await remount();
      expect(container.textContent).toBe('');
   });

   it('renders in the lender’s own app language, not just English', async () => {
      env.locale = 'vi';
      await render();
      expect(container.textContent).toContain('Bật thông báo');
      expect(buttonByText(container, 'Bật')).toBeTruthy();
      expect(container.textContent).not.toContain('Turn on notifications');
   });
});
