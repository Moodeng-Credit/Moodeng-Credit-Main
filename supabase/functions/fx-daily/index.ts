// Daily FX snapshot + "FX today" note for the team (admin → Finance → Borrower real cost).
//
// Called by pg_cron (fx-daily-snapshot, 09:15 Manila, retried hourly until noon). Saves today's
// USDC→PHP / USDC→IDR rates and the exchanges' top-of-book buy/sell prices (fx_daily_snapshots), then
// posts once a day to the team Telegram group and Discord: today's rate, its move vs yesterday and 30
// days ago, the live spread, and what the seasonal model expects for a loan funded this month, with
// the suggested fee. The seasonal estimate mirrors src/app/admin/borrowerCostModel.ts (seasonalForecast,
// suggestedFee): all years since 2000 blended with the last 10, 30-day horizon.
//
// Body: {} (scheduler) · { dryRun: true } → returns the note without saving or posting · { force: true }
// → posts even if today's note already went out. Internal callers only (isInternalRequest).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { isInternalRequest } from '../_shared/internalAuth.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

type Currency = 'PHP' | 'IDR';
type Snapshot = { currency: Currency; venue: string; mid: number | null; bid: number | null; ask: number | null };

const DAY_MS = 86_400_000;
const POSTED_KEY = 'fx_daily_date';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const manilaDate = (d = new Date()) => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
const getJson = async (url: string) => {
   const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
   if (!res.ok) throw new Error(`${url} → ${res.status}`);
   return await res.json();
};
const settle = async <T>(p: Promise<T>): Promise<T | null> => {
   try {
      return await p;
   } catch (err) {
      console.error('fx-daily source failed:', err instanceof Error ? err.message : err);
      return null;
   }
};

// ---- sources ----------------------------------------------------------------------------------

const fetchSnapshots = async (): Promise<Snapshot[]> => {
   const [coinbase, coinsPh, toko, indodax] = await Promise.all([
      settle(getJson('https://api.coinbase.com/v2/exchange-rates?currency=USDC')),
      settle(getJson('https://api.pro.coins.ph/openapi/quote/v1/ticker/bookTicker?symbol=USDCPHP')),
      settle(getJson('https://www.tokocrypto.com/open/v1/market/depth?symbol=USDC_IDR&limit=5')),
      settle(getJson('https://indodax.com/api/ticker/usdcidr'))
   ]);
   const out: Snapshot[] = [];
   for (const c of ['PHP', 'IDR'] as Currency[]) {
      const mid = num(coinbase?.data?.rates?.[c]);
      if (mid) out.push({ currency: c, venue: 'coinbase', mid, bid: null, ask: null });
   }
   const book = (currency: Currency, venue: string, bid: unknown, ask: unknown) => {
      const b = num(bid);
      const a = num(ask);
      if (b && a && a >= b) out.push({ currency, venue, mid: (a + b) / 2, bid: b, ask: a });
   };
   book('PHP', 'coins_ph', coinsPh?.bidPrice, coinsPh?.askPrice);
   book('IDR', 'tokocrypto', toko?.data?.bids?.[0]?.[0], toko?.data?.asks?.[0]?.[0]);
   book('IDR', 'indodax', indodax?.ticker?.buy, indodax?.ticker?.sell);
   return out;
};

// ---- seasonal model (mirrors borrowerCostModel.seasonalForecast) ------------------------------

type Series = Array<[string, number]>;

const seasonal = (series: Series, now: Date, horizonDays = 30, recentYears = 10) => {
   const times = series.map(([d]) => Date.parse(d));
   const recentFrom = now.getUTCFullYear() - recentYears;
   const byMonth = Array.from({ length: 12 }, () => ({ all: [] as number[], recent: [] as number[] }));
   let j = 0;
   for (let i = 0; i < series.length; i += 1) {
      while (j < series.length && times[j] < times[i] + horizonDays * DAY_MS) j += 1;
      if (j >= series.length) break;
      const change = series[j][1] / series[i][1] - 1;
      const m = Number(series[i][0].slice(5, 7)) - 1;
      byMonth[m].all.push(change);
      if (Number(series[i][0].slice(0, 4)) >= recentFrom) byMonth[m].recent.push(change);
   }
   const mean = (v: number[]) => (v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0);
   return byMonth.map(({ all, recent }) => {
      const sorted = [...all].sort((a, b) => a - b);
      return {
         estimate: (mean(all) + (recent.length ? mean(recent) : mean(all))) / 2,
         p90: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length))] : 0
      };
   });
};

const median = (values: number[]) => {
   const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
   if (!s.length) return null;
   const mid = Math.floor(s.length / 2);
   return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ---- note -------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SYMBOL: Record<Currency, string> = { PHP: '₱', IDR: 'Rp' };
const signed = (n: number | null, digits = 2) => (n === null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(digits)}%`);
const fmtRate = (c: Currency, v: number) => `${SYMBOL[c]}${v.toLocaleString('en-US', { maximumFractionDigits: c === 'IDR' ? 0 : 2 })}`;

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   if (!(await isInternalRequest(supabase, req))) return json({ error: 'Unauthorized' }, 401);
   const { dryRun = false, force = false } = await req.json().catch(() => ({}));

   try {
      const now = new Date();
      const today = manilaDate(now);
      const [snapshots, history] = await Promise.all([
         fetchSnapshots(),
         getJson('https://api.frankfurter.dev/v1/2000-01-01..?base=USD&symbols=PHP,IDR') as Promise<{ rates?: Record<string, Record<string, number>> }>
      ]);
      const ecbDays = Object.keys(history.rates ?? {}).sort();
      const lastEcb = ecbDays.at(-1);
      for (const c of ['PHP', 'IDR'] as Currency[]) {
         const mid = lastEcb ? num(history.rates?.[lastEcb]?.[c]) : null;
         if (mid) snapshots.push({ currency: c, venue: 'ecb', mid, bid: null, ask: null });
      }

      if (!dryRun && snapshots.length) {
         const { error } = await supabase
            .from('fx_daily_snapshots')
            .upsert(snapshots.map((s) => ({ ...s, snapshot_date: today, captured_at: now.toISOString() })), { onConflict: 'snapshot_date,currency,venue' });
         if (error) throw new Error(`saving snapshots: ${error.message}`);
      }

      // Yesterday's (or the latest earlier) Coinbase mid, for the day-over-day move.
      const { data: previous } = await supabase
         .from('fx_daily_snapshots')
         .select('snapshot_date, currency, mid')
         .eq('venue', 'coinbase')
         .lt('snapshot_date', today)
         .order('snapshot_date', { ascending: false })
         .limit(10);

      // Base fee for the suggestion: the median fee on loans funded in the last 40 days.
      const { data: loans } = await supabase
         .from('loans')
         .select('loan_amount, total_repayment_amount')
         .eq('loan_status', 'Lent')
         .eq('is_test', false)
         .gte('funded_at', new Date(now.getTime() - 40 * DAY_MS).toISOString());
      const baseFee =
         median(((loans ?? []) as Array<{ loan_amount: number; total_repayment_amount: number }>).map((l) => Number(l.total_repayment_amount) / Number(l.loan_amount) - 1)) ?? 0.1;

      const month = Number(today.slice(5, 7)) - 1;
      const lines = [`📈 FX today · ${today}`];
      for (const c of ['PHP', 'IDR'] as Currency[]) {
         const series: Series = ecbDays.map((d) => [d, Number(history.rates?.[d]?.[c])] as [string, number]).filter(([, v]) => Number.isFinite(v) && v > 0);
         const live = snapshots.find((s) => s.currency === c && s.venue === 'coinbase')?.mid ?? series.at(-1)?.[1] ?? null;
         if (!live) continue;
         const prev = (previous ?? []).find((p: { currency: string }) => p.currency === c)?.mid as number | undefined;
         // 30-day move on the ECB series at both ends (sources differ by a few tenths of a percent).
         const lastEcbRate = series.at(-1);
         const monthAgoDay = lastEcbRate ? new Date(Date.parse(lastEcbRate[0]) - 30 * DAY_MS).toISOString().slice(0, 10) : '';
         const monthAgo = [...series].reverse().find(([d]) => d <= monthAgoDay)?.[1] ?? null;
         const ecbMove = lastEcbRate && monthAgo ? lastEcbRate[1] / monthAgo - 1 : null;
         const book = snapshots.find((s) => s.currency === c && s.bid && s.ask && (c === 'PHP' ? s.venue === 'coins_ph' : s.venue === 'tokocrypto'));
         const spread = book?.bid && book?.ask && book.mid ? (book.ask - book.bid) / book.mid : null;
         const model = seasonal(series, now);
         const yearAvg = model.reduce((t, m) => t + m.estimate, 0) / 12;
         const expected = model[month]?.estimate ?? 0;
         const fee = Math.max(0, baseFee - (expected - yearAvg));
         lines.push(
            '',
            `${c === 'PHP' ? '🇵🇭' : '🇮🇩'} 1 USDC = ${fmtRate(c, live)} · ${signed(prev ? live / prev - 1 : null)} vs yesterday · ${signed(ecbMove)} vs 30 days`,
            `Spread ${spread === null ? '—' : `${(spread * 100).toFixed(3)}%`} (${c === 'PHP' ? 'Coins.ph' : 'Tokocrypto'} book)`,
            `Loans funded in ${MONTHS[month]}: expected ${signed(expected)} over 30 days (bad case ${signed(model[month]?.p90 ?? null)}) → suggested fee ${(fee * 100).toFixed(1)}% (base ${(baseFee * 100).toFixed(1)}%)`
         );
      }
      lines.push('', '+ = the currency weakens, so repaying costs borrowers more. Details: admin → Finance → Borrower real cost.');
      const note = lines.join('\n');

      if (dryRun) return json({ note, snapshots });

      if (!force) {
         const { data: posted } = await supabase.from('telegram_bot_settings').select('value').eq('key', POSTED_KEY).maybeSingle();
         if (posted?.value === today) return json({ message: 'Snapshot saved; note already posted today.' });
      }
      const { data: chat } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
      const chatId = (chat?.value as string | undefined) ?? Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
      const telegramOk = chatId
         ? await sendTelegramMessage(chatId, note)
              .then(() => true)
              .catch((err) => {
                 console.error('fx-daily Telegram failed:', err instanceof Error ? err.message : err);
                 return false;
              })
         : false;
      const discordOk = await postDiscord({ embeds: [{ title: '📈 FX today', description: note, color: 0xa78bfa, timestamp: now.toISOString() }] });
      if (telegramOk || discordOk) {
         await supabase
            .from('telegram_bot_settings')
            .upsert({ key: POSTED_KEY, value: today, description: 'Last Manila date the daily FX note was posted (fx-daily).' }, { onConflict: 'key' });
      }
      return json({ message: 'FX snapshot saved', posted: { telegram: telegramOk, discord: discordOk }, rows: snapshots.length });
   } catch (err) {
      console.error('fx-daily failed:', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'fx-daily failed' }, 500);
   }
});
