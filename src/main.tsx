import { StrictMode } from 'react';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { CapturedNetworkRequest } from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { Providers } from '@/components/providers';

import { LocalizationProvider } from '@/i18n';
import { initClarity } from '@/lib/analytics/clarity';
import { setupStaleChunkReload } from '@/lib/staleChunkReload';
import { applyThemeMode, getStoredThemeMode } from '@/lib/themeMode';

import App from './App.tsx';
import './globals.css';

applyThemeMode(getStoredThemeMode());
setupStaleChunkReload();
initClarity();

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
// Require a real PostHog project key (`phc_…`). Guards against the case where the
// build injects the raw dotenvx `encrypted:…` ciphertext (a truthy but invalid key),
// which would silently initialise PostHog with garbage and drop every event/replay.
const isPosthogEnabled = import.meta.env.PROD && Boolean(posthogKey?.startsWith('phc_'));

// Headers that carry credentials — never let these into a replay.
const SENSITIVE_HEADERS = new Set([
   'authorization',
   'cookie',
   'set-cookie',
   'apikey',
   'x-api-key',
   'x-client-info',
   'x-supabase-auth'
]);

// JSON body keys whose values are secrets/PII — redact wherever they appear.
const SENSITIVE_BODY_KEY = /(password|token|secret|api[-_]?key|refresh_token|access_token|otp|code|private[-_]?key|seed|mnemonic|ssn|email|phone)/i;

// URL fragments for endpoints whose bodies are all-credential — drop the body wholesale.
const CREDENTIAL_URL = /\/auth\/v1\/(token|signup|verify|recover|otp|user)|\/functions\/v1\/(withdraw|repay|lend|fund)/i;

const redactHeaders = (headers?: Record<string, string>) => {
   if (!headers) return headers;
   const out: Record<string, string> = {};
   for (const [key, value] of Object.entries(headers)) {
      out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value;
   }
   return out;
};

const redactBody = (body: unknown, url: string): unknown => {
   if (body == null) return body;
   if (CREDENTIAL_URL.test(url)) return '[redacted body]';
   if (typeof body !== 'string') return body;
   try {
      const parsed = JSON.parse(body);
      const walk = (node: unknown): unknown => {
         if (Array.isArray(node)) return node.map(walk);
         if (node && typeof node === 'object') {
            const obj: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
               obj[k] = SENSITIVE_BODY_KEY.test(k) ? '[redacted]' : walk(v);
            }
            return obj;
         }
         return node;
      };
      return JSON.stringify(walk(parsed));
   } catch {
      // Not JSON — if it smells like a credential payload, drop it rather than leak it.
      return SENSITIVE_BODY_KEY.test(body) ? '[redacted body]' : body;
   }
};

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
      maskCapturedNetworkRequestFn: (data: CapturedNetworkRequest) => {
         const url = data.name ?? '';
         data.requestHeaders = redactHeaders(data.requestHeaders);
         data.responseHeaders = redactHeaders(data.responseHeaders);
         data.requestBody = redactBody(data.requestBody, url) as CapturedNetworkRequest['requestBody'];
         data.responseBody = redactBody(data.responseBody, url) as CapturedNetworkRequest['responseBody'];
         return data;
      }
   },
   capture_pageview: false,
   capture_pageleave: true,
   // Friction signals for the admin UX-health tiles: rage clicks (rapid repeated
   // clicks on one spot) and dead clicks (clicks on things that don't respond).
   // `autocapture` must stay on for both to fire — it's on by default, but we set
   // it explicitly so nobody accidentally disables the frustration meter.
   autocapture: true,
   rageclick: true,
   capture_dead_clicks: true
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
