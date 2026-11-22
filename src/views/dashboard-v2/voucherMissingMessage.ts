import type { VoucherClaimSummary } from '@/lib/friendReferrals';

/** What they paste into our Messenger chat when a voucher didn't arrive. The team sees it as a support ticket. */
export const voucherMissingMessage = (claim: Pick<VoucherClaimSummary, 'id' | 'amountPhp' | 'brand' | 'status'>) =>
   `Hi Moodeng! ${claim.status === 'pending' ? 'I claimed my' : "I didn't get my"} ₱${claim.amountPhp} ${
      claim.brand === 'grabmart' ? 'GrabMart' : 'food'
   } voucher${claim.status === 'pending' ? " and it hasn't arrived yet" : ''}. Voucher ID: ${claim.id.slice(0, 8).toUpperCase()}`;
