import { logAdminAction } from '@/app/admin/adminSupabase';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Money owed to affiliates, in one list: team-made code payouts (referral_code_payouts, 'unpaid') and
 * personal-code $5s + old interest refunds (interest_refunds, 'pending'). Admins only (table RLS).
 */
export interface OwedPayout {
   source: 'code' | 'refund';
   id: string;
   amount: number;
   label: string;
   created_at: string;
}

export interface OwedAffiliate {
   user_id: string;
   username: string | null;
   display_name: string | null;
   wallet_address: string | null;
   owed: number;
   items: OwedPayout[];
}

type Person = { id: string; username: string | null; display_name: string | null; wallet_address: string | null } | null;

const PERSON = 'id, username, display_name, wallet_address';

const nameOf = (p: { username: string | null; display_name: string | null } | null | undefined) =>
   p ? p.display_name?.trim() || (p.username ? `@${p.username}` : 'someone') : 'someone';

/** Everyone owed money (or one person, with `userId`), most owed first. */
export async function listOwedAffiliates(userId?: string): Promise<OwedAffiliate[]> {
   const supabase = getSupabaseBrowserClient();
   let codes = supabase
      .from('referral_code_payouts')
      .select(
         `id, code, amount, created_at, owner:users!referral_code_payouts_owner_user_id_fkey(${PERSON}), referred:users!referral_code_payouts_referred_user_id_fkey(username, display_name), rc:referral_codes!referral_code_payouts_referral_code_id_fkey(payout_amount)`
      )
      .eq('status', 'unpaid');
   let refunds = supabase
      .from('interest_refunds')
      .select(
         `id, kind, amount_usd, created_at, user:users!interest_refunds_user_id_fkey(${PERSON}), friend:friend_referrals!interest_refunds_friend_referral_id_fkey(referred:users!friend_referrals_referred_user_id_fkey(username, display_name))`
      )
      .eq('status', 'pending');
   if (userId) {
      codes = codes.eq('owner_user_id', userId);
      refunds = refunds.eq('user_id', userId);
   }
   const [c, r] = await Promise.all([codes, refunds]);
   if (c.error) throw c.error;
   if (r.error) throw r.error;

   const byUser = new Map<string, OwedAffiliate>();
   const add = (person: Person, item: OwedPayout) => {
      if (!person || !(item.amount > 0)) return;
      const row = byUser.get(person.id) ?? {
         user_id: person.id,
         username: person.username,
         display_name: person.display_name,
         wallet_address: person.wallet_address,
         owed: 0,
         items: []
      };
      row.owed = Math.round((row.owed + item.amount) * 100) / 100;
      row.items.push(item);
      byUser.set(person.id, row);
   };

   for (const p of (c.data ?? []) as unknown as Array<{
      id: string;
      code: string;
      amount: number | null;
      created_at: string;
      owner: Person;
      referred: { username: string | null; display_name: string | null } | null;
      rc: { payout_amount: number | null } | null;
   }>) {
      add(p.owner, {
         source: 'code',
         id: p.id,
         amount: Number(p.amount ?? p.rc?.payout_amount ?? 0),
         label: `${p.code}: ${nameOf(p.referred)} repaid`,
         created_at: p.created_at
      });
   }
   for (const p of (r.data ?? []) as unknown as Array<{
      id: string;
      kind: 'interest' | 'cash' | null;
      amount_usd: number;
      created_at: string;
      user: Person;
      friend: { referred: { username: string | null; display_name: string | null } | null } | null;
   }>) {
      add(p.user, {
         source: 'refund',
         id: p.id,
         amount: Number(p.amount_usd),
         label: p.kind === 'cash' ? `Invite link: ${nameOf(p.friend?.referred)} repaid` : 'Old interest refund',
         created_at: p.created_at
      });
   }
   for (const row of byUser.values()) row.items.sort((a, b) => a.created_at.localeCompare(b.created_at));
   return [...byUser.values()].sort((a, b) => b.owed - a.owed);
}

/**
 * Marks these payouts paid (one transfer covers them all). A $5 the person turned into a voucher
 * meanwhile is skipped, never marked twice. Returns how many were marked.
 */
export async function markPayoutsPaid(affiliate: OwedAffiliate, items: OwedPayout[], txHash: string | null): Promise<number> {
   const supabase = getSupabaseBrowserClient();
   const now = new Date().toISOString();
   const by = txHash ? `admin panel · ${txHash}` : 'admin panel';
   let marked = 0;
   const codeIds = items.filter((i) => i.source === 'code').map((i) => i.id);
   const refundIds = items.filter((i) => i.source === 'refund').map((i) => i.id);
   if (codeIds.length) {
      const { data, error } = await supabase
         .from('referral_code_payouts')
         .update({ status: 'paid', paid_at: now, paid_by: by })
         .in('id', codeIds)
         .eq('status', 'unpaid')
         .select('id');
      if (error) throw error;
      marked += data?.length ?? 0;
   }
   if (refundIds.length) {
      const { data, error } = await supabase
         .from('interest_refunds')
         .update({ status: 'sent', tx_hash: txHash, sent_at: now, sent_by: 'admin panel' })
         .in('id', refundIds)
         .eq('status', 'pending')
         .select('id');
      if (error) throw error;
      marked += data?.length ?? 0;
   }
   await logAdminAction({
      action: 'affiliate_payout_sent',
      target_table: 'users',
      target_id: affiliate.user_id,
      target_user_id: affiliate.user_id,
      metadata: { amount_usd: items.reduce((s, i) => s + i.amount, 0), tx_hash: txHash, items: items.length, marked }
   });
   return marked;
}
