// Crisp live chat — the human support channel that replaces the Mecha AI
// assistant as the app's front door for "I have a problem".
//
// Why the swap: Mecha answered from the help docs, but the people who actually
// needed us were the ones Mecha couldn't help — stuck payouts, wrong wallet,
// blocked verification. They weren't finding the Facebook/Telegram links either
// (those live in the quick-start guide, not next to the Help button). Crisp puts
// a real inbox behind the Help button: the borrower types, it lands in the Crisp
// inbox, the team is emailed, and an emailed reply comes back into the same
// thread — badge in the widget plus an email to the borrower.
//
// Everything past "message lands in the inbox" is Crisp's own plumbing
// (operators, email notifications, reply-by-email, offline emails); this module
// only owns the browser side: load the widget, tell Crisp who the visitor is,
// and let any component open the chat.
//
// Loaded lazily — the script is only injected on first need (a Help tap, or an
// idle callback after the app has painted), so it never sits on the critical
// path of a first paint on a mid-range Android in Manila.

type CrispCommand = unknown[];

declare global {
   interface Window {
      $crisp?: CrispCommand[];
      CRISP_WEBSITE_ID?: string;
   }
}

// The Crisp website id is public by design — it ships in the client script on
// every page that renders the widget, so hard-coding the default is safe and
// keeps the widget working without a new secret in the dotenvx bundle. The env
// var stays supported so a staging workspace can be pointed somewhere else.
const DEFAULT_WEBSITE_ID = '8a36b463-2e4d-4909-9bb8-6ad9e670e1de';

const envWebsiteId = import.meta.env.VITE_CRISP_WEBSITE_ID as string | undefined;

// Guard against the raw dotenvx `encrypted:…` ciphertext leaking through as a
// truthy-but-invalid id (same failure mode clarity.ts guards against).
const configuredWebsiteId =
   envWebsiteId && !envWebsiteId.startsWith('encrypted:') ? envWebsiteId.trim() : DEFAULT_WEBSITE_ID;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The validated Crisp website id, or null when misconfigured. */
export const crispWebsiteId: string | null = UUID_PATTERN.test(configuredWebsiteId) ? configuredWebsiteId : null;

export const isCrispEnabled = crispWebsiteId !== null;

let injected = false;

/**
 * Queue a command for the Crisp client. Safe before the script has loaded — the
 * `$crisp` array is the client's own command queue and is drained on load, so
 * calls made during boot are not lost.
 */
export function crispPush(command: CrispCommand): void {
   if (!isCrispEnabled || typeof window === 'undefined') return;
   window.$crisp = window.$crisp || [];
   window.$crisp.push(command);
}

/**
 * Inject the Crisp client exactly once. Safe to call unconditionally and from
 * anywhere — repeat calls are no-ops.
 */
export function loadCrisp(): void {
   if (!isCrispEnabled || injected || typeof window === 'undefined') return;
   injected = true;

   window.$crisp = window.$crisp || [];
   window.CRISP_WEBSITE_ID = crispWebsiteId!;
   // Swallow client-side errors inside the widget rather than letting them reach
   // our global error handler in providers.tsx and pollute the console.
   crispPush(['safe', true]);

   const script = document.createElement('script');
   script.src = 'https://client.crisp.chat/l.js';
   script.async = true;
   document.head.appendChild(script);
}

export interface CrispIdentity {
   email?: string | null;
   nickname?: string | null;
   phone?: string | null;
   /**
    * Free-form context shown beside the conversation in the Crisp inbox. This is
    * the difference between "my payout failed" and an answerable ticket — put
    * anything an operator would otherwise have to ask for here.
    */
   data?: Record<string, string | number | boolean | null | undefined>;
   /** Coarse tags for inbox filtering, e.g. ['borrower', 'verified']. */
   segments?: string[];
}

/**
 * Attach who the visitor is to the current Crisp session. Called on login and
 * whenever the profile changes; unknown fields are skipped rather than cleared,
 * so a partial profile never wipes what Crisp already knows.
 */
export function identifyCrisp({ email, nickname, phone, data, segments }: CrispIdentity): void {
   if (!isCrispEnabled) return;

   if (email) crispPush(['set', 'user:email', [email]]);
   if (nickname) crispPush(['set', 'user:nickname', [nickname]]);
   if (phone) crispPush(['set', 'user:phone', [phone]]);

   if (data) {
      // Crisp takes session data as an array of [key, value] pairs and rejects
      // null/undefined values, so drop the empties rather than send them.
      const pairs = Object.entries(data)
         .filter(([, value]) => value !== null && value !== undefined && value !== '')
         .map(([key, value]) => [key, String(value)]);
      if (pairs.length > 0) crispPush(['set', 'session:data', [pairs]]);
   }

   if (segments && segments.length > 0) crispPush(['set', 'session:segments', [segments, true]]);
}

/**
 * Drop the Crisp session on logout so the next person to use this browser (a
 * shared phone or a cafe machine — common for our borrowers) doesn't inherit the
 * previous user's support thread.
 */
export function resetCrispSession(): void {
   if (!isCrispEnabled) return;
   crispPush(['do', 'session:reset']);
}

/**
 * Open the chat. Pass `prefill` to post it as the visitor's opening message, so
 * an inline "Why did this fail?" button starts a real conversation with zero
 * typing — the same zero-typing behaviour the old AskMechaButton had.
 */
export function openSupportChat(prefill?: string): void {
   loadCrisp();
   crispPush(['do', 'chat:show']);
   crispPush(['do', 'chat:open']);
   const text = prefill?.trim();
   if (text) crispPush(['do', 'message:send', ['text', text]]);
}

export function closeSupportChat(): void {
   crispPush(['do', 'chat:close']);
}

/**
 * Something just went wrong for this user (an error toast fired). Pull the widget
 * load forward instead of waiting on the idle callback, and make sure the
 * launcher is on screen — so "message a human" is one tap away at the moment
 * they need it. Deliberately does *not* open the chat: an unasked-for panel over
 * a failed action is the behaviour that made the old Mecha bubble annoying.
 */
export function signalSupportProblem(): void {
   loadCrisp();
   crispPush(['do', 'chat:show']);
}

/** Show the floating launcher bubble. */
export function showCrispLauncher(): void {
   crispPush(['do', 'chat:show']);
}

/** Hide the floating launcher without closing an open conversation. */
export function hideCrispLauncher(): void {
   crispPush(['do', 'chat:hide']);
}

/**
 * Match the widget's chrome to the language the user picked in-app. Crisp wants
 * an ISO 639-1 code; our Filipino locale is `fil` in-app but `tl` to Crisp.
 */
export function setCrispLocale(locale: string | undefined): void {
   if (!locale) return;
   crispPush(['config', 'locale', [locale === 'fil' ? 'tl' : locale]]);
}

/**
 * Fire `handler` when an operator (or a Crisp bot) sends the visitor a message.
 * This is what turns "someone replied to you" into an in-app notification rather
 * than a badge the borrower has to notice on their own.
 */
export function onCrispMessageReceived(handler: () => void): void {
   crispPush(['on', 'message:received', handler]);
}

/** Number of unread operator messages, or 0 before the client has loaded. */
export function crispUnreadCount(): number {
   if (!isCrispEnabled || typeof window === 'undefined') return 0;
   const crisp = window.$crisp as (CrispCommand[] & { get?: (key: string) => unknown }) | undefined;
   const count = crisp?.get?.('chat:unread:count');
   return typeof count === 'number' ? count : 0;
}
