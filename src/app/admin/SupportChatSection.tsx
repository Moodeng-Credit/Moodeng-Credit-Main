// Live-chat agent console, embedded inside the admin panel.
//
// Support now runs on the self-hosted Discord-backed widget (see
// src/lib/support/liveChat.ts), which replaced tawk.to. There is no third-party
// agent dashboard to embed any more: every website/app chat becomes a ticket in
// the Discord #web-support forum, and the team reads and replies straight from
// Discord (web or mobile) with the "Reply" button under each visitor message.
//
// So this section is now a signpost, not an embed — a cross-site iframe of
// Discord is blocked by its own frame-ancestors policy, and there is nothing to
// log into here anyway. The reliable paths are the Discord app on the team's
// phones (push) and the web client in a new tab.

// The Moodeng Credit Discord server. Opens on whatever channel the agent last
// viewed; #web-support is where the visitor tickets land.
const DISCORD_SERVER_URL = 'https://discord.com/channels/1447833618771611741';
// Official Discord download hub for the iOS / Android / desktop apps.
const DISCORD_DOWNLOADS_URL = 'https://discord.com/download';

const cardClass = 'rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6';

function openDiscordTab() {
   if (typeof window !== 'undefined') {
      window.open(DISCORD_SERVER_URL, '_blank', 'noopener,noreferrer');
   }
}

export default function SupportChatSection() {
   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-4xl font-black sm:text-5xl">Live chat</h2>
            <p className="mt-3 text-2xl text-[#a89bb8]">
               Read and reply to borrowers who open the in-app chat. Support runs through Discord now: each website chat opens
               a ticket in the <span className="font-black text-white">#web-support</span> forum, and your reply streams
               straight back into the visitor&rsquo;s chat window.
            </p>
         </div>

         {/* Primary, always-reliable action row. */}
         <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className={cardClass}>
               <h3 className="text-3xl font-black">Open the ticket forum</h3>
               <p className="mt-3 text-xl text-[#a89bb8]">
                  Opens the Moodeng Credit Discord in a new tab. Go to <span className="font-black text-white">#web-support</span>,
                  pick a ticket, and tap <span className="font-black text-white">Reply</span> under the visitor&rsquo;s message —
                  it appears in their chat within about a second. Tap <span className="font-black text-white">Reply again</span> to
                  keep the conversation going.
               </p>
               <div className="mt-5 flex flex-wrap gap-3">
                  <button
                     type="button"
                     onClick={openDiscordTab}
                     className="rounded-xl border border-[#8336f0] bg-[#2a1453] px-6 py-4 text-lg font-black text-white hover:bg-[#341a63]"
                  >
                     Open #web-support ↗
                  </button>
                  <a
                     href={DISCORD_DOWNLOADS_URL}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="rounded-xl border border-[#2a1453] bg-[#1c0a3a] px-6 py-4 text-lg font-black text-purple-200 hover:border-[#8336f0] hover:bg-[#20103e]"
                  >
                     Get the mobile app ↗
                  </a>
               </div>
            </div>

            <div className={cardClass}>
               <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">How it flows</p>
               <ol className="mt-3 space-y-2 text-sm font-bold text-[#a89bb8]">
                  <li>1. Visitor opens the chat and asks for a human.</li>
                  <li>2. A ticket appears in #web-support (and #escalations pings).</li>
                  <li>3. You Reply from Discord — web or phone.</li>
                  <li>4. It lands in their chat instantly.</li>
               </ol>
               <p className="mt-4 text-sm font-bold text-[#a89bb8]">
                  Install the Discord app and turn on notifications so a new ticket pings your phone the moment it opens.
               </p>
            </div>
         </div>
      </section>
   );
}
