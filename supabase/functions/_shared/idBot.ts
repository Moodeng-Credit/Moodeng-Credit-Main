// Indonesia track, "living in Telegram" (docs/INDONESIA_TRACK.md): after onboarding an Indonesian never
// needs the website. In a private chat with our bot, /menu, a bare /start, "menu" or "pinjaman" shows:
//
//   📋 Pinjamanku · 💸 Ajukan pinjaman · 💰 Bayar · ❓ Bantuan        (callback_data idm:status|apply|repay|help)
//
//   Ajukan: amount (ida:<amt>) → term (idt:<amt>:<days>) → rupiah total (idr:<amt>:<days>:<rp>) → purpose
//           (idp:…:<i>) → confirm (idc:…:<i>) → public.bot_request_id_loan (migration 20261107190000), which
//           re-checks everything. The whole state is in callback_data (≤ 64 bytes, idLoanMath.ts).
//   Bayar:  Walt → Transfer → Moodeng's Walt username (free), "✅ Sudah kirim" (ids:<request id>) → team
//           confirms (idRepayments.ts). Backup: the payout wallet on BNB Chain + an exact amount.
//
// Only people found by users.chat_id / users.telegram_id = the sender AND users.market = 'ID' get any of
// this; everyone else keeps the bot's old behaviour (the handlers return false). Bahasa by default,
// English when users.preferred_locale = 'en'. Never throws.

import {
   callbackFits,
   formatRp,
   type IdBotCallback,
   idCallback,
   idDueDateIso,
   idRepayIdrBounds,
   idRepayIdrChoices,
   idTermChoices,
   idUsdForIdr,
   idUsdLeft,
   ID_PURPOSES,
   isIdMenuText,
   parseIdBotCallback
} from './idLoanMath.ts';
import { claimSent, getOrCreateRepayRequest } from './idRepayments.ts';
import { appButton, buildIdMessage, formatIdDay, idLocaleOf, type IdLocale, type IdNext, loadIdStatus } from './idTrack.ts';
import { loanTimezone, pastDueAt } from './loanDeadline.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramButton, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

type TgUser = { id: number; first_name?: string; language_code?: string };
type TgMessage = { message_id: number; text?: string; chat: { id: number; type?: string }; from?: TgUser };
type TgCallback = { id: string; from: TgUser; data?: string; message?: TgMessage };

export type BotUser = {
   id: string;
   market: string | null;
   chat_id: string | number | null;
   preferred_locale: string | null;
   walt_address: string | null;
   display_name?: string | null;
   username?: string | null;
};

const BOT_USERNAME = (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? 'moodengnewbranchbot').trim().replace(/^@/, '');
const SUPPORT_URL = `https://t.me/${BOT_USERNAME}?start=support`;
const WALT_URL = 'https://t.me/wallet';

/** The Indonesia-track account behind this Telegram sender, or null (then the bot behaves as before). */
export const findIdUserByTelegram = async (svc: Svc, telegramId: number | null | undefined): Promise<BotUser | null> => {
   if (!telegramId || !Number.isSafeInteger(telegramId)) return null;
   try {
      const { data, error } = await svc
         .from('users')
         .select('id, market, chat_id, preferred_locale, walt_address, display_name, username')
         .or(`chat_id.eq.${telegramId},telegram_id.eq.${telegramId}`)
         .eq('market', 'ID')
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      if (error) {
         console.error('[idBot] user lookup failed', error.message);
         return null;
      }
      return (data as BotUser | null) ?? null;
   } catch {
      return null;
   }
};

// ── sending ──────────────────────────────────────────────────────────────────────────────────────
type Screen = { text: string; keyboard: TelegramInlineKeyboard };

const send = async (chatId: number | string, screen: Screen) => {
   await sendTelegramMessage(chatId, screen.text, { inlineKeyboard: screen.keyboard }).catch((err: unknown) =>
      console.error('[idBot] send failed', err instanceof Error ? err.message : err)
   );
};

/** Replace the tapped message (the loan steps); a new message if it can't be edited. */
const edit = async (chatId: number, messageId: number | undefined, screen: Screen) => {
   if (messageId) {
      try {
         await callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: screen.text,
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: screen.keyboard }
         });
         return;
      } catch (err) {
         if (/not modified/i.test(err instanceof Error ? err.message : '')) return;
      }
   }
   await send(chatId, screen);
};

const answer = async (queryId: string, text = '') => {
   try {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: queryId, ...(text ? { text: text.slice(0, 190) } : {}) });
   } catch (err) {
      console.error('[idBot] answerCallbackQuery failed', err instanceof Error ? err.message : err);
   }
};

const cb = (text: string, data: string): TelegramButton => {
   if (!callbackFits(data)) throw new Error(`callback_data too long: ${data}`);
   return { text, callback_data: data };
};

// ── copy ─────────────────────────────────────────────────────────────────────────────────────────
const say = (l: IdLocale, id: string, en: string) => (l === 'en' ? en : id);
const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const menuButton = (l: IdLocale) => cb(say(l, '☰ Menu', '☰ Menu'), idCallback.menu('menu'));

export const menuScreen = (l: IdLocale, name?: string | null): Screen => ({
   text: say(
      l,
      `👋 Halo${name ? ` ${name}` : ''}! Mau apa hari ini?`,
      `👋 Hi${name ? ` ${name}` : ''}! What would you like to do?`
   ),
   keyboard: [
      [cb(say(l, '📋 Pinjamanku', '📋 My loan'), idCallback.menu('status')), cb(say(l, '💸 Ajukan pinjaman', '💸 Request a loan'), idCallback.menu('apply'))],
      [cb(say(l, '💰 Bayar', '💰 Pay'), idCallback.menu('repay')), cb(say(l, '❓ Bantuan', '❓ Help'), idCallback.menu('help'))]
   ]
});

export const helpScreen = (l: IdLocale): Screen => ({
   text: say(
      l,
      '❓ Bantuan\n\nTekan "Chat dengan tim" lalu tulis pertanyaanmu di sini. Tim kami membalas di Telegram.\n\nTim juga bisa menghubungimu lewat WhatsApp di nomor yang kamu daftarkan (bot WhatsApp kami tidak membalas chat).',
      '❓ Help\n\nTap "Chat with the team", then write your question here. Our team replies in Telegram.\n\nThe team can also reach you on WhatsApp at the number you registered (our WhatsApp bot doesn’t reply to chats).'
   ),
   keyboard: [[{ text: say(l, '💬 Chat dengan tim', '💬 Chat with the team'), url: SUPPORT_URL }], [menuButton(l)]]
});

const supportRow = (l: IdLocale): TelegramButton[] => [{ text: say(l, '💬 Hubungi kami', '💬 Contact us'), url: SUPPORT_URL }, menuButton(l)];

/** The onboarding "next step" message (existing copy + sign-in button). */
export const nextStepScreen = (l: IdLocale, next: IdNext | null): Screen => {
   const msg = buildIdMessage('next_step', l, { next });
   return {
      text: say(l, `Pendaftaranmu belum selesai.\n\n${msg.text}`, `Your sign-up isn’t finished yet.\n\n${msg.text}`),
      keyboard: [...(msg.button ? [[appButton(msg.button)]] : []), [menuButton(l)]]
   };
};

export const noRateScreen = (l: IdLocale): Screen => ({
   text: say(l, 'Kurs Rupiah belum tersedia. Coba lagi sebentar lagi.', 'The rupiah exchange rate isn’t available right now. Try again soon.'),
   keyboard: [[menuButton(l)]]
});

// ── data ─────────────────────────────────────────────────────────────────────────────────────────
type LoanRow = {
   id: string;
   loan_status: string;
   repayment_status: string | null;
   loan_amount: number | string;
   repay_idr: number | string | null;
   repaid_idr: number | string | null;
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   due_date: string | null;
   due_timezone: string | null;
   funding_method: string | null;
   funded_at: string | null;
   created_at: string;
   on_hold_reason: string | null;
};

const loadLoans = async (svc: Svc, userId: string): Promise<LoanRow[]> => {
   const { data } = await svc
      .from('loans')
      .select(
         'id, loan_status, repayment_status, loan_amount, repay_idr, repaid_idr, total_repayment_amount, repaid_amount, due_date, due_timezone, funding_method, funded_at, created_at, on_hold_reason'
      )
      .eq('borrower_user_id', userId)
      .is('refunded_at', null)
      .order('created_at', { ascending: false })
      .limit(10);
   return (data ?? []) as LoanRow[];
};

const REQUEST_LIVE_MS = 7 * 86_400_000;
const isOpenRequest = (l: LoanRow, now: number) => l.loan_status === 'Requested' && now - new Date(l.created_at).getTime() < REQUEST_LIVE_MS;
const isUnpaid = (l: LoanRow) => l.loan_status === 'Lent' && l.repayment_status !== 'Paid';

const rateOf = async (svc: Svc): Promise<number | null> => {
   try {
      const { data } = await svc.rpc('current_usd_idr');
      const n = Number(data);
      return Number.isFinite(n) && n > 0 ? n : null;
   } catch {
      return null;
   }
};

const rulesOf = async (svc: Svc): Promise<{ amounts: number[]; maxTermDays: number }> => {
   try {
      const { data } = await svc.rpc('get_id_loan_rules');
      const amounts = Array.isArray(data?.amounts) ? data.amounts.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : [5, 10];
      return { amounts, maxTermDays: Number(data?.maxTermDays) || 14 };
   } catch {
      return { amounts: [5, 10], maxTermDays: 14 };
   }
};

// ── 📋 status ────────────────────────────────────────────────────────────────────────────────────
export const statusScreen = async (svc: Svc, user: BotUser, l: IdLocale, now = Date.now()): Promise<Screen> => {
   const loans = await loadLoans(svc, user.id);
   const active = loans.find(isUnpaid);
   const open = loans.find((x) => isOpenRequest(x, now));
   const rate = await rateOf(svc);

   if (active) {
      const left = idUsdLeft(active, rate);
      const late = active.due_date ? now >= pastDueAt(active.due_date, loanTimezone(active, 'Asia/Jakarta')).getTime() : false;
      const statusWord = late ? say(l, '🚨 Terlambat', '🚨 Late') : say(l, '💸 Sudah dikirim ke Walt', '💸 Sent to your Walt');
      const owed = left.idr != null ? `${formatRp(left.idr)} (≈ ${usd(left.usd)} ${say(l, 'hari ini', 'today')})` : usd(left.usd);
      return {
         text: say(
            l,
            `📋 Pinjamanmu\n\nPinjaman: ${usd(Number(active.loan_amount))}\nJatuh tempo: ${formatIdDay(active.due_date, l)}\nSisa bayar: ${owed}\nStatus: ${statusWord}`,
            `📋 Your loan\n\nLoan: ${usd(Number(active.loan_amount))}\nDue: ${formatIdDay(active.due_date, l)}\nLeft to pay: ${owed}\nStatus: ${statusWord}`
         ),
         keyboard: [[cb(say(l, '💰 Bayar sekarang', '💰 Pay now'), idCallback.menu('repay'))], [menuButton(l)]]
      };
   }
   if (open) {
      const idr = Number(open.repay_idr ?? NaN);
      return {
         text: say(
            l,
            `📋 Permintaanmu\n\nPinjaman: ${usd(Number(open.loan_amount))}${Number.isFinite(idr) ? ` · kembali ${formatRp(idr)}` : ''}\nJatuh tempo: ${formatIdDay(open.due_date, l)}\nStatus: ⏳ Menunggu dana\n\nKami kirim ke Walt kamu begitu didanai.`,
            `📋 Your request\n\nLoan: ${usd(Number(open.loan_amount))}${Number.isFinite(idr) ? ` · repay ${formatRp(idr)}` : ''}\nDue: ${formatIdDay(open.due_date, l)}\nStatus: ⏳ Waiting for funding\n\nWe send it to your Walt as soon as it’s funded.`
         ),
         keyboard: [[menuButton(l)]]
      };
   }

   const status = await loadIdStatus(svc, user.id);
   if (status?.market === 'ID' && status.next !== 'apply') return nextStepScreen(l, status.next ?? 'waiting');
   const lastPaid = loans.find((x) => x.repayment_status === 'Paid');
   return {
      text: lastPaid
         ? say(l, `✅ Lunas! Pinjaman terakhirmu (${usd(Number(lastPaid.loan_amount))}) sudah dibayar. Mau pinjam lagi?`, `✅ Paid! Your last loan (${usd(Number(lastPaid.loan_amount))}) is repaid. Borrow again?`)
         : say(l, 'Kamu belum punya pinjaman. Ajukan yang pertama di sini.', 'You don’t have a loan yet. Request your first one here.'),
      keyboard: [[cb(say(l, '💸 Ajukan pinjaman', '💸 Request a loan'), idCallback.menu('apply'))], [menuButton(l)]]
   };
};

// ── 💸 apply ─────────────────────────────────────────────────────────────────────────────────────
/** Why they can't start a request right now (a screen), or null. Mirrors bot_request_id_loan's gates. */
const applyGate = async (svc: Svc, user: BotUser, l: IdLocale, now = Date.now()): Promise<Screen | null> => {
   const status = await loadIdStatus(svc, user.id);
   if (!status || status.market !== 'ID') return { text: say(l, 'Akun ini tidak bisa mengajukan di sini.', 'This account can’t request here.'), keyboard: [supportRow(l)] };
   if (status.access !== 'approved' || !status.kycApproved || !status.steps?.walt) {
      return nextStepScreen(l, status.next === 'apply' ? 'waiting' : status.next ?? 'waiting');
   }
   const loans = await loadLoans(svc, user.id);
   if (loans.some(isUnpaid) || loans.some((x) => isOpenRequest(x, now))) {
      return {
         text: say(l, 'Kamu masih punya pinjaman yang berjalan. Selesaikan dulu, lalu ajukan lagi.', 'You still have a loan going. Finish it first, then request again.'),
         keyboard: [[cb(say(l, '📋 Pinjamanku', '📋 My loan'), idCallback.menu('status'))], [menuButton(l)]]
      };
   }
   return null;
};

export const amountScreen = (l: IdLocale, amounts: number[], rate: number): Screen => ({
   text: say(l, '💸 Berapa yang kamu butuhkan?', '💸 How much do you need?'),
   keyboard: [
      amounts.map((a) => cb(`${usd(a)} (≈ ${formatRp(Math.round((a * rate) / 1000) * 1000)})`, idCallback.amount(a))),
      [cb(say(l, '✖️ Batal', '✖️ Cancel'), idCallback.menu('stop'))]
   ]
});

export const termScreen = (l: IdLocale, amount: number, maxTermDays: number, now: Date): Screen => ({
   text: say(l, `📅 Pinjam ${usd(amount)}. Kapan kamu bayar kembali?`, `📅 Borrow ${usd(amount)}. When will you pay it back?`),
   keyboard: [
      idTermChoices(maxTermDays).map((d) => cb(`${d} ${say(l, 'hari', 'days')} (${formatIdDay(idDueDateIso(now, d), l)})`, idCallback.term(amount, d))),
      [cb(say(l, '⬅️ Kembali', '⬅️ Back'), idCallback.menu('pick'))]
   ]
});

export const rupiahScreen = (l: IdLocale, amount: number, days: number, rate: number, note = ''): Screen | null => {
   const chips = idRepayIdrChoices(amount, rate);
   if (!chips.length) return null;
   return {
      text:
         (note ? `${note}\n\n` : '') +
         say(
            l,
            `💵 Pinjam ${usd(amount)} (≈ ${formatRp(Math.round((amount * rate) / 1000) * 1000)}) selama ${days} hari.\nBerapa total yang kamu kembalikan (dalam rupiah)?`,
            `💵 Borrow ${usd(amount)} (≈ ${formatRp(Math.round((amount * rate) / 1000) * 1000)}) for ${days} days.\nHow much will you pay back in total (rupiah)?`
         ),
      keyboard: [...chips.map((rp) => [cb(`${formatRp(rp)} (≈ ${usd(idUsdForIdr(rp, rate))})`, idCallback.rupiah(amount, days, rp))]), [cb(say(l, '⬅️ Kembali', '⬅️ Back'), idCallback.amount(amount))]]
   };
};

export const purposeScreen = (l: IdLocale, amount: number, days: number, rp: number): Screen => {
   const buttons = ID_PURPOSES.map((p, i) => cb(l === 'en' ? p.en : p.id, idCallback.purpose(amount, days, rp, i)));
   const rows: TelegramButton[][] = [];
   for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
   return {
      text: say(l, '🎯 Untuk apa pinjaman ini?', '🎯 What is this loan for?'),
      keyboard: [...rows, [cb(say(l, '⬅️ Kembali', '⬅️ Back'), idCallback.term(amount, days))]]
   };
};

export const confirmScreen = (l: IdLocale, amount: number, days: number, rp: number, purpose: number, rate: number, now: Date): Screen => {
   const p = ID_PURPOSES[purpose];
   const due = formatIdDay(idDueDateIso(now, days), l);
   return {
      text: say(
         l,
         `📝 Cek dulu ya\n\nPinjam: ${usd(amount)} (dikirim ke Walt kamu)\nKembali: ${formatRp(rp)} (≈ ${usd(idUsdForIdr(rp, rate))} hari ini)\nJatuh tempo: ${due} (${days} hari)\nUntuk: ${p.id}\n\n⚠️ Bayar tepat waktu: keterlambatan dicatat dan akunmu bisa ditutup.`,
         `📝 Please check\n\nBorrow: ${usd(amount)} (sent to your Walt)\nPay back: ${formatRp(rp)} (≈ ${usd(idUsdForIdr(rp, rate))} today)\nDue: ${due} (${days} days)\nFor: ${p.en}\n\n⚠️ Pay on time: late payments are recorded and can close your account.`
      ),
      keyboard: [
         [cb(say(l, '✅ Ya, ajukan', '✅ Yes, request it'), idCallback.confirm(amount, days, rp, purpose))],
         [cb(say(l, '✖️ Batal', '✖️ Cancel'), idCallback.menu('stop'))]
      ]
   };
};

const REQUEST_ERRORS: Record<string, { id: string; en: string }> = {
   not_approved: { id: 'Kamu belum disetujui untuk meminjam.', en: 'You’re not approved to borrow yet.' },
   kyc: { id: 'Verifikasi KTP-mu belum disetujui.', en: 'Your ID check isn’t approved yet.' },
   no_walt: { id: 'Simpan alamat Walt kamu dulu.', en: 'Save your Walt address first.' },
   not_verified: { id: 'Verifikasi KTP-mu belum disetujui.', en: 'Your ID check isn’t approved yet.' },
   has_open_loan: { id: 'Kamu masih punya pinjaman yang berjalan.', en: 'You still have a loan going.' },
   mal_reached: { id: 'Kamu sudah mencapai batas jumlah pinjaman aktif.', en: 'You’ve reached your active loan limit.' },
   over_limit: { id: 'Jumlah ini melebihi batas kreditmu.', en: 'This is more than your credit limit.' },
   cooldown: { id: 'Kamu baru saja menghapus beberapa permintaan. Tunggu 30 menit lalu coba lagi.', en: 'You deleted a few requests just now. Wait 30 minutes and try again.' },
   no_rate: { id: 'Kurs Rupiah belum tersedia. Coba lagi sebentar lagi.', en: 'The rupiah exchange rate isn’t available right now. Try again soon.' },
   account_closed: { id: 'Akunmu tidak aktif. Hubungi kami.', en: 'Your account isn’t active. Contact us.' },
   bad_amount: { id: 'Jumlah itu tidak tersedia. Mulai lagi.', en: 'That amount isn’t available. Start again.' },
   bad_days: { id: 'Tanggal itu tidak tersedia. Mulai lagi.', en: 'That date isn’t available. Start again.' }
};

/** "✅ Permintaan $5 · Rp 110.000 · jatuh tempo 15 Nov diposting. Kami kirim ke Walt kamu begitu didanai." */
export const postedText = (l: IdLocale, amount: number, rp: number, dueIso: string) =>
   say(
      l,
      `✅ Permintaan ${usd(amount)} · ${formatRp(rp)} · jatuh tempo ${formatIdDay(dueIso, l)} diposting. Kami kirim ke Walt kamu begitu didanai.`,
      `✅ Request ${usd(amount)} · ${formatRp(rp)} · due ${formatIdDay(dueIso, l)} posted. We send it to your Walt as soon as it’s funded.`
   );

const handleApplyStep = async (svc: Svc, user: BotUser, l: IdLocale, step: IdBotCallback, chatId: number, messageId: number | undefined) => {
   const gate = await applyGate(svc, user, l);
   if (gate) return edit(chatId, messageId, gate);
   const rate = await rateOf(svc);
   if (!rate) return edit(chatId, messageId, noRateScreen(l));
   const rules = await rulesOf(svc);
   const now = new Date();
   const restart = (note: string) => edit(chatId, messageId, { ...amountScreen(l, rules.amounts, rate), text: `${note}\n\n${amountScreen(l, rules.amounts, rate).text}` });

   if (step.kind === 'menu') return edit(chatId, messageId, amountScreen(l, rules.amounts, rate));
   if (step.kind === 'sent') return; // handled before (repay), never a loan step
   // Everything in the callback is checked again (it came from a button, but a button can be old).
   if (!rules.amounts.includes(step.amount)) return restart(say(l, 'Jumlah itu tidak tersedia lagi.', 'That amount isn’t available any more.'));
   if (step.kind === 'amount') return edit(chatId, messageId, termScreen(l, step.amount, rules.maxTermDays, now));
   if (!Number.isInteger(step.days) || step.days < 1 || step.days > rules.maxTermDays) return edit(chatId, messageId, termScreen(l, step.amount, rules.maxTermDays, now));
   if (step.kind === 'term') {
      const screen = rupiahScreen(l, step.amount, step.days, rate);
      return edit(chatId, messageId, screen ?? noRateScreen(l));
   }
   const bounds = idRepayIdrBounds(step.amount, rate);
   if (!bounds || step.rp % 500 !== 0 || step.rp < bounds.min || step.rp > bounds.max) {
      const screen = rupiahScreen(l, step.amount, step.days, rate, say(l, '💱 Kurs berubah. Pilih lagi ya.', '💱 The rate moved. Please pick again.'));
      return edit(chatId, messageId, screen ?? noRateScreen(l));
   }
   if (step.kind === 'rupiah') return edit(chatId, messageId, purposeScreen(l, step.amount, step.days, step.rp));
   if (step.kind === 'purpose') return edit(chatId, messageId, confirmScreen(l, step.amount, step.days, step.rp, step.purpose, rate, now));
   if (step.kind !== 'confirm') return;

   const { data, error } = await svc.rpc('bot_request_id_loan', {
      p_user_id: user.id,
      p_amount: step.amount,
      p_days: step.days,
      p_repay_idr: step.rp,
      p_reason: ID_PURPOSES[step.purpose].reason
   });
   const result = (data ?? {}) as { ok?: boolean; error?: string; loan?: { due_date?: string; repay_idr?: number; loan_amount?: number } };
   if (error || !result.ok) {
      const code = error ? 'error' : String(result.error ?? 'error');
      console.warn('[idBot] bot_request_id_loan refused', code, error?.message ?? '');
      if (code === 'repay_low' || code === 'repay_high' || code === 'bad_repay_step') {
         const screen = rupiahScreen(l, step.amount, step.days, rate, say(l, '💱 Kurs berubah. Pilih lagi ya.', '💱 The rate moved. Please pick again.'));
         return edit(chatId, messageId, screen ?? noRateScreen(l));
      }
      const msg = REQUEST_ERRORS[code];
      return edit(chatId, messageId, {
         text: msg ? say(l, msg.id, msg.en) : say(l, 'Maaf, permintaanmu belum bisa dibuat. Coba lagi atau hubungi kami.', 'Sorry, we couldn’t post your request. Try again or contact us.'),
         keyboard: [supportRow(l)]
      });
   }
   return edit(chatId, messageId, {
      text: postedText(l, step.amount, step.rp, result.loan?.due_date ?? idDueDateIso(now, step.days)),
      keyboard: [[cb(say(l, '📋 Pinjamanku', '📋 My loan'), idCallback.menu('status')), menuButton(l)]]
   });
};

// ── 💰 repay ─────────────────────────────────────────────────────────────────────────────────────
type RepayInfo = {
   method?: 'walt_transfer' | 'bep20';
   waltUsername?: string | null;
   requestId?: number;
   address: string;
   amountUsdt: string;
   approxIdr: number | null;
   rupiahLeft: number | null;
};

/**
 * The repay instructions. Walt Transfer (free): username + exact amount with copy buttons, "Buka Walt",
 * then "✅ Sudah kirim". On-chain backup: the payout wallet address + the BEP20 steps.
 */
export const repayScreen = (l: IdLocale, q: RepayInfo): Screen => {
   const approx = q.approxIdr ? ` (≈ ${formatRp(q.approxIdr)})` : '';
   const left = q.rupiahLeft != null ? say(l, `Sisa pinjaman: ${formatRp(q.rupiahLeft)}\n`, `Left on your loan: ${formatRp(q.rupiahLeft)}\n`) : '';
   if (q.method === 'walt_transfer' && q.waltUsername && q.requestId) {
      const who = `@${q.waltUsername}`;
      return {
         text: say(
            l,
            `💰 Bayar lewat Walt (gratis)\n\n${left}Kirim TEPAT: ${q.amountUsdt} USDT${approx}\nKe: ${who}\n\n1. Belum punya USDT? Walt → Deposit → P2P Express: beli USDT dengan rupiah.\n2. Walt → Transfer → tempel ${who} → tempel jumlah ${q.amountUsdt} → kirim.\n3. Kembali ke sini dan tekan "✅ Sudah kirim".\n\n⚠️ Pakai Transfer (gratis), BUKAN Withdraw (ada biaya). Jumlah ini berlaku 48 jam.`,
            `💰 Pay with Walt (free)\n\n${left}Send EXACTLY: ${q.amountUsdt} USDT${approx}\nTo: ${who}\n\n1. No USDT yet? Walt → Deposit → P2P Express: buy USDT with rupiah.\n2. Walt → Transfer → paste ${who} → paste the amount ${q.amountUsdt} → send.\n3. Come back here and tap "✅ I've sent it".\n\n⚠️ Use Transfer (free), NOT Withdraw (it has a fee). This amount is good for 48 hours.`
         ),
         keyboard: [
            [{ text: say(l, '📋 Salin username', '📋 Copy username'), copy_text: { text: who } }, { text: say(l, '📋 Salin jumlah', '📋 Copy amount'), copy_text: { text: q.amountUsdt } }],
            [{ text: say(l, '👛 Buka Walt', '👛 Open Walt'), url: WALT_URL }],
            [cb(say(l, '✅ Sudah kirim', '✅ I’ve sent it'), idCallback.sent(q.requestId))],
            [menuButton(l)]
         ]
      };
   }
   return {
      text: say(
         l,
         `💰 Bayar dari Walt\n\n${left}Kirim TEPAT: ${q.amountUsdt} USDT${approx}\nKe alamat Moodeng:\n${q.address}\n\n1. Walt → Deposit → P2P Express: beli USDT dengan rupiah.\n2. Walt → Withdraw → External wallet → jaringan BNB Smart Chain (BEP20) → tempel alamat → kirim ${q.amountUsdt} USDT.\n\n⚠️ Jumlahnya harus persis ${q.amountUsdt} — dari angka itu kami tahu ini pembayaranmu. Kalau Walt memotong biaya, pastikan yang DITERIMA tetap ${q.amountUsdt}.\nHanya jaringan BEP20. Jumlah ini berlaku 48 jam.\nKami cek otomatis dan kabari kamu di sini (biasanya 1–5 menit).`,
         `💰 Pay from Walt\n\n${left}Send EXACTLY: ${q.amountUsdt} USDT${approx}\nTo Moodeng’s address:\n${q.address}\n\n1. Walt → Deposit → P2P Express: buy USDT with rupiah.\n2. Walt → Withdraw → External wallet → BNB Smart Chain (BEP20) network → paste the address → send ${q.amountUsdt} USDT.\n\n⚠️ The amount must be exactly ${q.amountUsdt} — that number is how we know it’s your payment. If Walt takes a fee, make sure the amount RECEIVED is still ${q.amountUsdt}.\nBEP20 only. This amount is good for 48 hours.\nWe check automatically and tell you here (usually 1–5 minutes).`
      ),
      keyboard: [
         [{ text: say(l, '📋 Salin alamat', '📋 Copy address'), copy_text: { text: q.address } }],
         [{ text: say(l, '📋 Salin jumlah', '📋 Copy amount'), copy_text: { text: q.amountUsdt } }, { text: say(l, '👛 Buka Walt', '👛 Open Walt'), url: WALT_URL }],
         [menuButton(l)]
      ]
   };
};

const REPAY_ERRORS: Record<string, { id: string; en: string }> = {
   no_loan: { id: 'Kamu tidak punya pinjaman yang perlu dibayar. 🎉', en: 'You have no loan to pay. 🎉' },
   on_contract: { id: 'Pinjaman ini belum bisa dibayar dari Telegram. Hubungi kami, kami bantu.', en: 'This loan can’t be paid from Telegram yet. Contact us and we’ll help.' },
   no_payout_wallet: { id: 'Pembayaran dari Walt belum tersedia. Hubungi kami, kami bantu.', en: 'Paying from Walt isn’t available yet. Contact us and we’ll help.' },
   paused: { id: 'Pembayaran dari Walt sedang dijeda. Coba lagi nanti atau hubungi kami.', en: 'Paying from Walt is paused right now. Try later or contact us.' },
   nothing_left: { id: 'Pinjamanmu sudah lunas. 🎉', en: 'Your loan is already paid. 🎉' },
   busy: { id: '⏳ Pembayaranmu sedang diproses. Kami kabari di sini begitu masuk.', en: '⏳ Your payment is being processed. We’ll tell you here as soon as it’s done.' },
   too_large: { id: 'Jumlahnya terlalu besar untuk dibayar dari sini. Hubungi kami.', en: 'That’s too much to pay from here. Contact us.' },
   error: { id: 'Tidak bisa menyiapkan pembayaran sekarang. Coba lagi sebentar.', en: 'Couldn’t set up the payment right now. Try again in a minute.' }
};

const handleRepay = async (svc: Svc, user: BotUser, l: IdLocale, chatId: number) => {
   const q = await getOrCreateRepayRequest(svc, user, 'telegram');
   if (!q.ok) {
      const msg = REPAY_ERRORS[q.error] ?? REPAY_ERRORS.error;
      const keyboard: TelegramInlineKeyboard =
         q.error === 'error' ? [[cb(say(l, '🔄 Coba lagi', '🔄 Try again'), idCallback.menu('repay'))], [menuButton(l)]] : q.error === 'busy' || q.error === 'nothing_left' || q.error === 'no_loan' ? [[menuButton(l)]] : [supportRow(l)];
      return send(chatId, { text: say(l, msg.id, msg.en), keyboard });
   }
   return send(chatId, repayScreen(l, q));
};

// ── entry points (telegram-webhook) ──────────────────────────────────────────────────────────────
/** Private-chat text: shows the menu to Indonesia-track users. True when handled. */
export const handleIdMenuMessage = async (svc: Svc, message: TgMessage): Promise<boolean> => {
   if (message.chat.type !== 'private' || !isIdMenuText(message.text)) return false;
   const user = await findIdUserByTelegram(svc, message.from?.id ?? message.chat.id);
   if (!user) return false;
   const l = idLocaleOf(user.preferred_locale);
   await send(message.chat.id, menuScreen(l, message.from?.first_name ?? null));
   return true;
};

/** Our callbacks (idm:/ida:/idt:/idr:/idp:/idc:). True when the data was ours (always answered). */
export const handleIdBotCallback = async (svc: Svc, query: TgCallback): Promise<boolean> => {
   const step = parseIdBotCallback(query.data);
   if (!step) return false;
   const chatId = query.message?.chat.id;
   const messageId = query.message?.message_id;
   const notYours = () => answer(query.id, 'Tombol ini bukan untukmu. / This button isn’t for you.');
   // Private chats only, and only the account the chat belongs to.
   if (!chatId || query.message?.chat.type !== 'private' || chatId !== query.from.id) {
      await notYours();
      return true;
   }
   const user = await findIdUserByTelegram(svc, query.from.id);
   if (!user) {
      await notYours();
      return true;
   }
   const l = idLocaleOf(user.preferred_locale);
   try {
      if (step.kind === 'sent') {
         const r = await claimSent(svc, user.id, step.requestId);
         await answer(query.id, r.ok ? say(l, '✅ Terima kasih!', '✅ Thank you!') : '');
         const text = r.ok
            ? say(
                 l,
                 '⏳ Terima kasih! Tim kami sedang mengecek Walt dan akan mengonfirmasi pembayaranmu di sini (biasanya dalam beberapa jam, pukul 08–22 WIB).',
                 '⏳ Thank you! Our team is checking Walt and will confirm your payment here (usually within a few hours, 08–22 WIB).'
              )
            : r.error === 'paid'
              ? say(l, '✅ Pembayaran ini sudah tercatat.', '✅ This payment is already recorded.')
              : say(l, 'Permintaan ini tidak ditemukan. Tekan 💰 Bayar untuk yang baru.', 'This request wasn’t found. Tap 💰 Pay for a new one.');
         await send(chatId, { text, keyboard: [[menuButton(l)]] });
         return true;
      }
      if (step.kind === 'menu' && step.action === 'repay') {
         await answer(query.id, say(l, '⏳ Menyiapkan…', '⏳ One moment…'));
         await handleRepay(svc, user, l, chatId);
         return true;
      }
      await answer(query.id);
      if (step.kind === 'menu' && step.action === 'menu') await send(chatId, menuScreen(l, query.from.first_name ?? null));
      else if (step.kind === 'menu' && step.action === 'stop') await edit(chatId, messageId, menuScreen(l, query.from.first_name ?? null));
      else if (step.kind === 'menu' && step.action === 'help') await send(chatId, helpScreen(l));
      else if (step.kind === 'menu' && step.action === 'status') await send(chatId, await statusScreen(svc, user, l));
      // apply from a menu/notification: a fresh message (the tapped one may be worth keeping); the
      // loan steps after that edit their own message.
      else await handleApplyStep(svc, user, l, step, chatId, step.kind === 'menu' && step.action === 'apply' ? undefined : messageId);
   } catch (err) {
      console.error('[idBot] callback failed', query.data, err instanceof Error ? err.message : err);
      await send(chatId, { text: say(l, 'Maaf, ada gangguan. Coba lagi sebentar.', 'Sorry, something went wrong. Try again in a moment.'), keyboard: [[menuButton(l)]] });
   }
   return true;
};
