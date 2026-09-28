import { useCallback, useState } from 'react';

import { useGeoCheck } from '@/hooks/useGeoCheck';

// The country whose cash-out / top-up rails the withdraw and repay screens show. Each country
// gets only its own options (Philippine apps don't work without a Philippine account, and
// Indodax needs an Indonesian KTP), so this is always shown as a visible switch: the IP lookup
// only picks the starting value — it's a guess that misreads travelers and some PH mobile
// carriers — and the user's own pick wins and is remembered across both screens.
export type CashoutCountry = 'PH' | 'ID' | 'OTHER';

export const CASHOUT_COUNTRIES: { code: CashoutCountry; flag: string; label: string }[] = [
   { code: 'PH', flag: '🇵🇭', label: 'Philippines' },
   { code: 'ID', flag: '🇮🇩', label: 'Indonesia' },
   { code: 'OTHER', flag: '🌏', label: 'Other' }
];

const STORAGE_KEY = 'moodeng.cashoutCountry';

function parseCountry(value: string | null | undefined): CashoutCountry | null {
   const upper = value?.toUpperCase();
   return upper === 'PH' || upper === 'ID' || upper === 'OTHER' ? upper : null;
}

function readStoredCountry(): CashoutCountry | null {
   try {
      return parseCountry(window.localStorage?.getItem(STORAGE_KEY));
   } catch {
      return null;
   }
}

// Unknown (lookup failed or still loading) falls back to the Philippines, where most users are.
export function countryFromGeo(countryCode: string | null): CashoutCountry {
   if (!countryCode || countryCode === 'PH') return 'PH';
   if (countryCode === 'ID') return 'ID';
   return 'OTHER';
}

// `override` lets preview routes force a starting country (e.g. ?country=ID); previews skip
// both the geo lookup and the stored choice so each preview URL renders predictably.
export function useCashoutCountry({ isPreview, override }: { isPreview: boolean; override?: string | null }) {
   const { countryCode, loading: geoLoading } = useGeoCheck(isPreview);
   const [chosen, setChosen] = useState<CashoutCountry | null>(() => (isPreview ? parseCountry(override) : readStoredCountry()));

   const setCountry = useCallback(
      (next: CashoutCountry) => {
         setChosen(next);
         if (isPreview) return;
         try {
            window.localStorage?.setItem(STORAGE_KEY, next);
         } catch {
            // The switch still works for this visit when storage is blocked.
         }
      },
      [isPreview]
   );

   return {
      country: chosen ?? countryFromGeo(countryCode),
      setCountry,
      // Only worth waiting on when the geo guess is what decides the country.
      loading: chosen === null && !isPreview && geoLoading
   };
}
