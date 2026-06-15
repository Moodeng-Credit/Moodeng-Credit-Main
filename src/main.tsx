import { StrictMode } from 'react';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { CapturedNetworkRequest } from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { Providers } from '@/components/providers';

import { LocalizationProvider } from '@/i18n';
import { setupStaleChunkReload } from '@/lib/staleChunkReload';
import { applyThemeMode, getStoredThemeMode } from '@/lib/themeMode';

import App from './App.tsx';
import './globals.css';

applyThemeMode(getStoredThemeMode());
setupStaleChunkReload();

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
const isPosthogEnabled = import.meta.env.PROD && Boolean(posthogKey);

const posthogOptions = {
   api_host: posthogHost,
   capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: true
   },
   session_recording: {
      recordHeaders: true,
      recordBody: true,
      maskCapturedNetworkRequestFn: (data: CapturedNetworkRequest) => data
   },
   capture_pageview: false,
   capture_pageleave: true
} as const;

const appTree = (
   <LocalizationProvider>
      <BrowserRouter>
         <Providers>
            <App />
         </Providers>
      </BrowserRouter>
   </LocalizationProvider>
);

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      {isPosthogEnabled ? (
         <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
            {appTree}
         </PostHogProvider>
      ) : (
         appTree
      )}
   </StrictMode>
);
