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
         [{ text: `✅ Sent ${amount} USDT to ${who}`, callback_data: `${PAYOUT_CB}${loan.id}` }]
      ]
   };
};

/** The 5-minute job: one card per open Indonesian request (Walt Transfer mode only). */
export const runWaltTransferPayoutCards = async (svc: Svc, now = Date.now(), deadline = Date.now() + 20_000): Promise<{ cards: number; askedUsername: number; skipped?: string }> => {
   const tally = { cards: 0, askedUsername: 0 } as { cards: number; askedUsername: number; skipped?: string };
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
   if (!data.startsWith(PAYOUT_CB)) return false;
   const answer = (text: string) => callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const chatId = query.message?.chat.id;
   if (chatId == null || !(await adminChatIds(svc)).includes(String(chatId))) {
      await answer('Not allowed here.');
      return true;
   }
   const loanId = data.slice(PAYOUT_CB.length);
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
