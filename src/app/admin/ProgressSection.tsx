// Admin → More → Progress (/admin/progress): a plain-English list for Emma of what is built and what
// is left on the Indonesia track and the Philippines cash-in / cash-out work. To update it, edit the
// lists below and change UPDATED; the progress bars are counted from them.

const UPDATED = '8 Nov 2026, Bangkok time';

type Status = 'live' | 'test' | 'paused' | 'todo';

type Item = { title: string; detail: string; status: Status; date?: string };
type Group = { title: string; items: Item[] };
type Track = { id: string; flag: string; title: string; summary: string; groups: Group[] };

const STATUS: Record<Status, { label: string; className: string }> = {
   live: { label: 'Live', className: 'border-emerald-800 bg-emerald-950 text-emerald-300' },
   test: { label: 'Needs a real test', className: 'border-amber-800 bg-amber-950 text-amber-300' },
   paused: { label: 'Paused', className: 'border-zinc-700 bg-zinc-800 text-zinc-300' },
   todo: { label: 'To do', className: 'border-purple-800 bg-purple-950 text-purple-300' }
};

const TRACKS: Track[] = [
   {
      id: 'indonesia',
      flag: '🇮🇩',
      title: 'Indonesia: onboarding and Telegram',
      summary:
         'Built and switched on 8 Nov, open to everyone at moodeng.app/id. No Indonesian borrower has joined yet, so none of it has been through a real loan.',
      groups: [
         {
            title: 'Onboarding, in order',
            items: [
               {
                  title: '1. Telegram sign-in',
                  detail: 'Telegram only. Works from inside the Facebook and TikTok browsers by opening the Telegram app.',
                  status: 'live',
                  date: '8 Nov'
               },
               { title: '2. WhatsApp', detail: 'Verified +62 number. Used for notifications and for the team to message them.', status: 'live', date: '8 Nov' },
               { title: '3. Facebook', detail: 'Messenger code, Facebook profile link and following the Page.', status: 'live', date: '8 Nov' },
               { title: '4. About you', detail: 'Income type, payday, income and expenses.', status: 'live', date: '8 Nov' },
               { title: '5. Proof of income', detail: 'Upload, and it must not be declined.', status: 'live', date: '8 Nov' },
               { title: '6. ID and face check', detail: 'Didit. Must be approved before the team can approve them.', status: 'live', date: '8 Nov' },
               { title: '7. Walt and Telegram username', detail: 'Open Walt once and have a @username. Nothing to paste.', status: 'live', date: '8 Nov' },
               { title: '8. 15-minute call', detail: 'The team approves after the call.', status: 'live', date: '8 Nov' }
            ]
         },
         {
            title: 'Telegram bot for borrowers',
            items: [
               { title: 'Bot menu', detail: 'My loans, Request a loan, Pay and Help, all in Bahasa. No need to return to the website after onboarding.', status: 'live', date: '8 Nov' },
               { title: 'Request a loan in chat', detail: 'Amount, 7 or 14 days, rupiah total, purpose, confirm.', status: 'live', date: '8 Nov' },
               { title: 'Repay in chat', detail: 'Shows the exact amount and our Walt username with copy buttons, then "Sudah kirim". The team confirms it arrived.', status: 'live', date: '8 Nov' },
               { title: 'Step-by-step guides', detail: 'How a loan works, make a username, open Walt, cash out to rupiah, buy USDT, pay the loan.', status: 'live', date: '8 Nov' },
               { title: 'AI helper', detail: 'Answers typed questions in Bahasa and hands over to a person when unsure, for missing money or complaints.', status: 'live', date: '8 Nov' },
               { title: 'Chat with the team', detail: 'A button on every guide. Support chat talks Bahasa to these borrowers.', status: 'live', date: '8 Nov' },
               { title: 'Repay nudge', detail: 'One "need help?" message 6 hours after opening Pay without sending.', status: 'live', date: '8 Nov' }
            ]
         },
         {
            title: 'Loans and team cards',
            items: [
               { title: 'Small loans first', detail: 'First loan $5. $10 only after one is repaid on time. Due within 14 days.', status: 'live', date: '8 Nov' },
               { title: 'Fixed in rupiah', detail: 'The borrower picks a rupiah total and it never changes.', status: 'live', date: '8 Nov' },
               { title: 'Sending loans', detail: 'A team card in Telegram says who to pay by Walt Transfer. Tap Sent after paying. Unpaid after 2 hours gets a reminder.', status: 'live', date: '8 Nov' },
               { title: 'No Moodeng or Walt Transfer fees', detail: 'The borrower only pays the Walt P2P spread and any bank fee to the P2P seller.', status: 'live', date: '8 Nov' },
               { title: '🇮🇩 mark', detail: 'Indonesian requests are marked on the request board, admin pages and team Telegram posts.', status: 'live', date: '8 Nov' }
            ]
         },
         {
            title: 'Still to do',
            items: [
               { title: 'First real $5 loan', detail: 'Full run: onboarding, Walt Transfer out, repayment back. Includes sending to someone who is not a Walt contact.', status: 'todo' },
               { title: 'Check Walt button names', detail: 'The guide wording needs checking against Walt on a real phone.', status: 'todo' },
               { title: 'Add screenshots to the guides', detail: 'No guide has a picture yet. They can be added from the admin Telegram chat.', status: 'todo' }
            ]
         }
      ]
   },
   {
      id: 'philippines',
      flag: '🇵🇭',
      title: 'Philippines: cash-in and cash-out screens',
      summary:
         'One small card at a time, pictures, pesos first, a gold main button and a green "done" after each step. Live for borrowers now.',
      groups: [
         {
            title: 'Cash-in and repay',
            items: [
               { title: 'Step-by-step Repay', detail: 'How much, pick an app, follow its cards, pay. Replaces one long page.', status: 'live', date: '8 Nov' },
               { title: 'One-tap pay', detail: 'If the wallet already has enough USDC, one screen and one Pay button.', status: 'live', date: '8 Nov' },
               { title: 'GCash (GCrypto) picture guide', detail: 'Top up, buy USDC (Base), send, and what the "processing" screen looks like.', status: 'live', date: '8 Nov' },
               { title: 'PDAX picture guide', detail: 'Cash in pesos by InstaPay, then pick USDCBASE, paste the address, Max and Send.', status: 'live', date: '8 Nov' },
               { title: 'Moneybees removed', detail: 'Hardly used. Repay now shows GCash and PDAX.', status: 'live', date: '8 Nov' },
               { title: '"Your wallet is empty"', detail: 'Says it plainly, with how much to add, before the wallet popup can fail.', status: 'live', date: '8 Nov' },
               { title: '"You\'re paid!" screen', detail: 'Borrow again or pay the next loan, plus a "Next loan: up to $X" chip.', status: 'live', date: '8 Nov' }
            ]
         },
         {
            title: 'Cash-out',
            items: [
               { title: 'Cash out to any PH bank', detail: 'Open to every borrower. Gold "Tap to cash out" button and bank logos.', status: 'live', date: '7 Nov' },
               { title: 'Simpler setup', detail: 'Email, ID, form, with Moodeng\'s pandesal growing at each step.', status: 'live', date: '7 Nov' },
               { title: 'Clear fees before confirming', detail: 'You send, Stableyard fee, Moodeng fee ₱0, you get, in pesos.', status: 'live', date: '7 Nov' },
               { title: 'Hides itself in an outage', detail: 'Bank cash-out disappears if Stableyard is down and returns on its own.', status: 'live', date: '7 Nov' },
               { title: 'Exchange cash-out in 3 steps', detail: 'Get the app\'s address, how much, then cash out inside the app. GCrypto, PDAX, Coins.ph, Kraken, Coinbase.', status: 'live', date: '8 Nov' },
               { title: 'GCrypto and PDAX pictures', detail: 'Picture cards for the last step inside the app.', status: 'live', date: '8 Nov' },
               { title: '"Not showing up after 10 minutes?"', detail: 'Help steps on the Sent screen and in the email, including the PDAX pesos case.', status: 'live', date: '5 Nov' },
               { title: 'GCash and Maya cash-out', detail: 'Stableyard paused e-wallets on 7 Nov. Banks only until that changes.', status: 'paused', date: '7 Nov' }
            ]
         },
         {
            title: 'Across both',
            items: [
               { title: 'Picks up where they left off', detail: 'After leaving for GCash or PDAX, a reload returns to the same step for a day.', status: 'live', date: '8 Nov' },
               { title: 'Filipino text', detail: 'Taglish on the new cards.', status: 'live', date: '8 Nov' },
               { title: '"Stuck? Chat with us"', detail: 'Opens live chat from Repay.', status: 'live', date: '8 Nov' },
               { title: 'Where people stop', detail: 'Each step is now tracked, so we can see which card loses people.', status: 'live', date: '8 Nov' }
            ]
         },
         {
            title: 'Still to do',
            items: [
               { title: 'Real repayment on the new cards', detail: 'Tested in preview only when built.', status: 'test' },
               { title: 'Real exchange cash-out on the new cards', detail: 'Tested in preview only when built.', status: 'test' },
               { title: 'Reuse the Moodeng ID check for bank cash-out', detail: 'Built so borrowers skip a second ID check. Not tried with a real borrower when it launched.', status: 'test', date: '7 Nov' }
            ]
         }
      ]
   }
];

function StatusPill({ status }: { status: Status }) {
   const { label, className } = STATUS[status];
   return <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${className}`}>{label}</span>;
}

function TrackCard({ track }: { track: Track }) {
   const items = track.groups.flatMap((group) => group.items);
   const live = items.filter((item) => item.status === 'live').length;
   const percent = Math.round((live / items.length) * 100);

   return (
      <section className="rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-4 sm:p-6">
         <h3 className="text-xl font-black text-white">
            <span aria-hidden="true">{track.flag}</span> {track.title}
         </h3>
         <p className="mt-2 text-sm leading-6 text-[#a89bb8]">{track.summary}</p>

         <div className="mt-4">
            <p className="text-sm font-bold text-zinc-200">
               {live} of {items.length} live
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#2a1453]">
               <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
            </div>
         </div>

         {track.groups.map((group) => (
            <div key={group.title} className="mt-6">
               <h4 className="text-xs font-bold uppercase tracking-wide text-[#a89bb8]">{group.title}</h4>
               <ul className="mt-1 divide-y divide-[#2a1453]">
                  {group.items.map((item) => (
                     <li key={item.title} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                           <p className="text-sm font-bold text-zinc-100">{item.title}</p>
                           <p className="mt-0.5 text-sm leading-5 text-[#a89bb8]">
                              {item.detail}
                              {item.date ? <span className="text-[#7d6f90]"> · {item.date}</span> : null}
                           </p>
                        </div>
                        <StatusPill status={item.status} />
                     </li>
                  ))}
               </ul>
            </div>
         ))}
      </section>
   );
}

export default function ProgressSection() {
   return (
      <div className="mx-auto max-w-3xl space-y-5">
         <header>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Progress</h2>
            <p className="mt-1 text-sm text-[#a89bb8]">Updated {UPDATED}</p>
         </header>
         {TRACKS.map((track) => (
            <TrackCard key={track.id} track={track} />
         ))}
      </div>
   );
}
