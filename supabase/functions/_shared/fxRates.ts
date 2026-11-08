// Indonesia track: the rupiah peg (migration 20261107160000_indonesia_idr_peg.sql).
//
//   Borrowers owe a fixed number of rupiah (loans.repay_idr); the USD still due floats with the
//   USD/IDR rate. This keeps public.fx_rates fresh and the USD due current:
//
//   refreshUsdIdrRate — fetch USD→IDR from BOTH open.er-api.com and frankfurter.app, at most once per
//                       6h. Stored only when they agree within 2% (the average), or — when only one
//                       answers — when it is within 3% of the last stored rate (or nothing is stored
//                       yet and it's 10,000–30,000). Otherwise the old rate stays and the team is told
//                       (at most once per 6h)
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
export const SOURCES_AGREE_PCT = 0.02;
export const SINGLE_SOURCE_MAX_MOVE_PCT = 0.03;
const ALERT_EVERY_MS = 6 * 60 * 60_000;

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

type SourceRate = { rate: number; source: string };

const fetchOne = async (source: (typeof SOURCES)[number], fetchImpl: typeof fetch, timeoutMs: number): Promise<SourceRate | null> => {
   try {
      const res = await fetchImpl(source.url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) return null;
      const rate = saneUsdIdr(source.read(await res.json()));
      return rate == null ? null : { rate, source: source.name };
   } catch {
      return null;
   }
};

export type RateDecision = { store: SourceRate } | { store: null; error: 'no_rate_source' | 'sources_disagree' | 'single_source_off' };

/**
 * What to store given what each source answered and the last stored rate (any age). Pure.
 *   both answer   → their average when within 2% of each other, else nothing ('sources_disagree')
 *   one answers   → it, when within 3% of the last stored rate (or nothing stored yet), else nothing
 *   none          → nothing ('no_rate_source')
 */
export const decideUsdIdrRate = (got: (SourceRate | null)[], lastRate: number | null): RateDecision => {
   const ok = got.filter((g): g is SourceRate => g != null);
   if (ok.length >= 2) {
      const [a, b] = ok;
      const avg = (a.rate + b.rate) / 2;
      if (Math.abs(a.rate - b.rate) / avg > SOURCES_AGREE_PCT) return { store: null, error: 'sources_disagree' };
      return { store: { rate: Math.round(avg * 100) / 100, source: 'er-api+frankfurter' } };
   }
   if (ok.length === 1) {
      const only = ok[0];
      if (lastRate == null || !(lastRate > 0)) return { store: only };
      if (Math.abs(only.rate / lastRate - 1) <= SINGLE_SOURCE_MAX_MOVE_PCT) return { store: only };
      return { store: null, error: 'single_source_off' };
   }
   return { store: null, error: 'no_rate_source' };
};

export type RefreshResult = { rate: number | null; fetched: boolean; source?: string; error?: string };

const setSetting = async (svc: Svc, key: string, value: string) => {
   await svc.from('telegram_bot_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
};

/** Team line when the rate looks wrong, at most once per 6h (telegram_bot_settings.fx_rate_alerted_at). */
const alertRateProblem = async (svc: Svc, text: string) => {
   const last = await getSetting(svc, 'fx_rate_alerted_at');
   if (last && Date.now() - Date.parse(last) < ALERT_EVERY_MS) return;
   await setSetting(svc, 'fx_rate_alerted_at', new Date().toISOString());
   const chat = await adminChatId(svc);
   if (chat) await sendTelegramMessage(chat, text).catch(() => undefined);
};

/** Store a fresh USD/IDR rate unless one under 6h old exists. Returns the latest usable rate. */
export const refreshUsdIdrRate = async (
   svc: Svc,
   options: { fetchImpl?: typeof fetch; force?: boolean; deadline?: number; alert?: (text: string) => Promise<void> } = {}
): Promise<RefreshResult> => {
   try {
      const { data: latest } = await svc
         .from('fx_rates')
         .select('rate, fetched_at')
         .eq('pair', USD_IDR_PAIR)
         .order('fetched_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      const lastRate = latest ? saneUsdIdr(Number(latest.rate)) : null;
      if (!options.force && latest && isRateFresh(latest.fetched_at as string)) {
         return { rate: lastRate, fetched: false };
      }
      const timeoutMs = Math.max(1_000, Math.min(FETCH_TIMEOUT_MS, (options.deadline ?? Infinity) - Date.now()));
      const fetchImpl = options.fetchImpl ?? fetch;
      const got = await Promise.all(SOURCES.map((source) => fetchOne(source, fetchImpl, timeoutMs)));
      const decision = decideUsdIdrRate(got, lastRate);
      if (!decision.store) {
         const seen = got.map((g, i) => `${SOURCES[i].name}: ${g ? Math.round(g.rate).toLocaleString('en-US') : '—'}`).join(', ');
         const why =
            decision.error === 'sources_disagree'
               ? 'the two sources disagree by more than 2%'
               : decision.error === 'single_source_off'
                 ? 'only one source answered and it is more than 3% off the last stored rate'
                 : 'no source answered';
         const text = `⚠️ 🇮🇩 USD/IDR not updated: ${why} (${seen}; last stored ${lastRate ? Math.round(lastRate).toLocaleString('en-US') : '—'}). The old rate stays; ID requests stop if it gets older than 36h.`;
         await (options.alert ? options.alert(text) : alertRateProblem(svc, text)).catch(() => undefined);
         return { rate: lastRate, fetched: false, error: decision.error };
      }
      const { error } = await svc.from('fx_rates').insert({ pair: USD_IDR_PAIR, rate: decision.store.rate, source: decision.store.source });
      if (error) return { rate: decision.store.rate, fetched: false, source: decision.store.source, error: error.message };
      return { rate: decision.store.rate, fetched: true, source: decision.store.source };
   } catch (err) {
      return { rate: null, fetched: false, error: err instanceof Error ? err.message : String(err) };
   }
};

export type RepricingResult = { rate: number | null; fetched: boolean; repriced: number; alerted: number; error?: string };

/** Refresh the rate, re-price open pegged loans, and tell the team about big moves. */
export const runIdrRepricing = async (svc: Svc, deadline?: number): Promise<RepricingResult> => {
   const refresh = await refreshUsdIdrRate(svc, { deadline });
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
