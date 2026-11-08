// Indonesia track: paying loans out by Walt Transfer (docs/INDONESIA_TRACK.md "Paying loans out").
//
// George's rule (2026-11-08): no fees anywhere, so loans go from George's Walt (@jimmymoodengcredit)
// to the borrower's Telegram @username by Walt → Transfer (free, inside Walt, no chain, no withdrawal).
// Walt has no API, so it's done by hand from a card:
//
//   1. The 5-minute job (video-call-reminders) posts ONE card per open Indonesian request to the admin
//      chat: "💸 Pay MC-… — send 10 USDT to @budi by Walt Transfer", with copy buttons for the username
//      and the amount, "👛 Open Walt" and "✅ Sent" (callback idwp:<loan id>).
//   2. "✅ Sent" → idManualFunding.recordWaltTransferPayout: the loan is funded (funding_method
//      'walt_manual', lender = id_payout_lender_user_id, hash 'walt-transfer-out:<loan id>'), the borrower
//      gets "money sent" + the step-by-step cash-out guide. Two taps can't fund twice.
//   3. No Telegram @username → no card; the borrower is sent the "make a username" guide once. The card
//      is posted on the next run after they have one (the bot refreshes it whenever they write).
//   4. "⚠️ Not found in Walt" (idwx:<loan id>) → the borrower is asked to message Moodeng's account and
//      open Walt; the card keeps its buttons. A card still unpaid after 2 h gets one "⏰ still unpaid" ping.
//   5. The website's Walt step (stableyard-deposit-address action id_walt_ready → markWaltReady) reads
//      their @username from Telegram itself (getChat) and marks Walt ready — no address to paste.
//
// Only when telegram_bot_settings.id_payout_mode is 'walt_transfer' (the default). 'chain' = the old way
// (payout wallet / Binance TH, idManualFunding.ts). The payout wallet's autopay never sends in walt mode.
// Never throws.

import { sendUsernameGuideOffer, WALT_URL } from './idGuides.ts';
import { formatRp } from './idLoanMath.ts';
import { ensurePayout, payoutModeOf, recordWaltTransferPayout, type PayoutRow } from './idManualFunding.ts';
import { adminChatIds } from './idRepayments.ts';
import { idLocaleOf } from './idTrack.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const PAYOUT_CB = 'idwp:';
export const NOT_FOUND_CB = 'idwx:';
const REMIND_AFTER_MS = 2 * 3_600_000;
const CARD_MIN_AGE_MS = 60_000; // the request's own triggers (team post, risk score, hold) run first
const OPEN_FOR_MS = 7 * 86_400_000;

/** A Telegram username as Walt Transfer takes it ("budi_88"), or null. */
export const cleanTelegramUsername = (raw: unknown): string | null => {
   const s = String(raw ?? '').trim().replace(/^@/, '');
   return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(s) ? s : null;
};

const usdText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

type OpenLoan = {
   id: string;
   tracking_id: string | null;
   borrower_user_id: string;
   loan_amount: number | string;
   repay_idr: number | string | null;
   due_date: string | null;
};

type Borrower = { telegram_username: string | null; display_name: string | null; chat_id: string | number | null; preferred_locale: string | null };

/** The card George pays from. Exported for tests. */
export const payoutCard = (loan: OpenLoan, borrower: Borrower, username: string): { text: string; keyboard: TelegramInlineKeyboard } => {
   const amount = usdText(Number(loan.loan_amount));
   const who = `@${username}`;
   const repay = Number(loan.repay_idr ?? NaN);
   const due = loan.due_date ? new Date(loan.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }) : '?';
   return {
      text: [
         `💸 🇮🇩 Pay ${loan.tracking_id ?? loan.id.slice(0, 8)}: send ${amount} USDT to ${who} by Walt Transfer (free).`,
         `${borrower.display_name ?? 'Borrower'} · repays ${Number.isFinite(repay) ? formatRp(repay) : '?'} · due ${due}`,
         '',
         `1. Walt → Transfer → paste ${who} → paste ${amount} → send`,
         '2. Tap ✅ Sent — the loan is recorded and they get "money sent" + the cash-out guide.',
         '⚠️ Transfer, NOT Withdraw.'
      ].join('\n'),
      keyboard: [
         [
            { text: `📋 ${who}`, copy_text: { text: who } },
            { text: `📋 ${amount}`, copy_text: { text: amount } }
         ],
         [{ text: '👛 Open Walt', url: WALT_URL }],
         [{ text: `✅ Sent ${amount} USDT to ${who}`, callback_data: `${PAYOUT_CB}${loan.id}` }],
         [{ text: '⚠️ Not found in Walt', callback_data: `${NOT_FOUND_CB}${loan.id}` }]
      ]
   };
};

/** The 5-minute job: one card per open Indonesian request (Walt Transfer mode only). */
type CardTally = { cards: number; askedUsername: number; reminded: number; skipped?: string };

export const runWaltTransferPayoutCards = async (svc: Svc, now = Date.now(), deadline = Date.now() + 20_000): Promise<CardTally> => {
   const tally: CardTally = { cards: 0, askedUsername: 0, reminded: 0 };
   try {
      if ((await payoutModeOf(svc)) !== 'walt_transfer') return { ...tally, skipped: 'chain_mode' };
      const [chat] = await adminChatIds(svc);
      if (!chat) return { ...tally, skipped: 'no_admin_chat' };
      const { data: loans } = await svc
         .from('loans')
         .select('id, tracking_id, borrower_user_id, loan_amount, repay_idr, due_date')
         .eq('market', 'ID')
         .eq('loan_status', 'Requested')
         .is('lender_user_id', null)
         .is('funded_at', null)
         // Held requests (waiting for the first call) aren't paid.
         .is('on_hold_reason', null)
         .lte('created_at', new Date(now - CARD_MIN_AGE_MS).toISOString())
         .gte('created_at', new Date(now - OPEN_FOR_MS).toISOString())
         .order('created_at', { ascending: true })
         .limit(20);
      for (const loan of (loans ?? []) as OpenLoan[]) {
         if (Date.now() > deadline) break;
         const { payout } = await ensurePayout(svc, loan.id);
         const row = payout as (PayoutRow & { walt_card_at?: string | null; walt_username_asked_at?: string | null }) | undefined;
         // Only rows nobody is paying another way.
         if (!row || row.status !== 'waiting' || row.marked_sent_at || row.walt_card_at) continue;
         const { data: b } = await svc.from('users').select('telegram_username, display_name, chat_id, preferred_locale').eq('id', loan.borrower_user_id).maybeSingle();
         const borrower = (b ?? { telegram_username: null, display_name: null, chat_id: null, preferred_locale: null }) as Borrower;
         const username = cleanTelegramUsername(borrower.telegram_username);
         const stamp = new Date().toISOString();
         if (!username) {
            if (row.walt_username_asked_at || !borrower.chat_id) continue;
            const { data: asked } = await svc
               .from('id_manual_payouts')
               .update({ walt_username_asked_at: stamp, updated_at: stamp })
               .eq('id', row.id)
               .is('walt_username_asked_at', null)
               .select('id');
            if ((asked ?? []).length) {
               await sendUsernameGuideOffer(borrower.chat_id, idLocaleOf(borrower.preferred_locale));
               tally.askedUsername += 1;
            }
            continue;
         }
         // Claim the card (one per loan, however many runs overlap).
         const { data: claimed } = await svc
            .from('id_manual_payouts')
            .update({ walt_card_at: stamp, walt_username: username, updated_at: stamp })
            .eq('id', row.id)
            .is('walt_card_at', null)
            .eq('status', 'waiting')
            .select('id');
         if (!(claimed ?? []).length) continue;
         const card = payoutCard(loan, borrower, username);
         try {
            await sendTelegramMessage(chat, card.text, { inlineKeyboard: card.keyboard });
            tally.cards += 1;
         } catch (err) {
            // Not posted: release so the next run tries again.
            console.error('[idWaltPayouts] card failed', err instanceof Error ? err.message : err);
            await svc.from('id_manual_payouts').update({ walt_card_at: null }).eq('id', row.id);
         }
      }
      // One "⏰ still unpaid" ping per card left untapped for 2 h (the borrower is waiting).
      const { data: stale } = await svc
         .from('id_manual_payouts')
         .select('id, loan_id, amount, walt_username, walt_card_at')
         .eq('status', 'waiting')
         .is('marked_sent_at', null)
         .is('walt_card_reminded_at', null)
         .not('walt_card_at', 'is', null)
         .lte('walt_card_at', new Date(now - REMIND_AFTER_MS).toISOString())
         .limit(10);
      for (const r of (stale ?? []) as Array<{ id: string; loan_id: string; amount: number | string; walt_username: string | null; walt_card_at: string }>) {
         const stamp = new Date().toISOString();
         const { data: claimed } = await svc.from('id_manual_payouts').update({ walt_card_reminded_at: stamp }).eq('id', r.id).is('walt_card_reminded_at', null).select('id');
         if (!(claimed ?? []).length) continue;
         const { data: loan } = await svc.from('loans').select('tracking_id, loan_status, lender_user_id').eq('id', r.loan_id).maybeSingle();
         if (!loan || loan.loan_status !== 'Requested' || loan.lender_user_id) continue;
         const hours = Math.round((now - new Date(r.walt_card_at).getTime()) / 3_600_000);
         await sendTelegramMessage(
            chat,
            `⏰ 🇮🇩 ${loan.tracking_id ?? r.loan_id.slice(0, 8)} still unpaid after ${hours} h: send ${usdText(Number(r.amount))} USDT to @${r.walt_username ?? '?'} by Walt Transfer, then tap ✅ Sent on the card above.`
         ).catch(() => undefined);
         tally.reminded += 1;
      }
   } catch (err) {
      console.error('[idWaltPayouts] run failed', err instanceof Error ? err.message : err);
   }
   return tally;
};

const ERRORS: Record<string, string> = {
   auto_payout_in_progress: 'The payout wallet is paying this one right now — don’t send.',
   loan_not_open: 'This request isn’t open any more (deleted or already funded).',
   lender_has_no_base_wallet: 'The lender of record has no Base wallet — fix id_payout_lender_user_id first.',
   no_lender_of_record: 'No lender of record (id_payout_lender_user_id) — set it first.',
   loan_already_funded: 'It was already funded another way — check admin (money may have gone out twice).'
};

/** "✅ Sent" on a payout card (admin chats only). True when the data was ours. */
export const handleWaltPayoutCallback = async (
   svc: Svc,
   query: { id: string; data?: string; from?: { username?: string; first_name?: string }; message?: { chat: { id: number | string }; message_id: number; text?: string } }
): Promise<boolean> => {
   const data = String(query.data ?? '');
   const notFound = data.startsWith(NOT_FOUND_CB);
   if (!data.startsWith(PAYOUT_CB) && !notFound) return false;
   const answer = (text: string) => callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const chatId = query.message?.chat.id;
   if (chatId == null || !(await adminChatIds(svc)).includes(String(chatId))) {
      await answer('Not allowed here.');
      return true;
   }
   const loanId = data.slice(PAYOUT_CB.length); // both prefixes are 5 characters
   if (!/^[0-9a-f-]{36}$/i.test(loanId)) {
      await answer('Bad button.');
      return true;
   }
   const by = query.from?.username ? `@${query.from.username}` : (query.from?.first_name ?? 'admin');
   const finish = async (line: string, keepButtons = false) => {
      await answer(line);
      if (query.message && !keepButtons) {
         await callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: query.message.message_id,
            text: `${query.message.text ?? ''}\n\n${line} — ${by}`.slice(0, 4000),
            reply_markup: { inline_keyboard: [] }
         }).catch(() => undefined);
      }
   };
   if (notFound) {
      await waltNotFoundTap(svc, loanId, query, by, answer);
      return true;
   }
   try {
      const r = await recordWaltTransferPayout(svc, loanId);
      if (r.ok && r.state === 'found') {
         await finish(r.funded ? '✅ Recorded as paid — they got "money sent" + the cash-out guide' : '✅ Already recorded');
      } else if (!r.ok) {
         const msg = ERRORS[r.error] ?? `Couldn’t record: ${r.error}`;
         // Keep the buttons when it's worth retrying (a temporary problem).
         await finish(`⚠️ ${msg}`, !(r.error in ERRORS));
      } else {
         await finish(`⏳ ${r.state}`, true);
      }
   } catch (err) {
      await finish(`⚠️ Failed: ${err instanceof Error ? err.message : String(err)}`, true);
   }
   return true;
};

/** "⚠️ Not found in Walt": ask the borrower to message Moodeng's account + open Walt. Card keeps its buttons. */
const waltNotFoundTap = async (
   svc: Svc,
   loanId: string,
   query: { message?: { chat: { id: number | string }; message_id: number; text?: string } },
   by: string,
   answer: (text: string) => Promise<unknown>
) => {
   const { data: row } = await svc.from('id_manual_payouts').select('id, status, borrower_user_id, walt_not_found_at').eq('loan_id', loanId).maybeSingle();
   if (!row) return void (await answer('No payout card for this loan.'));
   if (row.status === 'found') return void (await answer('Already recorded as paid.'));
   const recent = row.walt_not_found_at && Date.now() - new Date(row.walt_not_found_at).getTime() < 30 * 60_000;
   if (recent) return void (await answer('They were asked less than 30 min ago.'));
   await svc.from('id_manual_payouts').update({ walt_not_found_at: new Date().toISOString() }).eq('id', row.id);
   const { data: u } = await svc.from('users').select('chat_id, preferred_locale').eq('id', row.borrower_user_id).maybeSingle();
   const ours = String((await svc.from('telegram_bot_settings').select('value').eq('key', 'id_walt_username').maybeSingle())?.data?.value ?? 'jimmymoodengcredit').replace(/^@/, '');
   if (u?.chat_id) {
      const en = idLocaleOf(u.preferred_locale) === 'en';
      await sendTelegramMessage(
         u.chat_id,
         en
            ? `👋 We're sending your loan, but Walt can't find you yet. Two quick things:\n\n1. Tap "💬 Message @${ours}" and send "hi".\n2. Tap "👛 Open Walt" and make sure you tapped Start.\n\nThat's it — we'll try again right away.`
            : `👋 Kami sedang mengirim pinjamanmu, tapi Walt belum bisa menemukanmu. Dua langkah cepat:\n\n1. Tekan "💬 Chat @${ours}" dan kirim "halo".\n2. Tekan "👛 Buka Walt" dan pastikan kamu sudah tekan Mulai.\n\nSelesai — kami langsung coba lagi.`,
         {
            inlineKeyboard: [
               [{ text: en ? `💬 Message @${ours}` : `💬 Chat @${ours}`, url: `https://t.me/${ours}` }],
               [{ text: en ? '👛 Open Walt' : '👛 Buka Walt', url: WALT_URL }]
            ]
         }
      ).catch(() => undefined);
   }
   await answer(u?.chat_id ? 'Asked them to message you + open Walt.' : 'They have no Telegram chat saved — reach them on WhatsApp.');
   if (query.message) {
      await callTelegramApi('editMessageText', {
         chat_id: query.message.chat.id,
         message_id: query.message.message_id,
         text: `${query.message.text ?? ''}\n\n⚠️ Not found in Walt — borrower asked to message @${ours} and open Walt (${by}). Try again in a few minutes.`.slice(0, 4000),
         reply_markup: { inline_keyboard: (query.message as { reply_markup?: { inline_keyboard?: unknown } }).reply_markup?.inline_keyboard ?? [] }
      }).catch(() => undefined);
   }
};

export type WaltReadyResult = { ok: true; username: string } | { ok: false; error: 'not_id_track' | 'no_telegram' | 'no_username' | 'username_taken' | 'error' };

/**
 * The website's Walt step: they opened Walt; read their @username from Telegram (getChat on their
 * private chat with the bot — never from the client) and mark Walt ready.
 */
export const markWaltReady = async (svc: Svc, userId: string): Promise<WaltReadyResult> => {
   try {
      const { data: u } = await svc.from('users').select('market, chat_id').eq('id', userId).maybeSingle();
      if (!u || u.market !== 'ID') return { ok: false, error: 'not_id_track' };
      if (!u.chat_id) return { ok: false, error: 'no_telegram' };
      const chat = await callTelegramApi<{ username?: string }>('getChat', { chat_id: u.chat_id }).catch(() => null);
      const username = cleanTelegramUsername(chat?.username);
      if (!username) return { ok: false, error: 'no_username' };
      const { error } = await svc.from('users').update({ telegram_username: username, walt_ready_at: new Date().toISOString() }).eq('id', userId);
      if (error) return { ok: false, error: /duplicate|unique/i.test(error.message ?? '') ? 'username_taken' : 'error' };
      return { ok: true, username };
   } catch {
      return { ok: false, error: 'error' };
   }
};

/**
 * Keep users.telegram_username current from the sender of a private message / button tap (Indonesia
 * users only, by the caller). Loans are sent to it, so a changed username must be picked up.
 */
export const refreshTelegramUsername = async (svc: Svc, userId: string, current: string | null | undefined, fromUsername: string | null | undefined) => {
   const next = cleanTelegramUsername(fromUsername);
   if (!next || next.toLowerCase() === String(current ?? '').toLowerCase()) return;
   try {
      // users.telegram_username is unique: another account holding it (an old one) is left alone.
      const { error } = await svc.from('users').update({ telegram_username: next }).eq('id', userId);
      if (error) console.warn('[idWaltPayouts] username refresh skipped', error.message);
   } catch {
      // never block the chat on this
   }
};
