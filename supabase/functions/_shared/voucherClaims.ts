// Food voucher claims → sent automatically, with an admin Telegram card.
// Every send also goes to the borrower on Messenger (when they linked it), and the cards carry a
// 💬 button to their SendPulse chat so the team can follow up by hand.
//
// Borrowers claim a reward in the app (public.submit_voucher_claim → voucher_claims, status 'pending').
// The notify_voucher_claim_telegram trigger hands each new claim to voucher-claim-telegram-notification,
// which sends it straight away (sendVoucherCode):
//   0. when giftaway_enabled is on: a Giftaway eGift (Jollibee Group for food, Grab for Moo-snacks)
//      that Giftaway texts and emails to them; out of credits or not set up → the steps below
//   1. one ₱50 Xoxoday reward link per ₱50 from the stock (public.voucher_codes, filled on the admin
//      Vouchers page), emailed by us; the borrower opens it and picks Jollibee, Chowking, Greenwich,
//      Mang Inasal or Red Ribbon
//   2. if the stock is short: a Greenwich voucher bought on Bitrefill, which Bitrefill emails to them
//   3. if neither works: the admin card keeps ✅ Send code / ❌ Reject to retry after restocking.
// Deciding in the admin panel instead fires notify_voucher_claim_decided, which stamps the card the
// same way (event 'decided').

import { adminUserUrl, type CardStamp, stampDecisionCards } from './adminCards.ts';
import { buyBitrefillCode, getBitrefillApiKey, GRABMART_PRODUCTS } from './bitrefill.ts';
import { sendEmail } from './email.ts';
import { getGiftawayConfig, giftawaySource, type GiftawayBrand, orderGiftawayEgift, toPhilippineMobile } from './giftaway.ts';
import { isPlaceholderEmail } from './placeholderEmail.ts';
import { type MessengerCard, messengerChatUrl, sendMessengerMessage } from './sendpulse.ts';

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

/** Where a Giftaway Jollibee Group eGift works (one code, any of these). */
export const JOLLIBEE_GROUP_BRANDS = 'Jollibee, Chowking, Mang Inasal, Greenwich, Red Ribbon, Burger King, Yoshinoya or Panda Express';

/** Warn once this many ₱50 links or fewer are left. */
export const LOW_STOCK = 5;

export type VoucherClaimRow = {
   id: string;
   user_id?: string;
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
export const buildVoucherClaimCard = (claim: VoucherClaimRow, reason?: string | null, facebook?: MessengerContact | null) =>
   [
      `${voucherPickLabel(claim.brand)} voucher to send: ${peso(claim.amount_php)}`,
      `For: ${VOUCHER_REWARD_LABELS[claim.reward] ?? claim.reward}`,
      '',
      `Name: ${claim.full_name}`,
      `Mobile (GCash): ${claim.mobile}`,
      claim.email ? `Email: ${claim.email}` : null,
      claimUsername(claim) ? `User: @${claimUsername(claim)}` : null,
      facebookLine(facebook),
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
export const buildVoucherSentCard = (claim: VoucherClaimRow, summary: string, facebook?: MessengerContact | null) =>
   [
      `${voucherPickLabel(claim.brand)} voucher sent automatically: ${peso(claim.amount_php)}`,
      `To: ${claim.full_name}${claimUsername(claim) ? ` (@${claimUsername(claim)})` : ''} · ${VOUCHER_REWARD_LABELS[claim.reward] ?? claim.reward}`,
      facebookLine(facebook),
      summary
   ]
      .filter((line) => line !== null)
      .join('\n');

type SupabaseClient = any;

// ---- Messenger: tell the borrower, and give the team a 💬 button to their chat ----------------

const SITE_URL = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
const DASHBOARD_URL = `${SITE_URL}/dashboard`;

/** Who to message: their SendPulse contact (users.messenger_psid), Facebook name and bot language. */
export type MessengerContact = { contactId: string | null; facebookName: string | null; firstName: string | null; locale: 'en' | 'fil' };

export const loadMessengerContact = async (supabase: SupabaseClient, userId: string | null | undefined): Promise<MessengerContact | null> => {
   if (!userId) return null;
   const { data: user } = await supabase
      .from('users')
      .select('messenger_psid, facebook_name, display_name, preferred_locale')
      .eq('id', userId)
      .maybeSingle();
   if (!user) return null;
   const contactId = (user.messenger_psid as string | null) ?? null;
   const { data: contact } = contactId
      ? await supabase.from('messenger_contacts').select('facebook_name, locale').eq('contact_id', contactId).maybeSingle()
      : { data: null };
   const facebookName = String(user.facebook_name ?? contact?.facebook_name ?? '').trim() || null;
   const firstWord = (value: unknown) => String(value ?? '').trim().split(/\s+/)[0] || null;
   return {
      contactId,
      facebookName,
      firstName: firstWord(user.display_name) ?? firstWord(facebookName),
      locale: (contact?.locale ?? user.preferred_locale) === 'fil' ? 'fil' : 'en'
   };
};

const facebookLine = (facebook?: MessengerContact | null) => {
   if (!facebook) return null;
   if (facebook.contactId) return `Facebook: ${facebook.facebookName ?? 'name not saved'} · tap 💬 to message them`;
   return facebook.facebookName ? `Facebook: ${facebook.facebookName} (Messenger not linked)` : 'Facebook: not linked';
};

/** The 💬 button under an admin card: opens their SendPulse chat. Null when they never linked Messenger. */
export const messengerChatButton = (facebook?: MessengerContact | null, name?: string | null) =>
   facebook?.contactId
      ? { text: `💬 Message ${(facebook.facebookName ?? name ?? 'them').split(/\s+/)[0]} on Messenger`, url: messengerChatUrl(facebook.contactId) }
      : null;

export type RewardMessengerContent = { text: string; card: MessengerCard };

// Why they got it, in Filipino (REWARD_REASONS is the English).
const REWARD_REASONS_FIL: Record<string, string> = {
   first_on_time_repayment: 'dahil on time ang una mong bayad',
   referral_inviter: 'dahil nag-invite ka ng friend na nagbayad on time',
   referral_invitee: 'dahil sumali ka gamit ang invite ng friend at nagbayad on time',
   tier_rising: 'dahil umabot na sa Rising ang Moodeng mo',
   tier_prime: 'dahil umabot na sa Prime ang Moodeng mo',
   tier_apex: 'dahil umabot na sa Apex ang Moodeng mo'
};

/** "Your reward is here": the Xoxo links as card buttons, or (Bitrefill) where to find the email. */
export const buildRewardSentMessage = (input: {
   firstName: string | null;
   locale: 'en' | 'fil';
   amountPhp: number;
   reward: string;
   links: string[];
   product?: string | null;
   /** Giftaway eGift: one code for the whole value, already texted/emailed by Giftaway. */
   provider?: 'giftaway' | null;
}): RewardMessengerContent => {
   const fil = input.locale === 'fil';
   const hi = input.firstName ? ` ${input.firstName}` : '';
   const amount = `₱${input.amountPhp}`;
   const reason = (fil ? REWARD_REASONS_FIL : REWARD_REASONS)[input.reward];
   const many = input.links.length > 1;
   if (!input.links.length) {
      const what = input.product ?? 'voucher';
      return {
         text: fil
            ? `🎉 Hi${hi}! Nandito na ang ${amount} ${what} reward mo${reason ? ` ${reason}` : ''}. Salamat! Na-email ito sa iyo ng Bitrefill — tingnan ang inbox mo (pati Spam).`
            : `🎉 Hi${hi}! Your ${amount} ${what} reward is here${reason ? ` ${reason}` : ''}. Salamat! Bitrefill emailed it to you — check your inbox (and Spam).`,
         card: {
            title: fil ? `Ang ${amount} reward mo` : `Your ${amount} reward`,
            subtitle: fil ? 'Pindutin ang "I got it" pag natanggap mo na' : 'Tap "I got it" once it arrives',
            button: { title: fil ? 'Buksan ang Moodeng' : 'Open Moodeng', url: DASHBOARD_URL }
         }
      };
   }
   if (input.provider === 'giftaway') {
      const grab = input.product === 'Grab';
      const how = grab
         ? fil
            ? 'Pindutin ang button, tapos i-save ang voucher sa Grab app mo (sa phone) at gamitin sa GrabMart, GrabFood o GrabCar.'
            : 'Tap the button, then save the voucher in your Grab app (on your phone) and use it on GrabMart, GrabFood or GrabCar.'
         : fil
           ? `Pindutin ang button at ipakita ang code sa cashier ng kahit anong ${JOLLIBEE_GROUP_BRANDS.replace(' or ', ' o ')}.`
           : `Tap the button and show the code to the cashier at any ${JOLLIBEE_GROUP_BRANDS}.`;
      return {
         text: fil
            ? `🎉 Hi${hi}! Nandito na ang ${amount} ${grab ? 'Grab' : 'food'} reward mo${reason ? ` ${reason}` : ''}. Salamat!\n\n${how} (Na-text at na-email din ito sa iyo ng Giftaway.)`
            : `🎉 Hi${hi}! Your ${amount} ${grab ? 'Grab' : 'food'} reward is here${reason ? ` ${reason}` : ''}. Salamat!\n\n${how} (Giftaway also texted and emailed it to you.)`,
         card: {
            title: fil ? `Ang ${amount} ${grab ? 'Grab' : 'food'} reward mo ${grab ? '🛒' : '🍗'}` : `Your ${amount} ${grab ? 'Grab' : 'food'} reward ${grab ? '🛒' : '🍗'}`,
            subtitle: fil ? 'Valid nang 1 taon' : 'Valid for 1 year',
            button: { title: fil ? 'Buksan ang voucher' : 'Open my voucher', url: input.links[0] }
         }
      };
   }
   return {
      text: fil
         ? `🎉 Hi${hi}! Nandito na ang ${amount} food reward mo${reason ? ` ${reason}` : ''}. Salamat!\n\nPindutin ang ${many ? 'bawat button' : 'button'} sa baba, pumili ng ${FOOD_BRANDS.replace(' or ', ' o ')}, at ipakita ang code sa store. (Na-email din namin.)`
         : `🎉 Hi${hi}! Your ${amount} food reward is here${reason ? ` ${reason}` : ''}. Salamat!\n\nTap ${many ? 'each button' : 'the button'} below, pick ${FOOD_BRANDS}, and show the code at the store. (We emailed it too.)`,
      card: {
         title: fil ? `Ang ${amount} food reward mo 🍗` : `Your ${amount} food reward 🍗`,
         subtitle: fil ? 'Valid nang 1 taon' : 'Valid for 1 year',
         button: { title: many ? (fil ? 'Buksan voucher 1' : 'Open ₱50 voucher 1') : fil ? 'Buksan ang voucher' : 'Open my voucher', url: input.links[0] },
         moreButtons: input.links.slice(1, 3).map((url, i) => ({ title: fil ? `Buksan voucher ${i + 2}` : `Open ₱50 voucher ${i + 2}`, url }))
      }
   };
};

/** Daily nudges: earned but not claimed, or sent but no "I got it". */
export const buildRewardNudgeMessage = (input: {
   kind: 'unclaimed' | 'no_answer';
   firstName: string | null;
   locale: 'en' | 'fil';
   amountPhp: number;
}): RewardMessengerContent => {
   const fil = input.locale === 'fil';
   const hi = input.firstName ? ` ${input.firstName}` : '';
   const amount = `₱${input.amountPhp}`;
   if (input.kind === 'unclaimed') {
      return {
         text: fil
            ? `🎁 Hi${hi}! May ${amount} food reward ka mula sa Moodeng (Jollibee, Chowking at iba pa). I-claim mo na sa app — 1 minuto lang.`
            : `🎁 Hi${hi}! You earned a ${amount} food reward from Moodeng (Jollibee, Chowking and more). Claim it in the app — it takes 1 minute.`,
         card: {
            title: fil ? `May ${amount} reward ka! 🎁` : `You have a ${amount} reward! 🎁`,
            subtitle: fil ? 'Buksan ang Moodeng para i-claim' : 'Open Moodeng to claim it',
            button: { title: fil ? 'I-claim ang reward' : 'Claim my reward', url: DASHBOARD_URL }
         }
      };
   }
   return {
      text: fil
         ? `👋 Hi${hi}! Natanggap mo na ba ang ${amount} food voucher mo? Pindutin ang "I got it" sa app — o sabihin mo lang dito kung may problema.`
         : `👋 Hi${hi}! Did your ${amount} food voucher arrive? Tap "I got it" in the app — or just tell us here if something went wrong.`,
      card: {
         title: fil ? 'Natanggap mo na ba?' : 'Did it arrive?',
         subtitle: fil ? `Ang ${amount} food voucher mo` : `Your ${amount} food voucher`,
         button: { title: fil ? 'Buksan ang Moodeng' : 'Open Moodeng', url: DASHBOARD_URL }
      }
   };
};

/** Send it on Messenger. Never throws; 'sent' or why not ('no_contact' = never linked Messenger). */
export const messageBorrower = async (facebook: MessengerContact | null, content: RewardMessengerContent): Promise<'sent' | string> => {
   if (!facebook?.contactId) return 'no_contact';
   const result = await sendMessengerMessage(facebook.contactId, content);
   return result.ok ? 'sent' : (result.reason ?? 'send_failed');
};

/** One line for the admin card: did the bot reach them? */
export const messengerOutcomeLine = (outcome: 'sent' | string) =>
   outcome === 'sent'
      ? '💬 Messenger: told them ✓'
      : outcome === 'no_contact'
        ? '💬 Messenger: not linked — only the email went out'
        : `💬 Messenger: didn't go through (${outcome === 'send_failed' ? 'likely outside the 24h window' : outcome}) — tap 💬 to message them`;

/** Telegram line when the borrower answers "Did your Moo-meal arrive?". */
export const buildVoucherReceiptMessage = (claim: VoucherClaimRow & { received_at?: string | null }, giftawayResent: boolean | null = null) => {
   const who = `${claim.full_name}${claimUsername(claim) ? ` (@${claimUsername(claim)})` : ''}`;
   const what = `${peso(claim.amount_php)} ${voucherPickLabel(claim.brand)} voucher`;
   return claim.received_at
      ? `✅ ${who} got their ${what}.`
      : `⚠️ ${who} says their ${what} didn't arrive.\nEmail: ${claim.email ?? '—'} · Mobile: ${claim.mobile}\n${
           giftawayResent === true
              ? '🔁 Giftaway resent the eGift (text + email).'
              : giftawayResent === false
                ? "🔁 Giftaway resend didn't go through — resend from the Giftaway dashboard."
                : 'Check the email, or resend from Admin → Food vouchers.'
        }`;
};

export type VoucherDigestPerson = {
   userId?: string;
   messengerContactId?: string | null;
   // Set by the digest run: what the bot's Messenger nudge did today.
   nudge?: 'sent' | 'failed' | null;
   name: string;
   username: string | null;
   facebook: string | null;
   messenger: boolean;
   amountPhp: number | string;
   vouchers: number;
   days: number | null;
   // What they're owed and how to reach them (voucher_daily_digest from 20261028200000).
   rewards?: Array<{ reward: string; amountPhp: number | string }>;
   phone?: string | null;
   email?: string | null;
};
export type VoucherDigest = Record<'unclaimed' | 'pending' | 'not_arrived' | 'no_answer', VoucherDigestPerson[]>;

const DIGEST_LIMIT = 25;

// Short names for the digest: "Rising ₱50 + First on-time ₱50".
const REWARD_SHORT: Record<string, string> = {
   first_on_time_repayment: 'First on-time',
   referral_inviter: 'Invited a friend',
   referral_invitee: 'Joined by invite',
   tier_rising: 'Rising',
   tier_prime: 'Prime',
   tier_apex: 'Apex'
};

const digestDetails = (person: VoucherDigestPerson) => {
   const lines: string[] = [];
   if (person.rewards?.length) lines.push(`   ↳ ${person.rewards.map((r) => `${REWARD_SHORT[r.reward] ?? r.reward} ${peso(r.amountPhp)}`).join(' + ')}`);
   const email = person.email && !isPlaceholderEmail(person.email) ? person.email : null;
   const contact = [person.phone ? `📞 ${person.phone}` : null, email ? `✉️ ${email}` : null].filter(Boolean).join(' · ');
   if (contact) lines.push(`   ↳ ${contact}`);
   return lines.length ? `\n${lines.join('\n')}` : '';
};

const digestLine = (person: VoucherDigestPerson) => {
   const who = `${person.name}${person.username ? ` (@${person.username})` : ''}`;
   const fb = person.facebook ? `FB: ${person.facebook}` : person.messenger ? 'Messenger ✓' : 'no FB';
   const count = person.vouchers > 1 ? ` (${person.vouchers})` : '';
   const days = person.days === null ? '' : ` · ${person.days === 0 ? 'today' : `${person.days}d`}`;
   const nudge = person.nudge === 'sent' ? ' · 🤖 bot nudged' : person.nudge === 'failed' ? " · 🤖 bot couldn't reach" : '';
   return `• ${who} · ${peso(person.amountPhp)}${count} · ${fb}${days}${nudge}${digestDetails(person)}`;
};

const digestSection = (title: string, people: VoucherDigestPerson[]) => {
   if (!people.length) return null;
   const total = people.reduce((sum, person) => sum + Number(person.amountPhp), 0);
   const lines = people.slice(0, DIGEST_LIMIT).map(digestLine);
   if (people.length > DIGEST_LIMIT) lines.push(`…and ${people.length - DIGEST_LIMIT} more (Admin → Food vouchers)`);
   return `${title} — ${people.length} ${people.length === 1 ? 'person' : 'people'}, ${peso(total)}\n${lines.join('\n')}`;
};

/** The daily rewards-group check: who to nudge to claim, what's stuck, and who hasn't confirmed. */
export const buildVoucherDigest = (digest: VoucherDigest, linksLeft: number | null, giftawayCredits: number | null = null) => {
   const sections = [
      digestSection('🎁 Earned, not claimed yet (nudge them to claim)', digest.unclaimed ?? []),
      digestSection('⏳ Claimed, not sent yet', digest.pending ?? []),
      digestSection("⚠️ Said it didn't arrive (resend)", digest.not_arrived ?? []),
      digestSection('📭 Sent, no "I got it" yet', digest.no_answer ?? [])
   ].filter(Boolean);
   const credits = giftawayCredits === null ? '' : `${linksLeft === null ? '\n\n' : '\n'}Giftaway credits: ₱${giftawayCredits.toFixed(2)}${giftawayCredits < 500 ? ' — top up soon' : ''}`;
   const stock = `${linksLeft === null ? '' : `\n\n₱50 Xoxo links left: ${linksLeft}${linksLeft <= 5 ? ' — restock soon' : ''}`}${credits}`;
   if (!sections.length) return `🧾 Daily rewards check: nothing waiting — everyone has claimed and confirmed. 🎉${stock}`;
   const tap = Object.values(digest).some((people) => (people ?? []).length)
      ? `\n\n${Object.values(digest).some((people) => (people ?? []).some((p) => p.messengerContactId)) ? 'Tap 💬 below to message someone yourself, ' : 'Tap '}👤 to open their account.`
      : '';
   const text = `🧾 Daily rewards check\n\n${sections.join('\n\n')}${stock}${tap}`;
   // Telegram's limit is 4096 characters.
   return text.length > 4000 ? `${text.slice(0, 3900).replace(/\n[^\n]*$/, '')}\n…more in Admin → Food vouchers${stock}` : text;
};

const DIGEST_BUTTONS = 40;

/**
 * Buttons under the digest, one row per person, most urgent first: 💬 opens their Messenger chat in
 * SendPulse (only people who linked Messenger), 👤 opens their account in admin.
 */
export const buildVoucherDigestKeyboard = (digest: VoucherDigest) => {
   const seen = new Set<string>();
   const rows: Array<Array<{ text: string; url: string }>> = [];
   let count = 0;
   for (const bucket of ['not_arrived', 'pending', 'unclaimed', 'no_answer'] as const) {
      for (const person of digest[bucket] ?? []) {
         const key = person.userId ?? person.messengerContactId ?? person.name;
         if (seen.has(key)) continue;
         seen.add(key);
         const row: Array<{ text: string; url: string }> = [];
         if (person.messengerContactId) {
            const label = (person.facebook ?? person.name).split(/\s+/).slice(0, 2).join(' ');
            row.push({ text: `💬 ${label}`, url: messengerChatUrl(person.messengerContactId) });
         }
         if (person.userId) row.push({ text: `👤 ${person.name.split(/\s+/).slice(0, 2).join(' ')}`, url: adminUserUrl(person.userId, person.username) });
         if (!row.length || count + row.length > DIGEST_BUTTONS) continue;
         count += row.length;
         rows.push(row);
      }
   }
   return rows;
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
      .select('id, user_id, status, reward, amount_php, brand, full_name, mobile, email, bitrefill_invoice_id, users(email)')
      .eq('id', claimId)
      .maybeSingle();
   return data;
};

const claimEmail = (claim: any) => {
   const accountEmail = Array.isArray(claim?.users) ? claim.users[0]?.email : claim?.users?.email;
   return String(claim?.email ?? accountEmail ?? '').trim();
};

const isGiftawayEnabled = async (supabase: SupabaseClient) => {
   const { data } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'giftaway_enabled').maybeSingle();
   return String(data?.value ?? '').trim().toLowerCase() === 'true';
};

/**
 * Giftaway: one eGift of the claim's value (Jollibee Group for food, Grab for Moo-snacks), texted and
 * emailed to the borrower by Giftaway. Returns null when Giftaway is off, not set up, out of credits
 * or can't reach them, so the caller falls back to Xoxo links / Bitrefill.
 */
const sendViaGiftaway = async (supabase: SupabaseClient, claim: any, admin: string): Promise<VoucherActionResult | null> => {
   if (claim.bitrefill_invoice_id || !(await isGiftawayEnabled(supabase))) return null;
   const config = await getGiftawayConfig(supabase);
   if (!config) return null;
   const email = claimEmail(claim);
   const amountPhp = Number(claim.amount_php);
   const brand: GiftawayBrand = claim.brand === 'grabmart' ? 'grabmart' : 'food';
   const order = await orderGiftawayEgift(config, claim.id, brand, amountPhp, {
      name: String(claim.full_name ?? ''),
      mobile: toPhilippineMobile(claim.mobile),
      email: email && !isPlaceholderEmail(email) ? email : null,
      message: GIFT_MESSAGE,
      tags: `moodeng,${claim.reward}`
   });
   if (!order.ok) {
      console.error('giftaway order failed', claim.id, order.reason);
      if (order.uncertain) return { ok: false, retry: true, summary: `Giftaway didn't answer (${order.reason}). Tap again — a retry finds the same order, never a second one.` };
      return null;
   }

   const { data: sent } = await supabase
      .from('voucher_claims')
      .update({
         status: 'sent',
         sent_at: new Date().toISOString(),
         admin_note: `Giftaway ${order.product} eGift (order ${order.orderId}) texted/emailed by Giftaway · sent by ${admin}`,
         updated_at: new Date().toISOString()
      })
      .eq('id', claim.id)
      .eq('status', 'pending')
      .select('id, full_name, amount_php')
      .maybeSingle();
   if (!sent) return { ok: false, summary: `Ordered on Giftaway (order ${order.orderId}), but the claim was already handled — check for a double send.` };
   // Keep the eGift link with the claim: the dashboard shows it (Open my voucher) and admin sees who got what.
   const { error: codeError } = await supabase.from('voucher_codes').insert(
      order.urls.map((url) => ({
         amount_php: amountPhp / order.urls.length,
         code: url,
         source: giftawaySource(order),
         claim_id: claim.id,
         assigned_at: new Date().toISOString()
      }))
   );
   if (codeError) console.error('giftaway link not recorded', claim.id, codeError.message);

   const facebook = await loadMessengerContact(supabase, claim.user_id);
   const told = await messageBorrower(
      facebook,
      buildRewardSentMessage({
         firstName: facebook?.firstName ?? null,
         locale: facebook?.locale ?? 'en',
         amountPhp,
         reward: claim.reward,
         links: order.urls,
         product: order.product,
         provider: 'giftaway'
      })
   );
   const to = [toPhilippineMobile(claim.mobile), email && !isPlaceholderEmail(email) ? email : null].filter(Boolean).join(' + ');
   const credits = order.creditsLeft === null ? '' : ` · ₱${order.creditsLeft.toFixed(2)} Giftaway credits left${order.creditsLeft < 500 ? ' ⚠️ top up soon' : ''}`;
   const summary = `✅ ${peso(amountPhp)} ${order.product} eGift ordered on Giftaway (order ${order.orderId}) and sent by Giftaway to ${to} · by ${admin}${credits}\n${messengerOutcomeLine(told)}`;
   const stamp: CardStamp = { header: voucherStampHeader('sent', sent), detail: summary, by: admin };
   await stampDecisionCards(supabase, 'voucher', claim.id, stamp);
   return { ok: true, summary, stamp };
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
   const facebook = await loadMessengerContact(supabase, claim.user_id);
   const told = await messageBorrower(
      facebook,
      buildRewardSentMessage({ firstName: facebook?.firstName ?? null, locale: facebook?.locale ?? 'en', amountPhp, reward: claim.reward, links: [], product: bought.product })
   );
   const summary = `✅ ${peso(amountPhp)} ${bought.product} voucher (${why}) bought on Bitrefill and emailed by Bitrefill to ${email} · by ${admin}\n${messengerOutcomeLine(told)}`;
   const stamp: CardStamp = { header: voucherStampHeader('sent', sent), detail: summary, by: admin };
   await stampDecisionCards(supabase, 'voucher', claim.id, stamp);
   return { ok: true, summary, stamp };
};

/**
 * Send a pending claim: a Giftaway eGift when that's on and has credits, else Xoxo links from the
 * stock (emailed by us), Bitrefill as the fallback
 * when the stock is short. A claim with a Bitrefill purchase already started stays on Bitrefill, so
 * the borrower never gets both.
 */
export const sendVoucherCode = async (supabase: SupabaseClient, claimId: string, admin: string): Promise<VoucherActionResult> => {
   const claim = await loadClaim(supabase, claimId);
   if (!claim) return { ok: false, summary: 'Claim not found.' };
   if (claim.status !== 'pending') return { ok: false, summary: `Already handled (${claim.status}).` };

   const viaGiftaway = await sendViaGiftaway(supabase, claim, admin);
   if (viaGiftaway) return viaGiftaway;

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
   const facebook = await loadMessengerContact(supabase, claim.user_id);
   const told = await messageBorrower(
      facebook,
      buildRewardSentMessage({ firstName: facebook?.firstName ?? null, locale: facebook?.locale ?? 'en', amountPhp: Number(data.amount_php), reward: String(data.reward), links })
   );
   const summary = `✅ ${peso(data.amount_php)} food voucher (${links.length} Xoxo link${links.length === 1 ? '' : 's'}) emailed to ${email} · by ${admin} · ${stock}\n${messengerOutcomeLine(told)}`;
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
