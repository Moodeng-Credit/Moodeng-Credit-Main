'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
   type AdminSearchResult,
   meaningfulWords,
   type SearchablePage,
   type SearchableRequest,
   type SearchableUser,
   searchAdmin
} from '@/app/admin/adminSearchModel';
import { type AdminSearchAiPick, askAdminSearchAi } from '@/app/admin/adminSupabase';

// Global admin search: jump to any page, user (username / email / wallet) or loan request.
// Focus with ⌘K / Ctrl+K or "/" from anywhere in the panel; ↑ ↓ to move, Enter to open, Esc to close.
// Local matches show instantly; for a plain-words question ("who's late this week") DeepSeek also picks
// the tabs that answer it, each with a short reason. Enter with nothing found asks DeepSeek right away.

const KIND_LABEL: Record<AdminSearchResult['kind'], string> = {
   page: 'Pages',
   ai: 'AI suggestions',
   user: 'Users',
   request: 'Loan requests'
};

const AI_DEBOUNCE_MS = 500;

type AiAnswer = { status: 'loading' } | { status: 'done'; picks: AdminSearchAiPick[] } | { status: 'error'; message: string };

const aiKey = (query: string) => query.trim().toLowerCase().replace(/\s+/g, ' ');

// Ask DeepSeek for questions, not lookups: two or more real words, or one word nothing matched locally.
// Emails, wallets and numbers are user / request lookups, so they never go to the AI.
function wantsAi(query: string, localCount: number): boolean {
   const trimmed = query.trim();
   if (trimmed.length < 3 || /@|^0x|^[0-9\s+()-]+$/i.test(trimmed)) return false;
   const words = meaningfulWords(trimmed);
   return words.length >= 2 || (words.length === 1 && localCount === 0);
}

interface AdminSearchProps {
   pages: SearchablePage[];
   users: SearchableUser[];
   requests: SearchableRequest[];
   onSelect: (result: AdminSearchResult) => void;
}

const isTypingTarget = (target: EventTarget | null) =>
   target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export default function AdminSearch({ pages, users, requests, onSelect }: AdminSearchProps) {
   const [query, setQuery] = useState('');
   const [open, setOpen] = useState(false);
   const [active, setActive] = useState(0);
   const inputRef = useRef<HTMLInputElement>(null);
   const wrapperRef = useRef<HTMLDivElement>(null);

   const [aiAnswers, setAiAnswers] = useState<Record<string, AiAnswer>>({});
   const aiAnswersRef = useRef(aiAnswers);
   aiAnswersRef.current = aiAnswers;

   const local = useMemo(() => searchAdmin(query, { pages, users, requests }), [query, pages, users, requests]);
   const aiAnswer: AiAnswer | undefined = aiAnswers[aiKey(query)];

   // AI picks go right after the local page matches. A page already matched locally keeps its place and
   // gains the AI's reason; only new pages get their own row, so arrow positions don't jump around.
   const results = useMemo(() => {
      if (aiAnswer?.status !== 'done' || aiAnswer.picks.length === 0) return local;
      const why = new Map(aiAnswer.picks.map((pick) => [pick.id, pick.why]));
      const localPages = local
         .filter((r) => r.kind === 'page')
         .map((r) => (why.has(r.id) ? { ...r, detail: `${r.detail} · ${why.get(r.id)}` } : r));
      const localPageIds = new Set(localPages.map((r) => r.id));
      const aiRows = aiAnswer.picks.flatMap<AdminSearchResult>((pick) => {
         const page = pages.find((p) => p.id === pick.id);
         return page && !localPageIds.has(page.id) ? [{ kind: 'ai', id: page.id, title: page.label, detail: pick.why || page.group }] : [];
      });
      return [...localPages, ...aiRows, ...local.filter((r) => r.kind !== 'page')];
   }, [local, aiAnswer, pages]);

   const askAi = (raw: string) => {
      const key = aiKey(raw);
      if (!key || aiAnswersRef.current[key]) return;
      setAiAnswers((prev) => ({ ...prev, [key]: { status: 'loading' } }));
      askAdminSearchAi(raw.trim(), pages)
         .then((picks) => setAiAnswers((prev) => ({ ...prev, [key]: { status: 'done', picks } })))
         .catch((err: unknown) =>
            setAiAnswers((prev) => ({
               ...prev,
               [key]: { status: 'error', message: err instanceof Error ? err.message : 'AI search failed.' }
            }))
         );
   };

   useEffect(() => {
      if (!wantsAi(query, local.length)) return;
      const timer = window.setTimeout(() => askAi(query), AI_DEBOUNCE_MS);
      return () => window.clearTimeout(timer);
      // askAi only reads refs and props that local already depends on.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [query, local.length]);
   const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

   useEffect(() => setActive(0), [query]);

   useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
         const combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
         const slash = event.key === '/' && !isTypingTarget(event.target);
         if (combo || slash) {
            event.preventDefault();
            inputRef.current?.focus();
            inputRef.current?.select();
            setOpen(true);
         }
      };
      const onClick = (event: MouseEvent) => {
         if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
      };
      window.addEventListener('keydown', onKey);
      document.addEventListener('mousedown', onClick);
      return () => {
         window.removeEventListener('keydown', onKey);
         document.removeEventListener('mousedown', onClick);
      };
   }, []);

   const choose = (result: AdminSearchResult) => {
      onSelect(result);
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
   };

   const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
         event.preventDefault();
         setActive((i) => Math.min(results.length - 1, i + 1));
      } else if (event.key === 'ArrowUp') {
         event.preventDefault();
         setActive((i) => Math.max(0, i - 1));
      } else if (event.key === 'Enter' && results[active]) {
         event.preventDefault();
         choose(results[active]);
      } else if (event.key === 'Enter' && query.trim().length >= 2) {
         event.preventDefault();
         askAi(query);
      } else if (event.key === 'Escape') {
         setOpen(false);
         inputRef.current?.blur();
      }
   };

   const showPanel = open && query.trim().length > 0;

   return (
      <div ref={wrapperRef} className="relative w-full">
         <div className="flex h-11 items-center gap-2 rounded-xl border border-[#3d1f6e] bg-[#1c0a3a] px-3 focus-within:border-[#8336f0]">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 fill-none stroke-[#a89bb8] stroke-2">
               <circle cx="8.5" cy="8.5" r="5.5" />
               <path d="m13 13 4 4" strokeLinecap="round" />
            </svg>
            <input
               ref={inputRef}
               value={query}
               onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
               }}
               onFocus={() => setOpen(true)}
               onKeyDown={onInputKey}
               role="combobox"
               aria-expanded={showPanel}
               aria-controls="admin-search-results"
               aria-label="Search the admin panel"
               placeholder="Search or ask in plain words — “who's late this week”, a user, email, wallet…"
               className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-[#a89bb8] focus:outline-none"
            />
            <kbd className="hidden shrink-0 rounded-md border border-[#3d1f6e] px-1.5 py-0.5 text-[11px] font-bold text-[#a89bb8] sm:block">
               {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
         </div>

         {showPanel ? (
            <div
               id="admin-search-results"
               role="listbox"
               className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-[#3d1f6e] bg-[#1c0a3a] p-1.5 shadow-2xl"
            >
               {results.length === 0 && aiAnswer?.status !== 'loading' ? (
                  <p className="px-3 py-4 text-sm text-[#a89bb8]">
                     No matches for “{query.trim()}”.{aiAnswer ? null : ' Press Enter to ask AI.'}
                  </p>
               ) : null}
               {results.map((result, index) => {
                  const firstOfKind = index === 0 || results[index - 1].kind !== result.kind;
                  return (
                     <div key={`${result.kind}:${result.id}`}>
                        {firstOfKind ? (
                           <p className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-wider text-[#a89bb8]">
                              {KIND_LABEL[result.kind]}
                           </p>
                        ) : null}
                        <button
                           type="button"
                           role="option"
                           aria-selected={index === active}
                           onMouseEnter={() => setActive(index)}
                           onClick={() => choose(result)}
                           className={`flex w-full min-w-0 items-baseline gap-3 rounded-lg px-3 py-2 text-left ${index === active ? 'bg-[#2a1453]' : ''}`}
                        >
                           <span className="shrink-0 text-sm font-black text-white">{result.title}</span>
                           <span className={`min-w-0 text-xs text-[#a89bb8] ${result.kind === 'ai' ? '' : 'truncate'}`}>
                              {result.detail}
                           </span>
                        </button>
                     </div>
                  );
               })}
               {aiAnswer?.status === 'loading' ? (
                  <p className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-[#a89bb8]">
                     <span
                        aria-hidden="true"
                        className="h-3 w-3 animate-spin rounded-full border-2 border-[#8336f0] border-t-transparent"
                     />
                     Asking AI which page fits…
                  </p>
               ) : null}
               {aiAnswer?.status === 'error' ? (
                  <p className="px-3 py-2.5 text-xs text-[#a89bb8]">AI search unavailable: {aiAnswer.message}</p>
               ) : null}
            </div>
         ) : null}
      </div>
   );
}
