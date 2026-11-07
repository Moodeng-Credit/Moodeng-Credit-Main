// Indonesia track: the rupiah peg (migration 20261107160000_indonesia_idr_peg.sql).
//
//   Borrowers owe a fixed number of rupiah (loans.repay_idr); the USD still due floats with the
//   USD/IDR rate. This keeps public.fx_rates fresh and the USD due current:
//
//   refreshUsdIdrRate — fetch USD→IDR (open.er-api.com, fallback frankfurter.app), sanity-check it
//                       and store it in fx_rates, at most once per 6h
//   runIdrRepricing   — refresh, then public.reprice_id_loans() (total_repayment_amount = repaid +
//                       rupiah left ÷ today's rate), and one team Telegram line per loan whose rate
//                       moved > 5% since the request
//
// Meant for the 5-minute job. Never throws to callers.

import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const USD_IDR_PAIR = 'USD/IDR';
export const USD_IDR_MIN = 10_000;
export const USD_IDR_MAX = 30_000;
export const RATE_REFRESH_MS = 6 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

const SOURCES: { name: string; url: string; read: (body: unknown) => unknown }[] = [
   {
      name: 'open.er-api.com',
      url: 'https://open.er-api.com/v6/latest/USD',
      read: (b) => (b as { rates?: Record<string, unknown> } | null)?.rates?.IDR
   },
   {
      name: 'frankfurter.app',
      url: 'https://api.frankfurter.app/latest?from=USD&to=IDR',
      read: (b) => (b as { rates?: Record<string, unknown> } | null)?.rates?.IDR
   }
];

/** A usable USD→IDR rate, or null (not a number, or outside 10,000–30,000). Pure. */
export const saneUsdIdr = (value: unknown): number | null => {
   const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
   if (!Number.isFinite(n) || n < USD_IDR_MIN || n > USD_IDR_MAX) return null;
   return n;
};

/** True when the latest stored rate is recent enough to skip fetching. Pure. */
export const isRateFresh = (fetchedAt: string | null | undefined, now = Date.now(), maxAgeMs = RATE_REFRESH_MS): boolean => {
   if (!fetchedAt) return false;
   const at = Date.parse(fetchedAt);
   return Number.isFinite(at) && now - at < maxAgeMs;
};

/** "Rp 110.000" — whole rupiah, Indonesian grouping. Pure. */
export const formatIdr = (idr: number | string | null | undefined): string => {
   const n = Math.round(Number(idr ?? 0));
   return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)}`;
};

/** Rupiah still owed on a pegged loan (repay_idr − repaid_idr, never below 0), or null when not pegged. Pure. */
export const remainingIdr = (loan: { repay_idr?: number | string | null; repaid_idr?: number | string | null } | null | undefined): number | null => {
   if (!loan || loan.repay_idr == null) return null;
   const total = Number(loan.repay_idr);
   if (!Number.isFinite(total) || total <= 0) return null;
   const paid = Number(loan.repaid_idr ?? 0);
   return Math.max(0, Math.round(total - (Number.isFinite(paid) ? paid : 0)));
};

/** Sum of rupiah left over several loans; null unless every loan is pegged. Pure. */
export const sumRemainingIdr = (loans: { repay_idr?: number | string | null; repaid_idr?: number | string | null }[]): number | null => {
   if (!loans.length) return null;
   let sum = 0;
   for (const loan of loans) {
      const left = remainingIdr(loan);
      if (left == null) return null;
      sum += left;
   }
   return sum;
};

export type MovedLoan = {
   id: string;
   trackingId: string | null;
   loanStatus: string | null;
   loanAmount: number | string | null;
   repayIdr: number | string | null;
   repaidIdr: number | string | null;
   totalRepaymentAmount: number | string | null;
   rateAtRequest: number | string | null;
   rateNow: number | string | null;
   movePct: number | string | null;
};

/** The team line for one loan whose rate moved > 5%. Pure. */
export const buildFxMovedAlert = (m: MovedLoan): string => {
   const pct = Number(m.movePct ?? 0);
   const left = remainingIdr({ repay_idr: m.repayIdr, repaid_idr: m.repaidIdr }) ?? 0;
   const usdDue = Number(m.totalRepaymentAmount ?? 0);
   const rateAt = Math.round(Number(m.rateAtRequest ?? 0));
   const rateNow = Math.round(Number(m.rateNow ?? 0));
   // Rate up = rupiah weaker = fewer USD back for the same rupiah (Moodeng carries it).
   const direction = pct > 0 ? 'weaker, fewer USD back' : 'stronger, more USD back';
   return (
      `🇮🇩 Rupiah moved ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% on loan ${m.trackingId ?? m.id.slice(0, 8)} (${direction}). ` +
      `$${Number(m.loanAmount ?? 0)} ${m.loanStatus === 'Requested' ? 'request' : 'loan'}, ${formatIdr(m.repayIdr)} promised, ${formatIdr(left)} left ≈ $${usdDue.toFixed(2)} due now. ` +
      `USD/IDR ${rateAt.toLocaleString('en-US')} → ${rateNow.toLocaleString('en-US')}.`
   );
};

const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};

const adminChatId = async (svc: Svc): Promise<string | null> =>
   (await getSetting(svc, 'kyc_alert_chat_id')) || Deno.env.get('TEAM_TELEGRAM_CHAT_ID') || (await getSetting(svc, 'team_group_chat_id'));

const fetchRate = async (fetchImpl: typeof fetch = fetch): Promise<{ rate: number; source: string } | null> => {
   for (const source of SOURCES) {
      try {
         const res = await fetchImpl(source.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
         if (!res.ok) continue;
         const rate = saneUsdIdr(source.read(await res.json()));
         if (rate != null) return { rate, source: source.name };
      } catch {
         // try the next source
      }
   }
   return null;
};

export type RefreshResult = { rate: number | null; fetched: boolean; source?: string; error?: string };

/** Store a fresh USD/IDR rate unless one under 6h old exists. Returns the latest usable rate. */
export const refreshUsdIdrRate = async (svc: Svc, options: { fetchImpl?: typeof fetch; force?: boolean } = {}): Promise<RefreshResult> => {
   try {
      const { data: latest } = await svc
         .from('fx_rates')
         .select('rate, fetched_at')
         .eq('pair', USD_IDR_PAIR)
         .order('fetched_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      if (!options.force && latest && isRateFresh(latest.fetched_at as string)) {
         return { rate: saneUsdIdr(Number(latest.rate)), fetched: false };
      }
      const got = await fetchRate(options.fetchImpl);
      if (!got) return { rate: null, fetched: false, error: 'no_rate_source' };
      const { error } = await svc.from('fx_rates').insert({ pair: USD_IDR_PAIR, rate: got.rate, source: got.source });
      if (error) return { rate: got.rate, fetched: false, source: got.source, error: error.message };
      return { rate: got.rate, fetched: true, source: got.source };
   } catch (err) {
      return { rate: null, fetched: false, error: err instanceof Error ? err.message : String(err) };
   }
};

export type RepricingResult = { rate: number | null; fetched: boolean; repriced: number; alerted: number; error?: string };

/** Refresh the rate, re-price open pegged loans, and tell the team about big moves. */
export const runIdrRepricing = async (svc: Svc): Promise<RepricingResult> => {
   const refresh = await refreshUsdIdrRate(svc);
   try {
      const { data, error } = await svc.rpc('reprice_id_loans');
      if (error) return { rate: refresh.rate, fetched: refresh.fetched, repriced: 0, alerted: 0, error: error.message };
      const result = (data ?? {}) as { rate?: number | null; repriced?: number; moved?: MovedLoan[] };
      const moved = Array.isArray(result.moved) ? result.moved : [];
      let alerted = 0;
      if (moved.length) {
         const chat = await adminChatId(svc);
         if (chat) {
            for (const m of moved) {
               const ok = await sendTelegramMessage(chat, buildFxMovedAlert(m))
                  .then(() => true)
                  .catch(() => false);
               if (ok) alerted += 1;
            }
         }
      }
      return {
         rate: result.rate == null ? refresh.rate : Number(result.rate),
         fetched: refresh.fetched,
         repriced: Number(result.repriced ?? 0),
         alerted,
         ...(refresh.error ? { error: refresh.error } : {})
      };
   } catch (err) {
      return { rate: refresh.rate, fetched: refresh.fetched, repriced: 0, alerted: 0, error: err instanceof Error ? err.message : String(err) };
   }
};
