'use client';

import { useCallback, useEffect, useState } from 'react';

import { type AdminCallBrief, getAdminCallBrief } from '@/app/admin/adminSupabase';

// The call brief: what we already know about the borrower, as lines the host can say back to confirm
// ("So you're an admin assistant, paid end of month — right?"), plus what to ask and what to watch.
// Written by AI from their profile, pre-screening, bot chat and proof of income; saved per person.

interface CallBriefCardProps {
   userId: string;
   // true: write one if there isn't one yet. false: show a saved one, else a button to write it.
   auto?: boolean;
   // White call-sheet look instead of the dark admin look.
   light?: boolean;
}

export default function CallBriefCard({ userId, auto = true, light = false }: CallBriefCardProps) {
   const [brief, setBrief] = useState<AdminCallBrief | null>(null);
   const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
   const [error, setError] = useState('');

   const run = useCallback(
      async (mode: 'make' | 'peek' | 'refresh') => {
         setState('loading');
         try {
            const result = await getAdminCallBrief(userId, mode);
            setBrief(result?.brief ?? null);
            setState(result ? 'ready' : 'none');
         } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not write the brief.');
            setState('error');
         }
      },
      [userId]
   );

   useEffect(() => {
      setBrief(null);
      void run(auto ? 'make' : 'peek');
   }, [run, auto]);

   const tone = light
      ? { box: 'border-[#e3e3e3] bg-[#faf9ff]', title: 'text-[#6b55f7]', text: 'text-[#1f1f1f]', dim: 'text-[#7a7a7a]', button: 'border-[#6b55f7] text-[#6b55f7]' }
      : { box: 'border-[color:var(--ct-line2,#3d1f6e)] bg-[var(--ct-deep,#160830)]', title: 'text-[color:var(--ct-gold-text,#ffd166)]', text: 'text-[color:var(--ct-ink,#fff)]', dim: 'text-[color:var(--ct-dim,#a89bb8)]', button: 'border-[color:var(--ct-pill,#8336f0)] text-[color:var(--ct-soft-ink,#c9a7ff)]' };
   const button = `rounded-lg border px-2.5 py-1 text-xs font-black ${tone.button}`;

   const list = (title: string, icon: string, items: string[]) =>
      items.length ? (
         <div>
            <p className={`text-[11px] font-black uppercase tracking-wide ${tone.dim}`}>{title}</p>
            <ul className="mt-1 space-y-1">
               {items.map((item) => (
                  <li key={item} className={`flex gap-2 text-[15px] leading-snug ${tone.text}`}>
                     <span aria-hidden="true">{icon}</span>
                     <span>{item}</span>
                  </li>
               ))}
            </ul>
         </div>
      ) : null;

   return (
      <div className={`rounded-2xl border p-4 ${tone.box}`}>
         <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-black ${tone.title}`}>✨ Call brief{brief?.headline ? ` · ${brief.headline}` : ''}</p>
            {state === 'ready' ? (
               <button type="button" onClick={() => void run('refresh')} className={button} title="Write it again from the latest info">
                  ↻ New brief
               </button>
            ) : null}
         </div>
         {state === 'loading' ? <p className={`mt-2 text-sm ${tone.dim}`}>Reading what they told us…</p> : null}
         {state === 'none' ? (
            <button type="button" onClick={() => void run('make')} className={`mt-2 ${button}`}>
               Write a call brief
            </button>
         ) : null}
         {state === 'error' ? (
            <p className={`mt-2 text-sm ${tone.dim}`}>
               Couldn’t write the brief ({error}).{' '}
               <button type="button" onClick={() => void run('make')} className="font-black underline">
                  Try again
               </button>
            </p>
         ) : null}
         {state === 'ready' && brief ? (
            <div className="mt-3 space-y-3">
               {list('Say this back to them', '🗣', brief.say_back)}
               {list('Then ask', '❓', brief.ask)}
               {list('Keep in mind (don’t say)', '👀', brief.watch)}
            </div>
         ) : null}
      </div>
   );
}
