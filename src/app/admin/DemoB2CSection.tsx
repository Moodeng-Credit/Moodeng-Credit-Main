'use client';

export type DemoB2CKey = 'dashboard' | 'assets';

type DemoB2CPage = {
   key: DemoB2CKey;
   file: string;
   /** Clean, shareable vanity URL (makes it obvious in the link that it's a mockup). */
   share: string;
   title: string;
   blurb: string;
   tip: string;
};

const demoPages: Record<DemoB2CKey, DemoB2CPage> = {
   dashboard: {
      key: 'dashboard',
      file: '/demo-b2c/dashboard-mockup.html',
      share: '/b2c-dashboard-mockup',
      title: 'B2C Borrower Dashboard',
      blurb:
         'The redesigned borrower home, gamified Atome-style. Moodeng Town that grows with your credit level, a "Feed Moodeng" daily hook, milestones with food-voucher rewards, and refer-a-friend — all woven into the existing Trust Score, Credit Level and Dues sections. Localized for the Philippines (Taglish, ₱, GrabFood / Jollibee / GCash). No live data.',
      tip: 'Open full screen to share with a freelancer — the URL (/b2c-dashboard-mockup) says it is a mockup, and no login is needed. Gold-outlined cards are the new gamification layer built from existing assets.'
   },
   assets: {
      key: 'assets',
      file: '/demo-b2c/assets.html',
      share: '/b2c-dashboard-mockup-assets',
      title: 'B2C Mockup — Asset Pack',
      blurb:
         'Every graphic used in the borrower dashboard mockup, with one-click downloads: the town/mascot scene art plus the full 10-icon milestone set (160×160 transparent PNG). Includes palette and format notes for whoever builds it.',
      tip: 'Sharable download page for a freelancer (/b2c-dashboard-mockup-assets, no login). Only 2–3 new assets are still needed to complete the vision; the rest are final.'
   }
};

export default function DemoB2CSection({ page }: { page: DemoB2CKey }) {
   const demo = demoPages[page];

   return (
      <section className="space-y-6">
         <div className="flex flex-wrap items-start gap-4">
            <div>
               <h2 className="break-words text-4xl font-black sm:text-5xl">{demo.title}</h2>
               <p className="mt-3 max-w-3xl text-2xl text-[#a89bb8]">{demo.blurb}</p>
            </div>
            <a
               href={demo.share}
               target="_blank"
               rel="noreferrer"
               className="ml-auto shrink-0 rounded-xl bg-white px-6 py-3 text-lg font-black text-black transition hover:bg-white/90"
            >
               Open full screen
            </a>
         </div>

         <p className="text-lg text-[#c9bfd6]">{demo.tip}</p>

         <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-lg text-amber-200">
            <span className="font-black">Mock page.</span> Hand-built static HTML, no Supabase data, every figure invented. Sharable
            link for freelancers — the URL itself says <span className="font-mono">mockup</span>.
         </div>

         <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
            <iframe key={demo.file} src={demo.file} title={demo.title} className="h-[78vh] w-full border-0" />
         </div>
      </section>
   );
}
