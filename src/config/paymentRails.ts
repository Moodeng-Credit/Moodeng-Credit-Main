/**
 * Cash-in / cash-out rails that are temporarily switched off.
 *
 * Coins.ph was suspended by the Bangko Sentral ng Pilipinas on 2026-09-30 (InstaPay/PESONet
 * blocked transfers to DCPay, its licensed e-money entity), so cash-ins and cash-outs there
 * don't work. Its tile stays visible but greyed out, and all of its steps, guides and videos
 * are kept intact — flip COINS_PH_SUSPENDED back to false to bring everything back as it was.
 */
export const COINS_PH_SUSPENDED = true;

export const COINS_PH_SUSPENDED_TITLE = 'Coins.ph is temporarily paused';
export const COINS_PH_SUSPENDED_MESSAGE =
   "Coins.ph has been temporarily suspended by the Philippine government, so cash-ins and cash-outs there aren't working right now. It'll be back — we'll update this as soon as it is. Until then, please use PDAX or GCrypto (GCash).";
