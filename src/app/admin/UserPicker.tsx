'use client';

import { useEffect, useRef, useState } from 'react';

import { type AdminUserOption, searchUsersForPicker } from './adminSupabase';

// Searchable dropdown of users (by username or email). Calls onPick with the chosen user.
export default function UserPicker({
   onPick,
   onCancel,
   disabled
}: {
   onPick: (user: AdminUserOption) => void;
   onCancel: () => void;
   disabled?: boolean;
}) {
   const [search, setSearch] = useState('');
   const [options, setOptions] = useState<AdminUserOption[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      inputRef.current?.focus();
   }, []);

   useEffect(() => {
      let cancelled = false;
      const timer = window.setTimeout(async () => {
         setLoading(true);
         setError(null);
         try {
            const rows = await searchUsersForPicker(search);
            if (!cancelled) setOptions(rows);
         } catch (err) {
            if (!cancelled) setError((err as { message?: string })?.message || 'Search failed.');
         } finally {
            if (!cancelled) setLoading(false);
         }
      }, 250);
      return () => {
         cancelled = true;
         window.clearTimeout(timer);
      };
   }, [search]);

   return (
      <div className="mt-3 rounded-xl border border-[#3d1f6e] bg-[#150730] p-3">
         <div className="flex items-center gap-2">
            <input
               ref={inputRef}
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancel();
                  if (e.key === 'Enter' && options[0]) onPick(options[0]);
               }}
               placeholder="Search username or email…"
               className="min-w-0 flex-1 rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-2 text-base font-bold text-white placeholder:text-[#6f6385]"
            />
            <button type="button" onClick={onCancel} className="rounded-xl bg-[#241044] px-4 py-2 text-base font-black text-[#cfc6dd]">
               Cancel
            </button>
         </div>
         {error ? <p className="mt-2 text-sm font-bold text-red-300">{error}</p> : null}
         <ul className="mt-2 max-h-64 overflow-y-auto">
            {options.map((u) => (
               <li key={u.id}>
                  <button
                     type="button"
                     disabled={disabled}
                     onClick={() => onPick(u)}
                     className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#241044] disabled:opacity-50"
                  >
                     <span className="truncate text-base font-black text-white">{u.username || 'Unnamed user'}</span>
                     <span className="truncate text-sm font-medium text-[#a89bb8]">{u.email ?? ''}</span>
                  </button>
               </li>
            ))}
            {!options.length && !loading ? <li className="px-3 py-2 text-sm font-bold text-[#6f6385]">No users match.</li> : null}
            {loading ? <li className="px-3 py-2 text-sm font-bold text-[#6f6385]">Searching…</li> : null}
         </ul>
      </div>
   );
}
