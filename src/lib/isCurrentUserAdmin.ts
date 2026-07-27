import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

/**
 * Whether the signed-in viewer is an active admin.
 *
 * A standalone check rather than `getCurrentAdmin` from the admin panel: this runs on
 * public routes, and pulling in `adminSupabase` would drag the whole admin module into
 * their bundle. RLS on `admin_users` is the real gate — a non-admin simply reads nothing
 * back — so this is a UI hint, never a security boundary on its own.
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
   if (!isSupabaseBrowserConfigured()) return false;

   try {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return false;

      const { data } = await supabase.from('admin_users').select('id').eq('user_id', userId).eq('active', true).maybeSingle();

      return Boolean(data);
   } catch {
      return false;
   }
};
