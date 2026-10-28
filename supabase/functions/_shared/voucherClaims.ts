// Food voucher claims → sent automatically, with an admin Telegram card.
//
// Borrowers claim a reward in the app (public.submit_voucher_claim → voucher_claims, status 'pending').
// The notify_voucher_claim_telegram trigger hands each new claim to voucher-claim-telegram-notification,
// which sends it straight away (sendVoucherCode):
//   1. one ₱50 Xoxoday reward link per ₱50 from the stock (public.voucher_codes, filled on the admin
//      Vouchers page), emailed by us; the borrower opens it and picks Jollibee, Chowking, Greenwich,
//      Mang Inasal or Red Ribbon
//   2. if the stock is short: a Greenwich voucher bought on Bitrefill, which Bitrefill emails to them
//   3. if neither works: the admin card keeps ✅ Send code / ❌ Reject to retry after restocking.
// Deciding in the admin panel instead fires notify_voucher_claim_decided, which stamps the card the
// same way (event 'decided').

import { type CardStamp, stampDecisionCards } from './adminCards.ts';
import { buyBitrefillCode, getBitrefillApiKey, GRABMART_PRODUCTS } from './bitrefill.ts';
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

export const FOOD_BRANDS = 'Jollibee, Chowking, Greenwich, Mang Inasal or Red Ribbon';

/** Warn once this many ₱50 links or fewer are left. */
export const LOW_STOCK = 5;

export type VoucherClaimRow = {
   id: string;
   reward: string;
   amount_php: number | string;
   brand?: string | null;
   full_name: string;
   mobile: string;
   email: string | null;
   status: string;
   created_at: string;
   users?: { username: string | null } | Array<{ username: string | null }> | null;
};

const claimUsername = (claim: VoucherClaimRow) => (Array.isArray(claim.users) ? claim.users[0]?.username : claim.users?.username) ?? null;

const peso = (value: unknown) => `₱${Number(value)}`;

/** Admin card for a claim that couldn't be sent automatically; `reason` says why. */
export const buildVoucherClaimCard = (claim: VoucherClaimRow, reason?: string | null) =>
   [
      `${voucherPickLabel(claim.brand)} voucher to send: ${peso(claim.amount_php)}`,
      `For: ${VOUCHER_REWARD_LABELS[claim.reward] ?? claim.reward}`,
      '',
      `Name: ${claim.full_name}`,
      `Mobile (GCash): ${claim.mobile}`,
      claim.email ? `Email: ${claim.email}` : null,
      claimUsername(claim) ? `User: @${claimUsername(claim)}` : null,
      '',
      reason ? `⚠️ Not sent automatically: ${reason}` : null,
      claim.brand === 'grabmart'
         ? 'Top up the Bitrefill balance (bitrefill.com → Account), then tap ✅ Send code.'
         : 'Add ₱50 Xoxo links in Admin → Vouchers (Xoxoday → Send Reward Link → Moodeng food reward → Send to self), then tap ✅ Send code.'
   ]
      .filter((line) => line !== null)
      .join('\n');

/** What the borrower picked on the Moo-Menu, for the admin cards. */
export const voucherPickLabel = (brand?: string | null) => (brand === 'grabmart' ? '🛒 GrabMart' : '🍗 Food link (Jollibee & 4 more)');

/** Info card for a claim that went out on its own (no buttons). */
export const buildVoucherSentCard = (claim: VoucherClaimRow, summary: string) =>
   [
      `${voucherPickLabel(claim.brand)} voucher sent automatically: ${peso(claim.amount_php)}`,
      `To: ${claim.full_name}${claimUsername(claim) ? ` (@${claimUsername(claim)})` : ''} · ${VOUCHER_REWARD_LABELS[claim.reward] ?? claim.reward}`,
      summary
   ].join('\n');

type SupabaseClient = any;

/** Telegram line when the borrower answers "Did your Moo-meal arrive?". */
export const buildVoucherReceiptMessage = (claim: VoucherClaimRow & { received_at?: string | null }) => {
   const who = `${claim.full_name}${claimUsername(claim) ? ` (@${claimUsername(claim)})` : ''}`;
   const what = `${peso(claim.amount_php)} ${voucherPickLabel(claim.brand)} voucher`;
   return claim.received_at
      ? `✅ ${who} got their ${what}.`
      : `⚠️ ${who} says their ${what} didn't arrive.\nEmail: ${claim.email ?? '—'} · Mobile: ${claim.mobile}\nCheck the email, or resend from Admin → Food vouchers.`;
};

export type VoucherDigestPerson = {
   name: string;
   username: string | null;
   facebook: string | null;
   messenger: boolean;
   amountPhp: number | string;
   vouchers: number;
   days: number | null;
};
export type VoucherDigest = Record<'unclaimed' | 'pending' | 'not_arrived' | 'no_answer', VoucherDigestPerson[]>;

const DIGEST_LIMIT = 25;

const digestLine = (person: VoucherDigestPerson) => {
   const who = `${person.name}${person.username ? ` (@${person.username})` : ''}`;
   const fb = person.facebook ? `FB: ${person.facebook}` : person.messenger ? 'Messenger ✓' : 'no FB';
   const count = person.vouchers > 1 ? ` (${person.vouchers})` : '';
   const days = person.days === null ? '' : ` · ${person.days === 0 ? 'today' : `${person.days}d`}`;
   return `• ${who} · ${peso(person.amountPhp)}${count} · ${fb}${days}`;
};

const digestSection = (title: string, people: VoucherDigestPerson[]) => {
   if (!people.length) return null;
   const total = people.reduce((sum, person) => sum + Number(person.amountPhp), 0);
   const lines = people.slice(0, DIGEST_LIMIT).map(digestLine);
   if (people.length > DIGEST_LIMIT) lines.push(`…and ${people.length - DIGEST_LIMIT} more (Admin → Food vouchers)`);
   return `${title} — ${people.length} ${people.length === 1 ? 'person' : 'people'}, ${peso(total)}\n${lines.join('\n')}`;
};

/** The daily rewards-group check: who to nudge to claim, what's stuck, and who hasn't confirmed. */
export const buildVoucherDigest = (digest: VoucherDigest, linksLeft: number | null) => {
   const sections = [
      digestSection('🎁 Earned, not claimed yet (nudge them to claim)', digest.unclaimed ?? []),
      digestSection('⏳ Claimed, not sent yet', digest.pending ?? []),
      digestSection("⚠️ Said it didn't arrive (resend)", digest.not_arrived ?? []),
      digestSection('📭 Sent, no "I got it" yet', digest.no_answer ?? [])
   ].filter(Boolean);
   const stock = linksLeft === null ? '' : `\n\n₱50 Xoxo links left: ${linksLeft}${linksLeft <= 5 ? ' — restock soon' : ''}`;
   if (!sections.length) return `🧾 Daily rewards check: nothing waiting — everyone has claimed and confirmed. 🎉${stock}`;
   return `🧾 Daily rewards check\n\n${sections.join('\n\n')}${stock}`;
};

// The after-state header of a decided claim's card.
export const voucherStampHeader = (decision: VoucherDecision, claim: { full_name?: string | null; amount_php?: number | string | null }) => {
   const name = claim.full_name?.trim() || 'They';
   return decision === 'sent'
      ? `🎟 VOUCHER SENT — ${name} got their ₱${Number(claim.amount_php ?? 0)} food voucher`
      : `🚫 VOUCHER REJECTED — ${name}'s claim is closed (they can submit a new one)`;
};

// Who decided, from what's on the claim: "rejected by @george via Telegram" → "@george".
export const voucherDecidedBy = (adminNote: string | null | undefined) =>
   adminNote?.match(/(?:^|· )(?:sent|rejected) by (.+?) via Telegram$/)?.[1] ?? null;

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The borrower's email: one button per ₱50 link. */
export const buildVoucherCodeEmail = (input: { fullName: string; amountPhp: number; reward: string; links: string[] }) => {
   const firstName = input.fullName.trim().split(/\s+/)[0] || 'there';
   const reason = REWARD_REASONS[input.reward] ?? 'from Moodeng Credit';
   const amount = `₱${input.amountPhp}`;
   const many = input.links.length > 1;
   const subject = `Your ${amount} food voucher from Moodeng Credit`;
   const how = `Open ${many ? 'each link' : 'the link'}, pick ${FOOD_BRANDS}, and you'll get a voucher code to show at the store.`;
   const text = [
      `Hi ${firstName},`,
      '',
      `Here is your ${amount} food voucher ${reason}. Salamat!`,
      '',
      ...input.links.map((link, i) => (many ? `₱50 voucher ${i + 1}: ${link}` : `Your voucher: ${link}`)),
      '',
      how,
      'If anything goes wrong, just reply to this email.',
      '',
      'Moodeng Credit'
   ].join('\n');
   const buttons = input.links
      .map(
         (link, i) =>
            `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#6b55f7;color:#fff;border-radius:24px;text-decoration:none;font-weight:700">${many ? `Open ₱50 voucher ${i + 1}` : 'Open my food voucher'}</a></p>`
      )
      .join('\n');
   const html = `<p>Hi ${escapeHtml(firstName)},</p>
<p>Here is your <b>${amount} food voucher</b> ${escapeHtml(reason)}. Salamat!</p>
${buttons}
<p>${escapeHtml(how)}</p>
<p>If anything goes wrong, just reply to this email.</p>
<p>Moodeng Credit</p>`;
   return { subject, text, html };
};

export type VoucherActionResult = {
   ok: boolean;
   summary: string;
   stamp?: CardStamp;
   // true when nothing changed and the same tap can be tried again (stock empty, Bitrefill not ready),
   // so the Telegram card keeps its buttons.
   retry?: boolean;
};

const GIFT_MESSAGE = 'Salamat for repaying on time! — Moodeng Credit';

const loadClaim = async (supabase: SupabaseClient, claimId: string) => {
   const { data } = await supabase
      .from('voucher_claims')
      .select('id, status, reward, amount_php, brand, full_name, email, bitrefill_invoice_id, users(email)')
      .eq('id', claimId)
      .maybeSingle();
   return data;
};

const claimEmail = (claim: any) => {
   const accountEmail = Array.isArray(claim?.users) ? claim.users[0]?.email : claim?.users?.email;
   return String(claim?.email ?? accountEmail ?? '').trim();
};

/**
 * Bitrefill: a GrabMart voucher (the borrower picked Moo-snacks) or, as the food fallback, a Greenwich
 * voucher of the claim's value, with the borrower as the gift recipient so Bitrefill emails it. A purchase started for this claim earlier (bitrefill_invoice_id)
 * is finished instead of buying again. Returns null when Bitrefill can't be used at all (no key, no
 * real email).
 */
const sendViaBitrefill = async (supabase: SupabaseClient, claim: any, admin: string): Promise<VoucherActionResult | null> => {
   const apiKey = await getBitrefillApiKey(supabase);
   const email = claimEmail(claim);
   if (!apiKey || !email || isPlaceholderEmail(email)) return null;

   const amountPhp = Number(claim.amount_php);
   const bought = await buyBitrefillCode(
      apiKey,
      amountPhp,
      claim.bitrefill_invoice_id ?? null,
      async (invoiceId) => {
         await supabase.from('voucher_claims').update({ bitrefill_invoice_id: invoiceId }).eq('id', claim.id);
      },
      { recipientName: String(claim.full_name ?? '').trim() || 'Moodeng borrower', recipientEmail: email, message: GIFT_MESSAGE },
      claim.brand === 'grabmart' ? GRABMART_PRODUCTS : undefined
   );
   if (!bought.ok) return { ok: false, retry: true, summary: `Bitrefill: ${bought.reason}` };

   const { data: sent } = await supabase
      .from('voucher_claims')
      .update({
         status: 'sent',
         sent_at: new Date().toISOString(),
         admin_note: `Bitrefill ${bought.product} emailed by Bitrefill (invoice ${bought.invoiceId}) · sent by ${admin}`,
         updated_at: new Date().toISOString()
      })
      .eq('id', claim.id)
      .eq('status', 'pending')
      .select('id, full_name, amount_php')
      .maybeSingle();
   if (!sent) return { ok: false, summary: 'Bought on Bitrefill, but the claim was already handled — check for a double send.' };
   // Keep the code with the claim, so the dashboard can show it (Show my GrabMart code) and admin sees who got what.
   const { error: codeError } = await supabase.from('voucher_codes').insert({
      amount_php: amountPhp,
      code: bought.code,
      source: `bitrefill ${bought.product} ${bought.invoiceId}`,
      claim_id: claim.id,
      assigned_at: new Date().toISOString()
   });
   if (codeError) console.error('voucher code not recorded', claim.id, codeError.message);

   const why = claim.brand === 'grabmart' ? 'they picked GrabMart' : 'Xoxo link stock was empty';
   const summary = `✅ ${peso(amountPhp)} ${bought.product} voucher (${why}) bought on Bitrefill and emailed by Bitrefill to ${email} · by ${admin}`;
   const stamp: CardStamp = { header: voucherStampHeader('sent', sent), detail: summary, by: admin };
   await stampDecisionCards(supabase, 'voucher', claim.id, stamp);
   return { ok: true, summary, stamp };
};

/**
 * Send a pending claim: Xoxo links from the stock first (emailed by us), Bitrefill as the fallback
 * when the stock is short. A claim with a Bitrefill purchase already started stays on Bitrefill, so
 * the borrower never gets both.
 */
export const sendVoucherCode = async (supabase: SupabaseClient, claimId: string, admin: string): Promise<VoucherActionResult> => {
   const claim = await loadClaim(supabase, claimId);
   if (!claim) return { ok: false, summary: 'Claim not found.' };
   if (claim.status !== 'pending') return { ok: false, summary: `Already handled (${claim.status}).` };

   if (claim.bitrefill_invoice_id || claim.brand === 'grabmart') {
      const viaBitrefill = await sendViaBitrefill(supabase, claim, admin);
      if (viaBitrefill) return viaBitrefill;
      return { ok: false, retry: true, summary: claim.brand === 'grabmart' ? 'GrabMart needs Bitrefill (API key and a real email).' : 'Bitrefill purchase in progress, but Bitrefill is not set up.' };
   }

   const { data, error } = await supabase.rpc('assign_voucher_codes', { p_claim_id: claimId, p_admin: admin });
   if (error) return { ok: false, retry: true, summary: `Couldn't send: ${error.message}` };
   if (data?.error === 'not_found') return { ok: false, summary: 'Claim not found.' };
   if (data?.error === 'not_pending') return { ok: false, summary: `Already handled (${data.status}).` };
   if (data?.error === 'out_of_stock') {
      const stock = `needs ${data.needed} ₱50 link${data.needed === 1 ? '' : 's'}, ${data.available} in stock`;
      const fallback = await sendViaBitrefill(supabase, claim, admin);
      if (fallback?.ok) return fallback;
      const why = fallback ? `; ${fallback.summary}` : '; Bitrefill fallback not available';
      return { ok: false, retry: true, summary: `Out of Xoxo links (${stock})${why}.` };
   }
   const links: string[] = Array.isArray(data?.codes) ? data.codes.map(String) : [];
   if (data?.error || !links.length) return { ok: false, retry: true, summary: `Couldn't send: ${data?.error ?? 'no link returned'}` };

   const email = typeof data.email === 'string' ? data.email.trim() : '';
   try {
      if (!email || isPlaceholderEmail(email)) throw new Error('no real email on the claim or account');
      const message = buildVoucherCodeEmail({ fullName: String(data.full_name ?? ''), amountPhp: Number(data.amount_php), reward: String(data.reward), links });
      await sendEmail(email, message.subject, message.text, message.html);
   } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await supabase.rpc('release_voucher_code', { p_claim_id: claimId, p_reason: reason.slice(0, 200) });
      return { ok: false, retry: true, summary: `Email failed (${reason.slice(0, 120)}). Links returned to stock; claim still pending.` };
   }

   const remaining = Number(data.remaining ?? 0);
   const stock = `${remaining} ₱50 link${remaining === 1 ? '' : 's'} left${remaining <= LOW_STOCK ? ' ⚠️ restock soon' : ''}`;
   const summary = `✅ ${peso(data.amount_php)} food voucher (${links.length} Xoxo link${links.length === 1 ? '' : 's'}) emailed to ${email} · by ${admin} · ${stock}`;
   const stamp: CardStamp = { header: voucherStampHeader('sent', data), detail: summary, by: admin };
   await stampDecisionCards(supabase, 'voucher', claimId, stamp);
   return { ok: true, summary, stamp };
};

/** ✅ sends the voucher; ❌ rejects. Stamps the admin card. */
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
