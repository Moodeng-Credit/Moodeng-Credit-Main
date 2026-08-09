/**
 * Stripe fiat-to-crypto onramp configuration.
 *
 * Stripe is the merchant of record for these purchases — it owns KYC, sanctions screening,
 * and all fraud/dispute liability — so the card flow can be embedded directly in the app
 * rather than bounced to a popup the way Coinbase's onramp has to be.
 *
 * Availability is narrower than Coinbase's, though: per Stripe's embedded-onramp docs the
 * onramp only supports customers in the **EU and the US (excluding Hawaii)**. Canada is not
 * on that list. The card is still rendered for everyone because the honest check is
 * server-side — Stripe resolves supportability from `customer_ip_address` at session
 * creation and returns `crypto_onramp_unsupported_country` /
 * `crypto_onramp_unsupportable_customer`, which the sheet surfaces as a real message
 * pointing the customer at Coinbase instead.
 */

/**
 * Publishable key. This is a *publishable* Stripe key: it is designed to ship in the client
 * bundle and identifies the account to Stripe — it grants no ability to move money. The
 * secret key (`sk_live_…`) lives only in Supabase secrets, read by the
 * `stripe-onramp-session` edge function, and must never reach the browser.
 *
 * Overridable per-environment so a sandbox `pk_test_…` key can be used without a code change.
 */
export const STRIPE_PUBLISHABLE_KEY =
   (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim() ||
   'pk_live_51TgNd7ApwnjLeRIkzlcVLz5CX5kzjAhrfNs4K6LvqrJ1z6yt6mvTfFb4lBDPu3ijWEN581Fm16qUaYWVeW2J88y400X9bGjHqb';

/** Base is a first-class `destination_network` in the Onramp API, and USDC settles on it. */
export const STRIPE_DESTINATION_NETWORK = 'base' as const;
export const STRIPE_DESTINATION_CURRENCY = 'usdc' as const;

/** Fiat currencies the Onramp API accepts today. USD covers the US; EUR covers the EU. */
export const STRIPE_SOURCE_CURRENCY = 'usd' as const;

/**
 * Regions shown on the funding card. Sourced from Stripe's embedded-onramp availability
 * statement ("only available in the EU and the US (excluding Hawaii)") — deliberately not
 * Canada, which Coinbase covers and Stripe does not.
 */
export const STRIPE_SUPPORTED_REGION_CODES = ['US', 'EU'] as const;

/** Shown under the region flags so the Hawaii carve-out isn't a surprise at checkout. */
export const STRIPE_REGION_FOOTNOTE = 'US (excl. Hawaii) and EU only';

/** Error codes the edge function forwards from Stripe when it can't serve the customer. */
export const STRIPE_UNSUPPORTED_REGION_CODE = 'UNSUPPORTED_REGION';
