import { describe, expect, it } from 'vitest';

import { searchAdmin } from '@/app/admin/adminSearchModel';

const pages = [
   { id: 'users', label: 'User directory', group: 'Overview' },
   { id: 'calendar', label: 'Calendar', group: 'Overview' },
   { id: 'refunds', label: 'Refunds', group: 'Loans' }
];
const users = [
   {
      id: 'u1',
      username: 'maria_santos',
      email: 'maria@example.com',
      wallet_address: '0xabc0000000000000000000000000000000000def',
      user_role: 'borrower',
      account_status: 'active'
   },
   { id: 'u2', username: 'mar', email: null, wallet_address: null, user_role: 'lender', account_status: 'banned' },
   { id: 'u3', username: 'jonas', email: 'jonas@example.com', wallet_address: null, user_role: 'unset', account_status: 'active' }
];
const requests = [
   {
      id: 'r1',
      tracking_id: 'MC-1001',
      loan_amount: 25,
      reason: 'School fees',
      borrower: { username: 'maria_santos' },
      borrower_wallet: null
   }
];

describe('admin global search', () => {
   it('returns nothing for an empty query', () => {
      expect(searchAdmin('   ', { pages, users, requests })).toEqual([]);
   });

   it('ranks an exact username above a prefix match', () => {
      const results = searchAdmin('mar', { pages, users, requests }).filter((r) => r.kind === 'user');
      expect(results.map((r) => r.id)).toEqual(['u2', 'u1']);
      expect(results[0].detail).toContain('banned');
   });

   it('finds users by email and wallet, and ignores a leading @', () => {
      expect(searchAdmin('jonas@example', { pages, users, requests })[0]).toMatchObject({ kind: 'user', id: 'u3' });
      expect(searchAdmin('0xabc0', { pages, users, requests })[0]).toMatchObject({ kind: 'user', id: 'u1' });
      expect(searchAdmin('@jonas', { pages, users, requests })[0]).toMatchObject({ kind: 'user', id: 'u3' });
   });

   it('finds pages and loan requests', () => {
      expect(searchAdmin('calen', { pages, users, requests })).toEqual([
         { kind: 'page', id: 'calendar', title: 'Calendar', detail: 'Overview' }
      ]);
      const school = searchAdmin('school', { pages, users, requests });
      expect(school).toEqual([{ kind: 'request', id: 'r1', title: 'maria_santos · $25', detail: 'School fees' }]);
   });
});
