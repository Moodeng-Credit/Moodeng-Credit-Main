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
      expect(first).toEqual({ ok: false, hint: 'Too vague.', category: '', suggestion: '', checked: true });
      expect(second).toEqual(first);
   });

   it('treats whitespace and case differences as the same reason', async () => {
      invoke.mockResolvedValue({ data: { ok: true }, error: null });

      await checkLoanReason('Rent is due Friday and I am short');
      await checkLoanReason('  rent is   due friday and I am short  ');

      expect(invoke).toHaveBeenCalledTimes(1);
   });

   it('shares one in-flight request between the field and the submit gate', async () => {
      invoke.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: { ok: true }, error: null }), 10)));

      const [a, b] = await Promise.all([
         checkLoanReason('Buying medicine for my mother'),
         checkLoanReason('Buying medicine for my mother')
      ]);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(a).toEqual(b);
   });

   it('fails open when the function errors, and flags that nothing was checked', async () => {
      invoke.mockResolvedValue({ data: null, error: new Error('offline') });

      const verdict = await checkLoanReason('Rent balance due Friday, I am $30 short');

      expect(verdict).toEqual({ ok: true, hint: '', category: '', suggestion: '', checked: false });
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

      expect(verdict).toEqual({ ok: true, hint: '', category: '', suggestion: '', checked: false });
   });

   it('passes through the category and the suggested rewrite', async () => {
      invoke.mockResolvedValue({
         data: {
            ok: false,
            category: 'not_english',
            hint: 'Please write this in English so lenders can read it.',
            suggestion: "Paying the electricity bill and my mother's medicine before payday."
         },
         error: null
      });

      const verdict = await checkLoanReason('Pambayad sa kuryente at gamot ng nanay ko bago ang sahod');

      expect(verdict.category).toBe('not_english');
      expect(verdict.suggestion).toBe("Paying the electricity bill and my mother's medicine before payday.");
   });

   it('sends the app language and keeps a separate verdict per language', async () => {
      invoke.mockResolvedValue({ data: { ok: false, hint: 'Anong bills? Kuryente, tubig, o renta?', category: 'vague' }, error: null });

      await checkLoanReason('pay bills', 'fil');
      expect(invoke).toHaveBeenCalledWith('check-loan-input', { body: { text: 'pay bills', kind: 'reason', locale: 'fil' } });
      expect(getCachedReasonVerdict('pay bills', 'fil')?.hint).toBe('Anong bills? Kuryente, tubig, o renta?');
      expect(getCachedReasonVerdict('pay bills')).toBeUndefined();

      await checkLoanReason('pay bills');
      expect(invoke).toHaveBeenLastCalledWith('check-loan-input', { body: { text: 'pay bills', kind: 'reason', locale: 'en' } });
      expect(invoke).toHaveBeenCalledTimes(2);
   });

   it('asks for a second opinion even when a quick verdict is cached, and remembers the escalated one', async () => {
      invoke.mockResolvedValueOnce({ data: { ok: false, hint: 'Which bills?', category: 'vague' }, error: null });
      await checkLoanReason('pay my bills this month', 'en');

      invoke.mockResolvedValueOnce({ data: { ok: true, hint: '', category: 'good', escalated: true }, error: null });
      const history = [{ text: 'need money', hint: 'What is it for?' }];
      const second = await checkLoanReason('pay my bills this month', 'en', { history });

      expect(invoke).toHaveBeenLastCalledWith('check-loan-input', {
         body: { text: 'pay my bills this month', kind: 'reason', locale: 'en', escalate: true, history }
      });
      expect(second).toMatchObject({ ok: true, escalated: true });

      // The escalated verdict now answers both quick and second-opinion asks without another call.
      expect(await checkLoanReason('pay my bills this month', 'en')).toMatchObject({ ok: true, escalated: true });
      expect(await checkLoanReason('pay my bills this month', 'en', { history })).toMatchObject({ escalated: true });
      expect(invoke).toHaveBeenCalledTimes(2);
   });
});
