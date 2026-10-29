// Giftaway Ordering API (giftaway.ph, account george@moodeng.app): the first choice for reward vouchers.
// One order = one eGift that Giftaway texts and emails to the borrower (a gft.ph link with the code).
//   food     → Jollibee Group eGift of the claim's value (one code works at Jollibee, Chowking, Mang
//              Inasal, Greenwich, Red Ribbon, Burger King, Yoshinoya and Panda Express; ₱50 and up)
//   grabmart → Grab eGift of that denomination (GrabMart, GrabFood, GrabCar, GrabExpress; ₱50 and up)
// Paid from prepaid credits (top up via PayPal or bank transfer); costs value + 10% fee + VAT on the fee.
// API reference: "Public APIs.pdf" from Justin Hirang (solutions@giftaway.ph), 2026-10-22.
//
// The keys live in the DB vault as one JSON secret GIFTAWAY ({ api_key, private_key, email, sender_mobile }), read
// through public.giftaway_config() (edge function secrets are at their cap).

const BASE_URL = 'https://giftaway.ph/api';

export const GIFTAWAY_MERCHANTS = {
   food: { id: 7199, name: 'Jollibee Group', byValue: true },
   grabmart: { id: 7474, name: 'Grab', byValue: false }
} as const;

export type GiftawayBrand = keyof typeof GIFTAWAY_MERCHANTS;
// senderMobile: Giftaway refuses orders without one (107 "Invalid Sender Mobile"); a +66 number works.
export type GiftawayConfig = { apiKey: string; privateKey: string; email: string; senderMobile: string };

type SupabaseClient = any;

export const getGiftawayConfig = async (supabase: SupabaseClient): Promise<GiftawayConfig | null> => {
   const { data } = await supabase.rpc('giftaway_config');
   const apiKey = String(data?.api_key ?? '').trim();
   const privateKey = String(data?.private_key ?? '').trim();
   const email = String(data?.email ?? '').trim();
   const senderMobile = String(data?.sender_mobile ?? '').trim();
   return apiKey && privateKey && email && senderMobile ? { apiKey, privateKey, email, senderMobile } : null;
};

export const sha1Hex = async (value: string) => {
   const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
   return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

/** Our reference for a claim's order: the same claim always gets the same one, so Giftaway refuses a second order (117). */
export const giftawayReference = (claimId: string) => `MDNG-${claimId}`;

/** Giftaway wants an 11-digit PH mobile (09XXXXXXXXX); null when the number isn't one. */
export const toPhilippineMobile = (value: string | null | undefined) => {
   const digits = String(value ?? '').replace(/\D/g, '');
   const local = digits.startsWith('63') && digits.length === 12 ? `0${digits.slice(2)}` : digits.length === 10 && digits.startsWith('9') ? `0${digits}` : digits;
   return /^09\d{9}$/.test(local) ? local : null;
};

/** Names must be at least two words (status 105/108). */
export const twoWordName = (value: string | null | undefined, fallback = 'Moodeng Borrower') => {
   const name = String(value ?? '')
      .replace(/[^\p{L}\p{M}\s.'-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
   if (!name) return fallback;
   return name.includes(' ') ? name : `${name} Moodeng`;
};

const STATUS_MESSAGES: Record<number, string> = {
   101: 'invalid API key',
   102: 'invalid merchant',
   103: 'invalid items',
   107: 'invalid sender mobile',
   108: 'invalid recipient name',
   109: 'invalid recipient email',
   110: 'invalid recipient mobile',
   111: 'invalid secure hash',
   112: 'invalid denomination',
   113: 'amount not allowed for this merchant',
   116: 'not enough Giftaway credits — top up',
   117: 'duplicate reference'
};

const describe = (body: any) => {
   const code = Number(body?.status_code);
   return STATUS_MESSAGES[code] ?? `${code || '?'} ${String(body?.status ?? body?.status_description ?? 'failed').slice(0, 120)}`;
};

const getJson = async (path: string) => {
   const response = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(60_000) });
   if (!response.ok) throw new Error(`Giftaway ${response.status}`);
   return response.json();
};

const postJson = async (path: string, body: Record<string, unknown>) => {
   const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000)
   });
   if (!response.ok) throw new Error(`Giftaway ${response.status}`);
   return response.json();
};

/** Remaining prepaid credits in ₱, or null when the call fails. */
export const getGiftawayBalance = async (config: GiftawayConfig): Promise<number | null> => {
   try {
      const body = await postJson('/account/balance', { api_key: config.apiKey, token: await sha1Hex(`${config.privateKey}:${config.email}`) });
      const balance = Number(body?.account?.remaining_balance);
      return Number(body?.status_code) === 100 && Number.isFinite(balance) ? balance : null;
   } catch {
      return null;
   }
};

/** The order already placed for this reference (a retry after 117, or a timeout that went through). */
const findOrder = async (config: GiftawayConfig, referenceNo: string): Promise<{ orderId: string; urls: string[] } | null> => {
   const body = await getJson(`/order/details?apikey=${encodeURIComponent(config.apiKey)}&referenceno=${encodeURIComponent(referenceNo)}`).catch(() => null);
   const urls = (body?.items ?? []).map((item: { url?: unknown }) => String(item?.url ?? '')).filter(Boolean);
   return body?.order_id && urls.length ? { orderId: String(body.order_id), urls } : null;
};

const grabDenominationId = async (config: GiftawayConfig, amountPhp: number) => {
   const info = await getJson(`/merchant/info?apiKey=${encodeURIComponent(config.apiKey)}&merchantId=${GIFTAWAY_MERCHANTS.grabmart.id}`);
   const match = (info?.denominations ?? []).find((d: { value?: unknown }) => Number(d.value) === amountPhp);
   if (!match?.denomination_id) throw new Error(`no ₱${amountPhp} Grab eGift on Giftaway`);
   return Number(match.denomination_id);
};

export type GiftawayOrder =
   | { ok: true; orderId: string; referenceNo: string; urls: string[]; product: string; creditsLeft: number | null }
   | {
        ok: false;
        reason: string;
        outOfCredits?: boolean;
        // The order request went out but no answer came back: it may have gone through. Retry (same
        // reference, so never charged twice) instead of sending something else.
        uncertain?: boolean;
     };

export type GiftawayRecipient = { name: string; mobile: string | null; email: string | null; message?: string; tags?: string };

/**
 * Order one eGift of `amountPhp` for `claimId`, delivered by Giftaway to the recipient's mobile and/or
 * email. Safe to retry: the reference is fixed per claim, so a second try returns the first order.
 */
export const orderGiftawayEgift = async (
   config: GiftawayConfig,
   claimId: string,
   brand: GiftawayBrand,
   amountPhp: number,
   recipient: GiftawayRecipient
): Promise<GiftawayOrder> => {
   const merchant = GIFTAWAY_MERCHANTS[brand];
   const referenceNo = giftawayReference(claimId);
   if (!recipient.mobile && !recipient.email) return { ok: false, reason: 'no PH mobile or real email to deliver to' };
   let ordering = false;
   try {
      const existing = await findOrder(config, referenceNo);
      if (existing) return { ok: true, ...existing, referenceNo, product: merchant.name, creditsLeft: null };

      const items = merchant.byValue ? `[[${amountPhp},1]]` : `[[${await grabDenominationId(config, amountPhp)},1]]`;
      ordering = true;
      const body = await postJson('/order/process', {
         apikey: config.apiKey,
         ...(merchant.byValue ? { merchantid: merchant.id } : {}),
         items,
         referenceno: referenceNo,
         sendername: 'Moodeng Credit',
         senderemail: 'support@moodeng.app',
         sendermobile: config.senderMobile,
         recipientname: twoWordName(recipient.name),
         ...(recipient.mobile ? { recipientmobile: recipient.mobile } : {}),
         ...(recipient.email ? { recipientemail: recipient.email } : {}),
         securehash: await sha1Hex(`${config.apiKey}:${referenceNo}:${amountPhp}:${config.privateKey}`),
         ...(recipient.message ? { message: recipient.message.slice(0, 300) } : {}),
         ...(recipient.tags ? { tags: recipient.tags } : {})
      });
      ordering = false;
      const code = Number(body?.status_code);
      if (code === 117) {
         const placed = await findOrder(config, referenceNo);
         if (placed) return { ok: true, ...placed, referenceNo, product: merchant.name, creditsLeft: null };
      }
      const urls = Array.isArray(body?.urls) ? body.urls.map(String).filter(Boolean) : [];
      if (code !== 100 || !urls.length) return { ok: false, reason: describe(body), outOfCredits: code === 116 };
      const creditsLeft = Number(body?.credits_balance);
      return { ok: true, orderId: String(body.order_id), referenceNo, urls, product: merchant.name, creditsLeft: Number.isFinite(creditsLeft) ? creditsLeft : null };
   } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err), uncertain: ordering };
   }
};

/** Ask Giftaway to send an order's eGift again (borrower tapped "Didn't get it"). */
export const resendGiftawayOrder = async (config: GiftawayConfig, referenceNo: string, orderId: string) => {
   try {
      const body = await getJson(
         `/order/resend?apikey=${encodeURIComponent(config.apiKey)}&referenceno=${encodeURIComponent(referenceNo)}&orderid=${encodeURIComponent(orderId)}`
      );
      return String(body?.status ?? '').toLowerCase() === 'successful';
   } catch {
      return false;
   }
};

/** voucher_codes.source for a Giftaway eGift, and back: "giftaway <orderId> <referenceNo> <product>". */
export const giftawaySource = (order: { orderId: string; referenceNo: string; product: string }) => `giftaway ${order.orderId} ${order.referenceNo} ${order.product}`;

export const parseGiftawaySource = (source: string | null | undefined) => {
   const match = String(source ?? '').match(/^giftaway (\S+) (\S+)/);
   return match ? { orderId: match[1], referenceNo: match[2] } : null;
};
