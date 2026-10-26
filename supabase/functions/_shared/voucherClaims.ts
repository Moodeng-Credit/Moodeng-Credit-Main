// GrabMart vouchers: rewards bank into a balance, every ₱100 becomes a payout that gets a code.
//
// Borrowers claim a reward in the app (public.submit_voucher_claim → voucher_claims, status 'banked').
// Each full ₱100 of banked rewards creates a 'grabmart_payout' claim (status 'pending'), which the
// notify_voucher_claim_telegram trigger hands to voucher-claim-telegram-notification. That sends it
// straight away (sendVoucherCode): bought with the Bitrefill API as a gift, so Bitrefill emails the
// voucher to the borrower; or, if Bitrefill can't (no key, empty balance), the next code from the pool
// (public.voucher_codes, filled on the admin Vouchers page), emailed by us. If neither works, the admin
// card keeps ✅ Send code / ❌ Reject so the team can top up and tap again. Deciding in the admin panel instead fires
// notify_voucher_claim_decided, which stamps the card the same way (event 'decided').

import { type CardStamp, stampDecisionCards } from './adminCards.ts';
import { buyBitrefillCode, getBitrefillApiKey } from './bitrefill.ts';
import { sendEmail } from './email.ts';
import { isPlaceholderEmail } from './placeholderEmail.ts';

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
   tier_apex: 'Moodeng reached Apex',
   grabmart_payout: 'GrabMart wallet reached ₱100'
};

/** Warn once a value has this many pool codes or fewer left. */
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

const peso = (value: unknown) => `₱${Number(value)}`;

/** Admin card for a payout that couldn't be sent automatically; `reason` says why. */
export const buildVoucherClaimCard = (claim: VoucherClaimRow, reason?: string | null) =>
   [
      `🎁 GrabMart voucher to send: ${peso(claim.amount_php)}`,
      `For: ${VOUCHER_REWARD_LABELS[claim.reward] ?? claim.reward}`,
      '',
      `Name: ${claim.full_name}`,
      `Mobile (GCash): ${claim.mobile}`,
      claim.email ? `Email: ${claim.email}` : null,
      claimUsername(claim) ? `User: @${claimUsername(claim)}` : null,
      '',
      reason ? `⚠️ Not sent automatically: ${reason}` : null,
      `Top up the Bitrefill balance (or add ${peso(claim.amount_php)} GrabMart PH codes in Admin → Vouchers), then tap ✅ Send code.`
   ]
      .filter((line) => line !== null)
      .join('\n');

/** Info card for a payout that went out on its own (no buttons). */
export const buildVoucherSentCard = (claim: VoucherClaimRow, summary: string) =>
   [
      `🎁 GrabMart ${peso(claim.amount_php)} sent automatically`,
      `To: ${claim.full_name}${claimUsername(claim) ? ` (@${claimUsername(claim)})` : ''}`,
      summary
   ].join('\n');

type SupabaseClient = any;

// The after-state header of a decided claim's card.
export const voucherStampHeader = (decision: VoucherDecision, claim: { full_name?: string | null; amount_php?: number | string | null }) => {
   const name = claim.full_name?.trim() || 'They';
   return decision === 'sent'
      ? `🎟 VOUCHER SENT — ${name} got their ₱${Number(claim.amount_php ?? 0)} GrabMart code`
      : `🚫 VOUCHER REJECTED — ${name}'s ₱${Number(claim.amount_php ?? 0)} went back to their GrabMart wallet`;
};

// Who decided, from what's on the claim: "rejected by @george via Telegram" → "@george".
export const voucherDecidedBy = (adminNote: string | null | undefined) =>
   adminNote?.match(/(?:^|· )(?:sent|rejected) by (.+?) via Telegram$/)?.[1] ?? null;

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const buildVoucherCodeEmail = (input: { fullName: string; amountPhp: number; code: string }) => {
   const firstName = input.fullName.trim().split(/\s+/)[0] || 'there';
   const amount = `₱${input.amountPhp}`;
   const subject = `Your ${amount} GrabMart voucher from Moodeng Credit`;
   const steps = 'Open Grab → Mart, fill your basket, then type the code in the "Offer" field at checkout. One code per order.';
   const text = [
      `Hi ${firstName},`,
      '',
      `Your Moodeng rewards reached ${amount}, so here is your ${amount} GrabMart voucher. Salamat for repaying on time!`,
      '',
      `Your code: ${input.code}`,
      '',
      steps,
      'You can also find this code on your Moodeng dashboard. If anything goes wrong, just reply to this email.',
      '',
      'Moodeng Credit'
   ].join('\n');
   const html = `<p>Hi ${escapeHtml(firstName)},</p>
<p>Your Moodeng rewards reached ${amount}, so here is your <b>${amount} GrabMart voucher</b>. Salamat for repaying on time!</p>
<p style="font-size:20px;font-weight:700;letter-spacing:1px;padding:12px 16px;background:#f3ecff;border-radius:10px;display:inline-block">${escapeHtml(input.code)}</p>
<p>${escapeHtml(steps)}</p>
<p>You can also find this code on your Moodeng dashboard. If anything goes wrong, just reply to this email.</p>
<p>Moodeng Credit</p>`;
   return { subject, text, html };
};

export type VoucherActionResult = {
   ok: boolean;
   summary: string;
   stamp?: CardStamp;
   // true when nothing changed and the same tap can be tried again (pool empty, Bitrefill down), so the
   // Telegram card keeps its buttons.
   retry?: boolean;
};

const GIFT_MESSAGE = 'Salamat for repaying on time! Use this in the Grab app: Mart → fill your basket → enter the code in "Offer". — Moodeng Credit';

/**
 * Bitrefill path: buy the voucher with the borrower as the gift recipient, so Bitrefill emails it to
 * them. A purchase started for this claim earlier (bitrefill_invoice_id) is finished instead of buying
 * again. On success the claim is marked sent and the code kept in voucher_codes for the record.
 * Returns null when Bitrefill can't be used (no key, no real email) so the pool path runs instead.
 */
const sendViaBitrefill = async (supabase: SupabaseClient, claimId: string, admin: string): Promise<VoucherActionResult | null> => {
   const apiKey = await getBitrefillApiKey(supabase);
   if (!apiKey) return null;

   const { data: claim } = await supabase
      .from('voucher_claims')
      .select('id, status, amount_php, full_name, email, bitrefill_invoice_id, users(email)')
      .eq('id', claimId)
      .maybeSingle();
   if (!claim) return { ok: false, summary: 'Claim not found.' };
   if (claim.status !== 'pending') return { ok: false, summary: `Already handled (${claim.status}).` };
   const accountEmail = Array.isArray(claim.users) ? claim.users[0]?.email : claim.users?.email;
   const email = String(claim.email ?? accountEmail ?? '').trim();
   if (!email || isPlaceholderEmail(email)) return null;

   const amountPhp = Number(claim.amount_php);
   const bought = await buyBitrefillCode(
      apiKey,
      amountPhp,
      claim.bitrefill_invoice_id ?? null,
      async (invoiceId) => {
         await supabase.from('voucher_claims').update({ bitrefill_invoice_id: invoiceId }).eq('id', claimId);
      },
      { recipientName: String(claim.full_name ?? '').trim() || 'Moodeng borrower', recipientEmail: email, message: GIFT_MESSAGE }
   );
   if (!bought.ok) return { ok: false, retry: true, summary: `Bitrefill: ${bought.reason}` };

   const { data: sent } = await supabase
      .from('voucher_claims')
      .update({
         status: 'sent',
         sent_at: new Date().toISOString(),
         admin_note: `Bitrefill emailed it (invoice ${bought.invoiceId}) · sent by ${admin}`,
         updated_at: new Date().toISOString()
      })
      .eq('id', claimId)
      .eq('status', 'pending')
      .select('id, full_name, amount_php')
      .maybeSingle();
   await supabase
      .from('voucher_codes')
      .upsert(
         { amount_php: amountPhp, code: bought.code, source: `bitrefill:${bought.invoiceId}`, claim_id: claimId, assigned_at: new Date().toISOString() },
         { onConflict: 'code', ignoreDuplicates: true }
      );
   if (!sent) return { ok: false, summary: 'Bought on Bitrefill, but the claim was already handled — check for a double send.' };

   const summary = `✅ ${peso(amountPhp)} GrabMart voucher bought on Bitrefill and emailed by Bitrefill to ${email} · by ${admin}`;
   const stamp: CardStamp = { header: voucherStampHeader('sent', sent), detail: summary, by: admin };
   await stampDecisionCards(supabase, 'voucher', claimId, stamp);
   return { ok: true, summary, stamp };
};

/**
 * Send a pending payout. Bitrefill first: it emails the voucher to the borrower. If Bitrefill isn't set
 * up or fails (e.g. balance empty), the next pool code (Admin → Vouchers) is emailed by us instead.
 */
export const sendVoucherCode = async (supabase: SupabaseClient, claimId: string, admin: string): Promise<VoucherActionResult> => {
   const viaBitrefill = await sendViaBitrefill(supabase, claimId, admin);
   if (viaBitrefill && (viaBitrefill.ok || !viaBitrefill.retry)) return viaBitrefill;
   if (viaBitrefill) {
      // A Bitrefill invoice already exists for this claim (e.g. still processing): Bitrefill may still
      // email it, so don't also send a pool code. Tapping again finishes that invoice.
      const { data: started } = await supabase.from('voucher_claims').select('bitrefill_invoice_id').eq('id', claimId).maybeSingle();
      if (started?.bitrefill_invoice_id) return viaBitrefill;
   }

   const { data, error } = await supabase.rpc('assign_voucher_code', { p_claim_id: claimId, p_admin: admin });
   if (error) return { ok: false, retry: true, summary: `Couldn't send: ${error.message}` };
   if (data?.error === 'not_found') return { ok: false, summary: 'Claim not found.' };
   if (data?.error === 'not_pending') return { ok: false, summary: `Already handled (${data.status}).` };
   if (data?.error === 'out_of_stock') {
      const why = viaBitrefill ? `${viaBitrefill.summary}; ` : '';
      return { ok: false, retry: true, summary: `${why}no ${peso(data.amount_php)} codes in the pool — top up Bitrefill or add codes in Admin → Vouchers.` };
   }
   if (data?.error || !data?.code) return { ok: false, retry: true, summary: `Couldn't send: ${data?.error ?? 'no code returned'}` };

   const email = typeof data.email === 'string' ? data.email.trim() : '';
   let delivery: string;
   if (!email || isPlaceholderEmail(email)) {
      delivery = 'NOT emailed (no real email on file) — send it to them by hand';
   } else {
      try {
         const message = buildVoucherCodeEmail({ fullName: String(data.full_name ?? ''), amountPhp: Number(data.amount_php), code: String(data.code) });
         await sendEmail(email, message.subject, message.text, message.html);
         delivery = `emailed to ${email}`;
      } catch (err) {
         delivery = `email failed (${(err instanceof Error ? err.message : String(err)).slice(0, 100)}) — send it to them by hand`;
      }
   }

   const remaining = Number(data.remaining ?? 0);
   const stock = `${remaining} ${peso(data.amount_php)} code${remaining === 1 ? '' : 's'} left in the pool${remaining <= LOW_STOCK ? ' ⚠️' : ''}`;
   const summary = `✅ ${peso(data.amount_php)} GrabMart pool code ${delivery} · by ${admin} · ${stock}`;
   const stamp: CardStamp = { header: voucherStampHeader('sent', data), detail: summary, by: admin };
   await stampDecisionCards(supabase, 'voucher', claimId, stamp);
   return { ok: true, summary, stamp };
};

/** ✅ sends a code; ❌ rejects (the ₱ goes back to their GrabMart wallet). Stamps the admin card. */
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
      .select('id, full_name, amount_php')
      .maybeSingle();
   if (error) throw new Error(`Couldn't update: ${error.message}`);
   if (!data) {
      const { data: current } = await supabase.from('voucher_claims').select('status, admin_note').eq('id', claimId).maybeSingle();
      if (!current) return { ok: false, summary: 'That claim no longer exists.' };
      const by = voucherDecidedBy(current.admin_note);
      return { ok: false, summary: `Already ${current.status}${by ? ` by ${by}` : ' in the admin panel'} — nothing changed.` };
   }
   const stamp: CardStamp = { header: voucherStampHeader('rejected', data), by: admin };
   await stampDecisionCards(supabase, 'voucher', claimId, stamp);
   return { ok: true, summary: `❌ Rejected by ${admin}`, stamp };
};
