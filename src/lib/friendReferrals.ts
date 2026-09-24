import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Friend referrals ("FREE MEAL for both of you") and GrabFood voucher claims.
 * Every rule is enforced in the database (migration 20260924160000_friend_referrals_and_vouchers);
 * these helpers only call its functions.
 */

export type VoucherReward =
   'first_on_time_repayment' | 'referral_inviter' | 'referral_invitee' | 'tier_rising' | 'tier_prime' | 'tier_apex';
export type VoucherClaimStatus = 'pending' | 'sent' | 'rejected';
export type RedeemInviteResult = 'joined' | 'invalid_code' | 'self_referral' | 'already_referred' | 'not_a_new_account';

export interface ClaimableVoucher {
   reward: VoucherReward;
   friendReferralId: string | null;
   amountPhp: number;
}

export interface VoucherClaimSummary {
   reward: VoucherReward;
   friendReferralId: string | null;
   status: VoucherClaimStatus;
}

export interface MyRewards {
   invitedCount: number;
   qualifiedCount: number;
   wasReferred: boolean;
   claimable: ClaimableVoucher[];
   claims: VoucherClaimSummary[];
}

export const EMPTY_REWARDS: MyRewards = { invitedCount: 0, qualifiedCount: 0, wasReferred: false, claimable: [], claims: [] };

const PENDING_INVITE_KEY = 'moodeng.pendingInviteCode';
const INVITE_CODE_PATTERN = /^[A-Z]{6}[0-9]{5}$/;

export const normalizeInviteCode = (code: string) => code.trim().toUpperCase();
export const isValidInviteCode = (code: string) => INVITE_CODE_PATTERN.test(normalizeInviteCode(code));

export async function getMyInviteCode(): Promise<string> {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_my_invite_code');
   if (error) throw error;
   return String(data);
}

export async function getInviteInviter(code: string): Promise<string | null> {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_invite_inviter', { p_code: normalizeInviteCode(code) });
   if (error) throw error;
   return typeof data === 'string' && data ? data : null;
}

export async function redeemFriendInvite(code: string): Promise<RedeemInviteResult> {
   const { data, error } = await getSupabaseBrowserClient().rpc('redeem_friend_invite', { p_code: normalizeInviteCode(code) });
   if (error) throw error;
   return data as RedeemInviteResult;
}

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value) || 0);

/** Parses the jsonb returned by get_my_rewards(), tolerating missing keys. */
export function parseMyRewards(raw: unknown): MyRewards {
   if (!raw || typeof raw !== 'object') return EMPTY_REWARDS;
   const value = raw as Record<string, unknown>;
   const list = (key: string) => (Array.isArray(value[key]) ? (value[key] as Record<string, unknown>[]) : []);

   return {
      invitedCount: toNumber(value.invitedCount),
      qualifiedCount: toNumber(value.qualifiedCount),
      wasReferred: value.wasReferred === true,
      claimable: list('claimable').map((item) => ({
         reward: item.reward as VoucherReward,
         friendReferralId: typeof item.friendReferralId === 'string' ? item.friendReferralId : null,
         amountPhp: toNumber(item.amountPhp)
      })),
      claims: list('claims').map((item) => ({
         reward: item.reward as VoucherReward,
         friendReferralId: typeof item.friendReferralId === 'string' ? item.friendReferralId : null,
         status: item.status as VoucherClaimStatus
      }))
   };
}

export async function getMyRewards(): Promise<MyRewards> {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_my_rewards');
   if (error) throw error;
   return parseMyRewards(data);
}

export async function submitVoucherClaim(input: {
   reward: VoucherReward;
   friendReferralId: string | null;
   fullName: string;
   mobile: string;
   email?: string;
}): Promise<string> {
   const { data, error } = await getSupabaseBrowserClient().rpc('submit_voucher_claim', {
      p_reward: input.reward,
      p_friend_referral_id: input.friendReferralId,
      p_full_name: input.fullName,
      p_mobile: input.mobile,
      p_email: input.email || null
   });
   if (error) throw error;
   return String(data);
}

/** Invite codes arrive before sign-up, so the landing page parks the code until the user has an account. */
/** Invite links are credited to an account made after the link was opened, within a week. */
const PENDING_INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Sign-up can finish slightly before the landing page stores the code (e.g. clock skew).
const PENDING_INVITE_SIGNUP_SLACK_MS = 60 * 60 * 1000;

export interface PendingInvite {
   code: string;
   parkedAt: number;
}

export function rememberPendingInvite(code: string): void {
   try {
      const pending: PendingInvite = { code: normalizeInviteCode(code), parkedAt: Date.now() };
      window.localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(pending));
   } catch {
      // Storage can be unavailable (private mode); the invite simply won't be credited.
   }
}

export function readPendingInvite(now = Date.now()): PendingInvite | null {
   let raw: string | null = null;
   try {
      raw = window.localStorage.getItem(PENDING_INVITE_KEY);
   } catch {
      return null;
   }
   if (!raw) return null;
   let pending: Partial<PendingInvite> | null = null;
   try {
      pending = JSON.parse(raw) as Partial<PendingInvite>;
   } catch {
      pending = null;
   }
   if (
      !pending ||
      typeof pending.code !== 'string' ||
      typeof pending.parkedAt !== 'number' ||
      now - pending.parkedAt > PENDING_INVITE_MAX_AGE_MS
   ) {
      clearPendingInvite();
      return null;
   }
   return { code: pending.code, parkedAt: pending.parkedAt };
}

/** Only an account created after the invite link was opened is credited — not whoever signs in next on a shared phone. */
export const isAccountNewerThanInvite = (accountCreatedAt: string | undefined, invite: PendingInvite): boolean => {
   const created = accountCreatedAt ? Date.parse(accountCreatedAt) : Number.NaN;
   return Number.isFinite(created) && created >= invite.parkedAt - PENDING_INVITE_SIGNUP_SLACK_MS;
};

export function clearPendingInvite(): void {
   try {
      window.localStorage.removeItem(PENDING_INVITE_KEY);
   } catch {
      // Nothing to clear.
   }
}
