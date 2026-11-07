// Indonesia-track details for the admin (docs/INDONESIA_TRACK.md): who is on the track and how the
// team reaches them — Telegram, WhatsApp (+62, for the team to message directly), their Facebook
// profile, Walt address — plus where their ID check and proof of income stand. Read straight from
// tables the admin's RLS allows. Fails soft (empty) before the Indonesia migration is applied.
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type AnyRow = Record<string, any>;

export interface AdminIndoProfile {
   userId: string;
   telegramUsername: string | null;
   whatsappNumber: string | null;
   whatsappVerified: boolean;
   facebookProfileUrl: string | null;
   waltAddress: string | null;
   /** 'approved' (is_didit ACTIVE) | 'review' | 'declined' | 'started' | 'not started' */
   kyc: string;
   /** Latest proof of income: 'approved' | 'declined' | 'resend' | 'sent' (not decided) | null (none). */
   incomeDoc: string | null;
}

const kycLabel = (u: AnyRow): string => {
   if (u.is_didit === 'ACTIVE') return 'approved';
   const status = String(u.didit_id_status ?? '').toLowerCase();
   if (status.includes('review')) return 'review';
   if (status.includes('declined')) return 'declined';
   if (u.didit_submitted_at || status) return 'started';
   return 'not started';
};

/** wa.me link for a WhatsApp number (digits only), or null. */
export const whatsappChatUrl = (number: string | null | undefined): string | null => {
   const digits = String(number ?? '').replace(/\D/g, '');
   return digits.length >= 8 ? `https://wa.me/${digits}` : null;
};

/** Telegram link for a @username, or null. */
export const telegramUrl = (username: string | null | undefined): string | null => {
   const clean = String(username ?? '')
      .trim()
      .replace(/^@/, '');
   return clean ? `https://t.me/${clean}` : null;
};

/** Indonesia-track profiles for these users (only those with users.market = 'ID'). */
export async function fetchIndonesiaProfiles(userIds: string[]): Promise<Map<string, AdminIndoProfile>> {
   const ids = [...new Set(userIds.filter(Boolean))];
   const out = new Map<string, AdminIndoProfile>();
   if (!ids.length) return out;
   const supabase = getSupabaseBrowserClient();
   const { data: users, error } = await supabase
      .from('users')
      .select(
         'id,market,telegram_username,whatsapp_number,whatsapp_verified_at,facebook_profile_url,walt_address,is_didit,didit_id_status,didit_submitted_at'
      )
      .in('id', ids)
      .eq('market', 'ID');
   if (error || !users?.length) return out;

   const indoIds = (users as AnyRow[]).map((u) => u.id as string);
   const { data: docs } = await supabase
      .from('income_documents')
      .select('user_id,decision,verdict,created_at')
      .in('user_id', indoIds)
      .order('created_at', { ascending: false });
   const latestDoc = new Map<string, AnyRow>();
   for (const doc of (docs ?? []) as AnyRow[]) if (!latestDoc.has(doc.user_id)) latestDoc.set(doc.user_id, doc);

   for (const u of users as AnyRow[]) {
      const doc = latestDoc.get(u.id);
      out.set(u.id, {
         userId: u.id,
         telegramUsername: u.telegram_username ?? null,
         whatsappNumber: u.whatsapp_number ?? null,
         whatsappVerified: Boolean(u.whatsapp_verified_at),
         facebookProfileUrl: u.facebook_profile_url ?? null,
         waltAddress: u.walt_address ?? null,
         kyc: kycLabel(u),
         incomeDoc: doc ? (doc.decision ?? (doc.verdict === 'resend' ? 'resend' : 'sent')) : null
      });
   }
   return out;
}

/** Just the ids of the users on the Indonesia track (for 🇮🇩 marks in lists). */
export async function fetchIndonesiaUserIds(userIds: string[]): Promise<Set<string>> {
   const ids = [...new Set(userIds.filter(Boolean))];
   if (!ids.length) return new Set();
   const { data, error } = await getSupabaseBrowserClient().from('users').select('id').in('id', ids).eq('market', 'ID');
   if (error || !data) return new Set();
   return new Set((data as AnyRow[]).map((u) => u.id as string));
}
