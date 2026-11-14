import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Affiliate dashboard (/affiliate) — a referral code owner's own referrals and payouts, from
 * public.my_affiliate_dashboard() (supabase/migrations/20261026150000_affiliate_dashboard.sql).
 * The owner earns a code's payout_amount once a referred friend takes a loan and repays it; the
 * team marks each payout Paid in Admin → Referral codes (or the Telegram card).
 *
 * Friends who never typed the code can be claimed (submitReferralClaim → Telegram → the team approves
 * in Admin → Referral codes). Claimed friends are tracked only: `claimed`, no payout.
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
   /** Added by a claim the team approved — tracking only, never paid. */
   claimed?: boolean;
   borrowed: boolean;
   repaid: boolean;
   payout_amount: number;
   payout_status: 'unpaid' | 'paid' | null;
   paid_at: string | null;
}

/** A friend the owner added by name that the team hasn't approved (or turned down, last 30 days). */
export interface AffiliateClaim {
   id: string;
   friend_name: string;
   status: 'pending' | 'rejected';
   created_at: string;
}

export interface AffiliateDashboardData {
   codes: AffiliateCode[];
   referrals: AffiliateReferral[];
   claims: AffiliateClaim[];
}

export type AffiliateStage = 'paid' | 'owed' | 'repaid' | 'borrowed' | 'signed_up';

export function referralStage(r: AffiliateReferral): AffiliateStage {
   if (r.repaid && r.claimed) return 'repaid';
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
      if (stage === 'borrowed' && !r.claimed) totals.pending += amount;
   }
   return totals;
}

/**
 * The code shown big on the page: the one most friends signed up with (ties → the first active one).
 * Any other codes are tucked under "Other codes" so an unused one doesn't compete with the real one.
 */
export function splitCodes(
   codes: AffiliateCode[],
   referrals: AffiliateReferral[]
): { main: AffiliateCode | null; others: AffiliateCode[] } {
   if (!codes.length) return { main: null, others: [] };
   const uses = (code: string) => referrals.filter((r) => !r.claimed && r.code === code).length;
   const ranked = [...codes].sort((a, b) => uses(b.code) - uses(a.code) || Number(b.is_active) - Number(a.is_active));
   return { main: ranked[0], others: ranked.slice(1) };
}

/** 1 = signed up, 2 = took a loan, 3 = repaid (the three dots on each friend's row). */
export function referralStep(r: AffiliateReferral): 1 | 2 | 3 {
   if (r.repaid) return 3;
   return r.borrowed ? 2 : 1;
}

/** Badges only — reaching one pays nothing extra. Counts friends who used a code and repaid. */
export const AFFILIATE_MILESTONES = [
   { goal: 1, title: 'First friend repaid' },
   { goal: 3, title: '3 friends repaid' },
   { goal: 5, title: '5 friends repaid' },
   { goal: 10, title: '10 friends repaid' }
] as const;

export function affiliateMilestones(referrals: AffiliateReferral[]) {
   const repaid = referrals.filter((r) => r.repaid && !r.claimed).length;
   return AFFILIATE_MILESTONES.map((m) => ({ ...m, progress: Math.min(repaid, m.goal), done: repaid >= m.goal }));
}

/**
 * Payouts marked Paid after `seenAt` (ISO, or null on first visit) — drives the "You got paid" pop-up.
 * On a first visit nothing older than 14 days counts, so long-paid money doesn't pop up as news.
 */
export function newPayouts(
   referrals: AffiliateReferral[],
   seenAt: string | null,
   now = Date.now()
): { count: number; amount: number; latest: string | null } {
   const floor = seenAt ? Date.parse(seenAt) : now - 14 * 24 * 60 * 60 * 1000;
   let count = 0;
   let amount = 0;
   let latest: string | null = null;
   for (const r of referrals) {
      if (r.payout_status !== 'paid' || !r.paid_at || Date.parse(r.paid_at) <= floor) continue;
      count += 1;
      amount += Number(r.payout_amount) || 0;
      if (!latest || r.paid_at > latest) latest = r.paid_at;
   }
   return { count, amount, latest };
}

export async function fetchAffiliateDashboard(): Promise<AffiliateDashboardData> {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_affiliate_dashboard');
   if (error) throw error;
   const raw = (data ?? {}) as Partial<AffiliateDashboardData>;
   return {
      codes: (raw.codes ?? []).map((c) => ({ ...c, boost_amount: Number(c.boost_amount), payout_amount: Number(c.payout_amount) })),
      referrals: (raw.referrals ?? []).map((r) => ({ ...r, payout_amount: Number(r.payout_amount) })),
      claims: raw.claims ?? []
   };
}

export async function submitReferralClaim(friendName: string, friendContact: string): Promise<void> {
   const { error } = await getSupabaseBrowserClient().rpc('submit_referral_claim', {
      p_friend_name: friendName,
      p_friend_contact: friendContact || null
   });
   if (error) throw error;
}

/** Made-up data for the dev-only /affiliate-preview route. */
export const AFFILIATE_SAMPLE: AffiliateDashboardData = {
   codes: [
      { code: 'BELLE2', boost_amount: 0, payout_amount: 10, is_active: true },
      { code: 'BELLE', boost_amount: 5, payout_amount: 10, is_active: true }
   ],
   claims: [{ id: 'c1', friend_name: 'Lito', status: 'pending', created_at: '2026-10-26T03:00:00Z' }],
   referrals: [
      {
         first_name: 'Dan',
         code: 'BELLE',
         joined_at: '2026-10-01T03:00:00Z',
         claimed: true,
         borrowed: true,
         repaid: true,
         payout_amount: 0,
         payout_status: null,
         paid_at: null
      },
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
