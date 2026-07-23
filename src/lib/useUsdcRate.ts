import { useEffect, useState } from 'react';

/* Live USDC → fiat rate from CoinGecko's free endpoint. Falls back to an approximate
   fixed rate if the request is blocked/rate-limited, so an estimate always shows.
   Shared by the withdraw payout estimate and the borrower balance card's peso line. */
export const FALLBACK_RATE: Record<'php' | 'usd', number> = { php: 58.5, usd: 1 };

export function useUsdcRate(currency: 'php' | 'usd') {
   const [rate, setRate] = useState<{ value: number; live: boolean }>({ value: FALLBACK_RATE[currency], live: false });
   useEffect(() => {
      let cancelled = false;
      setRate({ value: FALLBACK_RATE[currency], live: false });
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=${currency}`)
         .then((r) => (r.ok ? r.json() : Promise.reject()))
         .then((d) => {
            const v = d?.['usd-coin']?.[currency];
            if (!cancelled && typeof v === 'number') setRate({ value: v, live: true });
         })
         .catch(() => {
            /* keep the fallback rate */
         });
      return () => {
         cancelled = true;
      };
   }, [currency]);
   return rate;
}
