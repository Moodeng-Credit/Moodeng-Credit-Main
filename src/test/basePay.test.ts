import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BasePaymentError, classifyBasePayThrow, sendUsdcViaBasePay, startBasePayment, waitForBasePayment } from '@/lib/basePay';

vi.mock('@base-org/account', () => ({
   pay: vi.fn(),
   getPaymentStatus: vi.fn()
}));

// Pull the mocked SDK after mocking so we can drive it per-test.
import { getPaymentStatus, pay } from '@base-org/account';

const mockPay = vi.mocked(pay);
const mockGetStatus = vi.mocked(getPaymentStatus);

const FAST = { timeoutMs: 60, intervalMs: 5 };

beforeEach(() => {
   vi.clearAllMocks();
});

describe('startBasePayment', () => {
   it('sends USDC on mainnet and returns the userOp id', async () => {
      mockPay.mockResolvedValue({ success: true, id: '0xuserop', amount: '25', to: '0xborrower' } as never);

      const result = await startBasePayment({ to: '0xborrower', usdAmount: '25' });

      expect(result).toEqual({ id: '0xuserop', to: '0xborrower' });
      expect(mockPay).toHaveBeenCalledWith(expect.objectContaining({ amount: '25', to: '0xborrower', testnet: false }));
   });

   it('classifies a user cancel as a rejection', async () => {
      mockPay.mockRejectedValue(new Error('User rejected the request'));

      await expect(startBasePayment({ to: '0xb', usdAmount: '1' })).rejects.toMatchObject({
         kind: 'rejected',
         errorCode: expect.any(String)
      });
   });

   it('classifies an unknown failure as failed, not rejected', async () => {
      mockPay.mockRejectedValue(new Error('bundler exploded'));

      await expect(startBasePayment({ to: '0xb', usdAmount: '1' })).rejects.toMatchObject({ kind: 'failed' });
   });
});

describe('waitForBasePayment', () => {
   it('resolves with the payer sender once completed', async () => {
      mockGetStatus.mockResolvedValue({
         status: 'completed',
         id: '0xuserop',
         message: 'ok',
         sender: '0xlender',
         amount: '25',
         recipient: '0xborrower'
      } as never);

      const confirmed = await waitForBasePayment('0xuserop', FAST);

      expect(confirmed).toEqual({ id: '0xuserop', sender: '0xlender', amount: '25', recipient: '0xborrower' });
   });

   it('treats not_found/pending as still-waiting, then completes', async () => {
      mockGetStatus
         .mockResolvedValueOnce({ status: 'not_found', id: '0xuserop', message: 'indexing' } as never)
         .mockResolvedValueOnce({ status: 'pending', id: '0xuserop', message: 'pending', sender: '0xlender' } as never)
         .mockResolvedValueOnce({ status: 'completed', id: '0xuserop', message: 'ok', sender: '0xlender' } as never);

      const confirmed = await waitForBasePayment('0xuserop', FAST);

      expect(confirmed.sender).toBe('0xlender');
      expect(mockGetStatus).toHaveBeenCalledTimes(3);
   });

   it('throws a definitive failure with the on-chain reason', async () => {
      mockGetStatus.mockResolvedValue({ status: 'failed', id: '0xuserop', message: 'reverted', reason: 'transfer exceeds balance' } as never);

      await expect(waitForBasePayment('0xuserop', FAST)).rejects.toMatchObject({ kind: 'failed', message: 'transfer exceeds balance' });
   });

   it('throws a reconcilable timeout (not a hard failure) if never confirmed', async () => {
      mockGetStatus.mockResolvedValue({ status: 'pending', id: '0xuserop', message: 'pending' } as never);

      const error = await waitForBasePayment('0xuserop', { timeoutMs: 15, intervalMs: 5 }).catch((e) => e);

      expect(error).toBeInstanceOf(BasePaymentError);
      expect(error.kind).toBe('timeout');
      expect(error.paymentId).toBe('0xuserop');
   });

   it('keeps polling through a transient RPC error rather than aborting the payment', async () => {
      mockGetStatus
         .mockRejectedValueOnce(new Error('RPC 429'))
         .mockResolvedValueOnce({ status: 'completed', id: '0xuserop', message: 'ok', sender: '0xlender' } as never);

      const confirmed = await waitForBasePayment('0xuserop', FAST);

      expect(confirmed.sender).toBe('0xlender');
   });
});

describe('sendUsdcViaBasePay', () => {
   it('opens the popup then waits for confirmation end to end', async () => {
      mockPay.mockResolvedValue({ success: true, id: '0xuserop', amount: '10', to: '0xb' } as never);
      mockGetStatus.mockResolvedValue({ status: 'completed', id: '0xuserop', message: 'ok', sender: '0xa' } as never);

      const confirmed = await sendUsdcViaBasePay({ to: '0xb', usdAmount: '10', ...FAST });

      expect(confirmed).toMatchObject({ id: '0xuserop', sender: '0xa' });
   });
});

describe('classifyBasePayThrow', () => {
   it('passes an existing BasePaymentError through unchanged', () => {
      const original = new BasePaymentError('insufficient', 'no funds');
      expect(classifyBasePayThrow(original)).toBe(original);
   });

   it('detects insufficient-balance messages', () => {
      expect(classifyBasePayThrow(new Error('insufficient balance')).kind).toBe('insufficient');
   });
});
