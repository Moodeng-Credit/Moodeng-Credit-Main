import { describe, expect, it } from 'vitest';

import { parseVoucherCodes } from '@/app/admin/voucherCodes';

describe('parseVoucherCodes', () => {
   it('takes one code per line and trims them', () => {
      expect(parseVoucherCodes('  ABCD-1234 \nEFGH-5678\n')).toEqual(['ABCD-1234', 'EFGH-5678']);
   });

   it('drops blank lines and repeats, keeping the pasted order', () => {
      expect(parseVoucherCodes('B2\n\nA1\nB2\r\n\nC3')).toEqual(['B2', 'A1', 'C3']);
   });

   it('also splits a spreadsheet column or a comma list', () => {
      expect(parseVoucherCodes('A1\tB2,C3')).toEqual(['A1', 'B2', 'C3']);
   });

   it('keeps a redemption link whole', () => {
      expect(parseVoucherCodes('https://gift.grab.com/redeem?c=XY12')).toEqual(['https://gift.grab.com/redeem?c=XY12']);
   });
});
