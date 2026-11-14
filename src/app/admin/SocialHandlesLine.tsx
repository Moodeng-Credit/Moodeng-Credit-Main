'use client';

import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { socialProfileUrl } from '@/lib/socialHandles';

interface AdminSocialHandles {
   instagram_handle: string | null;
   tiktok_handle: string | null;
   skipped: boolean;
   shared: boolean;
}

/**
 * Instagram / TikTok a borrower gave in the loan form ($60+), as tap-to-open links. Typed by the
 * borrower, so unchecked: "Also on another account" flags a handle someone else saved too.
 * Renders nothing when they gave neither.
 */
export default function SocialHandlesLine({ userId }: { userId: string | null | undefined }) {
   const [row, setRow] = useState<AdminSocialHandles | null>(null);

   useEffect(() => {
      if (!userId) return;
      let cancelled = false;
      void getSupabaseBrowserClient()
         .rpc('admin_social_handles', { p_user_ids: [userId] })
         .then(({ data }) => {
            if (!cancelled) setRow(((data ?? []) as AdminSocialHandles[])[0] ?? null);
         });
      return () => {
         cancelled = true;
      };
   }, [userId]);

   if (!row || (!row.instagram_handle && !row.tiktok_handle && !row.skipped)) return null;
   const link = 'font-semibold text-[#6b55f7] underline underline-offset-2';
   return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#594d65]">
         {row.instagram_handle ? (
            <a className={link} href={socialProfileUrl(row.instagram_handle, 'instagram')} rel="noopener noreferrer" target="_blank">
               Instagram @{row.instagram_handle}
            </a>
         ) : null}
         {row.tiktok_handle ? (
            <a className={link} href={socialProfileUrl(row.tiktok_handle, 'tiktok')} rel="noopener noreferrer" target="_blank">
               TikTok @{row.tiktok_handle}
            </a>
         ) : null}
         {!row.instagram_handle && !row.tiktok_handle ? <span>Said they don&apos;t use Instagram or TikTok</span> : null}
         {row.shared ? (
            <span className="rounded-full bg-[#fff6db] px-2 py-0.5 text-[11px] font-semibold text-[#8a6100]">Also on another account</span>
         ) : null}
      </p>
   );
}
