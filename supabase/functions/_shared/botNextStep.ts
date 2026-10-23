// "✅ How do I verify?" in the Messenger bot menu: instead of one fixed text, tell each person the
// next thing THEY need to do, read from their account. The SendPulse flow posts
// {"action":"next_step","psid":"{{contact_id}}"} to sendpulse-messenger-verify, which loads the stage
// here and sends the reply itself (the text, then a card with the link buttons).
//
// Stages mirror the app's journey (src/lib/verificationJourney.ts + src/lib/verificationUiState.ts):
//   not linked to an account → how to sign up (and how to link an account they already have)
//   wallet → Messenger → about you → book call → call booked   (onboarding, the pre-KYC gate)
//   apply → ID check (processing / review / unfinished / declined / duplicate) → verified
import { APPLY_URL, CONNECT_URL, SITE_URL } from './loanAccess.ts';
import { type BotLocale, signUpUrl, toBotLocale } from './messengerSupport.ts';
import { isKycVerified, kycTriesLeft, needsPreKycGate } from './preKycGate.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export type BotStage =
   | 'unlinked'
   | 'lender'
   | 'wallet'
   | 'messenger'
   | 'about'
   | 'book_call'
   | 'call_booked'
   | 'apply'
   | 'id_processing'
   | 'id_review'
   | 'id_unfinished'
   | 'id_declined'
   | 'id_no_tries'
   | 'id_duplicate'
   | 'verified';

export type BotUserRow = {
   user_role?: string | null;
   wallet_address?: string | null;
   messenger_verified_at?: string | null;
   whatsapp_verified_at?: string | null;
   income_type?: string | null;
   loan_access_status?: string | null;
   is_didit?: string | null;
   is_world_id?: string | null;
   is_world_id_passport?: string | null;
   didit_id_status?: string | null;
   didit_submitted_at?: string | null;
};

// Same order as getJourney() in the app, so the bot and the app's "next step" bar always agree.
export const botStage = (user: BotUserRow | null, gated: boolean, triesLeft: number): BotStage => {
   if (!user) return 'unlinked';
   if (isKycVerified(user)) return 'verified';
   if (user.user_role === 'lender') return 'lender';
   if (!user.wallet_address?.trim()) return 'wallet';
   if (gated) {
      if (user.loan_access_status === 'pending') return 'call_booked';
      if (!user.messenger_verified_at && !user.whatsapp_verified_at) return 'messenger';
      if (!user.income_type) return 'about';
      return 'book_call';
   }
   const raw = user.didit_id_status?.toLowerCase() ?? '';
   if (raw === 'duplicate') return 'id_duplicate';
   if (raw.includes('review')) return 'id_review';
   if (raw === 'declined') return triesLeft > 0 ? 'id_declined' : 'id_no_tries';
   if (['abandoned', 'expired', 'not started', 'in progress'].includes(raw)) return 'id_unfinished';
   if (user.didit_submitted_at) return 'id_processing';
   return 'apply';
};

type Button = { title: string; url: string };
// Sent as the text, then (when there are buttons) a small card titled `cardTitle` holding them.
export type NextStepReply = { text: string; cardTitle: string; buttons: Button[] };

// Every link carries the language, so the site opens in it (the app reads ?lang=).
const withLang = (url: string, locale: BotLocale) => `${url}${url.includes('?') ? '&' : '?'}lang=${locale}&utm_source=messenger&utm_medium=bot_menu`;

const BACK = { en: 'Type "menu" to go back.', fil: 'I-type ang "menu" para bumalik.' };
const BROWSER = {
   en: 'Open it in Chrome or Safari, not inside Facebook or Messenger.',
   fil: 'Buksan sa Chrome o Safari, hindi sa loob ng Facebook o Messenger.'
};

export const nextStepReply = (stage: BotStage, locale: BotLocale, firstName: string | null = null, triesLeft = 0): NextStepReply => {
   const fil = locale === 'fil';
   const hi = firstName ? `Hi ${firstName}! ` : '';
   const connect = withLang(CONNECT_URL, locale);
   const apply = withLang(APPLY_URL, locale);
   const verify = withLang(`${SITE_URL}/verify`, locale);
   const say = (en: string, tl: string) => (fil ? tl : en);
   const reply = (en: string, tl: string, buttons: Button[]): NextStepReply => ({
      text: `${hi}${say(en, tl)}\n\n${BACK[locale]}`,
      cardTitle: say('👇 Your next step', '👇 Ang susunod mong hakbang'),
      buttons
   });

   switch (stage) {
      case 'unlinked':
         return reply(
            '👋 Here\'s how to get verified and borrow:\n\n1. Sign up free (button below).\n2. In the app: set up your wallet → connect Messenger → tell us about you → book a 15-min video call.\n3. After the call, ask for your first loan. The ID check is the last step before it\'s sent.\n\nAlready have an account? Open Moodeng and tap "Connect Messenger" so I can show your exact next step.',
            '👋 Ganito ang pag-verify at paghiram:\n\n1. Mag-sign up nang libre (button sa ibaba).\n2. Sa app: i-set up ang wallet → i-connect ang Messenger → magkuwento tungkol sa iyo → mag-book ng 15-min video call.\n3. Pagkatapos ng call, humiram ng unang loan mo. Ang ID check ang huling hakbang bago ito ipadala.\n\nMay account ka na? Buksan ang Moodeng at i-tap ang "Connect Messenger" para maipakita ko ang susunod mong hakbang.',
            [
               { title: say('Sign up free', 'Mag-sign up'), url: signUpUrl(locale) },
               { title: say('I have an account', 'May account na ako'), url: connect }
            ]
         );
      case 'lender':
         return reply(
            '💜 As a Moo-lender you don\'t need the borrower steps. You can verify your ID anytime from your account.',
            '💜 Bilang Moo-lender, hindi mo kailangan ang mga hakbang ng borrower. Puwede mong i-verify ang ID mo kahit kailan sa account mo.',
            [{ title: say('Verify my ID', 'I-verify ang ID'), url: verify }]
         );
      case 'wallet':
         return reply(
            '📍 Your next step (1 of 3): set up your wallet. It takes a few seconds, and your loan arrives there.',
            '📍 Susunod mong hakbang (1 sa 3): i-set up ang wallet mo. Ilang segundo lang, at doon papasok ang loan mo.',
            [{ title: say('Set up wallet', 'I-set up ang wallet'), url: withLang(`${SITE_URL}/onboarding/wallet`, locale) }]
         );
      case 'messenger':
         return reply(
            '📍 Your next step (2 of 3): connect Messenger in the app, so the team can reach you about your loan.',
            '📍 Susunod mong hakbang (2 sa 3): i-connect ang Messenger sa app, para ma-message ka ng team tungkol sa loan mo.',
            [{ title: say('Connect Messenger', 'I-connect'), url: connect }]
         );
      case 'about':
         return reply(
            '📍 Your next step (2 of 3): tell us a little about your work and payday. It takes about a minute. Then you\'ll book your 15-min video call.',
            '📍 Susunod mong hakbang (2 sa 3): magkuwento nang kaunti tungkol sa trabaho at sweldo mo. Mga isang minuto lang. Tapos mag-book ka ng 15-min video call.',
            [{ title: say('Tell us about you', 'Magkuwento'), url: connect }]
         );
      case 'book_call':
         return reply(
            '📍 Your next step (3 of 3): book your 15-min video call with George or Emma. Right after the call, you can ask for your first loan. The ID check comes last, when you send it.',
            '📍 Susunod mong hakbang (3 sa 3): mag-book ng 15-min video call kasama si George o Emma. Pagkatapos ng call, puwede ka nang humiram ng unang loan mo. Ang ID check ay sa huli, kapag ipinadala mo na.',
            [{ title: say('Book your call', 'Mag-book ng call'), url: connect }]
         );
      case 'call_booked':
         return reply(
            '📅 Your call is booked. See you there! Right after the call, the team unlocks your loan request. You don\'t need to verify your ID yet.',
            '📅 Naka-book na ang call mo. Kita tayo doon! Pagkatapos ng call, bubuksan ng team ang loan request mo. Hindi mo pa kailangang i-verify ang ID mo.',
            [{ title: say('See call details', 'Tingnan ang call'), url: connect }]
         );
      case 'apply':
         return reply(
            `🎉 You're done with onboarding! Next: ask for your loan. Verifying your ID is the last step before it's sent (about 3 minutes):\n\n1. A clear photo of your national ID.\n2. A selfie, in good light.\n\n${BROWSER.en}`,
            `🎉 Tapos ka na sa onboarding! Susunod: humiram ng loan mo. Ang pag-verify ng ID ang huling hakbang bago ito ipadala (mga 3 minuto):\n\n1. Malinaw na litrato ng national ID mo.\n2. Selfie, sa maliwanag na lugar.\n\n${BROWSER.fil}`,
            [{ title: say('Ask for a loan', 'Humiram na'), url: apply }]
         );
      case 'id_processing':
         return reply(
            '⏳ We got your ID and it\'s being checked. Most checks finish in minutes. Nothing to do now, we\'ll message you here when it\'s done.',
            '⏳ Natanggap namin ang ID mo at sinusuri na. Karamihan ay tapos sa loob ng ilang minuto. Wala ka nang gagawin, ime-message ka namin dito kapag tapos na.',
            [{ title: say('See status', 'Tingnan ang status'), url: verify }]
         );
      case 'id_review':
         return reply(
            '👀 A person is reviewing your ID, usually within a few hours. Nothing to do now, we\'ll message you here when it\'s done.',
            '👀 May taong nagre-review ng ID mo, kadalasan sa loob ng ilang oras. Wala ka nang gagawin, ime-message ka namin dito kapag tapos na.',
            [{ title: say('See status', 'Tingnan ang status'), url: verify }]
         );
      case 'id_unfinished':
         return reply(
            `⏸️ You started your ID check but didn't finish. Pick up where you left off (about 3 minutes): a clear photo of your national ID, then a selfie, in good light.\n\n${BROWSER.en}`,
            `⏸️ Sinimulan mo ang ID check pero hindi natapos. Ituloy mo lang (mga 3 minuto): malinaw na litrato ng national ID mo, tapos selfie, sa maliwanag na lugar.\n\n${BROWSER.fil}`,
            [{ title: say('Finish ID check', 'Ituloy ang ID check'), url: verify }]
         );
      case 'id_declined':
         return reply(
            `🔁 Your ID check didn't go through, but you can try again (${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left). Tips: use your real national ID, make sure all 4 corners and the text are sharp, no glare, and take the selfie in good light.\n\n${BROWSER.en}`,
            `🔁 Hindi pumasa ang ID check mo, pero puwede kang sumubok ulit (${triesLeft} pa ang natitira). Tips: gamitin ang totoong national ID mo, kita ang 4 na sulok at malinaw ang text, walang silaw, at mag-selfie sa maliwanag na lugar.\n\n${BROWSER.fil}`,
            [{ title: say('Try again', 'Subukan ulit'), url: verify }]
         );
      case 'id_no_tries':
         return reply(
            '🙏 Your ID check didn\'t go through, and you\'ve used all your tries. Just type your question here and George or Emma will help you sort it out (10 AM–10 PM Thai time).',
            '🙏 Hindi pumasa ang ID check mo, at nagamit mo na lahat ng tries. I-type lang ang tanong mo dito at tutulungan ka nina George o Emma (10 AM–10 PM oras sa Thailand).',
            []
         );
      case 'id_duplicate':
         return reply(
            '⚠️ This face is already registered on another Moodeng account. Just type your question here and the team will help you (10 AM–10 PM Thai time).',
            '⚠️ Naka-register na ang mukhang ito sa ibang Moodeng account. I-type lang ang tanong mo dito at tutulungan ka ng team (10 AM–10 PM oras sa Thailand).',
            []
         );
      case 'verified':
         return reply(
            '✅ You\'re already verified, nothing else to do! Ask for a loan anytime on the Request Board.',
            '✅ Verified ka na, wala ka nang gagawin! Puwede kang humiram kahit kailan sa Request Board.',
            [{ title: say('Ask for a loan', 'Humiram na'), url: apply }]
         );
   }
};

// No is_world_id_passport: that column isn't on every database (the app reads it defensively), and
// selecting a missing column fails the whole lookup.
const USER_COLUMNS =
   'id, display_name, user_role, wallet_address, messenger_verified_at, whatsapp_verified_at, income_type, loan_access_status, is_didit, is_world_id, didit_id_status, didit_submitted_at, preferred_locale';

// Loads the account linked to this Messenger contact (users.messenger_psid, or one claimed in
// messenger_contacts) and builds their reply. `locale` from the flow wins; otherwise the saved one.
export const loadNextStep = async (svc: Svc, contactId: string, flowLocale?: string | null) => {
   const byPsid = await svc.from('users').select(USER_COLUMNS).eq('messenger_psid', contactId).limit(1).maybeSingle();
   let user = byPsid.data;
   const { data: contact } = await svc.from('messenger_contacts').select('user_id, locale').eq('contact_id', contactId).maybeSingle();
   if (!user && contact?.user_id) {
      user = (await svc.from('users').select(USER_COLUMNS).eq('id', contact.user_id).maybeSingle()).data;
   }
   const locale = toBotLocale(flowLocale || contact?.locale || user?.preferred_locale);
   const gated = user ? await needsPreKycGate(svc, user.id) : false;
   const declined = user?.didit_id_status?.toLowerCase() === 'declined';
   const triesLeft = user && declined ? await kycTriesLeft(svc, user.id) : 0;
   const stage = botStage(user ?? null, gated, triesLeft);
   const firstName = user?.display_name?.trim().split(/\s+/)[0] ?? null;
   return { stage, locale, reply: nextStepReply(stage, locale, firstName, triesLeft) };
};
