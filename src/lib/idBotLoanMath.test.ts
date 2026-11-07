import { describe, expect, it } from 'vitest';

import { idRepayIdrBounds, idRepayIdrChoices, idUsdForIdr } from '@/lib/loanMarket';

// The Telegram bot (supabase/functions/_shared/idLoanMath.ts) offers the same rupiah chips as the app. That file is a copy (Deno can't import src/), so check they agree.
import * as bot from '../../supabase/functions/_shared/idLoanMath.ts';

describe('Telegram bot loan maths = app loan maths', () => {
   const rates = [14000, 15123.45, 15800, 16250, 16321.5, 16500, 16777.77, 17000, 18100, 19999];
   it('rupiah bounds and chips', () => {
      for (const rate of rates) {
         for (const amount of [5, 7.5, 10, 15, 20]) {
            expect(bot.idRepayIdrBounds(amount, rate)).toEqual(idRepayIdrBounds(amount, rate));
            expect(bot.idRepayIdrChoices(amount, rate)).toEqual(idRepayIdrChoices(amount, rate));
            expect(bot.idUsdForIdr(110000, rate)).toEqual(idUsdForIdr(110000, rate));
         }
      }
      expect(bot.idRepayIdrChoices(5, null)).toEqual([]);
   });

});
