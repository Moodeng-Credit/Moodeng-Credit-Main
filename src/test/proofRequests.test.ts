import { describe, expect, it } from 'vitest';

import { missingItems, type ProofItem, proofLinkMessage } from '@/lib/proofRequests';

const items: ProofItem[] = [
   { id: 'visa', kind: 'proof', label: 'Visa' },
   { id: 'work', kind: 'proof', label: 'Work' },
   { id: 'q', kind: 'question', label: 'Company?' }
];

describe('proof request page', () => {
   it('needs a file, or "I don\'t have this" with a reason, for each proof and an answer for each question', () => {
      expect(missingItems(items, {}, {}).map((i) => i.id)).toEqual(['visa', 'work', 'q']);
      expect(missingItems(items, { work: { missing: true, text: '' }, q: { text: '  ' } }, { visa: 1 }).map((i) => i.id)).toEqual([
         'work',
         'q'
      ]);
      expect(missingItems(items, { work: { missing: true, text: 'Not yet issued' }, q: { text: 'Acme' } }, { visa: 2 })).toEqual([]);
   });

   it('counts files sent before an "Ask again"', () => {
      expect(missingItems([items[0]], {}, { visa: 1 })).toEqual([]);
   });

   it('writes the Messenger message with their first name and the link', () => {
      expect(proofLinkMessage('Ana', 'abc')).toContain('Hi Ana!');
      expect(proofLinkMessage(null, 'abc')).toMatch(/^Hi! .*\nhttps:\/\/moodeng\.app\/proof\/abc$/s);
   });
});
