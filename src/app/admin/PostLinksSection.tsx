'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Admin → Growth → Post links (supabase/migrations/20261016180000_post_links.sql). One tracked link
// per Facebook post, or per person we pay to post: moodeng.app/?src=fb-juan-bonds-oct16. Accounts
// made from it carry that ?src (users.signup_source); clicks are counted once per browser.

export const SITE_URL = 'https://moodeng.app';

export type PostLinkRow = {
   src: string;
   poster: string;
   place: string | null;
   note: string | null;
   created_at: string;
   clicks: number;
   signups: number;
   facebook_connected: number;
   approved: number;
   id_verified: number;
   borrowed: number;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const slug = (value: string, max: number) =>
   value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '');

/** fb-<who>-<where>-<mon><day>, e.g. "fb-juan-bonds-group-oct16". Same characters the app keeps for ?src. */
export function makePostSrc(poster: string, place: string, date: Date): string {
   const day = `${MONTHS[date.getMonth()]}${date.getDate()}`;
   const parts = ['fb', slug(poster, 24), slug(place, 30), day].filter(Boolean);
   return parts.join('-').slice(0, 80);
}

export const postLinkUrl = (src: string) => `${SITE_URL}/?src=${src}`;

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

const bangkokDate = (iso: string) =>
   new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' });

const inputClass =
   'h-12 w-full rounded-xl border border-[#2a1453] bg-[#12062a] px-3 text-base text-white outline-none placeholder:text-[#6b5a85] focus:border-[#a06bff]';

export default function PostLinksSection() {
   const [rows, setRows] = useState<PostLinkRow[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [poster, setPoster] = useState('');
   const [place, setPlace] = useState('');
   const [note, setNote] = useState('');
   const [saving, setSaving] = useState(false);
   const [copied, setCopied] = useState<string | null>(null);
   const [justMade, setJustMade] = useState<string | null>(null);

   const preview = useMemo(() => (poster.trim() ? postLinkUrl(makePostSrc(poster, place, new Date())) : null), [poster, place]);

   const load = useCallback(async () => {
      setLoading(true);
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('admin_post_links');
      if (rpcError) setError(rpcError.message);
      else setRows((data ?? []) as PostLinkRow[]);
      setLoading(false);
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const copy = async (src: string) => {
      try {
         await navigator.clipboard.writeText(postLinkUrl(src));
         setCopied(src);
         window.setTimeout(() => setCopied((c) => (c === src ? null : c)), 2000);
      } catch {
         setCopied(null);
      }
   };

   const create = async (e: FormEvent) => {
      e.preventDefault();
      if (!poster.trim()) {
         setError("Type who's posting.");
         return;
      }
      setSaving(true);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const {
         data: { user }
      } = await supabase.auth.getUser();
      const base = makePostSrc(poster, place, new Date());
      // Same person, same place, same day again → fb-…-oct16-2, -3…
      let made: string | null = null;
      for (let n = 1; n <= 20 && !made; n += 1) {
         const src = n === 1 ? base : `${base.slice(0, 77)}-${n}`;
         const { error: insertError } = await supabase.from('post_links').insert({
            src,
            poster: poster.trim(),
            place: place.trim() || null,
            note: note.trim() || null,
            created_by: user?.id ?? null
         });
         if (!insertError) made = src;
         else if (insertError.code !== '23505') {
            setError(insertError.message);
            break;
         }
      }
      setSaving(false);
      if (!made) return;
      setJustMade(made);
      setPoster('');
      setPlace('');
      setNote('');
      void copy(made);
      void load();
   };

   const totals = rows.reduce(
      (t, r) => ({ clicks: t.clicks + r.clicks, signups: t.signups + Number(r.signups), borrowed: t.borrowed + Number(r.borrowed) }),
      { clicks: 0, signups: 0, borrowed: 0 }
   );

   return (
      <div className="space-y-6">
         <form onSubmit={create} className="space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4 sm:p-5">
            <p className="text-base font-bold text-white">Make a link for a post</p>
            <p className="text-sm text-[#a89bb8]">
               Use one link per post (or per person posting). Put it in the post instead of plain moodeng.app, and every click and
               sign-up shows up below.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
               <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#a89bb8]">Who&apos;s posting *</span>
                  <input value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="Juan" className={inputClass} />
               </label>
               <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#a89bb8]">Where (group or page)</span>
                  <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Bonds group" className={inputClass} />
               </label>
               <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#a89bb8]">Note (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paid ₱500, Taglish post" className={inputClass} />
               </label>
            </div>
            {preview ? <p className="break-all text-sm text-[#e8defa]">Link: {preview}</p> : null}
            {error ? <p className="text-sm font-semibold text-red-300">{error}</p> : null}
            <button
               type="submit"
               disabled={saving}
               className="rounded-xl bg-[#a06bff] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
               {saving ? 'Making…' : 'Make link and copy'}
            </button>
            {justMade ? (
               <p className="text-sm font-semibold text-emerald-300">
                  {copied === justMade ? 'Copied: ' : 'Made: '}
                  <span className="break-all">{postLinkUrl(justMade)}</span>
               </p>
            ) : null}
         </form>

         <div className="grid grid-cols-3 gap-3">
            {[
               ['Clicks', totals.clicks],
               ['Sign-ups', totals.signups],
               ['Borrowed', totals.borrowed]
            ].map(([label, value]) => (
               <div key={label} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#a89bb8]">{label}</p>
                  <p className="mt-1 text-2xl font-black text-white">{value}</p>
               </div>
            ))}
         </div>

         <div className="overflow-x-auto rounded-2xl border border-[#2a1453] bg-[#1c0a3a]">
            <table className="w-full min-w-[820px] text-sm">
               <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#a89bb8]">
                     <th className="px-3 py-3 font-semibold">Post</th>
                     <th className="px-3 py-3 font-semibold">Made</th>
                     <th className="px-3 py-3 text-right font-semibold">Clicks</th>
                     <th className="px-3 py-3 text-right font-semibold">Sign-ups</th>
                     <th className="px-3 py-3 text-right font-semibold">Facebook</th>
                     <th className="px-3 py-3 text-right font-semibold">Approved</th>
                     <th className="px-3 py-3 text-right font-semibold">ID verified</th>
                     <th className="px-3 py-3 text-right font-semibold">Borrowed</th>
                     <th className="px-3 py-3 font-semibold"> </th>
                  </tr>
               </thead>
               <tbody>
                  {rows.map((r) => (
                     <tr key={r.src} className="border-t border-[#2a1453] text-[#e8defa]">
                        <td className="px-3 py-2">
                           <p className="font-semibold text-white">
                              {r.poster}
                              {r.place ? <span className="font-normal text-[#a89bb8]"> · {r.place}</span> : null}
                           </p>
                           <p className="break-all text-xs text-[#a89bb8]">?src={r.src}</p>
                           {r.note ? <p className="text-xs text-[#a89bb8]">{r.note}</p> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{bangkokDate(r.created_at)}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-white">{r.clicks}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                           {r.signups} <span className="text-xs text-[#a89bb8]">{pct(Number(r.signups), r.clicks)}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.facebook_connected}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.approved}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.id_verified}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-white">{r.borrowed}</td>
                        <td className="px-3 py-2">
                           <button
                              type="button"
                              onClick={() => void copy(r.src)}
                              className="rounded-lg border border-[#2a1453] px-3 py-1.5 text-xs font-semibold text-white"
                           >
                              {copied === r.src ? 'Copied' : 'Copy link'}
                           </button>
                        </td>
                     </tr>
                  ))}
                  {!loading && rows.length === 0 ? (
                     <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-[#a89bb8]">
                           No post links yet. Make one above.
                        </td>
                     </tr>
                  ) : null}
               </tbody>
            </table>
         </div>
         <p className="text-xs text-[#a89bb8]">
            Clicks count once per phone/browser. Sign-ups count accounts whose first visit came from the link. Someone who later
            opens moodeng.app in Chrome instead won&apos;t be counted, so ask posters to also share their referral code.
         </p>
      </div>
   );
}
