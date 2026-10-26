import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Affiliate dashboard (/affiliate) — a referral code owner's own referrals and payouts, from
 * public.my_affiliate_dashboard() (supabase/migrations/20261026150000_affiliate_dashboard.sql).
 * The owner earns a code's payout_amount once a referred friend takes a loan and repays it; the
 * team marks each payout Paid in Admin → Referral codes (or the Telegram card).
 */
export interface AffiliateCode {
   code: string;
   boost_amount: number;
   payout_amount: number;
   is_active: boolean;
}

export interface AffiliateReferral {
   first_name: string;
   code: string;
   joined_at: string;
   borrowed: boolean;
   repaid: boolean;
   payout_amount: number;
   payout_status: 'unpaid' | 'paid' | null;
   paid_at: string | null;
}

export interface AffiliateDashboardData {
   codes: AffiliateCode[];
   referrals: AffiliateReferral[];
}

export type AffiliateStage = 'paid' | 'owed' | 'borrowed' | 'signed_up';

export function referralStage(r: AffiliateReferral): AffiliateStage {
   if (r.repaid) return r.payout_status === 'paid' ? 'paid' : 'owed';
   return r.borrowed ? 'borrowed' : 'signed_up';
}

export interface AffiliateTotals {
   signedUp: number;
   borrowed: number;
   repaid: number;
   earned: number;
   paid: number;
   owed: number;
   /** Friends with a loan out who haven't repaid yet — what's on the way once they do. */
   pending: number;
}

export function affiliateTotals(referrals: AffiliateReferral[]): AffiliateTotals {
   const totals: AffiliateTotals = { signedUp: referrals.length, borrowed: 0, repaid: 0, earned: 0, paid: 0, owed: 0, pending: 0 };
   for (const r of referrals) {
      const amount = Number(r.payout_amount) || 0;
      const stage = referralStage(r);
      if (r.borrowed || r.repaid) totals.borrowed += 1;
      if (r.repaid) {
         totals.repaid += 1;
         totals.earned += amount;
      }
      if (stage === 'paid') totals.paid += amount;
      if (stage === 'owed') totals.owed += amount;
      if (stage === 'borrowed') totals.pending += amount;
   }
   return totals;
}

export async function fetchAffiliateDashboard(): Promise<AffiliateDashboardData> {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_affiliate_dashboard');
   if (error) throw error;
   const raw = (data ?? {}) as Partial<AffiliateDashboardData>;
   return {
      codes: (raw.codes ?? []).map((c) => ({ ...c, boost_amount: Number(c.boost_amount), payout_amount: Number(c.payout_amount) })),
      referrals: (raw.referrals ?? []).map((r) => ({ ...r, payout_amount: Number(r.payout_amount) }))
   };
}

/** Made-up data for the dev-only /affiliate-preview route. */
export const AFFILIATE_SAMPLE: AffiliateDashboardData = {
   codes: [{ code: 'BELLE', boost_amount: 5, payout_amount: 10, is_active: true }],
   referrals: [
      {
         first_name: 'Ana',
         code: 'BELLE',
         joined_at: '2026-10-20T03:00:00Z',
         borrowed: false,
         repaid: false,
         payout_amount: 10,
         payout_status: null,
         paid_at: null
      },
      {
         first_name: 'Marco',
         code: 'BELLE',
         joined_at: '2026-10-12T03:00:00Z',
         borrowed: true,
         repaid: false,
         payout_amount: 10,
         payout_status: null,
         paid_at: null
      },
      {
         first_name: 'Joy',
         code: 'BELLE',
         joined_at: '2026-10-05T03:00:00Z',
         borrowed: true,
         repaid: true,
         payout_amount: 10,
         payout_status: 'unpaid',
         paid_at: null
      },
      {
         first_name: 'Rica',
         code: 'BELLE',
         joined_at: '2026-09-21T03:00:00Z',
         borrowed: true,
         repaid: true,
         payout_amount: 10,
         payout_status: 'paid',
         paid_at: '2026-10-08T03:00:00Z'
      }
   ]
};
