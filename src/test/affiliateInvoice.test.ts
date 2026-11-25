import { describe, expect, it } from 'vitest';

import { invoiceCardMode, invoiceErrorText, invoiceMonthName, parseInvoiceState } from '@/lib/affiliateInvoice';

const base = parseInvoiceState({ open_month: '2026-11-01', owed: '10', ahead: 0, amount: '10', items: [{ id: 'a', amount: '5' }], invoices: [] });

describe('affiliate monthly invoice', () => {
   it('parses numbers from the RPC', () => {
      expect(base.amount).toBe(10);
      expect(base.items[0].amount).toBe(5);
   });
   it('offers Send in the window when money is owed', () => {
      expect(invoiceCardMode(base)).toBe('send');
   });
   it('says wait outside the window', () => {
      expect(invoiceCardMode({ ...base, openMonth: null })).toBe('waiting');
   });
   it('shows sent once this month is invoiced, even with new money owed', () => {
      expect(
         invoiceCardMode({ ...base, invoices: [{ id: 'i', month: '2026-11-01', amount: 10, created_at: '', paid: false }] })
      ).toBe('sent');
   });
   it('hides when nothing is owed and every invoice is paid', () => {
      expect(
         invoiceCardMode({ ...base, amount: 0, invoices: [{ id: 'i', month: '2026-10-01', amount: 5, created_at: '', paid: true }] })
      ).toBe('hidden');
   });
   it('names the month and explains errors', () => {
      expect(invoiceMonthName('2026-11-01')).toBe('November');
      expect(invoiceErrorText('invoice_already_sent')).toMatch(/already sent/);
   });
});
