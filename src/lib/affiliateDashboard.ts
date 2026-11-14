import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Moo affiliate (/affiliate) — every borrower's referrals and payouts, from public.my_affiliate_dashboard()
 * (migrations 20261026150000_affiliate_dashboard, 20261115140000_moo_affiliate_for_everyone).
 *
 * Two kinds of code, one page:
 * - the personal invite code every borrower has: $5 USDC per friend who repays, once the borrower has
 *   repaid a loan themself (`unlocked`); the $5 can be taken as a food/Grab voucher instead.
 * - Belle-style referral codes the team makes: the code's payout_amount, marked Paid in Admin → Referral codes.
 *
 * Friends who never typed the code can be added by hand (submitReferralClaim → Telegram → the team approves).
 * On a Belle-style code that's tracking only; on the personal code it pays if they joined in the last 30 days.
 */
export interface AffiliateCode {
   code: string;
   boost_amount: number;
   payout_amount: number;
   is_active: boolean;
   /** The borrower's own invite code (link /invite/CODE), not a team-made one. */
   personal?: boolean;
}

export type AffiliatePayoutStatus = 'unpaid' | 'paid' | 'voucher' | null;

export interface AffiliateReferral {
   first_name: string;
   code: string;
   joined_at: string;
   /** Tracked only, never paid (a hand-added friend on a Belle code, or one who joined long before the claim). */
   claimed?: boolean;
   personal?: boolean;
   /** A hand-added friend the team approved. */
   added_by_you?: boolean;
   /** Personal-code friends: what a voucher claim for their $5 points at. */
   friend_referral_id?: string | null;
   borrowed: boolean;
   repaid: boolean;
   /** They repaid, but only a loan that doesn't count (held under 24h, or funded by you). */
   repaid_not_counted?: boolean;
   payout_amount: number;
   payout_status: AffiliatePayoutStatus;
   paid_at: string | null;
   voucher_status?: 'pending' | 'sent' | 'rejected' | null;
   voucher_php?: number | null;
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
   /** Personal code pays out: they've repaid a loan themself (or own a team-made code). */
   unlocked: boolean;
   /** Payouts wait while they have a past-due loan (or are blocked from rewards). */
   paused: boolean;
   /** Take a $5 as a voucher instead (Giftaway on, Philippines only). */
   voucher: { available: boolean; amountPhp: number };
}

/** locked = their friend repaid, but the $5 waits until they repay a loan themself. */
export type AffiliateStage = 'paid' | 'owed' | 'voucher' | 'locked' | 'repaid' | 'borrowed' | 'signed_up';

export function referralStage(r: AffiliateReferral, unlocked = true): AffiliateStage {
   if (r.repaid && r.claimed) return 'repaid';
   if (r.repaid) {
      if (r.payout_status === 'paid') return 'paid';
      if (r.payout_status === 'voucher') return 'voucher';
      if (r.personal && !r.payout_status && !unlocked) return 'locked';
      return 'owed';
   }
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

export function affiliateTotals(referrals: AffiliateReferral[], unlocked = true): AffiliateTotals {
   const totals: AffiliateTotals = { signedUp: referrals.length, borrowed: 0, repaid: 0, earned: 0, paid: 0, owed: 0, pending: 0 };
   for (const r of referrals) {
      const amount = Number(r.payout_amount) || 0;
      const stage = referralStage(r, unlocked);
      if (r.borrowed || r.repaid) totals.borrowed += 1;
      if (r.repaid) {
         totals.repaid += 1;
         totals.earned += amount;
      }
      // A $5 taken as a voucher counts as paid: it's theirs, just not in USDC.
      if (stage === 'paid' || stage === 'voucher') totals.paid += amount;
      if (stage === 'owed') totals.owed += amount;
      if ((stage === 'borrowed' || stage === 'locked') && !r.claimed) totals.pending += amount;
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

/** Raw RPC answer → typed data. Older servers (before the "for everyone" migration) omit the new keys. */
export function parseAffiliateDashboard(data: unknown): AffiliateDashboardData {
   const raw = (data ?? {}) as Partial<AffiliateDashboardData>;
   const codes = (raw.codes ?? []).map((c) => ({ ...c, boost_amount: Number(c.boost_amount), payout_amount: Number(c.payout_amount) }));
   return {
      codes,
      referrals: (raw.referrals ?? []).map((r) => ({
         ...r,
         payout_amount: Number(r.payout_amount),
         voucher_php: r.voucher_php == null ? null : Number(r.voucher_php)
      })),
      claims: raw.claims ?? [],
      unlocked: raw.unlocked ?? codes.some((c) => !c.personal),
      paused: raw.paused === true,
      voucher: {
         available: raw.voucher?.available === true,
         amountPhp: Number(raw.voucher?.amountPhp) || AFFILIATE_VOUCHER_PHP
      }
   };
}

/** What a $5 becomes as a voucher (set in the database: app_private.affiliate_voucher_php). */
export const AFFILIATE_VOUCHER_PHP = 250;

export async function fetchAffiliateDashboard(): Promise<AffiliateDashboardData> {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_affiliate_dashboard');
   if (error) throw error;
   return parseAffiliateDashboard(data);
}

export async function submitReferralClaim(friendName: string, friendContact: string, facebookUrl = ''): Promise<void> {
   const { error } = await getSupabaseBrowserClient().rpc('submit_referral_claim', {
      p_friend_name: friendName,
      p_friend_contact: friendContact || null,
      p_facebook_url: facebookUrl || null
   });
   if (error) throw error;
}

/** The database's claim errors, in plain words. */
export function claimErrorText(message: string | undefined): string | null {
   if (!message) return null;
   if (message.includes('facebook_invalid')) return 'Paste their Facebook profile link (facebook.com/…).';
   if (message.includes('self_claim')) return 'That looks like your own account.';
   return message;
}

/** Made-up data for the dev-only /affiliate-preview route (?as=belle for a team-made code, ?locked=1 before the first repay). */
export const AFFILIATE_SAMPLE: AffiliateDashboardData = {
   unlocked: true,
   paused: false,
   voucher: { available: true, amountPhp: AFFILIATE_VOUCHER_PHP },
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

/** A regular borrower's view: their personal code, $5 per friend (the default /affiliate-preview). */
export const AFFILIATE_PERSONAL_SAMPLE: AffiliateDashboardData = {
   unlocked: true,
   paused: false,
   voucher: { available: true, amountPhp: AFFILIATE_VOUCHER_PHP },
   codes: [{ code: 'MOODEN12345', boost_amount: 0, payout_amount: 5, is_active: true, personal: true }],
   claims: [{ id: 'c2', friend_name: 'Lito', status: 'pending', created_at: '2026-11-12T03:00:00Z' }],
   referrals: [
      {
         first_name: 'Ana',
         code: 'MOODEN12345',
         joined_at: '2026-11-10T03:00:00Z',
         personal: true,
         friend_referral_id: 'fr-ana',
         borrowed: false,
         repaid: false,
         payout_amount: 5,
         payout_status: null,
         paid_at: null
      },
      {
         first_name: 'Marco',
         code: 'MOODEN12345',
         joined_at: '2026-11-04T03:00:00Z',
         personal: true,
         friend_referral_id: 'fr-marco',
         borrowed: true,
         repaid: false,
         repaid_not_counted: true,
         payout_amount: 5,
         payout_status: null,
         paid_at: null
      },
      {
         first_name: 'Joy',
         code: 'MOODEN12345',
         joined_at: '2026-10-28T03:00:00Z',
         personal: true,
         added_by_you: true,
         friend_referral_id: 'fr-joy',
         borrowed: true,
         repaid: true,
         payout_amount: 5,
         payout_status: 'unpaid',
         paid_at: null
      },
      {
         first_name: 'Rica',
         code: 'MOODEN12345',
         joined_at: '2026-10-20T03:00:00Z',
         personal: true,
         friend_referral_id: 'fr-rica',
         borrowed: true,
         repaid: true,
         payout_amount: 5,
         payout_status: 'voucher',
         paid_at: null,
         voucher_status: 'sent',
         voucher_php: 250
      },
      {
         first_name: 'Dan',
         code: 'MOODEN12345',
         joined_at: '2026-10-12T03:00:00Z',
         personal: true,
         friend_referral_id: 'fr-dan',
         borrowed: true,
         repaid: true,
         payout_amount: 5,
         payout_status: 'paid',
         paid_at: '2026-10-30T03:00:00Z'
      }
   ]
};
