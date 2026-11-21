// Indonesia track: the Walt watch (migration 20261112170000_walt_watch.sql). Reads Moodeng's Walt history
// (READ-ONLY) every 5 minutes so Walt Transfers confirm themselves:
//
//   money OUT to a borrower, the exact loan amount, after their request  → the loan is paid out
//                                                   (recordWaltTransferPayout, same as "✅ Sent")
//   money IN from a borrower, the exact amount of their 💰 Bayar request → the repayment is recorded
//                                                   (recordWaltTransferArrival, same as "✅ Arrived")
//   money IN, more than their 💰 Bayar amount      → records what they owed + a "send the extra back" card
//   anything else (wrong amount, unknown sender)   → a line to the team; the buttons still work
//   the USDT balance                               → walt_pot_usdt; a top-up card below walt_pot_low_usd or
//                                                     below what open requests need (/waltpot)
//
// Sending money stays by hand in Walt: this never moves money. Switch: telegram_bot_settings.walt_watch =
// off | observe (only posts what it WOULD confirm — the first days, to learn Walt's real status values) | on.
// /waltwatch [on|observe|off] and /waltconnect <tgWebAppData> in an admin chat.
//
// Walt has no public API. The login and the two reads below are ported from @2bad/walt (MIT License,
// Copyright (c) 2BAD, https://github.com/2BAD/walt): the web app's own endpoints, same headers. We keep only
// Walt's renewable web-app token (vault WALT_SESSION), never a Telegram session: a one-time login from the
// web app's tgWebAppData, then refresh tokens. If Walt rejects it, the watch stops and the team is told once;
// the ✅ buttons keep working.
import { recordWaltTransferPayout } from './idManualFunding.ts';
import { adminChatIds, openWaltRequests, overpaidRefundCard, recordWaltTransferArrival, requestUnitsOf } from './idRepayments.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const BASE_URL = 'https://walletbot.me';
const AUTH_URL = 'https://alectryon.walletbot.me';
const EXPIRY_SKEW_MS = 30_000;

// What the Walt web app sends (from @2bad/walt, captured from real traffic).
const BROWSER_HEADERS: Record<string, string> = {
   'accept-language': 'en-US,en;q=0.9',
   'cache-control': 'no-cache',
   pragma: 'no-cache',
   'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
   'sec-ch-ua-mobile': '?0',
   'sec-ch-ua-platform': '"Windows"',
   'sec-fetch-dest': 'empty',
   'sec-fetch-mode': 'cors',
   'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'
};

export type WaltSession = {
   jwt: string;
   refreshToken: string;
   sessionId: string;
   expiresAt: number;
   deviceSerial: string;
   /** Telegram id + @username of the Walt account (from the login). */
   tgId: number | null;
   username: string | null;
   /** Walt history from before this moment is never acted on. */
   connectedAt: string;
};

type AuthResponse = {
   jwt: string;
   refresh_token: string;
   session_id: string;
   access_token_expires_at: string;
   access_token_expires_in: number;
};

export type WaltTx = {
   id: number;
   type: string;
   created_at: string;
   amount: string;
   currency: string;
   status: string;
   gateway: string;
   is_blocked: boolean;
   username: string | null;
   tg_id: number | null;
};

class WaltAuthError extends Error {}

// ── pure helpers (waltWatch.test.ts) ─────────────────────────────────────────────────────────────
/** "5.000000" / "-6.08" → 500 / 608 cents (absolute), or null when not a whole number of cents. */
export const txCents = (amount: string): number | null => {
   const s = String(amount).trim().replace(/^[-+]/, '');
   if (!/^\d+(\.\d+)?$/.test(s)) return null;
   const [w, f = ''] = s.split('.');
   if (f.slice(2).replace(/0/g, '') !== '') return null;
   return Number(w) * 100 + Number((f + '00').slice(0, 2));
};

/** Walt statuses we treat as final and successful. Anything else waits (or is only observed). */
export const isDone = (tx: Pick<WaltTx, 'status' | 'is_blocked'>): boolean =>
   !tx.is_blocked &&
   ['success', 'succeeded', 'completed', 'complete', 'done', 'confirmed', 'finished'].includes(String(tx.status).toLowerCase());

/** The Telegram user in a web app's tgWebAppData (`user=<json>`), or null. */
export const initDataUser = (initData: string): { id: number; username: string | null } | null => {
   try {
      const raw = new URLSearchParams(initData).get('user');
      if (!raw) return null;
      const u = JSON.parse(raw) as { id?: unknown; username?: unknown };
      return typeof u.id === 'number' ? { id: u.id, username: typeof u.username === 'string' ? u.username : null } : null;
   } catch {
      return null;
   }
};

/** tgWebAppData pasted alone, or inside a web app URL (…#tgWebAppData=…&tgWebAppVersion=…). */
export const extractInitData = (pasted: string): string | null => {
   const t = pasted.trim();
   const hash = t.includes('#') ? t.slice(t.indexOf('#') + 1) : t;
   const fromUrl = new URLSearchParams(hash).get('tgWebAppData');
   const candidate = fromUrl ?? (t.startsWith('query_id=') || t.startsWith('user=') || t.includes('&hash=') ? t : null);
   if (!candidate) return null;
   // A raw paste may still be URL-encoded once more (copied from the iframe src).
   const decoded = candidate.includes('%3D') && !candidate.includes('=') ? decodeURIComponent(candidate) : candidate;
   return decoded.includes('hash=') ? decoded : null;
};

// ── settings ─────────────────────────────────────────────────────────────────────────────────────
const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};
const setSetting = (svc: Svc, key: string, value: string) =>
   svc
      .from('telegram_bot_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(
         () => undefined,
         () => undefined
      );

export const watchMode = async (svc: Svc): Promise<'off' | 'observe' | 'on'> => {
   const v = String((await getSetting(svc, 'walt_watch')) ?? 'observe')
      .trim()
      .toLowerCase();
   return v === 'on' ? 'on' : v === 'off' ? 'off' : 'observe';
};

// Walt watch alerts (login lost, pot low) go to the Indonesia ops chat when one is set
// (`id_alert_chat_id`), otherwise to the first admin chat.
const tellTeam = async (svc: Svc, text: string, keyboard?: TelegramInlineKeyboard) => {
   const chat = (await getSetting(svc, 'id_alert_chat_id'))?.trim() || (await adminChatIds(svc))[0];
   if (chat) await sendTelegramMessage(chat, text, keyboard ? { inlineKeyboard: keyboard } : {}).catch(() => undefined);
};

// ── the session (vault WALT_SESSION) ─────────────────────────────────────────────────────────────
const loadSession = async (svc: Svc): Promise<WaltSession | null> => {
   try {
      const { data } = await svc.rpc('walt_session_get');
      if (typeof data !== 'string' || !data.trim()) return null;
      const s = JSON.parse(data) as WaltSession;
      return s.refreshToken || s.jwt ? s : null;
   } catch {
      return null;
   }
};

const saveSession = async (svc: Svc, s: WaltSession | null) => {
   const { error } = await svc.rpc('walt_session_set', { p_value: s ? JSON.stringify(s) : '' });
   if (error) throw new Error(`walt_session_set: ${error.message}`);
};

const authPost = async (path: string, body: Record<string, unknown>): Promise<AuthResponse> => {
   const res = await fetch(`${AUTH_URL}${path}`, {
      method: 'POST',
      headers: {
         ...BROWSER_HEADERS,
         accept: '*/*',
         'sec-fetch-site': 'same-site',
         'content-type': 'application/json',
         origin: BASE_URL,
         referer: `${BASE_URL}/`,
         'x-wallet-tz-name': 'Asia/Bangkok',
         'x-wallet-tz-offset': '420'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
   });
   if (!res.ok) {
      const text = (await res.text()).slice(0, 200);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new WaltAuthError(`${path} ${res.status}: ${text}`);
      throw new Error(`${path} ${res.status}: ${text}`);
   }
   return (await res.json()) as AuthResponse;
};

const expiryOf = (d: AuthResponse) =>
   Number.isFinite(d.access_token_expires_in)
      ? Date.now() + d.access_token_expires_in * 1000
      : Number.isNaN(Date.parse(d.access_token_expires_at))
        ? Date.now() + 300_000
        : Date.parse(d.access_token_expires_at);

/** One-time login from the Walt web app's tgWebAppData. Only Moodeng's Walt account (id_walt_username) is accepted. */
export const waltConnect = async (svc: Svc, pasted: string): Promise<{ ok: true; username: string } | { ok: false; error: string }> => {
   const initData = extractInitData(pasted);
   if (!initData) return { ok: false, error: 'That isn’t the Walt web app data (tgWebAppData).' };
   const user = initDataUser(initData);
   const expected = String((await getSetting(svc, 'id_walt_username')) ?? '')
      .replace(/^@/, '')
      .toLowerCase();
   if (!user) return { ok: false, error: 'No Telegram user in it.' };
   if (!expected || (user.username ?? '').toLowerCase() !== expected) {
      return {
         ok: false,
         error: `That login is @${user.username ?? '?'}; only @${expected || '(id_walt_username not set)'} can be connected.`
      };
   }
   const deviceSerial = `weba:${crypto.randomUUID()}`;
   try {
      const d = await authPost('/alectryon/public-api/auth', {
         web_view_init_data_raw: initData,
         ep: 'menu',
         device_serial_multi_domain_backup_supported: true,
         device_serial_fallback: deviceSerial
      });
      await saveSession(svc, {
         jwt: d.jwt,
         refreshToken: d.refresh_token,
         sessionId: d.session_id,
         expiresAt: expiryOf(d),
         deviceSerial,
         tgId: user.id,
         username: user.username,
         connectedAt: new Date().toISOString()
      });
      await setSetting(svc, 'walt_watch_alerted_at', '');
      return { ok: true, username: user.username ?? String(user.id) };
   } catch (err) {
      return { ok: false, error: `Walt refused the login: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300) };
   }
};

/** A fresh jwt, refreshing (and saving the rotated refresh token) when needed. Throws WaltAuthError when it's gone. */
const freshSession = async (svc: Svc, force = false): Promise<WaltSession> => {
   const s = await loadSession(svc);
   if (!s) throw new WaltAuthError('not_connected');
   if (!force && Date.now() < s.expiresAt - EXPIRY_SKEW_MS) return s;
   if (!s.refreshToken) throw new WaltAuthError('no_refresh_token');
   const d = await authPost('/alectryon/public-api/auth-refresh', {
      session_id: s.sessionId,
      refresh_token: s.refreshToken,
      device_serial: s.deviceSerial
   });
   const next: WaltSession = { ...s, jwt: d.jwt, refreshToken: d.refresh_token, sessionId: d.session_id, expiresAt: expiryOf(d) };
   await saveSession(svc, next);
   return next;
};

const waltGet = async <T>(svc: Svc, path: string): Promise<T> => {
   for (let attempt = 0; attempt < 2; attempt += 1) {
      const s = await freshSession(svc, attempt > 0);
      const res = await fetch(`${BASE_URL}${path}`, {
         headers: {
            ...BROWSER_HEADERS,
            accept: 'application/json',
            'sec-fetch-site': 'same-origin',
            authorization: s.jwt,
            referer: `${BASE_URL}/main?ep=menu${s.tgId ? `&tgWebAppUserId=${s.tgId}` : ''}`
         },
         signal: AbortSignal.timeout(15_000)
      });
      if (res.status === 401 && attempt === 0) continue;
      if (res.status === 401) throw new WaltAuthError(`${path} 401`);
      if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()) as T;
   }
   throw new WaltAuthError('unreachable');
};

// ── matching ─────────────────────────────────────────────────────────────────────────────────────
type OpenLoan = {
   id: string;
   tracking_id: string | null;
   loan_amount: number | string;
   created_at: string;
   telegram_id: number | null;
   telegram_username: string | null;
};

const openIdLoans = async (svc: Svc): Promise<OpenLoan[]> => {
   const { data: loans } = await svc
      .from('loans')
      .select('id, tracking_id, loan_amount, created_at, borrower_user_id')
      .eq('market', 'ID')
      .eq('loan_status', 'Requested')
      .is('lender_user_id', null)
      .is('funded_at', null)
      .limit(200);
   const rows = (loans ?? []) as Array<{
      id: string;
      tracking_id: string | null;
      loan_amount: number | string;
      created_at: string;
      borrower_user_id: string;
   }>;
   if (!rows.length) return [];
   const { data: users } = await svc
      .from('users')
      .select('id, telegram_id, telegram_username')
      .in('id', [...new Set(rows.map((r) => r.borrower_user_id))]);
   const byId = new Map(
      ((users ?? []) as Array<{ id: string; telegram_id: number | string | null; telegram_username: string | null }>).map((u) => [u.id, u])
   );
   return rows.map((r) => {
      const u = byId.get(r.borrower_user_id);
      return { ...r, telegram_id: u?.telegram_id != null ? Number(u.telegram_id) : null, telegram_username: u?.telegram_username ?? null };
   });
};

const sameUser = (tx: WaltTx, tgId: number | null, username: string | null) =>
   (tx.tg_id != null && tgId != null && Number(tx.tg_id) === Number(tgId)) ||
   (!!tx.username && !!username && tx.username.replace(/^@/, '').toLowerCase() === username.replace(/^@/, '').toLowerCase());

type Outcome = { outcome: string; loan_id?: string | null; request_id?: number | null; note?: string };

const handleOut = async (svc: Svc, tx: WaltTx, mode: 'observe' | 'on'): Promise<Outcome> => {
   const cents = txCents(tx.amount);
   const candidates = (await openIdLoans(svc)).filter(
      (l) => sameUser(tx, l.telegram_id, l.telegram_username) && Date.parse(l.created_at) <= Date.parse(tx.created_at)
   );
   const exact = candidates.filter((l) => Math.round(Number(l.loan_amount) * 100) === cents);
   const who = tx.username ? `@${tx.username}` : `tg ${tx.tg_id}`;
   if (exact.length !== 1) {
      if (!candidates.length) return { outcome: 'out_not_a_loan', note: `${tx.amount} ${tx.currency} to ${who}` };
      await tellTeam(
         svc,
         `🟡 Walt watch: you sent ${tx.amount} ${tx.currency} to ${who}, but their open request is ${candidates.map((l) => `$${l.loan_amount}`).join(', ')}. Not matched — tap ✅ Sent on the card if it’s right.`
      );
      return { outcome: 'out_amount_mismatch', loan_id: candidates[0].id };
   }
   const loan = exact[0];
   const label = loan.tracking_id ?? loan.id.slice(0, 8);
   if (mode === 'observe') {
      await tellTeam(
         svc,
         `👀 Walt watch (observe): saw ${tx.amount} USDT → ${who} (status ${tx.status}). Would mark 🇮🇩 ${label} paid out.`
      );
      return { outcome: 'would_record_payout', loan_id: loan.id };
   }
   const r = await recordWaltTransferPayout(svc, loan.id);
   if (r.ok) await tellTeam(svc, `✅ Walt watch: ${tx.amount} USDT → ${who} seen in Walt. 🇮🇩 ${label} marked paid out.`);
   return { outcome: r.ok ? 'payout_recorded' : `payout_failed:${r.error ?? '?'}`, loan_id: loan.id };
};

const handleIn = async (svc: Svc, tx: WaltTx, mode: 'observe' | 'on'): Promise<Outcome> => {
   const cents = txCents(tx.amount);
   const reqs = await openWaltRequests(svc);
   if (!reqs.length) return { outcome: 'in_no_open_request' };
   const { data: users } = await svc
      .from('users')
      .select('id, telegram_id, telegram_username')
      .in('id', [...new Set(reqs.map((r) => r.user_id))]);
   const userById = new Map(
      ((users ?? []) as Array<{ id: string; telegram_id: number | string | null; telegram_username: string | null }>).map((u) => [u.id, u])
   );
   const mine = reqs.filter((r) => {
      const u = userById.get(r.user_id);
      return (
         u &&
         sameUser(tx, u.telegram_id != null ? Number(u.telegram_id) : null, u.telegram_username) &&
         Date.parse(r.created_at) <= Date.parse(tx.created_at)
      );
   });
   const reqCents = (r: (typeof reqs)[number]) => {
      const units = requestUnitsOf(r.amount_units);
      return units % 10n ** 16n === 0n ? Number(units / 10n ** 16n) : null;
   };
   const exact = mine.filter((r) => reqCents(r) === cents);
   const who = tx.username ? `@${tx.username}` : `tg ${tx.tg_id}`;
   // Paid MORE than their one 💰 Bayar amount: record what they owed; the team sends the extra back.
   const over =
      cents == null || exact.length
         ? []
         : mine.filter((r) => {
              const c = reqCents(r);
              return c != null && c < cents;
           });
   if (over.length === 1 && cents != null) {
      const req = over[0];
      const asked = reqCents(req)!;
      const note = `paid=${cents} asked=${asked} extra=${cents - asked}`;
      if (mode === 'observe') {
         await tellTeam(
            svc,
            `👀 Walt watch (observe): ${who} sent ${tx.amount} USDT but owed ${(asked / 100).toFixed(2)}. Would record ${(asked / 100).toFixed(2)} on their loan and ask you to send ${((cents - asked) / 100).toFixed(2)} back.`
         );
         return { outcome: 'would_record_overpaid', request_id: req.id, loan_id: req.loan_id, note };
      }
      const r = await recordWaltTransferArrival(svc, req, { by: 'walt_watch', walt_tx: tx.id, overpaid_cents: cents - asked }, 'walt_watch');
      if (r === 'recorded') {
         await overpaidRefundCard(svc, { waltTxId: tx.id, userId: req.user_id, loanId: req.loan_id, paidCents: cents, askedCents: asked });
         return { outcome: 'overpaid_recorded', request_id: req.id, loan_id: req.loan_id, note };
      }
      return { outcome: typeof r === 'object' ? `repay_failed:${r.error}` : `repay_${r}`, request_id: req.id, loan_id: req.loan_id, note };
   }
   if (exact.length !== 1) {
      if (!mine.length) return { outcome: 'in_not_a_repayment', note: `${tx.amount} ${tx.currency} from ${who}` };
      await tellTeam(
         svc,
         `🟡 Walt watch: ${who} sent ${tx.amount} ${tx.currency}, but their 💰 Bayar amount is ${mine.map((r) => r.amount_usd).join(', ')} USDT. Not recorded — check and use ✅ Arrived if it’s right.`
      );
      return { outcome: 'in_amount_mismatch', request_id: mine[0].id, loan_id: mine[0].loan_id };
   }
   const req = exact[0];
   if (mode === 'observe') {
      await tellTeam(
         svc,
         `👀 Walt watch (observe): saw ${tx.amount} USDT ← ${who} (status ${tx.status}). Would record it on their loan (request #${req.id}).`
      );
      return { outcome: 'would_record_repay', request_id: req.id, loan_id: req.loan_id };
   }
   const r = await recordWaltTransferArrival(svc, req, { by: 'walt_watch', walt_tx: tx.id }, 'walt_watch');
   const outcome =
      typeof r === 'object' ? `repay_failed:${r.error}` : r === 'recorded' || r === 'duplicate' ? 'repay_recorded' : `repay_${r}`;
   if (r === 'recorded') await tellTeam(svc, `✅ Walt watch: ${tx.amount} USDT ← ${who} seen in Walt and recorded on their loan.`);
   return { outcome, request_id: req.id, loan_id: req.loan_id };
};

// ── the 5-minute job ─────────────────────────────────────────────────────────────────────────────
export type WatchTally = { mode: string; seen: number; acted: number; balance: number | null; error?: string };

export const runWaltWatch = async (svc: Svc, deadline = Date.now() + 30_000): Promise<WatchTally> => {
   const mode = await watchMode(svc);
   const tally: WatchTally = { mode, seen: 0, acted: 0, balance: null };
   if (mode === 'off') return tally;
   const session = await loadSession(svc);
   if (!session) return { ...tally, error: 'not_connected' };
   try {
      const page = await waltGet<{ transactions: WaltTx[] }>(svc, '/api/v1/transactions/single-account/?crypto_currency=USDT&limit=50');
      const txs = (page.transactions ?? []).filter((t) => t.gateway === 'tg_transfer');
      tally.seen = txs.length;
      if (txs.length) {
         const { data: known } = await svc
            .from('walt_transactions')
            .select('id, outcome, status')
            .in(
               'id',
               txs.map((t) => t.id)
            );
         const knownById = new Map(
            ((known ?? []) as Array<{ id: number; outcome: string | null; status: string }>).map((k) => [Number(k.id), k])
         );
         // Oldest first, so a payout is matched before anything after it.
         for (const tx of [...txs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
            if (Date.now() > deadline) break;
            const prev = knownById.get(Number(tx.id));
            if (prev?.outcome) continue;
            const base = {
               id: tx.id,
               type: tx.type,
               gateway: tx.gateway,
               status: tx.status,
               currency: tx.currency,
               amount: tx.amount,
               tg_id: tx.tg_id,
               username: tx.username,
               created_at: tx.created_at
            };
            let result: Outcome | null = null;
            if (Date.parse(tx.created_at) < Date.parse(session.connectedAt)) result = { outcome: 'before_connect' };
            else if (tx.currency !== 'USDT') result = { outcome: 'not_usdt' };
            else if (!isDone(tx)) {
               // Not final yet (or a status we don't know): look again next run. Say once what it is.
               if (!prev)
                  await tellTeam(
                     svc,
                     `👀 Walt watch: ${tx.amount} USDT ${tx.type === 'deposit' ? '←' : '→'} ${tx.username ? `@${tx.username}` : tx.tg_id} has status “${tx.status}”${tx.is_blocked ? ' (blocked)' : ''}. Waiting for it to finish.`
                  );
            } else {
               result = tx.type === 'deposit' ? await handleIn(svc, tx, mode) : await handleOut(svc, tx, mode);
               tally.acted += result.outcome.endsWith('_recorded') ? 1 : 0;
            }
            await svc
               .from('walt_transactions')
               .upsert(
                  {
                     ...base,
                     ...(result
                        ? {
                             outcome: result.outcome,
                             loan_id: result.loan_id ?? null,
                             request_id: result.request_id ?? null,
                             note: result.note ?? null
                          }
                        : {})
                  },
                  { onConflict: 'id' }
               );
         }
      }
      // The pot: Moodeng's USDT in Walt.
      const acc = await waltGet<{ accounts: Array<{ currency: string; available_balance: string }> }>(svc, '/api/v1/accounts/');
      const usdt = (acc.accounts ?? []).find((a) => a.currency === 'USDT');
      if (usdt) {
         const bal = Number(usdt.available_balance);
         tally.balance = bal;
         await setSetting(svc, 'walt_pot_usdt', bal.toFixed(2));
         const low = Number((await getSetting(svc, 'walt_pot_low_usd')) ?? 40) || 40;
         // 😴 Snooze sets this into the future, so the 12-hour repeat waits until it has run out.
         const lastAlert = Date.parse(String((await getSetting(svc, 'walt_pot_low_alerted_at')) ?? '')) || 0;
         const waiting = await waitingLoansUsd(svc);
         if ((bal < low || bal < waiting.total) && Date.now() - lastAlert > 12 * 3_600_000) {
            await setSetting(svc, 'walt_pot_low_alerted_at', new Date().toISOString());
            const card = await potCard(svc, bal, waiting, session.username);
            await tellTeam(svc, card.text, card.keyboard);
         }
      }
   } catch (err) {
      tally.error = err instanceof Error ? err.message : String(err);
      if (err instanceof WaltAuthError) {
         const last = Date.parse(String((await getSetting(svc, 'walt_watch_alerted_at')) ?? '')) || 0;
         if (Date.now() - last > 6 * 3_600_000) {
            await setSetting(svc, 'walt_watch_alerted_at', new Date().toISOString());
            await tellTeam(
               svc,
               `⚠️ Walt watch can’t log in to Walt any more (${tally.error}). Payouts and repayments need the ✅ buttons until it’s reconnected with /waltconnect.`
            );
         }
      }
   }
   return tally;
};

// ── the pot card: how much to top up, and where ──────────────────────────────────────────────────
/** Open Indonesia loan requests nobody has paid out yet (the pot has to cover these). */
const waitingLoansUsd = async (svc: Svc): Promise<{ count: number; total: number }> => {
   const loans = await openIdLoans(svc);
   return { count: loans.length, total: loans.reduce((s, l) => s + (Number(l.loan_amount) || 0), 0) };
};

/** What the pot needs: back up to the target, or to what's waiting when that is more. Pure (waltWatch.test.ts). */
export const potTopUp = (balance: number, waiting: number, target: number) => ({
   need: Math.max(0, Math.ceil(Math.max(target, waiting) - balance)),
   short: Math.max(0, waiting - balance)
});

const potCard = async (
   svc: Svc,
   balance: number,
   waiting: { count: number; total: number },
   username: string | null
): Promise<{ text: string; keyboard: TelegramInlineKeyboard }> => {
   const [targetRaw, lowRaw, address] = await Promise.all([
      getSetting(svc, 'walt_pot_target_usd'),
      getSetting(svc, 'walt_pot_low_usd'),
      getSetting(svc, 'id_walt_deposit_address')
   ]);
   const target = Number(targetRaw ?? 300) || 300;
   const low = Number(lowRaw ?? 40) || 40;
   const { need, short } = potTopUp(balance, waiting.total, target);
   const who = `@${username ?? 'jimmymoodengcredit'}`;
   const lines = [
      `🪫 Walt pot: ${balance.toFixed(2)} USDT in ${who}’s Walt (alert under $${low}, target $${target}).`,
      waiting.count
         ? `Waiting to be paid out: ${waiting.count} loan${waiting.count === 1 ? '' : 's'}, $${waiting.total.toFixed(2)}${short > 0 ? ` — $${short.toFixed(2)} short right now` : ''}.`
         : 'No loan is waiting for a payout.',
      need > 0 ? `Top up about ${need} USDT to get back to $${Math.max(target, Math.ceil(waiting.total))}.` : null,
      '',
      `How: withdraw USDT from Binance (or any exchange) to the Walt deposit address${
         address?.trim() ? ` ${address.trim()}` : ` (Walt → Deposit → USDT in ${who}; save it here with /waltpot address <addr>)`
      }. A Walt Transfer from another Walt account also works and is free.`,
      'I read the balance every 5 minutes. Tap 🔄 to read it now.'
   ];
   return {
      text: lines.filter((l): l is string => l != null).join('\n'),
      keyboard: [
         [
            { text: '🔄 Check balance now', callback_data: 'idww:p' },
            { text: '😴 Snooze 24h', callback_data: 'idww:z' }
         ]
      ]
   };
};

/** Buttons on the pot card (admin chats only; idww:). True when handled. */
export const handleWaltWatchCallback = async (
   svc: Svc,
   query: { id: string; data?: string; message?: { chat: { id: number | string }; message_id: number; text?: string } }
): Promise<boolean> => {
   if (!query.data?.startsWith('idww:')) return false;
   const answer = (text: string) => callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const chatId = query.message?.chat.id;
   if (chatId == null || !(await adminChatIds(svc)).includes(String(chatId))) {
      await answer('Not allowed here.');
      return true;
   }
   if (query.data === 'idww:z') {
      // 12 h ahead + the 12 h repeat = quiet for 24 h.
      await setSetting(svc, 'walt_pot_low_alerted_at', new Date(Date.now() + 12 * 3_600_000).toISOString());
      await answer('Quiet for 24 hours.');
      return true;
   }
   if (query.data !== 'idww:p') {
      await answer('Unknown action.');
      return true;
   }
   try {
      const session = await loadSession(svc);
      if (!session) {
         await answer('Walt watch isn’t connected — /waltconnect');
         return true;
      }
      const acc = await waltGet<{ accounts: Array<{ currency: string; available_balance: string }> }>(svc, '/api/v1/accounts/');
      const bal = Number((acc.accounts ?? []).find((a) => a.currency === 'USDT')?.available_balance ?? NaN);
      if (!Number.isFinite(bal)) {
         await answer('Walt didn’t return a USDT balance.');
         return true;
      }
      await setSetting(svc, 'walt_pot_usdt', bal.toFixed(2));
      const card = await potCard(svc, bal, await waitingLoansUsd(svc), session.username);
      await answer(`Pot: ${bal.toFixed(2)} USDT`);
      if (query.message)
         await callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: query.message.message_id,
            text: `${card.text}\n\nChecked ${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(11, 16)} Bangkok`,
            reply_markup: { inline_keyboard: card.keyboard }
         }).catch(() => undefined);
   } catch (err) {
      await answer(`Couldn’t read Walt: ${err instanceof Error ? err.message : String(err)}`);
   }
   return true;
};

// ── admin commands ───────────────────────────────────────────────────────────────────────────────
/** /waltwatch [on|observe|off] · /waltconnect <tgWebAppData> (the message is deleted right away) · /waltpot [address|target|low <v>]. */
export const handleWaltWatchCommand = async (
   svc: Svc,
   message: { chat: { id: number | string }; message_id?: number; text?: string }
): Promise<boolean> => {
   const text = (message.text ?? '').trim();
   const chatId = message.chat.id;
   const connect = text.match(/^\/waltconnect(?:@\w+)?\s+([\s\S]+)$/i);
   if (connect) {
      if (message.message_id)
         await callTelegramApi('deleteMessage', { chat_id: chatId, message_id: message.message_id }).catch(() => undefined);
      const r = await waltConnect(svc, connect[1]);
      await sendTelegramMessage(
         chatId,
         r.ok
            ? `✅ Walt connected (@${r.username}), read-only. Mode: ${await watchMode(svc)}. I deleted your message.`
            : `❌ ${r.error} (I deleted your message.)`
      ).catch(() => undefined);
      return true;
   }
   const potCmd = text.match(/^\/waltpot(?:@\w+)?(?:\s+(address|target|low)\s+(\S+))?\s*$/i);
   if (potCmd) {
      if (potCmd[1]) {
         const key = potCmd[1].toLowerCase();
         const value = potCmd[2].trim();
         if (key === 'address' && !/^(0x[0-9a-fA-F]{40}|[A-Za-z0-9_-]{40,60})$/.test(value)) {
            await sendTelegramMessage(chatId, 'That doesn’t look like a deposit address.').catch(() => undefined);
            return true;
         }
         if (key !== 'address' && !(Number(value) > 0)) {
            await sendTelegramMessage(chatId, 'Give a dollar amount, e.g. /waltpot target 300').catch(() => undefined);
            return true;
         }
         await setSetting(svc, key === 'address' ? 'id_walt_deposit_address' : key === 'target' ? 'walt_pot_target_usd' : 'walt_pot_low_usd', value);
      }
      const session = await loadSession(svc);
      const bal = Number((await getSetting(svc, 'walt_pot_usdt')) ?? NaN);
      const card = await potCard(svc, Number.isFinite(bal) ? bal : 0, await waitingLoansUsd(svc), session?.username ?? null);
      await sendTelegramMessage(chatId, `${card.text}\n\nSet: /waltpot target 300 · /waltpot low 40 · /waltpot address <addr>`, {
         inlineKeyboard: card.keyboard
      }).catch(() => undefined);
      return true;
   }
   if (/^\/waltconnect\b/i.test(text)) {
      await sendTelegramMessage(chatId, 'Usage: /waltconnect <tgWebAppData from the Walt web app>').catch(() => undefined);
      return true;
   }
   const m = text.match(/^\/waltwatch(?:@\w+)?(?:\s+(on|observe|off))?\s*$/i);
   if (!m) return false;
   if (m[1]) await setSetting(svc, 'walt_watch', m[1].toLowerCase());
   const [session, mode, pot] = await Promise.all([loadSession(svc), watchMode(svc), getSetting(svc, 'walt_pot_usdt')]);
   const { data: recent } = await svc
      .from('walt_transactions')
      .select('outcome')
      .gte('seen_at', new Date(Date.now() - 7 * 86_400_000).toISOString());
   const counts = new Map<string, number>();
   for (const r of (recent ?? []) as Array<{ outcome: string | null }>)
      counts.set(r.outcome ?? 'waiting', (counts.get(r.outcome ?? 'waiting') ?? 0) + 1);
   await sendTelegramMessage(
      chatId,
      [
         `👀 Walt watch: ${mode.toUpperCase()}`,
         session
            ? `Connected: @${session.username ?? '?'} since ${session.connectedAt.slice(0, 16).replace('T', ' ')} UTC`
            : 'Not connected — /waltconnect',
         pot ? `Pot: ${pot} USDT` : '',
         counts.size ? `Last 7 days: ${[...counts].map(([k, v]) => `${k} ${v}`).join(' · ')}` : '',
         'Modes: /waltwatch on · observe · off'
      ]
         .filter(Boolean)
         .join('\n')
   ).catch(() => undefined);
   return true;
};
