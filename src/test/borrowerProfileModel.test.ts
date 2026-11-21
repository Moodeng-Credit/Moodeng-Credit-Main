import { describe, expect, it } from 'vitest';

import {
   type ProfileRow,
   UNKNOWN,
   ageBand,
   bestSegments,
   incomeLabel,
   isPhilippines,
   mapPoints,
   rateColor,
   regionLabel,
   segment
} from '@/app/admin/borrowerProfileModel';

let n = 0;
const row = (over: Partial<ProfileRow> = {}): ProfileRow => ({
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
   loans: 0,
   repaid: 0,
   late: 0,
   open_overdue: 0,
   borrowed_usd: 0,
   ...over
});

describe('borrower profile model', () => {
   it('bands ages and labels income', () => {
      expect(ageBand(19)).toBe('18–21');
      expect(ageBand(30)).toBe('26–30');
      expect(ageBand(55)).toBe('41+');
      expect(ageBand(null)).toBe(UNKNOWN);
      expect(incomeLabel('700_plus')).toBe('$700+');
      expect(incomeLabel(null)).toBe(UNKNOWN);
   });

   it('folds Filipino region names into English ones', () => {
      expect(regionLabel('Kalakhang Maynila')).toBe('Metro Manila');
      expect(regionLabel('Rehiyong Pampangasiwaan ng Cordillera')).toBe('Cordillera (CAR)');
      expect(regionLabel('Central Visayas')).toBe('Central Visayas');
      expect(regionLabel(null)).toBe(UNKNOWN);
   });

   it('counts on-time as repaid minus late, out of loans that came due', () => {
      const [s] = segment(
         [row({ loans: 3, repaid: 2, late: 1, open_overdue: 1, borrowed_usd: '30' }), row({ loans: 0 })],
         () => 'all'
      );
      expect(s).toMatchObject({ people: 2, borrowers: 1, loans: 3, due: 3, onTime: 1, late: 1, overdue: 1, borrowedUsd: 30 });
   });

   it('orders segments by the given order with "not known" last', () => {
      const keys = segment([row({ age: 45 }), row({ age: null }), row({ age: 20 })], (r) => ageBand(r.age), ['18–21', '41+']).map(
         (s) => s.key
      );
      expect(keys).toEqual(['18–21', '41+', UNKNOWN]);
   });

   it('only ranks groups with enough loans due', () => {
      const rows = [
         ...Array.from({ length: 4 }, () => row({ gender: 'Female', loans: 1, repaid: 1 })),
         row({ gender: 'Male', loans: 1, repaid: 1 })
      ];
      const best = bestSegments(rows);
      expect(best.some((s) => s.key === 'Female' && s.rate === 1)).toBe(true);
      expect(best.some((s) => s.key === 'Male')).toBe(false);
   });

   it('groups map points and skips people with no location', () => {
      const points = mapPoints([row(), row({ loans: 1, repaid: 1 }), row({ home_lat: null, home_lng: null })], 'home');
      expect(points).toHaveLength(1);
      expect(points[0]).toMatchObject({ people: 2, borrowers: 1, due: 1, onTime: 1, label: 'Cebu City, Cebu' });
      expect(mapPoints([row({ ip_lat: null })], 'ip')).toHaveLength(0);
   });

   it('treats ID country first, then IP, as the country', () => {
      expect(isPhilippines(row({ id_country: 'IDN', ip_country: 'PH' }))).toBe(false);
      expect(isPhilippines(row({ id_country: null, ip_country: 'PH' }))).toBe(true);
   });

   it('colours by on-time rate', () => {
      expect(rateColor(0, 0)).toBe('#8b8fa3');
      expect(rateColor(10, 9)).toBe('#2ecc71');
      expect(rateColor(10, 6)).toBe('#f5a524');
      expect(rateColor(10, 2)).toBe('#ff4d5e');
   });
});
