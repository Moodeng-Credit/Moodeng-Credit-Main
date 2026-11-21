import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Instagram + TikTok handles: more ways for the team to reach a borrower. Asked in the loan form from
 * SOCIAL_HANDLES_MIN_USD (next to the proof-of-income step). The database cleans and checks them
 * (public.save_my_social_handles, migration 20261115140000_moo_affiliate_for_everyone).
 */
export const SOCIAL_HANDLES_MIN_USD = 60;

export interface SocialHandles {
   instagram: string | null;
   tiktok: string | null;
   /** They said "I don't use these". */
   skipped: boolean;
   /** Another account uses one of these handles (the team sees this too). */
   shared: boolean;
}

export type SocialSite = 'instagram' | 'tiktok';

const LIMITS: Record<SocialSite, RegExp> = {
   instagram: /^[a-z0-9._]{1,30}$/,
   tiktok: /^[a-z0-9._]{2,24}$/
};

/** "@name", "name" or a profile link → the bare handle, lower case. Same rules as app_private.clean_social_handle. */
export function cleanSocialHandle(value: string, site: SocialSite): string {
   let v = value.trim().toLowerCase();
   v = v.replace(/^(https?:\/\/)?(www\.|m\.|vm\.)?/, '');
   v = site === 'instagram' ? v.replace(/^(instagram\.com|instagr\.am)\//, '') : v.replace(/^tiktok\.com\//, '');
   v = v.replace(/^@/, '');
   return v.split('/')[0].split('?')[0].split('#')[0];
}

export function isValidSocialHandle(handle: string, site: SocialSite): boolean {
   return LIMITS[site].test(handle);
}

export function socialProfileUrl(handle: string, site: SocialSite): string {
   return site === 'instagram' ? `https://www.instagram.com/${handle}/` : `https://www.tiktok.com/@${handle}`;
}

/** True when the loan form should ask: nothing saved and they haven't said they don't use these. */
export function needsSocialHandles(h: SocialHandles | null | undefined): boolean {
   return Boolean(h) && !h!.instagram && !h!.tiktok && !h!.skipped;
}

function parse(data: unknown): SocialHandles {
   const raw = (data ?? {}) as Partial<SocialHandles>;
   return {
      instagram: raw.instagram ?? null,
      tiktok: raw.tiktok ?? null,
      skipped: raw.skipped === true,
      shared: raw.shared === true
   };
}

export async function fetchMySocialHandles(): Promise<SocialHandles> {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_social_handles');
   if (error) throw error;
   return parse(data);
}

export async function saveMySocialHandles(input: { instagram: string; tiktok: string; skip?: boolean }): Promise<SocialHandles> {
   const { data, error } = await getSupabaseBrowserClient().rpc('save_my_social_handles', {
      p_instagram: input.instagram || null,
      p_tiktok: input.tiktok || null,
      p_skip: input.skip === true
   });
   if (error) throw error;
   return parse(data);
}

export function socialHandlesErrorText(message: string | undefined): string | null {
   if (!message) return null;
   if (message.includes('instagram_invalid')) return 'That Instagram name doesn’t look right.';
   if (message.includes('tiktok_invalid')) return 'That TikTok name doesn’t look right.';
   if (message.includes('handle_required')) return 'Add at least one, or tap “I don’t use these”.';
   return 'Couldn’t save. Try again.';
}
