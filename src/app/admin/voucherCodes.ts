/** Value of one Xoxo link in the stock: rewards are ₱50 (one link) or ₱100 (two). */
export const VOUCHER_LINK_PHP = 50;

/**
 * Links pasted on the admin Vouchers page: one per line (commas and tabs also split, so a column
 * copied from a spreadsheet works). Trims, drops blanks and repeats, keeps the pasted order.
 */
export const parseVoucherCodes = (input: string): string[] => {
   const seen = new Set<string>();
   const codes: string[] = [];
   for (const raw of input.split(/[\n\r,\t]+/)) {
      const code = raw.trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
   }
   return codes;
};
