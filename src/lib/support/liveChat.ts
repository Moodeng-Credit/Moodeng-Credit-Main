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

const propertyId = import.meta.env.VITE_TAWK_PROPERTY_ID as string | undefined;
const widgetId = import.meta.env.VITE_TAWK_WIDGET_ID as string | undefined;

// Guard against the raw dotenvx `encrypted:…` ciphertext leaking through as a
// truthy-but-invalid id (the same failure mode clarity.ts guards against), and
// against the placeholder values in env.example. A tawk.to property id is a
// 24-character hex string; the widget id is a short alphanumeric slug that is
// literally "default" on a brand-new property.
const isUsableId = (value: string | undefined, pattern: RegExp): boolean =>
   Boolean(value) && !value!.startsWith('encrypted:') && pattern.test(value!.trim());

const hasValidIds = isUsableId(propertyId, /^[0-9a-f]{20,32}$/i) && isUsableId(widgetId, /^[0-9a-z]{1,20}$/i);

/**
 * Whether live chat is configured. Every entry point checks this and falls back
 * to Telegram/Facebook/email when it is false, so the branch is safe to ship
 * before the tawk.to property exists — the app simply has no chat widget rather
 * than a dead button.
 */
export const isSupportChatEnabled = hasValidIds;

let injected = false;
let loaded = false;
/** Handlers registered before the script finished loading, replayed on load. */
const pendingOnLoad: Array<() => void> = [];

function whenLoaded(action: () => void): void {
   if (!isSupportChatEnabled) return;
   if (loaded) {
      action();
      return;
   }
   pendingOnLoad.push(action);
   loadSupportChat();
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

   // tawk.to reads Tawk_API.visitor at load time only, so anything identifySupport()
   // recorded before the script landed is applied here; later updates go through
   // setAttributes instead.
   api.onLoad = () => {
      loaded = true;
      while (pendingOnLoad.length > 0) pendingOnLoad.shift()!();
   };

   const script = document.createElement('script');
   script.src = `https://embed.tawk.to/${propertyId!.trim()}/${widgetId!.trim()}`;
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

   whenLoaded(() => {
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
   whenLoaded(() => window.Tawk_API?.endChat?.());
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
   whenLoaded(() => {
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
   whenLoaded(() => window.Tawk_API?.minimize?.());
}

/** Show the floating launcher bubble. */
export function showSupportLauncher(): void {
   whenLoaded(() => window.Tawk_API?.showWidget?.());
}

/** Hide the floating launcher without ending the conversation. */
export function hideSupportLauncher(): void {
   whenLoaded(() => window.Tawk_API?.hideWidget?.());
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
   whenLoaded(() => window.Tawk_API?.showWidget?.());
}

/**
 * Fire `handler` when an agent sends the visitor a message. This is what turns
 * "someone replied to you" into an in-app notification rather than a badge the
 * borrower has to notice on their own.
 */
export function onSupportMessageReceived(handler: () => void): void {
   whenLoaded(() => {
      const api = window.Tawk_API;
      if (api) api.onChatMessageAgent = () => handler();
   });
}
