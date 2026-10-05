// GrabFood voucher claims → admin Telegram card with "Send code" / "Reject" buttons.
//
// Borrowers claim a voucher in the app (public.submit_voucher_claim → voucher_claims, status 'pending').
// A trigger posts each new claim to the admin channel. The team keeps a pool of pre-bought GrabFood codes
// (admin Vouchers page → public.voucher_codes); tapping ✅ Send code hands the claim the next unused code
// of its value (public.assign_voucher_code), emails it to the borrower and marks the claim 'sent'.

import { sendEmail } from './email.ts';

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

// What the borrower reads in the email: why they got it.
const REWARD_REASONS: Record<string, string> = {
   first_on_time_repayment: 'for your first on-time repayment',
   referral_inviter: 'for inviting a friend who repaid on time',
   referral_invitee: 'for joining with a friend’s invite and repaying on time',
   tier_rising: 'for growing your Moodeng to Rising',
   tier_prime: 'for growing your Moodeng to Prime',
   tier_apex: 'for growing your Moodeng to Apex'
};

/** Warn on the card once a value has this many codes or fewer left. */
export const LOW_STOCK = 3;

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
      `✅ Send code emails them the next ₱${Number(claim.amount_php)} code from the pool (add codes in Admin → Vouchers).`
   ]
      .filter((line) => line !== null)
      .join('\n');

const escapeHtml = (value: string) =>
   value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const buildVoucherCodeEmail = (input: { fullName: string; amountPhp: number; reward: string; code: string }) => {
   const firstName = input.fullName.trim().split(/\s+/)[0] || 'there';
   const reason = REWARD_REASONS[input.reward] ?? 'from Moodeng Credit';
   const amount = `₱${input.amountPhp}`;
   const subject = `Your ${amount} GrabFood voucher from Moodeng Credit`;
   const text = [
      `Hi ${firstName},`,
      '',
      `Here is your ${amount} GrabFood voucher ${reason}. Salamat!`,
      '',
      `Your code: ${input.code}`,
      '',
      'Enter it in the Grab app to use it. If anything goes wrong, just reply to this email.',
      '',
      'Moodeng Credit'
   ].join('\n');
   const html = `<p>Hi ${escapeHtml(firstName)},</p>
<p>Here is your <b>${amount} GrabFood voucher</b> ${escapeHtml(reason)}. Salamat!</p>
<p style="font-size:20px;font-weight:700;letter-spacing:1px;padding:12px 16px;background:#f3ecff;border-radius:10px;display:inline-block">${escapeHtml(input.code)}</p>
<p>Enter it in the Grab app to use it. If anything goes wrong, just reply to this email.</p>
<p>Moodeng Credit</p>`;
   return { subject, text, html };
};

type SupabaseClient = any;

export type VoucherActionResult = {
   ok: boolean;
   summary: string;
   // true when nothing changed and the same tap can be tried again (pool empty, email failed), so the
   // Telegram card keeps its buttons.
   retry?: boolean;
};

const peso = (value: unknown) => `₱${Number(value)}`;

/** Approve a pending claim: take the next unused code of its value from the pool and email it. */
export const sendVoucherCode = async (supabase: SupabaseClient, claimId: string, admin: string): Promise<VoucherActionResult> => {
   const { data, error } = await supabase.rpc('assign_voucher_code', { p_claim_id: claimId, p_admin: admin });
   if (error) return { ok: false, retry: true, summary: `Couldn't send: ${error.message}` };
   if (data?.error === 'not_found') return { ok: false, summary: 'Claim not found.' };
   if (data?.error === 'not_pending') return { ok: false, summary: `Already handled (${data.status}).` };
   if (data?.error === 'out_of_stock') {
      return { ok: false, retry: true, summary: `No ${peso(data.amount_php)} codes left. Add some in Admin → Vouchers, then tap again.` };
   }
   if (data?.error || !data?.code) return { ok: false, retry: true, summary: `Couldn't send: ${data?.error ?? 'no code returned'}` };

   const email = typeof data.email === 'string' ? data.email.trim() : '';
   try {
      if (!email) throw new Error('the claim has no email address');
      const message = buildVoucherCodeEmail({ fullName: String(data.full_name ?? ''), amountPhp: Number(data.amount_php), reward: String(data.reward), code: String(data.code) });
      await sendEmail(email, message.subject, message.text, message.html);
   } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await supabase.rpc('release_voucher_code', { p_claim_id: claimId, p_reason: reason.slice(0, 200) });
      return { ok: false, retry: true, summary: `Email failed (${reason.slice(0, 120)}). Code returned to the pool; claim still pending.` };
   }

   const remaining = Number(data.remaining ?? 0);
   const stock = `${remaining} ${peso(data.amount_php)} code${remaining === 1 ? '' : 's'} left${remaining <= LOW_STOCK ? ' ⚠️ restock soon' : ''}`;
   return { ok: true, summary: `✅ ${peso(data.amount_php)} code emailed to ${email} by ${admin} · ${stock}` };
};

/** ✅ sends a code from the pool; ❌ rejects. Returns a one-line summary for the admin card. */
export const decideVoucherClaim = async (
   supabase: SupabaseClient,
   claimId: string,
   decision: VoucherDecision,
   admin: string
): Promise<VoucherActionResult> => {
   if (decision === 'sent') return await sendVoucherCode(supabase, claimId, admin);

   const { data, error } = await supabase
      .from('voucher_claims')
      .update({ status: 'rejected', sent_at: null, admin_note: `rejected by ${admin} via Telegram`, updated_at: new Date().toISOString() })
      .eq('id', claimId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
   if (error) return { ok: false, retry: true, summary: `Couldn't update: ${error.message}` };
   if (!data) return { ok: false, summary: 'Already handled (not pending any more).' };
   return { ok: true, summary: `❌ Rejected by ${admin}` };
};
