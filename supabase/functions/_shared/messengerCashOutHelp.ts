// Cash-out help on Messenger, right after a loan is funded (George, 2026-11-15).
//
// Why: borrowers got "your loan is funded" and then asked "how do I transfer my funds? usdc or usdt?
// kinda confused what to click". So the funded message now ends with one question, "How will you cash
// out?", and a reply of 1–4 (or the name: QR, GCrypto, PDAX, Maya) gets that way's steps, with the
// exact coin + network to pick. The coin is always USDC. Our wallet is on Base, so exchange apps must
// receive "USDC" on the "Base" network. Maya is the exception: Maya only takes USDC on Solana, and
// Moodeng's Send to Maya changes it for them. Every reply says what NOT to pick (USDT, Ethereum), since a
// wrong network can lose the money.
//
// Numbers only count for a few days after a funded loan (a "2" later could be anything); the names
// count any time for someone who has had a loan funded.
import { sendMessengerMessage, type MessengerCard } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export type CashOutChoice = 'qr' | 'gcrypto' | 'pdax' | 'maya';

const SITE = 'https://moodeng.app';
export const CASH_OUT_URL = `${SITE}/withdraw`;
// How long after funding a bare "1"–"4" is read as an answer to the question.
const NUMBER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export const CASH_OUT_QUESTION =
   '💸 How will you cash out to pesos?\n\n' +
   '1️⃣ Bank QR (straight to your bank)\n' +
   '2️⃣ GCrypto (in GCash)\n' +
   '3️⃣ PDAX\n' +
   '4️⃣ Maya\n\n' +
   'Reply 1, 2, 3 or 4 and I’ll show you exactly what to tap.';

// The funded card's second button.
export const CASH_OUT_BUTTON = { title: '💸 How to cash out', url: CASH_OUT_URL };

const NAMES: Array<[RegExp, CashOutChoice]> = [
   [/^(bank\s*)?qr(\s*code)?$|^bank$/, 'qr'],
   [/^g\s*crypto$|^gcash$/, 'gcrypto'],
   [/^pdax$/, 'pdax'],
   [/^maya$|^paymaya$/, 'maya']
];
const NUMBERS: Record<string, CashOutChoice> = { '1': 'qr', '2': 'gcrypto', '3': 'pdax', '4': 'maya' };

/** The way they picked, from their message: a number ('number') or a name ('name'); null if neither. */
export const parseCashOutChoice = (text: string): { choice: CashOutChoice; by: 'number' | 'name' } | null => {
   const t = text
      .trim()
      .toLowerCase()
      .replace(/[.!?。]+$/, '')
      .replace(/[⃣️]/g, '') // 1️⃣ → 1
      .trim();
   if (NUMBERS[t]) return { choice: NUMBERS[t], by: 'number' };
   for (const [re, choice] of NAMES) if (re.test(t)) return { choice, by: 'name' };
   return null;
};

const NOT_THESE =
   '⚠️ You’ll see many USDCs (Ethereum, Avalanche, Solana…). Tap only USD Coin (Base). Not USDT, not Ethereum. The wrong one can lose your money.';
const FOOTER = '\n\nStuck? Send a screenshot here and we’ll help 🦛\nAnother way? Reply 1, 2, 3 or 4.';

/** The steps for one way, plus a card with its buttons. */
export const buildCashOutReply = (choice: CashOutChoice): { text: string; card: MessengerCard } => {
   switch (choice) {
      case 'qr':
         return {
            text:
               '🏦 Bank QR: pesos straight to your bank. No exchange app, no network to pick.\n\n' +
               '1. In your bank app, open Receive money / QR and save your QR picture.\n' +
               '2. In Moodeng tap Cash out → Your bank’s QR.\n' +
               '3. Upload the QR picture, check the pesos you get (fees included) and confirm.\n\n' +
               'Up to ₱25,000 per cash-out.' +
               FOOTER,
            card: { title: 'Cash out with your bank QR', button: { title: 'Cash out now', url: `${CASH_OUT_URL}?to=qr` } }
         };
      case 'gcrypto':
         return {
            text:
               '📱 GCrypto (in GCash). Your loan is USDC on the Base network.\n\n' +
               '1. GCash → GCrypto (you need a fully verified GCash).\n' +
               '2. Search USDC and tap the one that says USD Coin (Base). Then Receive.\n' +
               '3. Copy the address.\n' +
               '4. In Moodeng tap Cash out → GCrypto, paste it and send.\n' +
               '5. When it arrives: GCrypto → Trade → Sell USDC (Base) for pesos.\n' +
               '6. Peso Balance → Withdraw, and the pesos go to your GCash wallet.\n\n' +
               NOT_THESE +
               FOOTER,
            card: {
               title: 'GCrypto: USDC on Base',
               button: { title: 'Cash out now', url: CASH_OUT_URL },
               moreButtons: [{ title: '▶️ Watch how', url: 'https://www.youtube.com/watch?v=m5-cD7v4SLg' }]
            }
         };
      case 'pdax':
         return {
            text:
               '📈 PDAX. Your loan is USDC on the Base network.\n\n' +
               '1. PDAX → Portfolio → USDC → Receive (Deposit).\n' +
               '2. Network: Base (PDAX shows it as USDCBASE). Not plain USDC.\n' +
               '3. Copy the address.\n' +
               '4. In Moodeng tap Cash out → PDAX, paste it and send.\n' +
               '5. Check your peso (PHP) balance first: PDAX often turns it into pesos for you. Still USDC? Markets → USDCBASE/PHP → Sell.\n' +
               '6. Portfolio → Cash out → pick your bank or GCash.\n\n' +
               NOT_THESE +
               FOOTER,
            card: {
               title: 'PDAX: USDC on Base',
               button: { title: 'Cash out now', url: CASH_OUT_URL },
               moreButtons: [
                  { title: '▶️ Find address', url: 'https://www.youtube.com/watch?v=q8F8H1UzBEU' },
                  { title: '▶️ Sell for pesos', url: 'https://www.youtube.com/shorts/IyObBHW3Sbg' }
               ]
            }
         };
      case 'maya':
         return {
            text:
               '💜 Maya. Maya only takes USDC on Solana, so Moodeng changes it for you.\n\n' +
               '1. Maya → Crypto → tap ⋯ next to Sell → Receive.\n' +
               '2. Search usdc → USD Coin → network: Solana.\n' +
               '3. Copy the address.\n' +
               '4. In Moodeng tap Cash out → Maya, paste it and send.\n' +
               '5. In Maya, sell the USDC for pesos.\n\n' +
               '⚠️ For Maya pick USDC on Solana, not Ethereum and not USDT. The wrong one can lose your money.\n' +
               'Don’t see Maya under Cash out? It isn’t open for your account yet, so use 1, 2 or 3.' +
               FOOTER,
            card: { title: 'Maya: USDC on Solana', button: { title: 'Cash out now', url: `${CASH_OUT_URL}?to=maya` } }
         };
   }
};

/** True when the message picked a cash-out way and we answered it (so it isn't also a support ticket). */
export const handleCashOutMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      const parsed = parseCashOutChoice(text);
      if (!parsed) return false;
      // Only borrowers with a funded loan; a bare number only within a few days of funding.
      const { data } = await svc
         .from('loans')
         .select('funded_at')
         .eq('borrower_user_id', userId)
         .not('funded_at', 'is', null)
         .order('funded_at', { ascending: false })
         .limit(1);
      const fundedAt = (data as Array<{ funded_at: string }> | null)?.[0]?.funded_at;
      if (!fundedAt) return false;
      if (parsed.by === 'number' && Date.now() - Date.parse(fundedAt) > NUMBER_WINDOW_MS) return false;

      const res = await sendMessengerMessage(contactId, buildCashOutReply(parsed.choice));
      console.log(`messenger-cashout-help: ${parsed.choice} → ${res.ok ? 'sent' : `not sent (${res.reason})`}`);
      return res.ok;
   } catch (err) {
      console.error('messenger-cashout-help: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
