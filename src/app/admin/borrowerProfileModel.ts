// Admin → Growth → Borrower profile: grouping and scoring for admin_borrower_profile()
// (supabase/migrations/20261113140000_borrower_profile.sql). Pure functions so they're testable.

export type ProfileRow = {
   user_id: string;
   signed_up_at: string;
   kyc_status: string | null;
   age: number | null;
   gender: string | null;
   marital_status: string | null;
   id_country: string | null;
   region: string | null;
   province: string | null;
   city: string | null;
   home_lat: number | null;
   home_lng: number | null;
   ip_country: string | null;
   ip_city: string | null;
   ip_lat: number | null;
   ip_lng: number | null;
   monthly_income: string | null;
   income_type: string | null;
   signup_source: string | null;
   approved: boolean;
   loans: number;
   repaid: number;
   late: number;
   open_overdue: number;
   borrowed_usd: number | string;
};

export type Segment = {
   key: string;
   people: number;
   borrowers: number;
   loans: number;
   /** Loans that came due: repaid, or unpaid past their due day. */
   due: number;
   onTime: number;
   late: number;
   overdue: number;
   borrowedUsd: number;
};

export const UNKNOWN = 'Not known';

export const AGE_BANDS = ['18–21', '22–25', '26–30', '31–40', '41+'] as const;
export const ageBand = (age: number | null): string => {
   if (age == null || age < 15) return UNKNOWN;
   if (age <= 21) return '18–21';
   if (age <= 25) return '22–25';
   if (age <= 30) return '26–30';
   if (age <= 40) return '31–40';
   return '41+';
};

const INCOME_LABELS: Record<string, string> = {
   under_200: 'Under $200',
   '200_400': '$200–400',
   '400_700': '$400–700',
   '700_plus': '$700+'
};
export const INCOME_ORDER = Object.values(INCOME_LABELS);
export const incomeLabel = (value: string | null) => (value ? INCOME_LABELS[value] ?? value : UNKNOWN);

const JOB_LABELS: Record<string, string> = {
   'full-time': 'Full-time',
   'part-time': 'Part-time',
   freelance: 'Freelance',
   none: 'No job'
};
export const jobLabel = (value: string | null) => (value ? JOB_LABELS[value] ?? value : UNKNOWN);

// Google sometimes answers in Filipino; fold those into the English region names.
const REGION_ALIASES: Record<string, string> = {
   'Kalakhang Maynila': 'Metro Manila',
   'National Capital Region': 'Metro Manila',
   'Rehiyong Pampangasiwaan ng Cordillera': 'Cordillera (CAR)',
   'Cordillera Administrative Region': 'Cordillera (CAR)',
   'Gitnang Luzon': 'Central Luzon',
   'Gitnang Kabisayaan': 'Central Visayas',
   'Kanlurang Kabisayaan': 'Western Visayas',
   'Silangang Kabisayaan': 'Eastern Visayas',
   'Rehiyon ng Davao': 'Davao Region',
   'Lambak ng Cagayan': 'Cagayan Valley',
   'Rehiyon ng Ilocos': 'Ilocos Region',
   'Rehiyon ng Bicol': 'Bicol Region',
   'Hilagang Mindanao': 'Northern Mindanao'
};
export const regionLabel = (region: string | null) => (region ? REGION_ALIASES[region.trim()] ?? region.trim() : UNKNOWN);

export const isPhilippines = (row: ProfileRow) => row.id_country === 'PHL' || (!row.id_country && row.ip_country === 'PH');

export const hasIdData = (row: ProfileRow) => row.age != null || row.gender != null || row.region != null || row.home_lat != null;

export const onTimeRate = (s: Pick<Segment, 'due' | 'onTime'>) => (s.due ? s.onTime / s.due : null);

export function segment(rows: ProfileRow[], keyOf: (row: ProfileRow) => string, order?: readonly string[]): Segment[] {
   const groups = new Map<string, Segment>();
   for (const row of rows) {
      const key = keyOf(row) || UNKNOWN;
      const g = groups.get(key) ?? { key, people: 0, borrowers: 0, loans: 0, due: 0, onTime: 0, late: 0, overdue: 0, borrowedUsd: 0 };
      g.people += 1;
      if (row.loans > 0) g.borrowers += 1;
      g.loans += row.loans;
      g.due += row.repaid + row.open_overdue;
      g.onTime += row.repaid - row.late;
      g.late += row.late;
      g.overdue += row.open_overdue;
      g.borrowedUsd += Number(row.borrowed_usd) || 0;
      groups.set(key, g);
   }
   const rank = (key: string) => {
      if (key === UNKNOWN) return Number.MAX_SAFE_INTEGER;
      const i = order?.indexOf(key) ?? -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i;
   };
   return [...groups.values()].sort((a, b) => (order ? rank(a.key) - rank(b.key) : 0) || b.people - a.people || a.key.localeCompare(b.key));
}

export type Dimension = { id: string; label: string; keyOf: (row: ProfileRow) => string; order?: readonly string[] };

export const DIMENSIONS: Dimension[] = [
   { id: 'age', label: 'Age', keyOf: (r) => ageBand(r.age), order: AGE_BANDS },
   { id: 'gender', label: 'Gender', keyOf: (r) => r.gender ?? UNKNOWN, order: ['Female', 'Male'] },
   { id: 'income', label: 'Monthly income', keyOf: (r) => incomeLabel(r.monthly_income), order: INCOME_ORDER },
   { id: 'job', label: 'Work', keyOf: (r) => jobLabel(r.income_type), order: ['Full-time', 'Part-time', 'Freelance', 'No job'] },
   { id: 'marital', label: 'Marital status', keyOf: (r) => r.marital_status ?? UNKNOWN },
   { id: 'region', label: 'Region (from ID)', keyOf: (r) => regionLabel(r.region) }
];

export type BestSegment = Segment & { dimension: string; rate: number };

/**
 * Groups that repay best, across every dimension. Needs at least `minDue` loans that came due so one
 * lucky borrower doesn't top the list; ties go to the bigger group.
 */
export function bestSegments(rows: ProfileRow[], minDue = 4, limit = 6): BestSegment[] {
   const all: BestSegment[] = [];
   for (const d of DIMENSIONS) {
      for (const s of segment(rows, d.keyOf, d.order)) {
         const rate = onTimeRate(s);
         if (s.key === UNKNOWN || rate == null || s.due < minDue) continue;
         all.push({ ...s, dimension: d.label, rate });
      }
   }
   return all.sort((a, b) => b.rate - a.rate || b.due - a.due).slice(0, limit);
}

export type MapLayer = 'home' | 'ip';

export type MapPoint = {
   lat: number;
   lng: number;
   label: string;
   people: number;
   borrowers: number;
   due: number;
   onTime: number;
};

/** People grouped by their rounded (~10 km) map point: home address from the ID, or where they log in. */
export function mapPoints(rows: ProfileRow[], layer: MapLayer): MapPoint[] {
   const points = new Map<string, MapPoint>();
   for (const row of rows) {
      const lat = layer === 'home' ? row.home_lat : row.ip_lat;
      const lng = layer === 'home' ? row.home_lng : row.ip_lng;
      if (lat == null || lng == null) continue;
      const key = `${lat},${lng}`;
      const label =
         layer === 'home'
            ? [row.city, row.province, row.region].filter(Boolean).slice(0, 2).join(', ') || 'Unknown place'
            : row.ip_city || 'Unknown city';
      const p = points.get(key) ?? { lat, lng, label, people: 0, borrowers: 0, due: 0, onTime: 0 };
      p.people += 1;
      if (row.loans > 0) p.borrowers += 1;
      p.due += row.repaid + row.open_overdue;
      p.onTime += row.repaid - row.late;
      points.set(key, p);
   }
   return [...points.values()].sort((a, b) => b.people - a.people);
}

/** Green = repays on time, amber = mixed, red = mostly late, grey = no loans due yet. */
export function rateColor(due: number, onTime: number): string {
   if (!due) return '#8b8fa3';
   const r = onTime / due;
   if (r >= 0.8) return '#2ecc71';
   if (r >= 0.5) return '#f5a524';
   return '#ff4d5e';
}
