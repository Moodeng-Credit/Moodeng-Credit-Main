// GrabMart vouchers: rewards bank into a balance, every ₱100 becomes a payout that gets a code.
//
// Borrowers claim a reward in the app (public.submit_voucher_claim → voucher_claims, status 'banked').
// Each full ₱100 of banked rewards creates a 'grabmart_payout' claim (status 'pending'), which the
// notify_voucher_claim_telegram trigger hands to voucher-claim-telegram-notification. That sends it
// straight away (sendVoucherCode): the next code from the pool (public.voucher_codes, filled on the
// admin Vouchers page), or a fresh one bought with the Bitrefill API when the pool is empty. The code
// is emailed and shown in the app. If neither works, the admin card keeps ✅ Send code / ❌ Reject so
// the team can restock and tap again. Deciding in the admin panel instead fires
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
      `Buy ${peso(claim.amount_php)} GrabMart PH codes on bitrefill.com, add them in Admin → Vouchers, then tap ✅ Send code.`
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

/**
 * Pool empty: buy one code with the Bitrefill API and add it to the pool. A purchase started for this
 * claim earlier (bitrefill_invoice_id) is finished instead of buying again. Returns why it didn't work.
 */
const restockFromBitrefill = async (supabase: SupabaseClient, claimId: string, amountPhp: number): Promise<string | null> => {
   const apiKey = await getBitrefillApiKey(supabase);
   if (!apiKey) return `no ${peso(amountPhp)} codes left in the pool, and no Bitrefill API key is set`;

   const { data: claim } = await supabase.from('voucher_claims').select('bitrefill_invoice_id').eq('id', claimId).maybeSingle();
   const bought = await buyBitrefillCode(apiKey, amountPhp, claim?.bitrefill_invoice_id ?? null, async (invoiceId) => {
      await supabase.from('voucher_claims').update({ bitrefill_invoice_id: invoiceId }).eq('id', claimId);
   });
   if (!bought.ok) return `Bitrefill: ${bought.reason}`;

   const { error } = await supabase
      .from('voucher_codes')
      .upsert({ amount_php: amountPhp, code: bought.code, source: `bitrefill:${bought.invoiceId}` }, { onConflict: 'code', ignoreDuplicates: true });
   if (error) return `Bitrefill code bought (invoice ${bought.invoiceId}) but not saved: ${error.message}`;
   return null;
};

/**
 * Send a pending payout: take the next pool code of its value (buying one from Bitrefill when the pool
 * is empty), email it and mark the claim sent. The borrower also sees the code in the app, so a missing
 * or failed email doesn't undo the send.
 */
export const sendVoucherCode = async (supabase: SupabaseClient, claimId: string, admin: string): Promise<VoucherActionResult> => {
   let { data, error } = await supabase.rpc('assign_voucher_code', { p_claim_id: claimId, p_admin: admin });
   if (!error && data?.error === 'out_of_stock') {
      const problem = await restockFromBitrefill(supabase, claimId, Number(data.amount_php));
      if (problem) return { ok: false, retry: true, summary: problem };
      ({ data, error } = await supabase.rpc('assign_voucher_code', { p_claim_id: claimId, p_admin: admin }));
   }
   if (error) return { ok: false, retry: true, summary: `Couldn't send: ${error.message}` };
   if (data?.error === 'not_found') return { ok: false, summary: 'Claim not found.' };
   if (data?.error === 'not_pending') return { ok: false, summary: `Already handled (${data.status}).` };
   if (data?.error === 'out_of_stock') return { ok: false, retry: true, summary: `No ${peso(data.amount_php)} codes left — add some in Admin → Vouchers.` };
   if (data?.error || !data?.code) return { ok: false, retry: true, summary: `Couldn't send: ${data?.error ?? 'no code returned'}` };

   const email = typeof data.email === 'string' ? data.email.trim() : '';
   let delivery: string;
   if (!email || isPlaceholderEmail(email)) {
      delivery = 'no email on file — code is on their dashboard';
   } else {
      try {
         const message = buildVoucherCodeEmail({ fullName: String(data.full_name ?? ''), amountPhp: Number(data.amount_php), code: String(data.code) });
         await sendEmail(email, message.subject, message.text, message.html);
         delivery = `emailed to ${email}`;
      } catch (err) {
         delivery = `email failed (${(err instanceof Error ? err.message : String(err)).slice(0, 100)}) — code is on their dashboard`;
      }
   }

   const remaining = Number(data.remaining ?? 0);
   const stock = `${remaining} ${peso(data.amount_php)} code${remaining === 1 ? '' : 's'} left in the pool${remaining <= LOW_STOCK ? ' ⚠️' : ''}`;
   const summary = `✅ ${peso(data.amount_php)} GrabMart code ${delivery} · by ${admin} · ${stock}`;
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
