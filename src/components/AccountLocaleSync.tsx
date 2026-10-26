import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import { useLocalization } from '@/i18n/LocalizationProvider';
import { LOCALE_CHOSEN_AT_STORAGE_KEY, LOCALE_CHOSEN_EVENT, resolveLocaleCode } from '@/i18n/translations';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { RootState } from '@/store/store';

// Keeps the app's language and the language saved on the account in step:
//   - signed in: if the account's language was chosen more recently than this browser's (in the
//     Messenger bot, or on another device), switch to it;
//   - any explicit choice here (a picker, or a ?lang= link from the bot) is saved to the account,
//     so the bot and other devices follow it.
// Best-effort both ways: a failed read or save never blocks the app.

const readLocalChosenAt = (): number => {
   try {
      return Number(window.localStorage?.getItem(LOCALE_CHOSEN_AT_STORAGE_KEY) ?? 0) || 0;
   } catch {
      return 0;
   }
};

export default function AccountLocaleSync(): null {
   const userId = useSelector((state: RootState) => state.auth.user?.id ?? '');
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const { locale, adoptAccountLocale, hasChosenLocale } = useLocalization();

   const save = (chosen: string) =>
      getSupabaseBrowserClient()
         .rpc('set_my_preferred_locale', { p_locale: chosen })
         .then(({ error }) => {
            if (error) console.warn('set_my_preferred_locale failed', error.message);
         });

   // On sign-in, the newer choice wins: the account's (switch to it) or this browser's (save it —
   // e.g. a ?lang= link opened before the account had loaded).
   useEffect(() => {
      if (!isAuthChecked || !userId) return;
      let cancelled = false;
      void (async () => {
         const { data, error } = await getSupabaseBrowserClient().rpc('my_preferred_locale');
         if (cancelled || error) return;
         const row = (Array.isArray(data) ? data[0] : data) as { locale?: string | null; chosen_at?: string | null } | null;
         const accountLocale = resolveLocaleCode(row?.locale);
         const accountAt = Date.parse(row?.chosen_at ?? '') || 0;
         const localAt = readLocalChosenAt();
         if (accountLocale && accountLocale !== locale && accountAt > localAt) adoptAccountLocale(accountLocale, accountAt);
         else if (hasChosenLocale && localAt > accountAt && accountLocale !== locale) void save(locale);
      })();
      return () => {
         cancelled = true;
      };
      // Only on sign-in: after that, choices made here are pushed, not pulled back.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isAuthChecked, userId]);

   // Push: every explicit choice made here while signed in.
   useEffect(() => {
      if (!userId) return;
      const onChosen = (event: Event) => {
         const chosen = resolveLocaleCode((event as CustomEvent<string>).detail);
         if (chosen) void save(chosen);
      };
      window.addEventListener(LOCALE_CHOSEN_EVENT, onChosen);
      return () => window.removeEventListener(LOCALE_CHOSEN_EVENT, onChosen);
   }, [userId]);

   return null;
}
