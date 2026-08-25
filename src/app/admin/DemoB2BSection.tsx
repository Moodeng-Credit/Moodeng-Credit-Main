'use client';

type DemoPage = {
   id: string;
   file: string;
   order: string;
   title: string;
   blurb: string;
   audience: string;
   kind: 'demo' | 'spec';
};

const demoPages: DemoPage[] = [
   {
      id: 'monday-problem',
      file: '/demo-b2b/monday-problem.html',
      order: '1',
      title: 'The Monday Problem',
      blurb:
         'The pain, almost wordless. A lender with every peso already lent, 412 approved applicants waiting, and a funding market that refuses on eligibility rather than price. Ends on the return-on-equity swing.',
      audience: 'Open first. Arrow keys move between the three scenes; the Kasama / Bahay toggle switches lender.',
      kind: 'demo'
   },
   {
      id: 'facility-console',
      file: '/demo-b2b/facility-console.html',
      order: '2',
      title: 'Facility console',
      blurb:
         'The product a partner lender would log into. Pool map, borrowing base waterfall, covenant tests, reporting calendar, debt service and draw requests, all wired to live state.',
      audience: 'Open second. Start on the suspended draw, submit the certificate, then draw. The pool map is under its own tab.',
      kind: 'demo'
   },
   {
      id: 'facility-spec',
      file: '/demo-b2b/facility-spec.html',
      order: '3',
      title: 'Facility & reserve build spec',
      blurb:
         'One page on what has to exist before the demo stops being a mock: two tables, three edge functions, and the commercial decisions still open.',
      audience: 'Internal. Not for the video — this is the engineering follow-up.',
      kind: 'spec'
   }
];

export default function DemoB2BSection() {
   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-4xl font-black sm:text-5xl">B2B demo</h2>
            <p className="mt-3 text-2xl text-[#a89bb8]">
               Static mock pages for the partner-lender pitch. Nothing here touches real data, real loans, or real money —
               every figure is invented. Open them in a new tab during a recording.
            </p>
         </div>

         <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5 text-lg text-amber-200">
            <span className="font-black">These are mock pages.</span> They are hand-built HTML served from{' '}
            <code className="rounded bg-black/30 px-2 py-0.5 text-base">/demo-b2b/</code>. They do not read from Supabase and
            they are not a product surface — do not link a real partner to them without saying so.
         </div>

         <div className="grid gap-4">
            {demoPages.map((page) => (
               <div
                  key={page.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/25"
               >
                  <div className="flex flex-wrap items-center gap-3">
                     <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-black">
                        {page.order}
                     </span>
                     <h3 className="text-2xl font-black">{page.title}</h3>
                     <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${
                           page.kind === 'demo' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-sky-400/15 text-sky-300'
                        }`}
                     >
                        {page.kind === 'demo' ? 'Show on camera' : 'Internal doc'}
                     </span>
                  </div>

                  <p className="mt-4 text-xl leading-relaxed text-[#c9bfd6]">{page.blurb}</p>
                  <p className="mt-3 text-lg text-[#a89bb8]">{page.audience}</p>

                  <div className="mt-5 flex flex-wrap gap-3">
                     <a
                        href={page.file}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-white px-5 py-2.5 text-lg font-black text-black transition hover:bg-white/90"
                     >
                        Open in new tab
                     </a>
                     <a
                        href={page.file}
                        className="rounded-xl border border-white/20 px-5 py-2.5 text-lg font-black transition hover:border-white/40"
                     >
                        Open here
                     </a>
                  </div>
               </div>
            ))}
         </div>
      </section>
   );
}
