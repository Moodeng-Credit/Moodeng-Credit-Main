// Live chat — the human support channel behind every "I have a problem" path in
// the app, and the replacement for the Mecha AI assistant on those paths.
//
// The vendor is the self-hosted Moodeng Support widget (Discord-backed), and it
// is deliberately sealed inside this one file — exactly as tawk.to and Crisp
// were before it. Everything else in the app talks to openSupportChat() /
// identifySupport() / onSupportMessageReceived(), so swapping the vendor is a
// rewrite of this module and nothing else.
//
// Why we left tawk.to: replies now come back through our own Discord ops flow
// (a ticket per chat in #web-support, the team replies with a button), so there
// is no third-party inbox, no per-contact free-tier cap, and no vendor script
// phoning home from every borrower's browser. The widget is served from our own
// Vercel deployment and posts into Supabase + Discord.
//
// Loaded lazily: the script is injected on first need (a Help tap, or an idle
// callback once the app has painted), so it never sits on the critical path of a
// first paint on the mid-range Android handsets most of our borrowers use.

interface MoodengSupportApi {
   open: (topic?: string) => void;
   close: () => void;
   show: () => void;
   hide: () => void;
   identify: (info: { name?: string; email?: string; context?: string }) => void;
   reset: () => void;
   signalProblem: () => void;
   onMessage: (handler: (message: unknown) => void) => void;
   version?: number;
}

declare global {
   interface Window {
      MoodengSupport?: MoodengSupportApi;
   }
}

// The widget is served from our own deployment. `data-api` pins the API origin
// so the injected script does not have to guess it from document.currentScript
// (which is null for a dynamically-inserted tag).
const WIDGET_SRC = 'https://web-iota-sage-38.vercel.app/widget.js';
const WIDGET_API_ORIGIN = 'https://web-iota-sage-38.vercel.app';

/**
 * Whether live chat is configured. The self-hosted widget needs no per-tenant
 * ids, so it is always available — the fallbacks to Telegram/Facebook/email
 * stay in the callers as a belt-and-braces path if the script fails to load.
 */
export const isSupportChatEnabled = true;

let injected = false;
/** Actions registered before the widget API was ready, replayed once it is. */
const pending: Array<() => void> = [];
let pollTimer: number | undefined;

// Readiness is decided by the control API actually existing on window.
const isApiReady = (): boolean => typeof window !== 'undefined' && typeof window.MoodengSupport?.open === 'function';

// Give up after ~20s. A widget that has not booted by then is blocked (ad
// blocker, offline, corporate proxy) and will not boot later; dropping the queue
// keeps a stuck poll from running for the life of the session.
const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 20000;

function drainPending(): void {
   while (pending.length > 0) pending.shift()!();
}

function whenReady(action: () => void): void {
   if (typeof window === 'undefined') return;
   if (isApiReady()) {
      action();
      return;
   }

   pending.push(action);
   loadSupportChat();

   if (pollTimer !== undefined) return;
   const startedAt = Date.now();
   pollTimer = window.setInterval(() => {
      if (isApiReady()) {
         window.clearInterval(pollTimer);
         pollTimer = undefined;
         drainPending();
      } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
         window.clearInterval(pollTimer);
         pollTimer = undefined;
         pending.length = 0;
         console.warn('[support] live chat did not load; falling back to Telegram/Facebook/email');
      }
   }, POLL_INTERVAL_MS);
}

/**
 * Inject the widget client exactly once. Safe to call unconditionally and from
 * anywhere — repeat calls are no-ops.
 */
export function loadSupportChat(): void {
   if (injected || typeof window === 'undefined') return;
   injected = true;
   if (window.MoodengSupport) return; // already present (e.g. a static embed)

   const script = document.createElement('script');
   script.src = WIDGET_SRC;
   script.async = true;
   // The widget resolves its config from these attributes when currentScript is
   // null (the dynamic-injection case).
   script.setAttribute('data-moodeng-support', '1');
   script.setAttribute('data-api', WIDGET_API_ORIGIN);
   script.setAttribute('data-title', 'Moodeng Support');
   script.setAttribute('data-accent', '#16a34a');
   document.body.appendChild(script);
}

export interface SupportIdentity {
   email?: string | null;
   nickname?: string | null;
   /**
    * Free-form context shown beside the conversation in the support ticket. This
    * is the difference between "my payout failed" and an answerable ticket — put
    * anything an agent would otherwise have to ask for here.
    */
   data?: Record<string, string | number | boolean | null | undefined>;
   /** Coarse tags for filtering, e.g. ['borrower', 'wallet-connected']. */
   segments?: string[];
}

/**
 * Attach who the visitor is to the current chat session. Called on login and
 * whenever the profile changes. With an identity set, escalating to a human
 * skips the name/email form and the Discord ticket opens with the visitor's
 * name, email, and any context/segments folded into the ticket intro.
 */
export function identifySupport({ email, nickname, data, segments }: SupportIdentity): void {
   if (typeof window === 'undefined') return;

   // Fold the structured data + segments into a single context string the ticket
   // intro can carry (the widget has one free-form context field, not arbitrary
   // key/value attributes like tawk.to did).
   const parts: string[] = [];
   for (const [key, value] of Object.entries(data ?? {})) {
      if (value !== null && value !== undefined && value !== '') parts.push(`${key}: ${value}`);
   }
   if (segments && segments.length > 0) parts.push(`tags: ${segments.join(', ')}`);
   const context = parts.length > 0 ? parts.join(' · ') : undefined;

   whenReady(() =>
      window.MoodengSupport?.identify({
         name: nickname ?? undefined,
         email: email ?? undefined,
         context,
      }),
   );
}

/**
 * Drop the chat session on logout so the next person to use this browser — a
 * shared phone or a cafe machine, both normal for our borrowers — does not
 * inherit the previous user's support thread.
 */
export function resetSupportSession(): void {
   if (typeof window === 'undefined') return;
   whenReady(() => window.MoodengSupport?.reset());
}

/**
 * Open the chat.
 *
 * `topic` is the help subject the borrower tapped. The widget asks it as the
 * opening question so the bot can answer immediately and, if the borrower still
 * needs a human, the topic is already in the thread for the agent to see.
 */
export function openSupportChat(topic?: string): void {
   loadSupportChat();
   whenReady(() => window.MoodengSupport?.open(topic?.trim() || undefined));
}

export function closeSupportChat(): void {
   whenReady(() => window.MoodengSupport?.close());
}

/** Show the floating launcher bubble. */
export function showSupportLauncher(): void {
   whenReady(() => window.MoodengSupport?.show());
}

/** Hide the floating launcher without ending the conversation. */
export function hideSupportLauncher(): void {
   whenReady(() => window.MoodengSupport?.hide());
}

/**
 * Something just went wrong for this user (an error toast fired). Pull the
 * widget load forward instead of waiting on the idle callback, and make sure the
 * launcher is on screen — so "message a human" is one tap away at the moment
 * they need it. Deliberately does *not* open the chat: an unasked-for panel over
 * a failed action is the behaviour that made the old Mecha bubble annoying.
 */
export function signalSupportProblem(): void {
   loadSupportChat();
   whenReady(() => window.MoodengSupport?.signalProblem());
}

/**
 * Fire `handler` when an agent sends the visitor a message. This is what turns
 * "someone replied to you" into an in-app notification rather than a badge the
 * borrower has to notice on their own.
 */
export function onSupportMessageReceived(handler: () => void): void {
   whenReady(() => window.MoodengSupport?.onMessage(() => handler()));
}
