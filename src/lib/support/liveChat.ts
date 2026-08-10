// Live chat — the human support channel behind every "I have a problem" path in
// the app, and the replacement for the Mecha AI assistant on those paths.
//
// Why: Mecha answered from the help docs, but the borrowers who actually needed
// us were the ones it could not help — stuck payouts, blocked verification,
// wrong wallet. They weren't finding the Facebook/Telegram links either (those
// live in the quick-start guide, not next to the Help button). This module puts
// a real inbox behind Help: the borrower types, it lands in the support inbox,
// the team is notified, and a reply comes back into the same thread with a badge
// in the widget plus an email to the borrower.
//
// The vendor is tawk.to, and it is deliberately sealed inside this one file.
// Everything else in the app talks to openSupportChat() / identifySupport() /
// onSupportMessageReceived(), so replacing the vendor is a rewrite of this
// module and nothing else — which is exactly how we got here from Crisp, whose
// free tier caps at 100 unique contacts (we passed that months ago).
//
// Loaded lazily: the script is injected on first need (a Help tap, or an idle
// callback once the app has painted), so it never sits on the critical path of a
// first paint on the mid-range Android handsets most of our borrowers use.

interface TawkVisitor {
   name?: string;
   email?: string;
   hash?: string;
}

interface TawkApi {
   visitor?: TawkVisitor;
   onLoad?: () => void;
   onChatMessageAgent?: (message: unknown) => void;
   maximize?: () => void;
   minimize?: () => void;
   showWidget?: () => void;
   hideWidget?: () => void;
   endChat?: () => void;
   setAttributes?: (attributes: Record<string, string>, callback?: (error?: unknown) => void) => void;
   addEvent?: (event: string, metadata?: Record<string, string>, callback?: (error?: unknown) => void) => void;
   addTags?: (tags: string[], callback?: (error?: unknown) => void) => void;
}

declare global {
   interface Window {
      Tawk_API?: TawkApi;
      Tawk_LoadStart?: Date;
   }
}

// The tawk.to property and widget ids are public by design — the embed script
// ships them to every visitor's browser on every page load — so hard-coding the
// defaults keeps the widget working without adding a secret to the dotenvx
// bundle. The env vars stay supported so a staging workspace can point at a
// separate property and avoid polluting the live support inbox with test chats.
const DEFAULT_PROPERTY_ID = '6a78cc4ed436a81d47b3b0f0';
const DEFAULT_WIDGET_ID = '1jvjts5rt';

const envPropertyId = import.meta.env.VITE_TAWK_PROPERTY_ID as string | undefined;
const envWidgetId = import.meta.env.VITE_TAWK_WIDGET_ID as string | undefined;

// Guard against the raw dotenvx `encrypted:…` ciphertext leaking through as a
// truthy-but-invalid id (the same failure mode clarity.ts guards against). A
// tawk.to property id is a 24-character hex string; the widget id is a short
// alphanumeric slug.
const resolveId = (value: string | undefined, fallback: string): string =>
   value && !value.startsWith('encrypted:') ? value.trim() : fallback;

const propertyId = resolveId(envPropertyId, DEFAULT_PROPERTY_ID);
const widgetId = resolveId(envWidgetId, DEFAULT_WIDGET_ID);

const hasValidIds = /^[0-9a-f]{20,32}$/i.test(propertyId) && /^[0-9a-z]{1,20}$/i.test(widgetId);

/**
 * Whether live chat is configured. Every entry point checks this and falls back
 * to Telegram/Facebook/email when it is false, so the branch is safe to ship
 * before the tawk.to property exists — the app simply has no chat widget rather
 * than a dead button.
 */
export const isSupportChatEnabled = hasValidIds;

let injected = false;
/** Actions registered before the API was ready, replayed once it is. */
const pending: Array<() => void> = [];
let pollTimer: number | undefined;

// Readiness is decided by the API surface actually existing, not by the
// Tawk_API.onLoad callback. onLoad is a single assignable property — anything
// else on the page can clobber it, and in practice it did not fire for us at
// all, which silently swallowed every queued open/identify call. Checking for a
// real method is true whenever the API is genuinely usable.
const isApiReady = (): boolean => typeof window !== 'undefined' && typeof window.Tawk_API?.maximize === 'function';

// Give up after ~20s. A widget that has not booted by then is blocked (ad
// blocker, offline, corporate proxy) and will not boot later; dropping the queue
// keeps a stuck poll from running for the life of the session.
const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 20000;

function drainPending(): void {
   while (pending.length > 0) pending.shift()!();
}

function whenReady(action: () => void): void {
   if (!isSupportChatEnabled) return;
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
 * Inject the tawk.to client exactly once. Safe to call unconditionally and from
 * anywhere — repeat calls are no-ops.
 */
export function loadSupportChat(): void {
   if (!isSupportChatEnabled || injected || typeof window === 'undefined') return;
   injected = true;

   const api: TawkApi = window.Tawk_API || {};
   window.Tawk_API = api;
   window.Tawk_LoadStart = new Date();

   // Fast path only. When tawk.to does fire onLoad we drain the queue on the spot
   // instead of waiting up to one poll interval; whenReady() does not rely on it.
   api.onLoad = () => drainPending();

   const script = document.createElement('script');
   script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
   script.async = true;
   script.charset = 'UTF-8';
   script.setAttribute('crossorigin', '*');
   document.head.appendChild(script);
}

export interface SupportIdentity {
   email?: string | null;
   nickname?: string | null;
   /**
    * Free-form context shown beside the conversation in the support inbox. This
    * is the difference between "my payout failed" and an answerable ticket — put
    * anything an agent would otherwise have to ask for here.
    */
   data?: Record<string, string | number | boolean | null | undefined>;
   /** Coarse tags for inbox filtering, e.g. ['borrower', 'wallet-connected']. */
   segments?: string[];
}

/**
 * Attach who the visitor is to the current chat session. Called on login and
 * whenever the profile changes; unknown fields are skipped rather than cleared,
 * so a partial profile never wipes what the inbox already knows.
 */
export function identifySupport({ email, nickname, data, segments }: SupportIdentity): void {
   if (!isSupportChatEnabled || typeof window === 'undefined') return;

   // Seed the pre-load visitor object so the very first conversation already
   // carries a name and email even if the script has not finished loading.
   const api: TawkApi = window.Tawk_API || {};
   window.Tawk_API = api;
   if (email || nickname) {
      api.visitor = { ...api.visitor, ...(nickname ? { name: nickname } : {}), ...(email ? { email } : {}) };
   }

   whenReady(() => {
      const attributes: Record<string, string> = {};
      if (nickname) attributes.name = nickname;
      if (email) attributes.email = email;
      // tawk.to attribute values must be strings, and it rejects empty ones —
      // drop the blanks rather than send them.
      for (const [key, value] of Object.entries(data ?? {})) {
         if (value !== null && value !== undefined && value !== '') attributes[key] = String(value);
      }
      if (Object.keys(attributes).length > 0) window.Tawk_API?.setAttributes?.(attributes, () => undefined);
      if (segments && segments.length > 0) window.Tawk_API?.addTags?.(segments, () => undefined);
   });
}

/**
 * Drop the chat session on logout so the next person to use this browser — a
 * shared phone or a cafe machine, both normal for our borrowers — does not
 * inherit the previous user's support thread.
 */
export function resetSupportSession(): void {
   if (!isSupportChatEnabled || typeof window === 'undefined') return;
   whenReady(() => window.Tawk_API?.endChat?.());
}

/**
 * Open the chat.
 *
 * `topic` is the help subject the borrower tapped. tawk.to has no API to post a
 * message *as* the visitor (unlike Crisp's message:send), so instead of faking
 * an opening message we hand the topic to the agent as an event and a tag: they
 * see "verify-id" in the visitor panel the moment the chat opens and can lead
 * with the answer. Entry-point copy must not promise that tapping sends a
 * message on the borrower's behalf, because it does not.
 */
export function openSupportChat(topic?: string): void {
   if (!isSupportChatEnabled) return;
   loadSupportChat();
   whenReady(() => {
      const trimmed = topic?.trim();
      if (trimmed) {
         window.Tawk_API?.addEvent?.('help-topic', { topic: trimmed }, () => undefined);
         window.Tawk_API?.addTags?.([topicTag(trimmed)], () => undefined);
      }
      window.Tawk_API?.showWidget?.();
      window.Tawk_API?.maximize?.();
   });
}

/** A short, inbox-filterable tag from a free-text help topic. */
function topicTag(topic: string): string {
   return topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
}

export function closeSupportChat(): void {
   whenReady(() => window.Tawk_API?.minimize?.());
}

/** Show the floating launcher bubble. */
export function showSupportLauncher(): void {
   whenReady(() => window.Tawk_API?.showWidget?.());
}

/** Hide the floating launcher without ending the conversation. */
export function hideSupportLauncher(): void {
   whenReady(() => window.Tawk_API?.hideWidget?.());
}

/**
 * Something just went wrong for this user (an error toast fired). Pull the
 * widget load forward instead of waiting on the idle callback, and make sure the
 * launcher is on screen — so "message a human" is one tap away at the moment
 * they need it. Deliberately does *not* open the chat: an unasked-for panel over
 * a failed action is the behaviour that made the old Mecha bubble annoying.
 */
export function signalSupportProblem(): void {
   if (!isSupportChatEnabled) return;
   loadSupportChat();
   whenReady(() => window.Tawk_API?.showWidget?.());
}

/**
 * Fire `handler` when an agent sends the visitor a message. This is what turns
 * "someone replied to you" into an in-app notification rather than a badge the
 * borrower has to notice on their own.
 */
export function onSupportMessageReceived(handler: () => void): void {
   whenReady(() => {
      const api = window.Tawk_API;
      if (api) api.onChatMessageAgent = () => handler();
   });
}
