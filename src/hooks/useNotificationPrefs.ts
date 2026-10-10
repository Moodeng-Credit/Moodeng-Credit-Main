import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import { type AppDispatch, type RootState } from '@/store/store';

export interface NotificationPrefs {
   accountActivity: boolean;
   transactionActivity: boolean;
   moodengBlogs: boolean;
   push: boolean;
}

type NotifColumn = 'notif_account_activity' | 'notif_transaction_activity' | 'notif_blogs' | 'notif_push';

const PREF_COLUMNS: Record<keyof NotificationPrefs, NotifColumn> = {
   accountActivity: 'notif_account_activity',
   transactionActivity: 'notif_transaction_activity',
   moodengBlogs: 'notif_blogs',
   push: 'notif_push'
};

export const NOTIF_SAVE_ERROR = 'Could not save your notification setting. Please try again.';

/**
 * Account-wide notification preferences, loaded from and saved to `users.notif_*` (the columns the
 * notification senders read). Toggles update optimistically and roll back if the save fails.
 */
export function useNotificationPrefs() {
   const dispatch = useDispatch<AppDispatch>();
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const accountActivity = useSelector((state: RootState) => state.auth.user?.notifAccountActivity ?? true);
   const transactionActivity = useSelector((state: RootState) => state.auth.user?.notifTransactionActivity ?? true);
   const moodengBlogs = useSelector((state: RootState) => state.auth.user?.notifBlogs ?? false);
   const push = useSelector((state: RootState) => state.auth.user?.notifPush ?? true);

   const [prefs, setPrefs] = useState<NotificationPrefs>({ accountActivity, transactionActivity, moodengBlogs, push });
   const [error, setError] = useState('');
   const [savingKey, setSavingKey] = useState<keyof NotificationPrefs | null>(null);

   useEffect(() => {
      setPrefs({ accountActivity, transactionActivity, moodengBlogs, push });
   }, [accountActivity, transactionActivity, moodengBlogs, push]);

   const setPref = useCallback(
      async (key: keyof NotificationPrefs, value: boolean): Promise<boolean> => {
         if (!userId) {
            setError(NOTIF_SAVE_ERROR);
            return false;
         }

         setError('');
         setSavingKey(key);
         setPrefs((prev) => ({ ...prev, [key]: value }));

         const column = PREF_COLUMNS[key];
         const { error: saveError } = await getSupabaseBrowserClient()
            .from('users')
            .update({ [column]: value })
            .eq('id', userId);

         setSavingKey(null);

         if (saveError) {
            setPrefs((prev) => ({ ...prev, [key]: !value }));
            setError(NOTIF_SAVE_ERROR);
            return false;
         }

         void dispatch(fetchUser());
         return true;
      },
      [dispatch, userId]
   );

   const toggle = useCallback((key: keyof NotificationPrefs) => setPref(key, !prefs[key]), [prefs, setPref]);

   return { prefs, setPref, toggle, error, savingKey };
}
