import { assertEquals } from 'jsr:@std/assert@1';
import { isProofKeyword } from './messengerPhotoIntake.ts';

Deno.test('PROOF keyword: the word alone, any case, a little punctuation', () => {
   for (const t of ['PROOF', 'proof', ' Proof. ', 'proofs', 'photo', 'PHOTOS!', 'litrato']) assertEquals(isProofKeyword(t), true, t);
});

Deno.test('PROOF keyword: not inside a sentence', () => {
   for (const t of ['proof of income', 'i sent the photo', 'DOCS', 'proofread', '']) assertEquals(isProofKeyword(t), false, t);
});
