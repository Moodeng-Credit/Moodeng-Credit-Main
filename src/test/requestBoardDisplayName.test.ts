import { describe, expect, it } from 'vitest';

import { filterBySearch } from '@/utils/loanFilters';

import { WorldId, type User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

const loan: Loan = {
   id: 'loan-1',
   borrowerUser: 'user-1',
   borrowerWallet: '0x0000000000000000000000000000000000000001',
   lenderUser: '',
   loanAmount: 25,
   totalRepaymentAmount: 27,
   repaidAmount: 0,
   dueDate: '2026-06-15T00:00:00.000Z',
   reason: 'Groceries',
   loanStatus: 'Requested',
   repaymentStatus: 'Unpaid',
   coin: 'USDC',
   createdAt: '2026-06-01T00:00:00.000Z',
   updatedAt: '2026-06-01T00:00:00.000Z'
};

const borrower: User = {
   id: 'user-1',
   username: 'georgemlerner-2371a4',
   displayName: 'G.L.',
   email: 'george@example.com',
   isWorldId: WorldId.ACTIVE,
   mal: 3,
   nal: 0,
   cs: 20,
   createdAt: '2026-06-01T00:00:00.000Z',
   updatedAt: '2026-06-01T00:00:00.000Z'
};

describe('Request Board display names', () => {
   it('matches borrower display names in search', () => {
      expect(filterBySearch([loan], 'g.l.', { 'user-1': borrower })).toEqual([loan]);
   });
});
