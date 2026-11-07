// Indonesia track, "living in Telegram" (docs/INDONESIA_TRACK.md): the pure parts of the bot's loan
// flow — rupiah chips, term choices, the Walt top-up amount, and the inline-button callback data.
//
// No imports on purpose: src/lib/idBotLoanMath.test.ts (vitest) imports this file next to
// src/lib/loanMarket.ts and checks the rupiah chips are the same numbers the app shows. The chip maths
// below is a copy of loanMarket.ts (idRepaymentBounds … idRepayIdrChoices); change both together.

// ── rupiah chips (same as src/lib/loanMarket.ts) ──────────────────────────────────────────────────
export const ID_MAX_REPAY_MULTIPLE = 1.5;
export const ID_REPAY_IDR_STEP = 500;
export const ID_REPAY_IDR_CHIP_STEP = 5000;

const roundCents = (n: number) => Math.round(n * 100) / 100;

export const idRepaymentBounds = (amount: number): { min: number; max: number } => ({
   min: roundCents(amount + 1),
   max: roundCents(amount * ID_MAX_REPAY_MULTIPLE)
});

const ID_REPAY_EXTRAS: Record<number, number[]> = { 5: [1, 1.5, 2], 10: [1, 2, 3] };

export const idRepaymentChoices = (amount: number): number[] => {
   if (!Number.isFinite(amount) || amount <= 0) return [];
   const { min, max } = idRepaymentBounds(amount);
   if (min > max) return [];
   const extras = ID_REPAY_EXTRAS[amount] ?? [1, Math.round(amount * 0.2 * 2) / 2, Math.round(amount * 0.3 * 2) / 2];
   const totals = extras.map((extra) => roundCents(Math.min(Math.max(amount + extra, min), max)));
   return [...new Set(totals)].sort((a, b) => a - b);
};

/** USD the server charges for `idr` rupiah at `rate` (round(idr / rate, 2), like the server). */
export const idUsdForIdr = (idr: number, rate: number): number => roundCents(idr / rate);

export const idRepayIdrBounds = (amount: number, rate: number | null | undefined): { min: number; max: number } | null => {
   if (!rate || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(amount) || amount <= 0) return null;
   const { min, max } = idRepaymentBounds(amount);
   const step = ID_REPAY_IDR_STEP;
   const accepts = (idr: number) => {
      const usd = idUsdForIdr(idr, rate);
      return usd >= min && usd <= max;
   };
   let lo = Math.ceil(((min - 0.005) * rate) / step) * step;
   let hi = Math.floor(((max + 0.005) * rate) / step) * step;
   for (let i = 0; i < 4 && !accepts(lo); i += 1) lo += step;
   for (let i = 0; i < 4 && lo - step > 0 && accepts(lo - step); i += 1) lo -= step;
   for (let i = 0; i < 4 && !accepts(hi); i += 1) hi -= step;
   for (let i = 0; i < 4 && accepts(hi + step); i += 1) hi += step;
   return lo <= hi && accepts(lo) && accepts(hi) ? { min: lo, max: hi } : null;
};

export const idRepayIdrChoices = (amount: number, rate: number | null | undefined): number[] => {
   const bounds = idRepayIdrBounds(amount, rate);
   if (!bounds || !rate) return [];
   const chip = ID_REPAY_IDR_CHIP_STEP;
   const candidates: number[] = [];
   for (let v = Math.ceil(bounds.min / chip) * chip; v <= bounds.max; v += chip) candidates.push(v);
   if (candidates.length <= 3) return candidates;
   const picked = new Set<number>();
   for (const usd of idRepaymentChoices(amount)) {
      const target = usd * rate;
      let nearest: number | null = null;
      for (const c of candidates) {
         if (picked.has(c)) continue;
         if (nearest === null || Math.abs(c - target) < Math.abs(nearest - target)) nearest = c;
      }
      if (nearest !== null) picked.add(nearest);
   }
   const rest = candidates.filter((c) => !picked.has(c));
   while (picked.size < 3 && rest.length) picked.add(rest.splice(Math.floor(rest.length / 2), 1)[0]);
   return [...picked].sort((a, b) => a - b);
};

/** "Rp 110.000". */
export const formatRp = (idr: number): string =>
   `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(idr) ? idr : 0))}`;

// ── terms ─────────────────────────────────────────────────────────────────────────────────────────
/** Term buttons: 7 and the longest term (14 by default), each ≤ maxTermDays. */
export const idTermChoices = (maxTermDays: number): number[] => {
   const max = Math.floor(Number(maxTermDays));
   if (!Number.isFinite(max) || max < 1) return [];
   return [...new Set([Math.min(7, max), max])].sort((a, b) => a - b);
};

/** YYYY-MM-DD in Jakarta for `now`. */
export const jakartaDate = (now: Date): string =>
   new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** The due date the app stores: midnight UTC of (Jakarta today + days). Same as bot_request_id_loan. */
export const idDueDateIso = (now: Date, days: number): string => {
   const [y, m, d] = jakartaDate(now).split('-').map(Number);
   return new Date(Date.UTC(y, m - 1, d + days)).toISOString();
};

// ── purposes (the loan reason) ───────────────────────────────────────────────────────────────────
// Stored in loans.reason in English (lenders, admin and the team read it); shown in Bahasa.
export const ID_PURPOSES: ReadonlyArray<{ id: string; en: string; reason: string }> = [
   { id: '🛒 Kebutuhan harian', en: '🛒 Daily needs', reason: 'Daily needs (food, groceries)' },
   { id: '🧾 Tagihan', en: '🧾 Bills', reason: 'Bills (electricity, phone, internet)' },
   { id: '🎒 Sekolah', en: '🎒 School', reason: 'School costs' },
   { id: '🏪 Usaha', en: '🏪 Business', reason: 'Small business stock or supplies' },
   { id: '👨‍👩‍👧 Keluarga', en: '👨‍👩‍👧 Family', reason: 'Family needs' },
   { id: '🛵 Transport', en: '🛵 Transport', reason: 'Transport (fuel, fares, motorbike)' }
];

// ── Walt top-up amount (same as src/views/indonesia/walt/WaltRepaySteps.tsx waltRepayAmount) ────
const MIN_USDT = 1;
const ceilCents = (usd: number) => Math.ceil(Math.round(usd * 1e6) / 1e4) / 100;

/** What's owed + ~1% (at least $0.30) for the bridge, at least $1, rounded up to cents. */
export const waltRepayAmount = (shortfall: number): number => {
   const s = Number.isFinite(shortfall) && shortfall > 0 ? shortfall : 0;
   const buffer = Math.max(0.3, s * 0.01);
   return Math.max(MIN_USDT, ceilCents(s + buffer));
};

/** USD still owed on a loan: rupiah left ÷ today's rate when pegged (else the USD left), rounded up to cents. */
export const idUsdLeft = (
   loan: { repay_idr?: number | string | null; repaid_idr?: number | string | null; total_repayment_amount?: number | string | null; repaid_amount?: number | string | null },
   rate: number | null | undefined
): { usd: number; idr: number | null } => {
   const repayIdr = Number(loan.repay_idr ?? NaN);
   const usdLeft = Math.max(0, Number(loan.total_repayment_amount ?? 0) - Number(loan.repaid_amount ?? 0));
   if (Number.isFinite(repayIdr) && repayIdr > 0) {
      const idrLeft = Math.max(0, Math.round(repayIdr - Number(loan.repaid_idr ?? 0)));
      if (rate && Number.isFinite(rate) && rate > 0) return { usd: ceilCents(idrLeft / rate), idr: idrLeft };
      return { usd: ceilCents(usdLeft), idr: idrLeft };
   }
   return { usd: ceilCents(usdLeft), idr: null };
};

// ── callback data (Telegram allows 1–64 bytes) ───────────────────────────────────────────────────
// menu/status/apply/repay/help send a new message; pick (back to the amounts) and stop (cancel → the
// menu) edit the loan-steps message they're on.
export type IdMenuAction = 'menu' | 'status' | 'apply' | 'repay' | 'help' | 'pick' | 'stop';
const MENU_ACTIONS: ReadonlySet<string> = new Set(['menu', 'status', 'apply', 'repay', 'help', 'pick', 'stop']);

export type IdBotCallback =
   | { kind: 'menu'; action: IdMenuAction }
   | { kind: 'amount'; amount: number }
   | { kind: 'term'; amount: number; days: number }
   | { kind: 'rupiah'; amount: number; days: number; rp: number }
   | { kind: 'purpose'; amount: number; days: number; rp: number; purpose: number }
   | { kind: 'confirm'; amount: number; days: number; rp: number; purpose: number };

const AMOUNT = '(\\d{1,4}(?:\\.\\d{1,2})?)';
const INT = '(\\d{1,3})';
const RP = '(\\d{4,9})';
const PATTERNS: Array<[RegExp, (m: RegExpExecArray) => IdBotCallback | null]> = [
   [/^idm:([a-z]{4,6})$/, (m) => (MENU_ACTIONS.has(m[1]) ? { kind: 'menu', action: m[1] as IdMenuAction } : null)],
   [new RegExp(`^ida:${AMOUNT}$`), (m) => ({ kind: 'amount', amount: Number(m[1]) })],
   [new RegExp(`^idt:${AMOUNT}:${INT}$`), (m) => ({ kind: 'term', amount: Number(m[1]), days: Number(m[2]) })],
   [new RegExp(`^idr:${AMOUNT}:${INT}:${RP}$`), (m) => ({ kind: 'rupiah', amount: Number(m[1]), days: Number(m[2]), rp: Number(m[3]) })],
   [
      new RegExp(`^idp:${AMOUNT}:${INT}:${RP}:(\\d)$`),
      (m) => ({ kind: 'purpose', amount: Number(m[1]), days: Number(m[2]), rp: Number(m[3]), purpose: Number(m[4]) })
   ],
   [
      new RegExp(`^idc:${AMOUNT}:${INT}:${RP}:(\\d)$`),
      (m) => ({ kind: 'confirm', amount: Number(m[1]), days: Number(m[2]), rp: Number(m[3]), purpose: Number(m[4]) })
   ]
];

/** Parse one of our callbacks; null for anything else (other handlers get it). */
export const parseIdBotCallback = (data: string | null | undefined): IdBotCallback | null => {
   const s = String(data ?? '');
   if (!/^id[mtarpc]:/.test(s) || s.length > 64) return null;
   for (const [re, build] of PATTERNS) {
      const m = re.exec(s);
      if (m) {
         const parsed = build(m);
         if (!parsed) return null;
         if ('purpose' in parsed && (parsed.purpose < 0 || parsed.purpose >= ID_PURPOSES.length)) return null;
         return parsed;
      }
   }
   return null;
};

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export const idCallback = {
   menu: (action: IdMenuAction) => `idm:${action}`,
   amount: (amount: number) => `ida:${num(amount)}`,
   term: (amount: number, days: number) => `idt:${num(amount)}:${days}`,
   rupiah: (amount: number, days: number, rp: number) => `idr:${num(amount)}:${days}:${Math.round(rp)}`,
   purpose: (amount: number, days: number, rp: number, purpose: number) => `idp:${num(amount)}:${days}:${Math.round(rp)}:${purpose}`,
   confirm: (amount: number, days: number, rp: number, purpose: number) => `idc:${num(amount)}:${days}:${Math.round(rp)}:${purpose}`
};

/** Telegram's limit: callback_data is 1–64 BYTES. */
export const callbackFits = (data: string) => {
   const bytes = new TextEncoder().encode(data).length;
   return bytes >= 1 && bytes <= 64;
};

/** Is this private-chat text a request for the menu? (/menu, bare /start, "menu", "pinjaman"). */
export const isIdMenuText = (text: string | null | undefined): boolean => {
   const t = String(text ?? '').trim().toLowerCase();
   return /^\/menu(@\w+)?$/.test(t) || /^\/start(@\w+)?$/.test(t) || t === 'menu' || t === 'pinjaman';
};
