// Bitrefill API (personal key, Account → Developers on bitrefill.com): the food voucher fallback when
// the Xoxo link stock is empty. Buys a ₱50/₱100 voucher paid from the account balance (BTC) and has
// Bitrefill email it to the borrower. https://docs.bitrefill.com/docs/quickstart-2
//
// The key lives in the DB vault as BITREFILL_API_KEY (edge function secrets are at their cap); the
// BITREFILL_API_KEY env var wins when set.

const BASE_URL = 'https://api.bitrefill.com/v2';

// Tried in order; both sell ₱50 and ₱100 and work nationwide (dine-in / take-out, one-time use).
// Package ids look like 'greenwich-philippines<&>50' (checked 2026-10-26).
export type BitrefillProduct = { id: string; name: string };

export const FALLBACK_PRODUCTS: BitrefillProduct[] = [
   { id: 'greenwich-philippines', name: 'Greenwich' },
   { id: 'red-ribbon-php', name: 'Red Ribbon' }
];

// Moo-Menu "Moo-snacks": ₱100–₱5,000, no minimum basket, Metro Manila and Cebu only (Bitrefill terms).
export const GRABMART_PRODUCTS: BitrefillProduct[] = [{ id: 'grabmart-gift-card-philippines', name: 'GrabMart' }];

type SupabaseClient = any;

export const getBitrefillApiKey = async (supabase: SupabaseClient): Promise<string | null> => {
   const fromEnv = Deno.env.get('BITREFILL_API_KEY')?.trim();
   if (fromEnv) return fromEnv;
   const { data } = await supabase.rpc('bitrefill_api_key');
   return typeof data === 'string' && data.trim() ? data.trim() : null;
};

const call = async (apiKey: string, path: string, init?: RequestInit) => {
   const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
   });
   const body = await response.json().catch(() => null);
   if (!response.ok) {
      const message = body?.message ?? body?.error?.message ?? body?.error ?? response.statusText;
      throw new Error(`${response.status} ${String(message).slice(0, 160)}`);
   }
   return body?.data;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The first of `products` in stock with a package of this ₱ value. */
const findPackage = async (apiKey: string, amountPhp: number, products: BitrefillProduct[]) => {
   for (const candidate of products) {
      const product = await call(apiKey, `/products/${candidate.id}`).catch(() => null);
      if (!product || product.in_stock === false) continue;
      const match = (product.packages ?? []).find((p: { value?: unknown }) => Number(p.value) === amountPhp);
      const packageId = match?.package_id ?? match?.id;
      if (packageId) return { productId: candidate.id, name: candidate.name, packageId: String(packageId) };
   }
   throw new Error(`no ₱${amountPhp} ${products.map((p) => p.name).join('/')} voucher in stock on Bitrefill`);
};

const codeFromInvoice = async (apiKey: string, invoice: any): Promise<string | null> => {
   const orderId = invoice?.orders?.[0]?.id;
   if (!orderId) return null;
   const order = await call(apiKey, `/orders/${orderId}`);
   // An eGift comes as a code or, for some brands, a link.
   const code = order?.redemption_info?.code ?? order?.redemption_info?.pin ?? order?.redemption_info?.link;
   return typeof code === 'string' && code.trim() ? code.trim() : null;
};

export type BitrefillPurchase = { ok: true; code: string; invoiceId: string; product: string } | { ok: false; reason: string };

/** Bitrefill emails the voucher straight to this person (its "gift" delivery). */
export type BitrefillGift = { recipientName: string; recipientEmail: string; message?: string };

/**
 * Buy one food voucher of `amountPhp` from the balance, delivered by Bitrefill to `gift`'s email,
 * or finish `existingInvoiceId` (a purchase started earlier that hadn't delivered yet). `onInvoice`
 * records a new invoice id before waiting, so a retry never pays twice. Waits up to ~20s for delivery.
 */
export const buyBitrefillCode = async (
   apiKey: string,
   amountPhp: number,
   existingInvoiceId: string | null,
   onInvoice: (invoiceId: string) => Promise<void>,
   gift?: BitrefillGift,
   products: BitrefillProduct[] = FALLBACK_PRODUCTS
): Promise<BitrefillPurchase> => {
   try {
      let product = 'food';
      let invoice = existingInvoiceId ? await call(apiKey, `/invoices/${existingInvoiceId}`) : null;
      if (!invoice || ['expired', 'failed', 'cancelled'].includes(String(invoice.status))) {
         const pick = await findPackage(apiKey, amountPhp, products);
         product = pick.name;
         invoice = await call(apiKey, '/invoices', {
            method: 'POST',
            body: JSON.stringify({
               products: [{ product_id: pick.productId, package_id: pick.packageId, quantity: 1 }],
               payment_method: 'balance',
               auto_pay: true,
               ...(gift
                  ? {
                       gift: {
                          recipient_name: gift.recipientName,
                          recipient_email: gift.recipientEmail,
                          sender_name: 'Moodeng Credit',
                          ...(gift.message ? { message: gift.message } : {})
                       }
                    }
                  : {})
            })
         });
         if (!invoice?.id) return { ok: false, reason: 'invoice not created' };
         await onInvoice(String(invoice.id));
      }

      for (let attempt = 0; attempt < 6; attempt++) {
         const code = await codeFromInvoice(apiKey, invoice);
         if (code) return { ok: true, code, invoiceId: String(invoice.id), product };
         if (['expired', 'failed', 'cancelled'].includes(String(invoice.status))) {
            return { ok: false, reason: `invoice ${invoice.id} ${invoice.status} (balance too low?)` };
         }
         await sleep(3500);
         invoice = await call(apiKey, `/invoices/${invoice.id}`);
      }
      return { ok: false, reason: `invoice ${invoice.id} still ${invoice.status} — tap again in a minute` };
   } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
   }
};
