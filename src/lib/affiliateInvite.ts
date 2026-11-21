// Affiliate-only sign-up (moodeng.app/partner/TOKEN, migration 20261119240000_affiliate_invite_links).
// The team makes a one-time link for a referral code on /admin; whoever signs up from it owns the code
// and gets user_role 'affiliate' — no borrower steps. The token is parked in localStorage while they
// sign up so the role picker can send them back to /partner to finish.
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const KEY = 'md_affiliate_invite';
const TTL_MS = 24 * 60 * 60 * 1000;

export const PARTNER_BASE_URL = 'https://moodeng.app/partner/';
export const partnerPath = (token: string) => `/partner/${encodeURIComponent(token)}`;
/** Where an affiliate goes after the wallet step (WalletConnected reads it as returnTo). */
export const AFFILIATE_WALLET_RETURN_TO = 'affiliate';

export function parkAffiliateInvite(token: string, now = Date.now()): void {
   try {
      localStorage.setItem(KEY, JSON.stringify({ token, at: now }));
   } catch {
      /* private mode: they can open the link again after signing up */
   }
}

export function readParkedAffiliateInvite(now = Date.now()): string | null {
   try {
      const raw = localStorage.getItem(KEY);
      const saved = raw ? (JSON.parse(raw) as { token?: unknown; at?: unknown }) : null;
      if (!saved || typeof saved.token !== 'string' || typeof saved.at !== 'number' || now - saved.at > TTL_MS) return null;
      return saved.token;
   } catch {
      return null;
   }
}

export function clearParkedAffiliateInvite(): void {
   try {
      localStorage.removeItem(KEY);
   } catch {
      /* ignore */
   }
}

export interface AffiliateInviteInfo {
   code: string;
   label: string | null;
   payout: number;
   /** Someone else already owns the code. */
   claimed: boolean;
   /** The signed-in person already owns it. */
   mine: boolean;
}

export async function fetchAffiliateInvite(token: string): Promise<AffiliateInviteInfo | null> {
   const { data, error } = await getSupabaseBrowserClient().rpc('affiliate_invite_info', { p_token: token });
   if (error) throw error;
   if (!data) return null;
   const row = data as Record<string, unknown>;
   return {
      code: String(row.code ?? ''),
      label: typeof row.label === 'string' ? row.label : null,
      payout: Number(row.payout ?? 5) || 5,
      claimed: row.claimed === true,
      mine: row.mine === true
   };
}

export async function claimAffiliateInvite(token: string): Promise<{ code: string; role: string | null }> {
   const { data, error } = await getSupabaseBrowserClient().rpc('claim_affiliate_invite', { p_token: token });
   if (error) throw error;
   const row = (data ?? {}) as Record<string, unknown>;
   return { code: String(row.code ?? ''), role: typeof row.role === 'string' ? row.role : null };
}

/** Admin: the sign-up link for a code (creates the code if it's new). */
export async function createAffiliateInviteLink(code: string, label?: string): Promise<string> {
   const { data, error } = await getSupabaseBrowserClient().rpc('admin_create_affiliate_invite', {
      p_code: code,
      p_label: label ?? null
   });
   if (error) throw error;
   return `${PARTNER_BASE_URL}${data as string}`;
}

export function claimErrorMessage(message: string | undefined): string {
   if (message?.includes('invite_already_claimed')) return 'Someone already used this link. Ask the Moodeng team for a new one.';
   if (message?.includes('invite_not_found')) return "This link doesn't work. Ask the Moodeng team for a new one.";
   if (message?.includes('invite_own_code')) return 'You signed up with this code, so it can’t be yours too. Ask the team for help.';
   return 'Something went wrong. Please try again.';
}
