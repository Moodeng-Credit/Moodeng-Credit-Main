// GrabFood voucher claims → admin Telegram card with "Mark sent" / "Reject" buttons.
//
// Borrowers claim a voucher in the app (public.submit_voucher_claim → voucher_claims, status 'pending').
// A trigger posts each new claim to the admin channel; the team buys the voucher (e.g. Gifted.PH,
// uDialPinoy) and taps ✅ Mark sent, which flips the claim to 'sent' so the borrower sees "Sent".
// Deciding in the admin panel instead fires notify_voucher_claim_decided, which stamps the card
// the same way (voucher-claim-telegram-notification, event 'decided').

import { type CardStamp, stampDecisionCards } from './adminCards.ts';

// Telegram callback_data for the card buttons: "vo:<s|r>:<claim uuid>" (≤64 bytes).
export type VoucherDecision = 'sent' | 'rejected';

const DECISION_CODES: Record<VoucherDecision, string> = { sent: 's', rejected: 'r' };

export const buildVoucherCallback = (decision: VoucherDecision, claimId: string) => `vo:${DECISION_CODES[decision]}:${claimId}`;

export const parseVoucherCallback = (data?: string): { decision: VoucherDecision; claimId: string } | null => {
   const match = (data ?? '').match(/^vo:([sr]):([0-9a-f-]{36})$/i);
   if (!match) return null;
   return { decision: match[1] === 's' ? 'sent' : 'rejected', claimId: match[2] };
};

export const VOUCHER_REWARD_LABELS: Record<string, string> = {
   first_on_time_repayment: 'First on-time repayment',
   referral_inviter: 'Referral (inviter)',
   referral_invitee: 'Referral (friend)',
   tier_rising: 'Moodeng reached Rising',
   tier_prime: 'Moodeng reached Prime',
   tier_apex: 'Moodeng reached Apex'
};

export type VoucherClaimRow = {
   id: string;
   reward: string;
   amount_php: number | string;
   full_name: string;
   mobile: string;
   email: string | null;
   status: string;
   created_at: string;
   users?: { username: string | null } | Array<{ username: string | null }> | null;
};

const claimUsername = (claim: VoucherClaimRow) => (Array.isArray(claim.users) ? claim.users[0]?.username : claim.users?.username) ?? null;

export const buildVoucherClaimCard = (claim: VoucherClaimRow) =>
   [
      `🎁 GrabFood voucher claim: ₱${Number(claim.amount_php)}`,
      `For: ${VOUCHER_REWARD_LABELS[claim.reward] ?? claim.reward}`,
      '',
      `Name: ${claim.full_name}`,
      `Mobile (GCash): ${claim.mobile}`,
      claim.email ? `Email: ${claim.email}` : null,
      claimUsername(claim) ? `User: @${claimUsername(claim)}` : null,
      '',
      `Buy a ₱${Number(claim.amount_php)} GrabFood e-gift (gifted.ph or udialpinoy.com), send it to the number/email above, then tap ✅ Mark sent.`
   ]
      .filter((line) => line !== null)
      .join('\n');

type SupabaseClient = any;

// The after-state header of a decided claim's card.
export const voucherStampHeader = (decision: VoucherDecision, claim: { full_name?: string | null; amount_php?: number | string | null }) => {
   const name = claim.full_name?.trim() || 'They';
   return decision === 'sent'
      ? `🎟 VOUCHER SENT — ${name} got their ₱${Number(claim.amount_php ?? 0)} GrabFood voucher`
      : `🚫 VOUCHER REJECTED — ${name}'s claim is closed (they can submit a new one)`;
};

// Who decided, from what's on the claim: "sent by @george via Telegram" → "@george".
export const voucherDecidedBy = (adminNote: string | null | undefined) =>
   adminNote?.match(/^(?:sent|rejected) by (.+?) via Telegram$/)?.[1] ?? null;

/** Flip a pending claim to sent/rejected, and stamp its admin card. Returns a one-line summary. */
export const decideVoucherClaim = async (
   supabase: SupabaseClient,
   claimId: string,
   decision: VoucherDecision,
   admin: string
): Promise<{ ok: boolean; summary: string; stamp?: CardStamp }> => {
   const { data, error } = await supabase
      .from('voucher_claims')
      .update({
         status: decision,
         sent_at: decision === 'sent' ? new Date().toISOString() : null,
         admin_note: `${decision} by ${admin} via Telegram`,
         updated_at: new Date().toISOString()
      })
      .eq('id', claimId)
      .eq('status', 'pending')
      .select('id, full_name, amount_php')
      .maybeSingle();
   if (error) throw new Error(`Couldn't update: ${error.message}`);
   if (!data) {
      const { data: current } = await supabase.from('voucher_claims').select('status, admin_note').eq('id', claimId).maybeSingle();
      if (!current) return { ok: false, summary: 'That claim no longer exists.' };
      const by = voucherDecidedBy(current.admin_note);
      return { ok: false, summary: `Already ${current.status}${by ? ` by ${by}` : ' in the admin panel'} — nothing changed.` };
   }
   const stamp: CardStamp = { header: voucherStampHeader(decision, data), by: admin };
   await stampDecisionCards(supabase, 'voucher', claimId, stamp);
   return {
      ok: true,
      summary: decision === 'sent' ? `✅ Marked sent by ${admin}` : `❌ Rejected by ${admin}`,
      stamp
   };
};
