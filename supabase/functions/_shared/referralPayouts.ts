// Referral code owner payouts → admin Telegram card with "✅ Paid" / "⏳ Not paid yet" buttons.
//
// A user redeems a code that has an owner (referral_codes.owner_user_id) → a referral_code_payouts
// row (status 'unpaid') → this card. ✅ Paid flips it to 'paid' and stamps the card; ⏳ Not paid yet
// leaves it unpaid and keeps a ✅ Paid button on the card. Paying in the admin panel stamps the card
// too (referral-payout-telegram-notification, event 'decided').

import { type CardStamp, stampDecisionCards } from './adminCards.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// Telegram callback_data: "rp:<p|u>:<payout uuid>" (≤64 bytes).
export type PayoutDecision = 'paid' | 'unpaid';

export const buildPayoutCallback = (decision: PayoutDecision, payoutId: string) =>
   `rp:${decision === 'paid' ? 'p' : 'u'}:${payoutId}`;

export const parsePayoutCallback = (data?: string): { decision: PayoutDecision; payoutId: string } | null => {
   const match = (data ?? '').match(/^rp:([pu]):([0-9a-f-]{36})$/i);
   if (!match) return null;
   return { decision: match[1] === 'p' ? 'paid' : 'unpaid', payoutId: match[2] };
};

type Person = { username?: string | null; display_name?: string | null; email?: string | null } | null;

export type PayoutRow = {
   id: string;
   code: string;
   status: string;
   paid_by: string | null;
   owner_user_id: string | null;
   referred_user_id: string;
   created_at: string;
   owner: Person;
   referred: Person;
};

const name = (p: Person) => p?.display_name?.trim() || (p?.username ? `@${p.username}` : null) || p?.email || 'Someone';

export const payoutSelect =
   'id, code, status, paid_by, owner_user_id, referred_user_id, created_at, owner:users!referral_code_payouts_owner_user_id_fkey(username, display_name, email), referred:users!referral_code_payouts_referred_user_id_fkey(username, display_name, email)';

export const buildPayoutCard = (p: PayoutRow) =>
   [
      `💸 ${name(p.owner)} needs money now — they referred a user`,
      '',
      `Code: ${p.code}`,
      `Owner: ${name(p.owner)}${p.owner?.username ? ` (@${p.owner.username})` : ''}${p.owner?.email ? ` · ${p.owner.email}` : ''}`,
      `Referred: ${name(p.referred)}${p.referred?.username ? ` (@${p.referred.username})` : ''}`,
      '',
      'Pay their referral reward, then tap ✅ Paid.'
   ].join('\n');

export const payoutStampHeader = (p: { owner?: Person }) => `✅ PAID — ${name(p.owner ?? null)} got their referral payout`;

/** Mark a payout paid and stamp its cards. Returns a one-line summary. */
export const markPayoutPaid = async (
   supabase: SupabaseClient,
   payoutId: string,
   admin: string
): Promise<{ ok: boolean; summary: string; stamp?: CardStamp }> => {
   const { data, error } = await supabase
      .from('referral_code_payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: `${admin} via Telegram` })
      .eq('id', payoutId)
      .eq('status', 'unpaid')
      .select(payoutSelect)
      .maybeSingle();
   if (error) throw new Error(`Couldn't update: ${error.message}`);
   if (!data) {
      const { data: current } = await supabase.from('referral_code_payouts').select('status, paid_by').eq('id', payoutId).maybeSingle();
      if (!current) return { ok: false, summary: 'That payout no longer exists.' };
      return { ok: false, summary: `Already ${current.status}${current.paid_by ? ` by ${current.paid_by}` : ''} — nothing changed.` };
   }
   const stamp: CardStamp = { header: payoutStampHeader(data as PayoutRow), by: admin };
   await stampDecisionCards(supabase, 'referral_payout', payoutId, stamp);
   return { ok: true, summary: `✅ Marked paid by ${admin}`, stamp };
};
