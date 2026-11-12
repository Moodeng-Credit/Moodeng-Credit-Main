// Indonesia track: /idready (admin chats) — is everything in place to fund an Indonesian request from the
// board (vault on Base → LI.FI → BNB Chain → the borrower's Walt)? One message, one line per check, and
// what to do about each ❌. Reads only, except the two "🧪 Test gas" buttons: each sends a 0-USDC transfer
// from the payout wallet to itself on that chain, which moves no money and proves the Openfort gas
// sponsorship covers the chain (the bridge fails without it, because the wallet holds no gas coin).
import {
   balanceOf,
   BASE_CHAIN_ID,
   BSC_CHAIN_ID,
   BSC_USDC_CHECKSUM,
   encodeTransfer,
   getPayoutWallet,
   loadPayoutCreds,
   NotSentError,
   pollOpenfortTx,
   sendFromPayoutWallet
} from './idPayoutWallet.ts';
import { payoutTokenOf } from './idManualFunding.ts';
import { adminChatIds } from './idRepayments.ts';
import { BASE_USDC, lifiQuoteToAmount } from './lifi.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';
import { RPC_URL } from './usdcTransfer.ts';
import { VAULT_OPERATOR } from './vaultWatch.ts';
import { readVaultSnapshot } from './vaultWatchRead.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const CB = 'idrd:';
const TEST_LOAN_USD = 5;

export type Check = { ok: boolean | null; label: string; fix?: string };

/** "✅ label" / "❌ label\n   → fix" / "⚪ label" (unknown). Pure (idReady.test.ts). */
export const checkLines = (checks: Check[]): string =>
   checks.map((c) => `${c.ok === true ? '✅' : c.ok === false ? '❌' : '⚪'} ${c.label}${c.ok !== true && c.fix ? `\n   → ${c.fix}` : ''}`).join('\n');

/** The headline. Unknown checks don't count as failures. Pure. */
export const readyHeadline = (checks: Check[]): string => {
   const bad = checks.filter((c) => c.ok === false).length;
   const unknown = checks.filter((c) => c.ok === null).length;
   if (bad) return `🇮🇩 Not ready: ${bad} thing${bad === 1 ? '' : 's'} to fix`;
   return unknown ? `🇮🇩 Looks ready, ${unknown} not checked yet` : '🇮🇩 Ready to fund Indonesian requests';
};

const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};
const setSetting = (svc: Svc, key: string, value: string) =>
   svc.from('telegram_bot_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 160);
const CHAIN_NAME: Record<number, string> = { [BASE_CHAIN_ID]: 'Base', [BSC_CHAIN_ID]: 'BNB Chain' };
const gasKey = (chainId: number) => `id_gas_test_${chainId}`;

/** Result of the last "🧪 Test gas" on a chain: 'ok' within 30 days, a failure, or never run. */
const gasCheck = async (svc: Svc, chainId: number, hasWallet: boolean): Promise<Check> => {
   const name = CHAIN_NAME[chainId];
   const raw = await getSetting(svc, gasKey(chainId));
   const [state, at, detail] = String(raw ?? '').split('|');
   const fresh = at && Date.now() - Date.parse(at) < 30 * 86_400_000;
   if (state === 'ok' && fresh) return { ok: true, label: `Gas sponsorship on ${name} (tested ${at.slice(0, 10)})` };
   if (state === 'failed' && fresh) {
      return {
         ok: false,
         label: `Gas sponsorship on ${name}: test failed (${detail || 'no reason given'})`,
         fix: `Openfort dashboard → Gas sponsorship → add ${name} with an “All functions” rule, then tap 🧪 Test gas on ${name}.`
      };
   }
   return {
      ok: null,
      label: `Gas sponsorship on ${name}: not tested`,
      fix: hasWallet ? `Tap 🧪 Test gas on ${name} below (sends 0 USDC to itself; moves no money).` : 'Create the payout wallet first.'
   };
};

export const readinessCard = async (svc: Svc): Promise<{ text: string; keyboard: TelegramInlineKeyboard }> => {
   const checks: Check[] = [];
   const [creds, wallet, token, required, watch, pot] = await Promise.all([
      loadPayoutCreds(svc).catch(() => null),
      getPayoutWallet(svc).catch(() => null),
      payoutTokenOf(svc),
      getSetting(svc, 'id_walt_address_required'),
      getSetting(svc, 'walt_watch'),
      getSetting(svc, 'walt_pot_usdt')
   ]);

   checks.push({ ok: !!creds, label: 'Openfort keys for the payout wallet', fix: 'Vault secret OPENFORT_PAYOUT is missing.' });
   checks.push({
      ok: !!wallet,
      label: wallet ? `Payout wallet ${wallet.address}` : 'Payout wallet',
      fix: 'Admin → Requests → payout wallet panel → Create.'
   });
   checks.push(await gasCheck(svc, BASE_CHAIN_ID, !!wallet));
   checks.push(await gasCheck(svc, BSC_CHAIN_ID, !!wallet));
   checks.push({
      ok: token === 'USDC',
      label: `Payout coin: ${token}`,
      fix: 'The bridge lands USDC. Set telegram_bot_settings.id_payout_token to USDC.'
   });

   // The vault: can it lend a first loan, and may our lending wallet draw?
   try {
      const v = await readVaultSnapshot(svc, RPC_URL);
      checks.push({
         ok: !v.paused && v.operatorCanDraw && v.available >= TEST_LOAN_USD + 0.5,
         label: `BitRepo vault: ${v.available.toFixed(2)} USDC available${v.paused ? ', PAUSED' : ''}${v.operatorCanDraw ? '' : ', lending wallet can’t draw'}`,
         fix: v.paused
            ? 'BitRepo paused draws. Ask Thomas.'
            : !v.operatorCanDraw
              ? 'The lending wallet lost its draw permission. Ask Thomas.'
              : 'Not enough left in the vault for a $5 loan. Pay some back (Admin → Credit line).'
      });
   } catch (err) {
      checks.push({ ok: null, label: `BitRepo vault: couldn’t read it (${errMsg(err)})`, fix: 'Try /idready again in a minute.' });
   }

   // The bridge: a real LI.FI price for landing $5 on BNB Chain.
   try {
      const from = wallet?.address ?? VAULT_OPERATOR;
      const q = await lifiQuoteToAmount(svc, {
         fromChain: BASE_CHAIN_ID,
         toChain: BSC_CHAIN_ID,
         fromToken: BASE_USDC,
         toToken: BSC_USDC_CHECKSUM,
         fromAddress: from,
         toAddress: from,
         toAmount: BigInt(TEST_LOAN_USD) * 10n ** 18n
      });
      const cost = Number(q.fromAmount) / 1e6 - TEST_LOAN_USD;
      checks.push({
         ok: cost < 0.5,
         label: `Bridge price: $${TEST_LOAN_USD} lands for ${(Number(q.fromAmount) / 1e6).toFixed(2)} USDC (via ${q.tool})`,
         fix: 'The bridge is expensive right now (over $0.50 on $5). Try later.'
      });
   } catch (err) {
      checks.push({ ok: false, label: `Bridge price: LI.FI didn’t answer (${errMsg(err)})`, fix: 'Try /idready again in a minute.' });
   }

   // Money already on BNB Chain (only matters for "pay from the payout wallet balance").
   if (wallet) {
      const bal = await balanceOf(wallet.address).catch(() => null);
      checks.push({
         ok: bal ? true : null,
         label: bal ? `Payout wallet holds ${bal.usdc.toFixed(2)} USDC, ${bal.usdt.toFixed(2)} USDT on BNB Chain` : 'Payout wallet balance: couldn’t read BNB Chain'
      });
   }

   // Borrowers.
   const { data: users } = await svc.from('users').select('walt_address, video_call_outcome').eq('market', 'ID').limit(1000);
   const rows = (users ?? []) as Array<{ walt_address: string | null; video_call_outcome: string | null }>;
   const approved = rows.filter((u) => u.video_call_outcome === 'approved');
   const withAddress = approved.filter((u) => !!u.walt_address).length;
   const mustGive = String(required ?? 'on').trim().toLowerCase() !== 'off';
   checks.push({
      ok: approved.length === 0 ? null : withAddress === approved.length,
      label: `Borrowers: ${rows.length} Indonesian accounts, ${approved.length} approved, ${withAddress} of those with a Walt address`,
      fix: mustGive ? 'The bot asks for the address when they tap 💸 Ajukan.' : 'The address is optional right now (id_walt_address_required = off).'
   });
   checks.push({
      ok: mustGive,
      label: `Walt address required before a request: ${mustGive ? 'yes' : 'no'}`,
      fix: 'Set telegram_bot_settings.id_walt_address_required to on.'
   });

   const { count: waiting } = await svc
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('market', 'ID')
      .eq('loan_status', 'Requested')
      .is('funded_at', null);
   const footer = [
      `Waiting on the board: ${waiting ?? 0} Indonesian request${waiting === 1 ? '' : 's'}.`,
      `Walt watch: ${String(watch ?? 'observe')}${pot ? ` · Walt pot ${pot} USDT` : ''}.`
   ];

   const keyboard: TelegramInlineKeyboard = wallet
      ? [
           [
              { text: '🧪 Test gas on Base', callback_data: `${CB}g:${BASE_CHAIN_ID}` },
              { text: '🧪 Test gas on BNB', callback_data: `${CB}g:${BSC_CHAIN_ID}` }
           ],
           [{ text: '🔄 Check again', callback_data: `${CB}r` }]
        ]
      : [[{ text: '🔄 Check again', callback_data: `${CB}r` }]];
   return { text: [readyHeadline(checks), '', checkLines(checks), '', ...footer].join('\n').slice(0, 4000), keyboard };
};

/** /idready */
export const handleReadyCommand = async (svc: Svc, message: { chat: { id: number | string }; text?: string }): Promise<boolean> => {
   if (!/^\/idready\b/i.test((message.text ?? '').trim())) return false;
   const card = await readinessCard(svc);
   await sendTelegramMessage(message.chat.id, card.text, { inlineKeyboard: card.keyboard }).catch(() => undefined);
   return true;
};

/** 0 USDC from the payout wallet to itself on one chain: proves the sponsorship, moves nothing. */
const testGas = async (svc: Svc, chainId: number): Promise<{ ok: boolean; detail: string }> => {
   const wallet = await getPayoutWallet(svc);
   if (!wallet) return { ok: false, detail: 'no payout wallet' };
   const token = chainId === BASE_CHAIN_ID ? BASE_USDC : BSC_USDC_CHECKSUM;
   let txId: string;
   try {
      txId = await sendFromPayoutWallet(svc, chainId, [{ to: token, data: encodeTransfer(wallet.address, 0n) }], Date.now() + 50_000);
   } catch (err) {
      return { ok: false, detail: `${err instanceof NotSentError ? 'not sent' : 'send failed'}: ${errMsg(err)}` };
   }
   for (let i = 0; i < 8; i += 1) {
      await new Promise((r) => setTimeout(r, 3_000));
      const st = await pollOpenfortTx(svc, txId).catch(() => null);
      if (st?.state === 'succeeded') return { ok: true, detail: st.txHash };
      if (st?.state === 'failed') return { ok: false, detail: st.error.slice(0, 120) };
   }
   return { ok: false, detail: `still pending after 24 s (Openfort ${txId}); tap again in a minute` };
};

/** Buttons under the /idready card (admin chats only). True when handled. */
export const handleReadyCallback = async (
   svc: Svc,
   query: { id: string; data?: string; message?: { chat: { id: number | string }; message_id: number } }
): Promise<boolean> => {
   if (!query.data?.startsWith(CB)) return false;
   const answer = (text: string) => callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const chatId = query.message?.chat.id;
   if (chatId == null || !(await adminChatIds(svc)).includes(String(chatId))) {
      await answer('Not allowed here.');
      return true;
   }
   const [, kind, arg] = query.data.split(':');
   if (kind === 'g') {
      const chainId = Number(arg);
      if (chainId !== BASE_CHAIN_ID && chainId !== BSC_CHAIN_ID) {
         await answer('Unknown chain.');
         return true;
      }
      // One test per chain per minute, however often it's tapped.
      const last = String((await getSetting(svc, `${gasKey(chainId)}_started`)) ?? '');
      if (last && Date.now() - Date.parse(last) < 60_000) {
         await answer('A test just ran. Wait a minute.');
         return true;
      }
      await setSetting(svc, `${gasKey(chainId)}_started`, new Date().toISOString());
      await answer(`Testing gas on ${CHAIN_NAME[chainId]}… about 20 seconds.`);
      const res = await testGas(svc, chainId);
      await setSetting(svc, gasKey(chainId), `${res.ok ? 'ok' : 'failed'}|${new Date().toISOString()}|${res.ok ? '' : res.detail.replace(/\|/g, '/')}`);
   } else if (kind === 'r') {
      await answer('Checking…');
   } else {
      await answer('Unknown action.');
      return true;
   }
   const card = await readinessCard(svc);
   if (query.message)
      await callTelegramApi('editMessageText', {
         chat_id: chatId,
         message_id: query.message.message_id,
         text: `${card.text}\n\nChecked ${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(11, 16)} Bangkok`,
         reply_markup: { inline_keyboard: card.keyboard }
      }).catch(() => undefined);
   return true;
};
