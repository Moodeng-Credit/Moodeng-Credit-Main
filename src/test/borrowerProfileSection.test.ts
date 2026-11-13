import { act, createElement } from 'react';

import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProfileRow } from '@/app/admin/borrowerProfileModel';

// Renders Admin → Borrower profile from fixed (made-up) rows, so a broken page shows up in CI.

vi.mock('@/app/admin/BorrowerProfileMap', () => ({ default: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ rpc: () => Promise.resolve({ data: [], error: null }) }) }));

let n = 0;
const row = (over: Partial<ProfileRow>): ProfileRow => ({
   user_id: `u${++n}`,
   signed_up_at: '2026-10-01T00:00:00Z',
   kyc_status: 'Approved',
   age: 24,
   gender: 'Female',
   marital_status: 'Single',
   id_country: 'PHL',
   region: 'Central Visayas',
   province: 'Cebu',
   city: 'Cebu City',
   home_lat: 10.3,
   home_lng: 123.9,
   ip_country: 'PH',
   ip_city: 'Cebu City',
   ip_lat: 10.3,
   ip_lng: 123.9,
   monthly_income: '200_400',
   income_type: 'full-time',
   signup_source: null,
   approved: true,
   loans: 1,
   repaid: 1,
   late: 0,
   open_overdue: 0,
   borrowed_usd: 15,
   ...over
});

class ResizeObserverStub {
   observe() {}
   unobserve() {}
   disconnect() {}
}

describe('borrower profile page', () => {
   let container: HTMLDivElement;
   beforeEach(() => {
      (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
      (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.appendChild(container);
   });
   afterEach(() => container.remove());

   it('shows the headline numbers and the best-repaying groups', async () => {
      const { BorrowerProfileView } = await import('@/app/admin/BorrowerProfileSection');
      const rows = [
         ...Array.from({ length: 4 }, () => row({})),
         row({ gender: 'Male', age: 35, region: 'Kalakhang Maynila', late: 1 }),
         row({ id_country: 'IDN', region: 'Banten' })
      ];
      const root = createRoot(container);
      await act(async () => {
         root.render(createElement(BorrowerProfileView, { rows }));
      });
      const text = container.textContent ?? '';
      expect(text).toContain('Who repays best');
      expect(text).toContain('Paid on time');
      expect(text).toContain('Metro Manila');
      expect(text).not.toContain('Banten'); // Philippines only by default
      expect(text).toContain('80%'); // 4 of 5 Philippine loans on time
      act(() => root.unmount());
   });
});
