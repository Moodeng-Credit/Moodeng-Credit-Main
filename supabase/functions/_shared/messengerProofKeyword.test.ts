import { assertEquals } from 'jsr:@std/assert@1';

import { isProofKeyword, prescreenReason } from './messengerPhotoIntake.ts';

Deno.test('PROOF keyword: the word alone, any case, a little punctuation', () => {
   for (const t of ['PROOF', 'proof', ' Proof. ', 'proofs', 'photo', 'PHOTOS!', 'litrato']) assertEquals(isProofKeyword(t), true, t);
});

Deno.test('PROOF keyword: not inside a sentence', () => {
   for (const t of ['proof of income', 'i sent the photo', 'DOCS', 'proofread', '']) assertEquals(isProofKeyword(t), false, t);
});

const H = 3_600_000;
const NOW = Date.parse('2026-11-21T12:00:00Z');
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString();

Deno.test('pre-screening: a photo during it (started < 24h, nothing sent yet) is proof', () => {
   assertEquals(prescreenReason({ created_at: at(2), income_files: [], status: 'open' }, 0, NOW), 'prescreen_open');
   assertEquals(prescreenReason({ created_at: at(30), income_files: [], status: 'open' }, 0, NOW), null);
   assertEquals(prescreenReason({ created_at: at(2), income_files: [], status: 'open' }, 1, NOW), null);
});

Deno.test('pre-screening: after it went in without proof, a photo is that proof (until one comes)', () => {
   assertEquals(prescreenReason({ created_at: at(100), sent_at: at(99), income_files: [], status: 'graded' }, 0, NOW), 'prescreen_skipped');
   assertEquals(prescreenReason({ created_at: at(100), sent_at: at(99), income_files: [], status: 'graded' }, 1, NOW), null);
});

Deno.test('pre-screening: within 48h after it went in with proof, a photo is more proof', () => {
   const files = [{ path: 'x' }];
   assertEquals(prescreenReason({ created_at: at(10), sent_at: at(9), income_files: files, status: 'sent' }, 0, NOW), 'prescreen_recent');
   assertEquals(prescreenReason({ created_at: at(60), sent_at: at(50), income_files: files, status: 'graded' }, 0, NOW), null);
});
