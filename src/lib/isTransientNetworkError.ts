// iOS Safari (and mobile browsers generally) report an aborted or network-dropped fetch
// as "TypeError: Load failed"; Chromium says "Failed to fetch"; an explicit AbortController
// abort throws "AbortError". These are connectivity / page-teardown events, not application
// faults — the classic signature is several parallel fetches on one screen all failing
// within a few hundred ms as the tab backgrounds, the user navigates away, or the mobile
// connection flaps. Logging them via console.error turns each into a captured $exception
// (capture_console_errors is on), so we detect them and treat them as non-actionable.
export const isTransientNetworkError = (error: unknown): boolean => {
   const message =
      typeof error === 'string'
         ? error
         : error instanceof Error
           ? error.message
           : typeof (error as { message?: unknown } | null)?.message === 'string'
             ? (error as { message: string }).message
             : '';

   return /load failed|failed to fetch|networkerror|network request failed|the operation was aborted|aborterror/i.test(message);
};
