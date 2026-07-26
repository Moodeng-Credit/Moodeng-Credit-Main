import { describe, expect, it } from 'vitest';

import { checkReasonQuality } from '@/lib/reasonQuality';

/**
 * The English rule is the one check here that can wrongly stop a real borrower: a false
 * positive means someone who wrote a perfectly good English reason is told to write it in
 * English. These two corpora are the guard rail — English reasons in the register our
 * borrowers actually use (Philippine English, borrowed nouns, SMS-ish punctuation) must all
 * pass, and Tagalog/Taglish must all fail.
 */

const ENGLISH_REASONS = [
   'Rent balance is due on Friday and I am short by thirty dollars',
   'I need to buy medicine for my mother and pay for the jeepney to the clinic',
   'Buying school supplies and uniform for my son before classes start',
   'My phone load and fare to work until my salary comes on the 15th',
   'Paying the electricity bill this month, it is due on the 20th',
   'I want to buy stock for my sari-sari store, mostly rice and canned goods',
   'Emergency dental work, I chipped a tooth and the clinic asks for a deposit',
   'Repair of my tricycle engine so I can go back to driving next week',
   'Buying gamot for my mother, she needs it before Friday',
   'Need to cover my internet bill for online work, due on Monday',
   'Paying for my nursing board exam review fees this month',
   'Groceries for the family until my next payday on Nov 30',
   'My kid has a fever and we need money for the doctor and medicine',
   'I am short on the down payment for a second hand laptop for my job',
   'To pay the PO for my supplier before they release the goods',
   'Transport and food while I attend a two week training in Manila',
   'Fixing the leak in our roof before the rainy season starts',
   'I need capital to buy vegetables to resell at the palengke on Saturday',
   'Saving up for the para athletics meet entry fee in March',
   'Paying back my cousin who covered my hospital bill last month',
   'Buying a water pump for our small farm, mine broke last week',
   'I need money for my daughter tuition balance so she can take exams',
   // Collisions with the marker list, in text that is plainly English:
   'Milk for my 6 mo old baby and the PO I owe the store',
   'I owe Kay for the hospital bill and need to pay her back by Friday',
   'Paying for my Hindi language class and the books that go with it',
   'Filling in the NA fields on my permit renewal and paying the fee'
];

const NOT_ENGLISH_REASONS = [
   'Pambayad sa tuition ng anak ko, sahod ako sa Friday',
   'Kailangan ko ng pambili ng gamot para sa nanay ko',
   'Pang bayad sa kuryente namin ngayong buwan',
   'Pambili ng bigas at ulam para sa pamilya ko',
   'Gusto ko sana mag start ng maliit na negosyo sa bahay',
   'Para sa pamasahe ko papunta sa trabaho hanggang sahod',
   'Ipapaayos ko ang motor ko para makapag hanapbuhay ulit',
   'Wala na kaming pera pang bayad sa renta ngayong buwan',
   'Pambayad po sa hospital bill ng asawa ko last week',
   'Kailangan ko po ng tulong para sa gamot ng anak ko',
   // Cebuano/Bisaya — a big share of borrowers, and it shares few words with Tagalog:
   'Palit ug tambal para sa akong mama kay nagsakit siya',
   'Ipalit ug bugas ug sud-an sa balay namo karon',
   'Kinahanglan nako ug kwarta para sa tuition sa akong anak',
   'Bayad sa kuryente namo kay hapit na mawad-an ug koryente'
];

describe('reason quality — English corpus', () => {
   it.each(ENGLISH_REASONS)('accepts: %s', (reason) => {
      expect(checkReasonQuality(reason)).toEqual({ ok: true, hint: '', code: 'ok' });
   });

   it.each(NOT_ENGLISH_REASONS)('rejects as not English: %s', (reason) => {
      const result = checkReasonQuality(reason);
      expect(result.ok).toBe(false);
      expect(result.hint).toContain('English');
   });
});
