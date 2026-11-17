import { describe, expect, it } from 'vitest';

import { missingItems, openProofLinkStatus, type ProofItem, proofLinkMessage } from '@/lib/proofRequests';

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

describe('open link status line', () => {
   const base = {
      id: 'r1',
      token: 'tok123',
      created_at: '2026-11-17T03:00:00Z',
      expires_at: '2026-12-01T03:00:00Z',
      sent_at: null,
      sent_via: null,
      opened_at: null
   };
   it('says when it was made in Bangkok time and that we have not sent it', () => {
      expect(openProofLinkStatus(base)).toBe('Made Nov 17, 10:00 AM · not sent by us yet · not opened yet · works until Dec 1, 10:00 AM');
   });
   it('names where it was sent and when they opened it', () => {
      expect(
         openProofLinkStatus({
            ...base,
            sent_at: '2026-11-17T03:01:00Z',
            sent_via: ['messenger', 'push'],
            opened_at: '2026-11-17T12:30:00Z'
         })
      ).toBe('Made Nov 17, 10:00 AM · sent on messenger, push · opened Nov 17, 7:30 PM · works until Dec 1, 10:00 AM');
   });
});
