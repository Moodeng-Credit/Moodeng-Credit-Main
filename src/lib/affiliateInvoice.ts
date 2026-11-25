import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** Monthly affiliate invoice: at the end of the month the affiliate sends us what we owe them (affiliate_invoices). */
export interface InvoiceLine {
   source: 'code' | 'refund';
   id: string;
   amount: number;
   label: string;
   at: string;
}

export interface SentInvoice {
   id: string;
   month: string;
   amount: number;
   created_at: string;
   paid: boolean;
}

export interface AffiliateInvoiceState {
   /** First day of the month an invoice can be sent for now (25th → 5th, Bangkok), or null outside that window. */
   openMonth: string | null;
   owed: number;
   ahead: number;
   amount: number;
   items: InvoiceLine[];
   walletAddress: string | null;
   invoices: SentInvoice[];
}

export interface AdminInvoice extends SentInvoice {
   owner_user_id: string;
   owed: number;
   ahead: number;
   items: InvoiceLine[];
   wallet_address: string | null;
   note: string | null;
   username: string | null;
   display_name: string | null;
}

const num = (v: unknown) => Number(v) || 0;

const lines = (v: unknown): InvoiceLine[] =>
   Array.isArray(v) ? v.map((i) => ({ ...(i as InvoiceLine), amount: num((i as InvoiceLine).amount) })) : [];

export function parseInvoiceState(data: unknown): AffiliateInvoiceState {
   const d = (data ?? {}) as Record<string, unknown>;
   return {
      openMonth: typeof d.open_month === 'string' ? d.open_month : null,
      owed: num(d.owed),
      ahead: num(d.ahead),
      amount: num(d.amount),
      items: lines(d.items),
      walletAddress: typeof d.wallet_address === 'string' ? d.wallet_address : null,
      invoices: Array.isArray(d.invoices)
         ? d.invoices.map((i) => ({ ...(i as SentInvoice), amount: num((i as SentInvoice).amount), paid: (i as SentInvoice).paid === true }))
         : []
   };
}

/** "2026-11-01" → "November". */
export function invoiceMonthName(month: string): string {
   return new Date(`${month.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
}

/** What the invoice card should show. */
export type InvoiceCardMode = 'hidden' | 'send' | 'sent' | 'waiting';

export function invoiceCardMode(s: AffiliateInvoiceState): InvoiceCardMode {
   const thisMonth = s.openMonth ? s.invoices.find((i) => i.month.slice(0, 10) === s.openMonth) : undefined;
   if (thisMonth) return 'sent';
   if (s.amount <= 0) return s.invoices.some((i) => !i.paid) ? 'sent' : 'hidden';
   return s.openMonth ? 'send' : 'waiting';
}

export async function fetchMyAffiliateInvoice(): Promise<AffiliateInvoiceState> {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_affiliate_invoice');
   if (error) throw error;
   return parseInvoiceState(data);
}

export async function submitAffiliateInvoice(note: string): Promise<void> {
   const { error } = await getSupabaseBrowserClient().rpc('submit_affiliate_invoice', { p_note: note.trim() || null });
   if (error) throw error;
}

export function invoiceErrorText(message: string | undefined): string {
   if (message?.includes('invoice_already_sent')) return 'You already sent this month’s invoice.';
   if (message?.includes('invoice_window_closed')) return 'Invoices open on the 25th. Come back then.';
   if (message?.includes('nothing_owed')) return 'Nothing is owed to you right now.';
   return 'Couldn’t send it. Try again in a minute.';
}

export async function fetchAdminInvoices(): Promise<AdminInvoice[]> {
   const { data, error } = await getSupabaseBrowserClient().rpc('admin_affiliate_invoices');
   if (error) throw error;
   return (Array.isArray(data) ? data : []).map((i) => {
      const r = i as AdminInvoice;
      return { ...r, amount: num(r.amount), owed: num(r.owed), ahead: num(r.ahead), items: lines(r.items), paid: r.paid === true };
   });
}
