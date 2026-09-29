import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/i18n';
import { WALLET_SAFETY_COPY } from '@/views/account/walletSafetyCopy';

describe('WALLET_SAFETY_COPY', () => {
   it.each(SUPPORTED_LOCALES.map((l) => l.code))('%s keeps the loan count and wallet list', (code) => {
      const copy = WALLET_SAFETY_COPY[code];
      expect(copy.borrowerBlocked(2, 'change')).toContain('2');
      expect(copy.lenderWarning(3, '0x12…ab', 'disconnect')).toContain('0x12…ab');
      expect(copy.lenderWarning(1, '', 'change')).not.toContain('()');
      expect(copy.usingNonBaseWallet('MetaMask')).toContain('MetaMask');
   });

   it('keeps the original English wording', () => {
      expect(WALLET_SAFETY_COPY.en.borrowerBlocked(1, 'disconnect')).toBe(
         "You have 1 active loan still to repay. You can't disconnect your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to."
      );
   });
});
