import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({ functions: { invoke } })
}));

const { checkLoanReason, getCachedReasonVerdict, resetLoanReasonVerdicts } = await import('@/lib/loanReasonCheck');

describe('loan reason check', () => {
   beforeEach(() => {
      resetLoanReasonVerdicts();
      invoke.mockReset();
   });

   it('asks DeepSeek once per reason and reuses the verdict', async () => {
      invoke.mockResolvedValue({ data: { ok: false, hint: 'Too vague.' }, error: null });

      const first = await checkLoanReason('for personal use and other things I need');
      const second = await checkLoanReason('for personal use and other things I need');

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(first).toEqual({ ok: false, hint: 'Too vague.', checked: true });
      expect(second).toEqual(first);
   });

   it('treats whitespace and case differences as the same reason', async () => {
      invoke.mockResolvedValue({ data: { ok: true }, error: null });

      await checkLoanReason('Rent is due Friday and I am short');
      await checkLoanReason('  rent is   due friday and I am short  ');

      expect(invoke).toHaveBeenCalledTimes(1);
   });

   it('shares one in-flight request between the field and the submit gate', async () => {
      invoke.mockImplementation(
         () => new Promise((resolve) => setTimeout(() => resolve({ data: { ok: true }, error: null }), 10))
      );

      const [a, b] = await Promise.all([checkLoanReason('Buying medicine for my mother'), checkLoanReason('Buying medicine for my mother')]);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(a).toEqual(b);
   });

   it('fails open when the function errors, and flags that nothing was checked', async () => {
      invoke.mockResolvedValue({ data: null, error: new Error('offline') });

      const verdict = await checkLoanReason('Rent balance due Friday, I am $30 short');

      expect(verdict).toEqual({ ok: true, hint: '', checked: false });
   });

   it('fails open when the function throws', async () => {
      invoke.mockRejectedValue(new Error('network down'));

      const verdict = await checkLoanReason('Rent balance due Friday, I am $30 short');

      expect(verdict.ok).toBe(true);
      expect(verdict.checked).toBe(false);
   });

   it('does not remember a failed check — the next ask retries', async () => {
      invoke.mockResolvedValueOnce({ data: null, error: new Error('offline') });
      invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });

      await checkLoanReason('Groceries until my payday on the 15th');
      expect(getCachedReasonVerdict('Groceries until my payday on the 15th')).toBeUndefined();

      const retried = await checkLoanReason('Groceries until my payday on the 15th');
      expect(invoke).toHaveBeenCalledTimes(2);
      expect(retried.checked).toBe(true);
   });

   it('ignores a malformed response rather than trusting it', async () => {
      invoke.mockResolvedValue({ data: { hint: 'no ok field' }, error: null });

      const verdict = await checkLoanReason('Fixing my motorbike so I can get to work');

      expect(verdict).toEqual({ ok: true, hint: '', checked: false });
   });
});
