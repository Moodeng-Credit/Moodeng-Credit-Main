import { useEffect, useRef, useState } from 'react';

// Live-chat agent console, embedded inside the admin panel.
//
// Two things share the name "tawk" and only one belongs here:
//   • the VISITOR widget (the borrower-facing bubble) lives in src/lib/support/
//     liveChat.ts and must NEVER be mounted here — it would make an admin look
//     like a customer.
//   • the AGENT dashboard (where the team reads and replies) lives at
//     dashboard.tawk.to. That is what this section surfaces.
//
// We try to embed the agent dashboard in an iframe, but a cross-site embedded
// login is fragile by design: third-party-cookie blocking (Safari ITP, Firefox
// ETP, Chrome partitioning), SameSite=Lax/Strict session cookies that are not
// sent into a cross-site frame, storage partitioning, and SSO redirects that
// refuse to render framed. So the iframe is BEST-EFFORT and the always-present
// "Open in a new tab" button is the reliable path. On a phone, the tawk.to app
// (with push) is how the team actually gets pinged — the embed is a desktop
// convenience, not the primary channel.

// The tawk.to agent inbox. The dashboard resolves the logged-in agent's
// properties itself, so no property id is needed in the URL.
const TAWK_DASHBOARD_URL = 'https://dashboard.tawk.to/';
// Official download hub for the iOS / Android / desktop apps. Linking the hub
// (rather than a hard-coded App Store numeric id) keeps this correct if tawk
// re-publishes an app.
const TAWK_DOWNLOADS_URL = 'https://www.tawk.to/downloads/';

// For reference only — the live property the borrower widget points at, mirrored
// from src/lib/support/liveChat.ts. Shown so an admin can confirm they are
// logged into the right workspace.
const LIVE_PROPERTY_ID = (import.meta.env.VITE_TAWK_PROPERTY_ID as string | undefined) ?? '6a78cc4ed436a81d47b3b0f0';

// How long we wait for the embedded dashboard to signal a load before we assume
// the browser blocked it and lean harder on the new-tab launcher.
const EMBED_PROBE_MS = 8000;

const cardClass = 'rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6';

function openInboxTab() {
   if (typeof window !== 'undefined') {
      window.open(TAWK_DASHBOARD_URL, '_blank', 'noopener,noreferrer');
   }
}

export default function SupportChatSection() {
   const iframeRef = useRef<HTMLIFrameElement | null>(null);
   // 'probing' until the iframe fires onLoad or we time out. A cross-origin
   // frame that is blocked never fires a reliable onLoad, so the timeout is what
   // actually flips us to the "use the new tab" hint.
   const [embedState, setEmbedState] = useState<'probing' | 'loaded' | 'blocked'>('probing');
   const [showEmbed, setShowEmbed] = useState(true);

   useEffect(() => {
      if (!showEmbed) return;
      setEmbedState('probing');
      const timer = window.setTimeout(() => {
         setEmbedState((prev) => (prev === 'loaded' ? prev : 'blocked'));
      }, EMBED_PROBE_MS);
      return () => window.clearTimeout(timer);
   }, [showEmbed]);

   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-4xl font-black sm:text-5xl">Live chat</h2>
            <p className="mt-3 text-2xl text-[#a89bb8]">
               Read and reply to borrowers who open the in-app chat. This is the tawk.to team inbox — the same conversations
               show up here, in the tawk.to mobile app, and get a heads-up in the Telegram alerts group.
            </p>
         </div>

         {/* Primary, always-reliable action row. */}
         <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className={cardClass}>
               <h3 className="text-3xl font-black">Open the team inbox</h3>
               <p className="mt-3 text-xl text-[#a89bb8]">
                  Opens the tawk.to dashboard in a new tab, where you can reply live. Log in with the account that owns the
                  Moodeng property.
               </p>
               <div className="mt-5 flex flex-wrap gap-3">
                  <button
                     type="button"
                     onClick={openInboxTab}
                     className="rounded-xl border border-[#8336f0] bg-[#2a1453] px-6 py-4 text-lg font-black text-white hover:bg-[#341a63]"
                  >
                     Open tawk.to inbox ↗
                  </button>
                  <a
                     href={TAWK_DOWNLOADS_URL}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="rounded-xl border border-[#2a1453] bg-[#1c0a3a] px-6 py-4 text-lg font-black text-purple-200 hover:border-[#8336f0] hover:bg-[#20103e]"
                  >
                     Get the mobile app ↗
                  </a>
               </div>
            </div>

            <div className={cardClass}>
               <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">Workspace</p>
               <p className="mt-2 break-all font-mono text-sm text-white">{LIVE_PROPERTY_ID}</p>
               <p className="mt-4 text-sm font-bold text-[#a89bb8]">
                  Install the mobile app and turn on push so a new chat pings your phone instantly — the embed below is a
                  desktop convenience, not the alert.
               </p>
            </div>
         </div>

         {/* Best-effort embedded console. */}
         <div className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
               <h3 className="text-2xl font-black">Inbox (embedded)</h3>
               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => setShowEmbed((v) => !v)}
                     className="rounded-lg border border-[#2a1453] px-4 py-2 text-sm font-black text-purple-200 hover:border-[#8336f0] hover:bg-[#20103e]"
                  >
                     {showEmbed ? 'Hide' : 'Show'}
                  </button>
                  <button
                     type="button"
                     onClick={openInboxTab}
                     className="rounded-lg border border-[#8336f0] px-4 py-2 text-sm font-black text-white hover:bg-[#2a1453]"
                  >
                     Open in new tab ↗
                  </button>
               </div>
            </div>

            {embedState === 'blocked' && showEmbed ? (
               <p className="mt-4 rounded-2xl border border-amber-900 bg-amber-950/60 p-4 text-base font-bold text-amber-200">
                  If the inbox below is blank or keeps asking you to log in, your browser is blocking the embedded session
                  (third-party cookies). That is expected — use <span className="underline">Open in new tab</span> above, or the
                  mobile app. Nothing is broken.
               </p>
            ) : null}

            {showEmbed ? (
               <div className="mt-4 overflow-hidden rounded-2xl border border-[#2a1453] bg-[#120726]">
                  <iframe
                     ref={iframeRef}
                     title="tawk.to team inbox"
                     src={TAWK_DASHBOARD_URL}
                     onLoad={() => setEmbedState('loaded')}
                     className="h-[70vh] min-h-[520px] w-full"
                     // The dashboard needs these to run its own login + storage.
                     sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                     referrerPolicy="no-referrer-when-downgrade"
                  />
               </div>
            ) : (
               <p className="mt-4 text-lg font-bold text-[#a89bb8]">Embed hidden. Use the tawk.to inbox in a new tab or the mobile app.</p>
            )}
         </div>
      </section>
   );
}
