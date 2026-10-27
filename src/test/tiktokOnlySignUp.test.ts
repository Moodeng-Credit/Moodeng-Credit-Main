import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// /sign-up inside TikTok's browser: TikTok login is the only way to sign up (no email/phone form, no Google).
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
vi.mock('react-redux', () => ({ useDispatch: () => () => ({ unwrap: () => new Promise(() => {}) }) }));
vi.mock('@/store/slices/authSlice', () => ({
   registerUser: vi.fn(),
   requestOtpCode: vi.fn(),
   registerWithGoogle: vi.fn(),
   registerWithTelegram: vi.fn()
}));
vi.mock('@/components/ToastSystem/hooks/useToast', () => ({
   useToast: () => ({ showToast: vi.fn(), showToastByConfig: vi.fn() })
}));
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({ auth: { signInWithOAuth: vi.fn() }, rpc: vi.fn() }),
   isSupabaseBrowserConfigured: () => true
}));
vi.mock('@/hooks/useSignedInRedirect', () => ({ useSignedInRedirect: () => false }));
vi.mock('@/components/LineLoginButton', () => ({ default: () => null }));
vi.mock('@/components/auth/TelegramLoginTile', () => ({ default: () => null }));
// Stand-in that shows which variant was rendered: the full-width bar or the small icon tile.
vi.mock('@/components/TikTokLoginButton', () => ({
   default: ({ iconOnly }: { iconOnly?: boolean }) => createElement('div', { 'data-tiktok': iconOnly ? 'tile' : 'full' })
}));
vi.mock('@/lib/tiktokAuth', () => ({ isTikTokButtonVisible: () => true }));

const { default: SignUpPage } = await import('@/views/signup/SignUpPage');

const TIKTOK_IOS_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/PH';
const FB_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';

describe('sign-up inside TikTok', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   const render = async (ua: string) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
      await act(async () => {
         root.render(createElement(MemoryRouter, null, createElement(SignUpPage)));
      });
   };

   beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllEnvs();
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
   });

   it('shows only the TikTok button: no email/phone form, no Google, no tiles', async () => {
      await render(TIKTOK_IOS_UA);
      expect(container.querySelectorAll('[data-tiktok]')).toHaveLength(1);
      expect(container.querySelector('[data-tiktok="full"]')).not.toBeNull();
      expect(container.querySelector('form')).toBeNull();
      expect(container.querySelector('input')).toBeNull();
      expect(container.textContent).not.toContain('Google');
      expect(container.textContent).toContain('Already have an account?');
   });

   it('Facebook keeps the email/phone code form and no big TikTok button', async () => {
      await render(FB_ANDROID_UA);
      expect(container.querySelector('form')).not.toBeNull();
      expect(container.querySelector('[data-tiktok="full"]')).toBeNull();
   });
});
