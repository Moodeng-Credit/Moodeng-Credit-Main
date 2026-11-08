// Indonesia track: step-by-step guides inside Telegram (docs/INDONESIA_TRACK.md "Hand-holding").
//
// Most borrowers have never used a crypto wallet. Every money step gets a guide: one small action per
// screen, ⬅️ / ➡️ to move, a "👛 Buka Walt" button where Walt is needed, and "🙋 Masih bingung?" on every
// screen (the support chat). Bahasa by default, English when users.preferred_locale = 'en'.
//
//   how   — how a Moodeng loan works (borrow dollars, repay the rupiah you chose, on time → bigger loans)
//   uname — make a Telegram @username (needed: loans are sent to it by Walt Transfer)
//   walt  — open Walt the first time
//   cash  — turn the loan into rupiah (Walt → P2P Express → sell USDT)
//   buy   — buy USDT with rupiah to repay (Walt → P2P Express → buy)
//   send  — repay: Walt → Transfer → Moodeng's @username (free) → "✅ Sudah kirim"
//
// Screenshots: telegram_bot_settings.id_guide_media = {"cash:1": "<Telegram file_id or https URL>", …}
// (step numbers start at 1). A step with a picture is sent as a photo with the text as its caption.
// Callback data: idg:<guide>:<step> (idLoanMath.ts). Never throws.

import { formatRp, ID_GUIDE_KEYS, type IdGuideKey, idCallback } from './idLoanMath.ts';
import { idLocaleOf, type IdLocale } from './idTrack.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramButton, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const BOT_USERNAME = (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? 'moodengnewbranchbot').trim().replace(/^@/, '');
export const SUPPORT_URL = `https://t.me/${BOT_USERNAME}?start=support`;
export const WALT_URL = 'https://t.me/wallet';

type Text = { id: string; en: string };
type Step = { text: Text; walt?: boolean };
type Guide = { title: Text; steps: Step[]; warning?: Text };

const t = (id: string, en: string): Text => ({ id, en });

/** The guides. `{walt}` is replaced with Moodeng's Walt @username. Keep each step to ONE action. */
export const GUIDES: Record<IdGuideKey, Guide> = {
   how: {
      title: t('Cara kerja pinjaman Moodeng', 'How a Moodeng loan works'),
      steps: [
         {
            text: t(
               '💸 Kamu pinjam $5 (sekitar Rp 90.000).\nKami kirim ke Walt kamu, dalam bentuk USDT.\n\nUSDT = dolar digital. 1 USDT = 1 dolar.',
               '💸 You borrow $5 (about Rp 90,000).\nWe send it to your Walt as USDT.\n\nUSDT = digital dollars. 1 USDT = 1 dollar.'
            )
         },
         {
            text: t(
               '🏦 Di Walt, kamu tukar USDT jadi rupiah.\nRupiahnya masuk ke rekening bank atau e-wallet kamu (DANA, GoPay, OVO).\n\nAda panduan "Cairkan ke rupiah" untuk ini.',
               '🏦 In Walt, you swap the USDT for rupiah.\nThe rupiah goes to your bank or e-wallet (DANA, GoPay, OVO).\n\nThere is a "Cash out to rupiah" guide for this.'
            )
         },
         {
            text: t(
               '📅 Sebelum jatuh tempo, kamu bayar kembali.\nJumlahnya dalam RUPIAH dan TIDAK berubah.\nContoh: pinjam Rp 90.000, bayar Rp 110.000.',
               '📅 Before the due date, you pay it back.\nThe amount is in RUPIAH and does NOT change.\nExample: borrow Rp 90,000, pay back Rp 110,000.'
            )
         },
         {
            text: t(
               '⭐ Bayar tepat waktu → pinjaman berikutnya bisa lebih besar ($10, lalu lebih).\n🚨 Terlambat → dicatat, dan akunmu bisa ditutup.',
               '⭐ Pay on time → your next loan can be bigger ($10, then more).\n🚨 Late → it is recorded, and your account can be closed.'
            )
         },
         {
            text: t(
               '✅ Moodeng tidak memotong biaya apa pun dari pinjamanmu.\nKamu hanya bayar jumlah rupiah yang kamu pilih di awal.',
               '✅ Moodeng takes no fees out of your loan.\nYou only pay the rupiah amount you chose at the start.'
            )
         }
      ]
   },
   uname: {
      title: t('Buat username Telegram', 'Make a Telegram username'),
      steps: [
         {
            text: t(
               '🙂 Kami kirim pinjaman ke username Telegram kamu (contoh: @budi_88).\nKamu belum punya. Ayo buat, cuma 1 menit.',
               '🙂 We send loans to your Telegram username (like @budi_88).\nYou don’t have one yet. Let’s make it — 1 minute.'
            )
         },
         { text: t('⚙️ Buka Telegram → tekan ☰ (garis tiga) atau "Pengaturan" (Settings).', '⚙️ Open Telegram → tap ☰ (three lines) or "Settings".') },
         { text: t('👤 Tekan nama kamu / "Edit", lalu tekan "Username" (Nama pengguna).', '👤 Tap your name / "Edit", then tap "Username".') },
         {
            text: t(
               '⌨️ Tulis username, contoh: budi_santoso88\n(huruf, angka dan _ saja, minimal 5 huruf). Tekan ✓ untuk simpan.',
               '⌨️ Type a username, like: budi_santoso88\n(letters, numbers and _ only, at least 5 characters). Tap ✓ to save.'
            )
         },
         { text: t('✅ Sudah? Kembali ke chat ini dan tekan "✅ Sudah, cek lagi".', '✅ Done? Come back to this chat and tap "✅ Done, check again".') }
      ]
   },
   walt: {
      title: t('Buka Walt pertama kali', 'Open Walt for the first time'),
      steps: [
         { text: t('👛 Walt adalah dompet di dalam Telegram. Uang pinjamanmu masuk ke sini.\nTekan "👛 Buka Walt" di bawah.', '👛 Walt is the wallet inside Telegram. Your loan money arrives here.\nTap "👛 Open Walt" below.'), walt: true },
         { text: t('▶️ Tekan "Mulai" (Start) dan setujui syaratnya.', '▶️ Tap "Start" and accept the terms.'), walt: true },
         { text: t('✅ Selesai! Dompetmu siap menerima uang. Kembali ke chat ini.', '✅ Done! Your wallet is ready to receive money. Come back to this chat.') }
      ]
   },
   cash: {
      title: t('Cairkan pinjaman ke rupiah', 'Cash your loan out to rupiah'),
      steps: [
         { text: t('👛 Tekan "👛 Buka Walt". Kamu akan lihat saldo USDT.\n(Kalau tertulis USDC, sama saja: 1 USDC = 1 USDT.)', '👛 Tap "👛 Open Walt". You will see your USDT balance.\n(If it says USDC, that’s the same: 1 USDC = 1 USDT.)'), walt: true },
         { text: t('💱 Tekan "Jual" (Sell) atau "P2P Express".', '💱 Tap "Sell" or "P2P Express".'), walt: true },
         { text: t('🔢 Pilih USDT, lalu tulis berapa yang mau kamu jual.', '🔢 Choose USDT, then type how much you want to sell.'), walt: true },
         {
            text: t(
               '🏦 Pilih cara terima uang: bank atau e-wallet kamu (DANA, GoPay, OVO). Isi nomor rekening/HP kamu dengan BENAR.',
               '🏦 Choose how to get paid: your bank or e-wallet (DANA, GoPay, OVO). Enter your account/phone number CORRECTLY.'
            ),
            walt: true
         },
         { text: t('👀 Cek berapa rupiah yang kamu terima, lalu tekan "Jual" / "Konfirmasi".', '👀 Check how much rupiah you will get, then tap "Sell" / "Confirm".'), walt: true },
         {
            text: t(
               '⏳ Tunggu rupiah masuk (biasanya 5–15 menit).\nCek rekening/e-wallet kamu. Kalau SUDAH masuk, baru tekan "Sudah terima" di Walt.',
               '⏳ Wait for the rupiah (usually 5–15 minutes).\nCheck your bank/e-wallet. ONLY when it has arrived, tap "Received" in Walt.'
            ),
            walt: true
         }
      ],
      warning: t(
         '⚠️ Jangan tekan "Sudah terima" sebelum uang benar-benar masuk.\n⚠️ Jangan pernah kasih PIN, kode, atau password ke siapa pun — tim Moodeng tidak akan pernah minta.',
         '⚠️ Never tap "Received" before the money has really arrived.\n⚠️ Never give your PIN, codes or password to anyone — the Moodeng team will never ask.'
      )
   },
   buy: {
      title: t('Beli USDT dengan rupiah', 'Buy USDT with rupiah'),
      steps: [
         { text: t('💰 Tekan 💰 Bayar di menu dulu. Lihat berapa USDT yang harus kamu kirim (contoh: 6.08).', '💰 First tap 💰 Pay in the menu. See how much USDT you must send (e.g. 6.08).') },
         { text: t('👛 Tekan "👛 Buka Walt", lalu "Beli" (Buy) atau "P2P Express".', '👛 Tap "👛 Open Walt", then "Buy" or "P2P Express".'), walt: true },
         { text: t('🔢 Pilih USDT. Tulis jumlah USDT itu, tambah sedikit (contoh: 6.10).', '🔢 Choose USDT. Type that USDT amount, plus a little (e.g. 6.10).'), walt: true },
         {
            text: t(
               '🏦 Pilih cara bayar yang SAMA dengan milikmu (misal DANA ke DANA, BCA ke BCA) supaya tidak ada biaya transfer.',
               '🏦 Pick the SAME payment method you have (e.g. DANA to DANA, BCA to BCA) so there’s no transfer fee.'
            ),
            walt: true
         },
         {
            text: t(
               '📲 Transfer rupiah PERSIS sesuai jumlah dan ke rekening yang ditunjukkan Walt. Lalu kembali ke Walt dan tekan "Saya sudah bayar".',
               '📲 Send EXACTLY the rupiah amount to the account Walt shows you. Then go back to Walt and tap "I’ve paid".'
            ),
            walt: true
         },
         { text: t('⏳ Tunggu USDT masuk ke Walt (biasanya 5–15 menit). Lalu ikuti panduan "Bayar pinjaman".', '⏳ Wait for the USDT to arrive in Walt (usually 5–15 minutes). Then follow the "Pay your loan" guide.') }
      ],
      warning: t(
         '⚠️ Bayar HANYA ke rekening yang ditunjukkan di dalam Walt. Jangan bayar ke orang yang chat kamu.',
         '⚠️ Pay ONLY to the account shown inside Walt. Never pay someone who messages you.'
      )
   },
   send: {
      title: t('Bayar pinjaman (gratis)', 'Pay your loan (free)'),
      steps: [
         { text: t('💰 Tekan 💰 Bayar di menu. Kamu dapat jumlah TEPAT dan username kami: @{walt}.', '💰 Tap 💰 Pay in the menu. You get the EXACT amount and our username: @{walt}.') },
         { text: t('📋 Tekan "📋 Salin username", lalu "👛 Buka Walt".', '📋 Tap "📋 Copy username", then "👛 Open Walt".'), walt: true },
         { text: t('➡️ Di Walt tekan "Kirim" / "Transfer", pilih USDT, lalu tempel @{walt}.', '➡️ In Walt tap "Send" / "Transfer", choose USDT, then paste @{walt}.'), walt: true },
         { text: t('🔢 Kembali ke chat ini, tekan "📋 Salin jumlah". Tempel di Walt. Tekan "Kirim".', '🔢 Come back to this chat, tap "📋 Copy amount". Paste it in Walt. Tap "Send".'), walt: true },
         { text: t('✅ Kembali ke sini dan tekan "✅ Sudah kirim". Selesai! Kami kabari kalau sudah tercatat.', '✅ Come back here and tap "✅ I’ve sent it". Done! We’ll tell you when it’s recorded.') }
      ],
      warning: t(
         '⚠️ JANGAN pakai "Withdraw" / "Tarik" — itu ada biaya. Pakai "Transfer" ke username kami, gratis.',
         '⚠️ DON’T use "Withdraw" — it has a fee. Use "Transfer" to our username, it’s free.'
      )
   }
};

const say = (l: IdLocale, x: Text) => (l === 'en' ? x.en : x.id);
const cb = (text: string, data: string): TelegramButton => ({ text, callback_data: data });
const menuButton = () => cb('☰ Menu', idCallback.menu('menu'));
export const helpButton = (l: IdLocale): TelegramButton => ({ text: l === 'en' ? '🙋 Still stuck? Chat with us' : '🙋 Masih bingung? Chat tim', url: SUPPORT_URL });
export const waltButton = (l: IdLocale): TelegramButton => ({ text: l === 'en' ? '👛 Open Walt' : '👛 Buka Walt', url: WALT_URL });
export const guideButton = (l: IdLocale, guide: IdGuideKey): TelegramButton => cb(`📖 ${say(l, GUIDES[guide].title)}`, idCallback.guide(guide, 1));

export type GuideScreen = { text: string; keyboard: TelegramInlineKeyboard; photo?: string };

/** The guide list (📖 Panduan). */
export const guideListScreen = (l: IdLocale): GuideScreen => ({
   text: say(
      l,
      t(
         '📖 Panduan langkah demi langkah\n\nPilih yang kamu butuhkan. Atau tulis pertanyaanmu di chat ini — kami bantu jawab.',
         '📖 Step-by-step guides\n\nPick what you need. Or type your question in this chat — we’ll help.'
      )
   ),
   keyboard: [...ID_GUIDE_KEYS.map((k) => [guideButton(l, k)]), [helpButton(l)], [menuButton()]]
});

/** One step of a guide (1-based). Out-of-range steps clamp. */
export const guideStepScreen = (l: IdLocale, key: IdGuideKey, step: number, opts: { waltUsername?: string | null; media?: Record<string, string> } = {}): GuideScreen => {
   const g = GUIDES[key];
   const n = g.steps.length;
   const i = Math.min(Math.max(1, Math.floor(step) || 1), n);
   const s = g.steps[i - 1];
   const walt = (opts.waltUsername ?? '').replace(/^@/, '') || 'jimmymoodengcredit';
   const last = i === n;
   const body = say(l, s.text).replaceAll('{walt}', walt);
   const text = [`📖 ${say(l, g.title)} — ${l === 'en' ? 'step' : 'langkah'} ${i}/${n}`, '', body, ...(last && g.warning ? ['', say(l, g.warning)] : [])].join('\n');
   const nav: TelegramButton[] = [];
   if (i > 1) nav.push(cb(l === 'en' ? '⬅️ Back' : '⬅️ Kembali', idCallback.guide(key, i - 1)));
   if (!last) nav.push(cb(l === 'en' ? '➡️ Next' : '➡️ Lanjut', idCallback.guide(key, i + 1)));
   const keyboard: TelegramInlineKeyboard = [];
   if (s.walt) keyboard.push([waltButton(l)]);
   if (nav.length) keyboard.push(nav);
   if (last) {
      if (key === 'uname') keyboard.push([cb(l === 'en' ? '✅ Done, check again' : '✅ Sudah, cek lagi', idCallback.guide('uname', 'ok'))]);
      else if (key === 'buy') keyboard.push([guideButton(l, 'send')]);
      else if (key === 'send' || key === 'how') keyboard.push([cb(l === 'en' ? '💰 Pay' : '💰 Bayar', idCallback.menu('repay'))]);
      else keyboard.push([cb(l === 'en' ? '✅ Done' : '✅ Selesai', idCallback.menu('menu'))]);
   }
   keyboard.push([helpButton(l)], [cb(l === 'en' ? '📖 All guides' : '📖 Semua panduan', idCallback.guide('list', 0)), menuButton()]);
   const photo = opts.media?.[`${key}:${i}`];
   return { text, keyboard, ...(photo ? { photo } : {}) };
};

// ── sending ──────────────────────────────────────────────────────────────────────────────────────
const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   try {
      const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
      return (data?.value as string | undefined) ?? null;
   } catch {
      return null;
   }
};

export const loadGuideMedia = async (svc: Svc): Promise<Record<string, string>> => {
   try {
      const raw = await getSetting(svc, 'id_guide_media');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
   } catch {
      return {};
   }
};

/** Send (or, for text-only steps, edit in place) a guide screen. */
export const showGuideScreen = async (chatId: number | string, screen: GuideScreen, editMessageId?: number) => {
   try {
      if (screen.photo) {
         await callTelegramApi('sendPhoto', { chat_id: chatId, photo: screen.photo, caption: screen.text.slice(0, 1024), reply_markup: { inline_keyboard: screen.keyboard } });
         return;
      }
      if (editMessageId) {
         try {
            await callTelegramApi('editMessageText', {
               chat_id: chatId,
               message_id: editMessageId,
               text: screen.text,
               disable_web_page_preview: true,
               reply_markup: { inline_keyboard: screen.keyboard }
            });
            return;
         } catch (err) {
            if (/not modified/i.test(err instanceof Error ? err.message : '')) return;
         }
      }
      await sendTelegramMessage(chatId, screen.text, { inlineKeyboard: screen.keyboard });
   } catch (err) {
      console.error('[idGuides] send failed', err instanceof Error ? err.message : err);
   }
};

/** Build + show step `step` of `key` for this chat (reads Moodeng's Walt username and the screenshots). */
export const sendGuide = async (svc: Svc, chatId: number | string, l: IdLocale, key: IdGuideKey, step = 1, editMessageId?: number) => {
   const [waltUsername, media] = await Promise.all([getSetting(svc, 'id_walt_username'), loadGuideMedia(svc)]);
   await showGuideScreen(chatId, guideStepScreen(l, key, step, { waltUsername, media }), editMessageId);
};

type GuideUser = { chat_id: string | number | null; preferred_locale: string | null; market: string | null };

const loadGuideUser = async (svc: Svc, userId: string): Promise<GuideUser | null> => {
   try {
      const { data } = await svc.from('users').select('chat_id, preferred_locale, market').eq('id', userId).maybeSingle();
      return (data as GuideUser | null) ?? null;
   } catch {
      return null;
   }
};

/** After a loan lands in their Walt: "it's there — here's how to turn it into rupiah". ID borrowers only. */
export const sendCashOutGuideOffer = async (svc: Svc, userId: string, amountUsd: number) => {
   const u = await loadGuideUser(svc, userId);
   if (!u || u.market !== 'ID' || !u.chat_id) return;
   const l = idLocaleOf(u.preferred_locale);
   let rate = NaN;
   try {
      rate = Number((await svc.rpc('current_usd_idr'))?.data);
   } catch {
      // no rate: the message just leaves out the rupiah
   }
   const approx = Number.isFinite(rate) && rate > 0 ? ` (≈ ${formatRp(Math.round((amountUsd * rate) / 1000) * 1000)})` : '';
   const text =
      l === 'en'
         ? `💸 ${amountUsd} USDT${approx} is now in your Walt.\n\nWant rupiah in your bank or e-wallet? Follow the steps — one at a time.`
         : `💸 ${amountUsd} USDT${approx} sudah masuk ke Walt kamu.\n\nMau jadi rupiah di bank atau e-wallet? Ikuti langkahnya — satu per satu.`;
   await sendTelegramMessage(u.chat_id, text, { inlineKeyboard: [[guideButton(l, 'cash')], [waltButton(l)], [helpButton(l)]] }).catch(() => undefined);
};

/** "You don't have a Telegram username yet" + the guide. */
export const sendUsernameGuideOffer = async (chatId: number | string, l: IdLocale) => {
   const text =
      l === 'en'
         ? '🙂 We send your loan to your Telegram username, and you don’t have one yet. It takes 1 minute — follow the steps.'
         : '🙂 Kami kirim pinjamanmu ke username Telegram kamu, dan kamu belum punya. Cuma 1 menit — ikuti langkahnya.';
   await sendTelegramMessage(chatId, text, { inlineKeyboard: [[guideButton(l, 'uname')], [helpButton(l)]] }).catch(() => undefined);
};

/** Nobody tapped "✅ Sudah kirim" hours after opening 💰 Bayar: offer the guides that get them there. */
export const sendRepayStuckOffer = async (chatId: number | string, l: IdLocale) => {
   const text =
      l === 'en'
         ? '👋 Need a hand paying? Most people get stuck on buying USDT. Here are the steps, one at a time — or chat with us.'
         : '👋 Butuh bantuan bayar? Biasanya orang bingung di bagian beli USDT. Ini langkahnya, satu per satu — atau chat dengan kami.';
   await sendTelegramMessage(chatId, text, { inlineKeyboard: [[guideButton(l, 'buy')], [guideButton(l, 'send')], [helpButton(l)]] }).catch(() => undefined);
};

// ── /idguidephoto (admin chats): attach a screenshot to a guide step ─────────────────────────────
// Send a photo with the caption "/idguidephoto cash 2" (or reply to a photo with that text): step 2 of
// "cash" is then shown with that picture. "/idguidephoto cash 2 clear" removes it; "/idguidephoto" alone
// lists which steps have pictures. Stored as Telegram file_ids in telegram_bot_settings.id_guide_media.
type PhotoMessage = {
   text?: string;
   caption?: string;
   chat: { id: number | string };
   photo?: Array<{ file_id: string; width?: number }>;
   reply_to_message?: PhotoMessage;
};

export const parseGuidePhotoCommand = (raw: string): { key: IdGuideKey; step: number; clear: boolean } | 'list' | null => {
   const m = /^\/idguidephoto(?:@\w+)?(?:\s+([a-z]+)\s+(\d{1,2})(\s+clear)?)?\s*$/i.exec(raw.trim());
   if (!m) return null;
   if (!m[1]) return 'list';
   const key = m[1].toLowerCase();
   if (!(ID_GUIDE_KEYS as readonly string[]).includes(key)) return null;
   const step = Number(m[2]);
   if (step < 1 || step > GUIDES[key as IdGuideKey].steps.length) return null;
   return { key: key as IdGuideKey, step, clear: Boolean(m[3]) };
};

export const isGuidePhotoCommand = (m: PhotoMessage) => /^\/idguidephoto\b/i.test(String(m.text ?? m.caption ?? '').trim());

export const handleGuidePhotoCommand = async (svc: Svc, m: PhotoMessage) => {
   const reply = (text: string) => sendTelegramMessage(m.chat.id, text).catch(() => undefined);
   const cmd = parseGuidePhotoCommand(String(m.text ?? m.caption ?? ''));
   const usage = `Usage: send a screenshot with the caption "/idguidephoto <guide> <step>" (guides: ${ID_GUIDE_KEYS.join(', ')}), or add "clear" to remove one.`;
   if (!cmd) return void (await reply(`Couldn't read that. ${usage}`));
   const media = await loadGuideMedia(svc);
   if (cmd === 'list') {
      const lines = ID_GUIDE_KEYS.map((k) => {
         const n = GUIDES[k].steps.length;
         const have = Array.from({ length: n }, (_, i) => (media[`${k}:${i + 1}`] ? `${i + 1}✅` : `${i + 1}·`)).join(' ');
         return `${k} (${GUIDES[k].title.en}): ${have}`;
      });
      return void (await reply(`📖 Guide screenshots\n${lines.join('\n')}\n\n${usage}`));
   }
   const slot = `${cmd.key}:${cmd.step}`;
   if (cmd.clear) {
      delete media[slot];
   } else {
      const photos = m.photo ?? m.reply_to_message?.photo ?? [];
      const best = [...photos].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (!best?.file_id) return void (await reply(`No photo found. ${usage}`));
      media[slot] = best.file_id;
   }
   const { error } = await svc
      .from('telegram_bot_settings')
      .upsert({ key: 'id_guide_media', value: JSON.stringify(media), description: 'Indonesia guides: screenshots per step (Telegram file_ids), set with /idguidephoto.' }, { onConflict: 'key' });
   if (error) return void (await reply(`Couldn't save: ${error.message}`));
   await reply(cmd.clear ? `🗑 Removed the picture from ${slot}.` : `✅ ${slot} ("${GUIDES[cmd.key].title.en}", step ${cmd.step}) now shows this picture.`);
};
