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

const { default: LenderFundedPopup } = await import('@/components/funding/LenderFundedPopup');

const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

describe('LenderFundedPopup', () => {
   let container: HTMLDivElement;
   let root: Root;
   const onClose = vi.fn();

   const render = async () => {
      await act(async () => {
         root.render(
            createElement(LenderFundedPopup, {
               userId: 'lender-1',
               borrowerName: 'Mimi',
               totalRepayment: 44,
               dueDate: '2026-10-12',
               onClose
            })
         );
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
      onClose.mockClear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
   });

   it('asks for push the first time, then never again on this device', async () => {
      await render();
      expect(container.textContent).toContain('You funded Mimi!');
      expect(container.textContent).toContain('Want to know when you’re repaid?');
      expect(container.textContent).toContain('Mimi repays you $44.00 by Oct 12.');

      await remount();
      expect(container.textContent).toContain('Thanks for lending!');
      expect(buttonByText(container, 'Done')).toBeTruthy();
      expect(buttonByText(container, 'Notify Me When Repaid')).toBeUndefined();
   });

   it('only asks the browser after the lender taps the button, then closes', async () => {
      await render();
      expect(env.enable).not.toHaveBeenCalled();
      await act(async () => buttonByText(container, 'Notify Me When Repaid')?.click());
      expect(env.enable).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
   });

   it('closing skips the ask without asking the browser', async () => {
      await render();
      await act(async () => (container.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(env.enable).not.toHaveBeenCalled();
   });

   it('no ask when the browser already allowed or blocked notifications', async () => {
      env.permission = 'granted';
      await render();
      expect(buttonByText(container, 'Done')).toBeTruthy();

      env.permission = 'denied';
      await remount();
      expect(buttonByText(container, 'Done')).toBeTruthy();
   });

   it('on iPhone Safari explains Add to Home Screen', async () => {
      env.supported = false;
      env.needsHomeScreen = true;
      await render();
      expect(container.textContent).toContain('Add to Home Screen');
      expect(buttonByText(container, 'Got It')).toBeTruthy();
   });
});
