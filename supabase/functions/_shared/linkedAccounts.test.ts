import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { type NamedLink, nameParts, sameName, samePersonLinks } from './linkedAccounts.ts';

const link = (over: Partial<NamedLink>): NamedLink => ({
   user_id: '00000000-0000-0000-0000-000000000001',
   username: 'old_account',
   status: 'rejected',
   via: ['same WhatsApp number'],
   bad: true,
   why: 'rejected',
   names: nameParts(),
   rejectReason: null,
   ...over
});

Deno.test('name parts: lowercase, accents gone, short and common parts dropped', () => {
   assertEquals([...nameParts('José Dela Peña', null).parts].sort(), ['jose', 'pena']);
   assertEquals([...nameParts('Ana Mae B. Lopez', 'ana_lopez').parts].sort(), ['ana', 'lopez']);
   assertEquals([...nameParts('Ana Mae B. Lopez').firsts], ['ana']);
});

Deno.test('same name needs first name and surname, in any order; surname alone is family', () => {
   assertEquals(sameName(nameParts('Juan Pablo Tester'), nameParts('Tester Juan')), true);
   assertEquals(sameName(nameParts('Juan Tester'), nameParts('Pedro Tester')), false);
   assertEquals(sameName(nameParts('Anna Mae Tester'), nameParts('Lyn Mae Tester')), false);
   assertEquals(sameName(nameParts(null), nameParts('Juan Tester')), false);
   // Siblings: same middle name (the mother's surname) and surname, different first names.
   assertEquals(sameName(nameParts('Ana Sample Tester'), nameParts('Pedro Luis Sample Tester')), false);
   // Surname written first on one of them.
   assertEquals(sameName(nameParts('Tester M. Christine'), nameParts('Christine Tester')), true);
});

Deno.test('same person: a person-level link alone is enough', () => {
   const fb = link({ via: ['same Facebook'] });
   assertEquals(samePersonLinks(nameParts('Someone Else'), [fb]).length, 1);
   const id = link({ via: ['ID check: same person'] });
   assertEquals(samePersonLinks(nameParts(), [id]).length, 1);
});

Deno.test('same person: a household link needs the same name too', () => {
   const me = nameParts('Juan Tester');
   assertEquals(samePersonLinks(me, [link({ names: nameParts('Juan Pablo Tester') })]).length, 1);
   // A relative on the same WhatsApp and home internet, different name: left for the team.
   assertEquals(
      samePersonLinks(me, [link({ via: ['same WhatsApp number', 'same home internet'], names: nameParts('Maria Other') })]).length,
      0
   );
   assertEquals(samePersonLinks(me, [link({ via: ['same home internet'], names: nameParts('Pedro Tester') })]).length, 0);
});

Deno.test('only bad accounts count, and not ones this rule rejected itself', () => {
   const me = nameParts('Juan Tester');
   assertEquals(samePersonLinks(me, [link({ bad: false, via: ['same Facebook'] })]).length, 0);
   assertEquals(samePersonLinks(me, [link({ via: ['same Facebook'], rejectReason: 'linked_account' })]).length, 0);
   // ...unless it's bad for another reason too.
   assertEquals(
      samePersonLinks(me, [link({ via: ['same Facebook'], rejectReason: 'linked_account', why: 'rejected, loan overdue' })]).length,
      1
   );
});
