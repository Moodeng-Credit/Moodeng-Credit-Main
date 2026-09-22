import { useEffect, useRef } from 'react';

import { useSelector } from 'react-redux';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToastContext } from '@/components/ToastSystem/hooks/useToastContext';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { type RootState } from '@/store/store';

// One-off, admin-directed notice aimed at a single borrower: before they can request a loan again
// they must add a verified social contact (WhatsApp or Facebook Messenger) so Moodeng can reach
// them. Shown as a persistent card the next time that borrower logs in, and self-resolving — it
// stops appearing the moment they verify a contact, so no manual cleanup is needed.
//
// The target borrower is set via VITE_SOCIAL_CONTACT_NOTICE_USER_ID rather than hard-coded, so no
// real user id lives in the repo and the notice can be turned off by clearing the env var. Empty
// env = this component does nothing.
const TARGET_USER_ID = (import.meta.env.VITE_SOCIAL_CONTACT_NOTICE_USER_ID ?? '').trim();

export function SocialContactRequiredNotifier() {
   const { user, isAuthChecked } = useSelector((state: RootState) => state.auth);
   const { addToast } = useToastContext();
   const shownRef = useRef(false);

   useEffect(() => {
      if (shownRef.current) return;
      if (!TARGET_USER_ID || !isAuthChecked || user?.id !== TARGET_USER_ID || !isSupabaseBrowserConfigured()) {
         return;
      }

      let cancelled = false;

      (async () => {
         // Only nudge until they've actually added a line we can reach them on — a verified
         // WhatsApp or Messenger contact makes the notice disappear on its own.
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('whatsapp_verified_at, messenger_verified_at')
            .eq('id', TARGET_USER_ID)
            .maybeSingle();

         if (cancelled || !data || data.whatsapp_verified_at || data.messenger_verified_at || shownRef.current) {
            return;
         }

         shownRef.current = true;
         addToast({
            toastType: TOAST_TYPES.WARNING,
            title: 'A message from the Moodeng team',
            message:
               "To request a loan, you'll first need to add a verified social media contact — like Facebook or WhatsApp — so we can reach you. Please contact us and we'll help you get set up.",
            buttonText: 'Contact us',
            buttonAction: 'open_support_contacts',
            duration: 0,
            autoClose: false,
            customData: { supportIssue: 'social_contact_required' }
         });
      })();

      return () => {
         cancelled = true;
      };
   }, [addToast, isAuthChecked, user?.id]);

   return null;
}
