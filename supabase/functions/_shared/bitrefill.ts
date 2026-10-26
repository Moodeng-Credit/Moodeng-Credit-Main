// Bitrefill API (personal key, Account → Developers on bitrefill.com): buys GrabMart PH codes paid
// from the account balance. https://docs.bitrefill.com/docs/quickstart-2
//
// The key lives in the DB vault as BITREFILL_API_KEY (edge function secrets are at their cap); the
// BITREFILL_API_KEY env var wins when set.

const BASE_URL = 'https://api.bitrefill.com/v2';

// https://www.bitrefill.com/ph/en/gift-cards/grabmart-gift-card-philippines/ — ₱100 to ₱5,000, no
// minimum basket, one code per order, Metro Manila and Cebu only. Paid in BTC from the balance.
export const GRABMART_PRODUCT_ID = 'grabmart-gift-card-philippines';

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

/** The package of a given ₱ value, e.g. "grabmart-gift-card-philippines<&>100". */
const findPackageId = async (apiKey: string, amountPhp: number) => {
   const product = await call(apiKey, `/products/${GRABMART_PRODUCT_ID}`);
   // Packages look like { id: 'grabmart-gift-card-philippines<&>100', value: '100', amount: 100 } (checked 2026-10-26).
   const match = (product?.packages ?? []).find((p: { value?: unknown }) => Number(p.value) === amountPhp);
   const packageId = match?.package_id ?? match?.id;
   if (!packageId) throw new Error(`no ₱${amountPhp} package for ${GRABMART_PRODUCT_ID}`);
   return String(packageId);
};

const codeFromInvoice = async (apiKey: string, invoice: any): Promise<string | null> => {
   const orderId = invoice?.orders?.[0]?.id;
   if (!orderId) return null;
   const order = await call(apiKey, `/orders/${orderId}`);
   // GrabMart eGifts come as a code or, when Grab has none, a link to add in the Grab app.
   const code = order?.redemption_info?.code ?? order?.redemption_info?.pin ?? order?.redemption_info?.link;
   return typeof code === 'string' && code.trim() ? code.trim() : null;
};

export type BitrefillPurchase = { ok: true; code: string; invoiceId: string } | { ok: false; reason: string };

/** Bitrefill emails the voucher straight to this person (its "gift" delivery). */
export type BitrefillGift = { recipientName: string; recipientEmail: string; message?: string };

/**
 * Buy one GrabMart PH voucher of `amountPhp` from the balance, delivered by Bitrefill to `gift`'s email,
 * or finish `existingInvoiceId` (a purchase started earlier that hadn't delivered yet). `onInvoice`
 * records a new invoice id before waiting, so a retry never pays twice. Waits up to ~20s for delivery.
 */
export const buyBitrefillCode = async (
   apiKey: string,
   amountPhp: number,
   existingInvoiceId: string | null,
   onInvoice: (invoiceId: string) => Promise<void>,
   gift?: BitrefillGift
): Promise<BitrefillPurchase> => {
   try {
      let invoice = existingInvoiceId ? await call(apiKey, `/invoices/${existingInvoiceId}`) : null;
      if (!invoice || ['expired', 'failed', 'cancelled'].includes(String(invoice.status))) {
         const packageId = await findPackageId(apiKey, amountPhp);
         invoice = await call(apiKey, '/invoices', {
            method: 'POST',
            body: JSON.stringify({
               products: [{ product_id: GRABMART_PRODUCT_ID, package_id: packageId, quantity: 1 }],
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
         if (code) return { ok: true, code, invoiceId: String(invoice.id) };
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
