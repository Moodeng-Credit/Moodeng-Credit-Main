import { getPaymentStatus } from '@base-org/account';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
   clearPendingBasePayment,
   listPendingBasePayments,
   type ReconcileHandlers,
   reconcilePendingBasePayments,
   registerPendingBasePayment
} from '@/lib/basePayReconciliation';

vi.mock('@base-org/account', () => ({ getPaymentStatus: vi.fn() }));

const mockStatus = vi.mocked(getPaymentStatus);

const MIN_AGE = 2 * 60 * 1000;
const handlers = (): ReconcileHandlers => ({
   completeFund: vi.fn().mockResolvedValue(undefined),
   completeRepay: vi.fn().mockResolvedValue(undefined)
});

beforeEach(() => {
   window.localStorage.clear();
   vi.clearAllMocks();
});

describe('pending Base payment store', () => {
   it('registers, lists and clears entries idempotently by id', () => {
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' });
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' }); // dup id
      expect(listPendingBasePayments()).toHaveLength(1);

      registerPendingBasePayment({ kind: 'repay', id: '0xb', loanId: 'L2', repaidAmount: 5, repaymentStatus: 'Partial' });
      expect(listPendingBasePayments()).toHaveLength(2);

      clearPendingBasePayment('0xa');
      expect(listPendingBasePayments().map((e) => e.id)).toEqual(['0xb']);
   });
});

describe('reconcilePendingBasePayments', () => {
   it('does not touch an entry younger than the guard window (avoids racing the live poll)', async () => {
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' });
      const h = handlers();

      await reconcilePendingBasePayments(h); // now ~= createdAt

      expect(mockStatus).not.toHaveBeenCalled();
      expect(h.completeFund).not.toHaveBeenCalled();
      expect(listPendingBasePayments()).toHaveLength(1);
   });

   it('completes a confirmed fund with the on-chain payer and clears it', async () => {
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' });
      mockStatus.mockResolvedValue({ status: 'completed', id: '0xa', message: 'ok', sender: '0xlender' } as never);
      const h = handlers();

      await reconcilePendingBasePayments(h, Date.now() + MIN_AGE + 1000);

      expect(h.completeFund).toHaveBeenCalledWith({ loanId: 'L1', userId: 'U1', wallet: '0xlender', hash: '0xa' });
      expect(listPendingBasePayments()).toHaveLength(0);
   });

   it('completes a confirmed repay with the stored amount/status', async () => {
      registerPendingBasePayment({ kind: 'repay', id: '0xb', loanId: 'L2', repaidAmount: 7.5, repaymentStatus: 'Paid' });
      mockStatus.mockResolvedValue({ status: 'completed', id: '0xb', message: 'ok', sender: '0xborrower' } as never);
      const h = handlers();

      await reconcilePendingBasePayments(h, Date.now() + MIN_AGE + 1000);

      expect(h.completeRepay).toHaveBeenCalledWith({ loanId: 'L2', repaidAmount: 7.5, repaymentStatus: 'Paid', hash: '0xb' });
      expect(listPendingBasePayments()).toHaveLength(0);
   });

   it('drops a failed payment without writing (the money never moved)', async () => {
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' });
      mockStatus.mockResolvedValue({ status: 'failed', id: '0xa', message: 'reverted' } as never);
      const h = handlers();

      await reconcilePendingBasePayments(h, Date.now() + MIN_AGE + 1000);

      expect(h.completeFund).not.toHaveBeenCalled();
      expect(listPendingBasePayments()).toHaveLength(0);
   });

   it('keeps a still-pending payment for a later pass', async () => {
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' });
      mockStatus.mockResolvedValue({ status: 'pending', id: '0xa', message: 'pending' } as never);
      const h = handlers();

      await reconcilePendingBasePayments(h, Date.now() + MIN_AGE + 1000);

      expect(h.completeFund).not.toHaveBeenCalled();
      expect(listPendingBasePayments()).toHaveLength(1);
   });

   it('keeps the entry if the DB write throws, so a later pass retries', async () => {
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' });
      mockStatus.mockResolvedValue({ status: 'completed', id: '0xa', message: 'ok', sender: '0xlender' } as never);
      const h: ReconcileHandlers = { completeFund: vi.fn().mockRejectedValue(new Error('db down')), completeRepay: vi.fn() };

      await reconcilePendingBasePayments(h, Date.now() + MIN_AGE + 1000);

      expect(h.completeFund).toHaveBeenCalled();
      expect(listPendingBasePayments()).toHaveLength(1);
   });

   it('drops an entry older than the max age (never going to confirm now)', async () => {
      registerPendingBasePayment({ kind: 'fund', id: '0xa', loanId: 'L1', userId: 'U1' });
      const h = handlers();

      await reconcilePendingBasePayments(h, Date.now() + 25 * 60 * 60 * 1000);

      expect(mockStatus).not.toHaveBeenCalled();
      expect(listPendingBasePayments()).toHaveLength(0);
   });
});
