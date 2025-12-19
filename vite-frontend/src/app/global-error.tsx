

import { useEffect } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
   useEffect(() => {
      console.error('Global error:', error);
   }, [error]);

   return (
      <html lang="en">
         <body>
            <ErrorBoundary errorMessage={error.message} onReset={reset} />
         </body>
      </html>
   );
}
