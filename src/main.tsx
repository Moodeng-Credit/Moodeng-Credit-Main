import { StrictMode } from 'react';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@rainbow-me/rainbowkit/styles.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PostHogProvider } from 'posthog-js/react';

import { Providers } from '@/components/providers';
import App from './App.tsx';
import './globals.css';

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
const isPosthogEnabled = import.meta.env.PROD && Boolean(posthogKey);

const posthogOptions = {
   api_host: posthogHost,
   capture_exceptions: {
      capture_console_errors: true
   },
   session_recording: {
      recordHeaders: true,
      recordBody: true,
      maskCapturedNetworkRequestFn: (data) => data
   },
   capture_pageview: false,
   capture_pageleave: true
} as const;

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      {isPosthogEnabled ? (
         <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
            <BrowserRouter>
               <Providers>
                  <App />
               </Providers>
            </BrowserRouter>
         </PostHogProvider>
      ) : (
         <BrowserRouter>
            <Providers>
               <App />
            </Providers>
         </BrowserRouter>
      )}
   </StrictMode>
);
