'use client';

export type DemoKey = 'platform' | 'monday' | 'map' | 'console' | 'spec';

type DemoPage = {
   key: DemoKey;
   file: string;
   title: string;
   blurb: string;
   tip: string;
   internal?: boolean;
};

const demoPages: Record<DemoKey, DemoPage> = {
   platform: {
      key: 'platform',
      file: '/demo-b2b/platform.html',
      title: 'Moodeng Credit Platform',
      blurb:
         'The full B2B product, both sides of the vault. A Moodeng view (Overview, Integration, Underwriting, Marketplace, Vault, Traction) and a Partner Lender portal (Dashboard, Draw Funds, Loan Book) — switch with the toggle top-right. On brand, gamified lender milestones, no live data.',
      tip: 'Toggle Moodeng / Partner Lender top-right. Every tab, button, animation and the Draw flow are live in-page. Open full screen to present it as its own page.'
   },
   monday: {
      key: 'monday',
      file: '/demo-b2b/monday-problem.html',
      title: 'The Monday Problem',
      blurb:
         'The pain, almost wordless. A lender with every peso already lent, 412 approved applicants waiting, and a funding market that refuses on eligibility rather than price. Ends on the return-on-equity swing.',
      tip: 'Arrow keys move between the three scenes. The Kasama / Bahay toggle switches lender — Bahay is the one nobody will quote.'
   },
   map: {
      key: 'map',
      file: '/demo-b2b/facility-console.html?view=map',
      title: 'Pool map',
      blurb:
         'Every loan in the facility drawn as one cell, grouped by the week it was originated. Colour is state, a dashed border means it is excluded from the borrowing base, and old vintages carry a watch flag.',
      tip: 'The most visual screen. Hover any cell to inspect the loan, click to pin it. Scroll down to watch the vintages age from green to red.'
   },
   console: {
      key: 'console',
      file: '/demo-b2b/facility-console.html?view=overview',
      title: 'Facility console',
      blurb:
         'The product a partner lender would log into. Borrowing base waterfall, covenant tests, reporting calendar, debt service schedule and draw requests, all wired to live in-page state.',
      tip: 'Start on the suspended draw: submit the overdue certificate, then draw. Prepaying principal puts availability back up.'
   },
   spec: {
      key: 'spec',
      file: '/demo-b2b/facility-spec.html',
      title: 'Facility build spec',
      blurb:
         'What has to exist before the demo stops being a mock: two tables, three edge functions, and the commercial decisions still open.',
      tip: 'Internal. Not for the video — this is the engineering follow-up.',
      internal: true
   }
};

export default function DemoB2BSection({ page }: { page: DemoKey }) {
   const demo = demoPages[page];

   return (
      <section className="space-y-6">
         <div className="flex flex-wrap items-start gap-4">
            <div>
               <h2 className="break-words text-4xl font-black sm:text-5xl">{demo.title}</h2>
               <p className="mt-3 max-w-3xl text-2xl text-[#a89bb8]">{demo.blurb}</p>
            </div>
            <a
               href={demo.file}
               target="_blank"
               rel="noreferrer"
               className="ml-auto shrink-0 rounded-xl bg-white px-6 py-3 text-lg font-black text-black transition hover:bg-white/90"
            >
               Open full screen
            </a>
         </div>

         <p className="text-lg text-[#c9bfd6]">{demo.tip}</p>

         <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-lg text-amber-200">
            <span className="font-black">Mock page.</span> Hand-built static HTML, no Supabase data, every figure invented.
            {demo.internal ? ' Internal reference only.' : ' Safe to show on camera; do not present it as live reporting.'}
         </div>

         <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
            <iframe
               key={demo.file}
               src={demo.file}
               title={demo.title}
               className="h-[78vh] w-full border-0"
            />
         </div>
      </section>
   );
}
