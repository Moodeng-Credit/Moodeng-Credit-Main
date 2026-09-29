'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Ellipsis, Landmark, type LucideIcon, Menu, MessageCircle, ShieldAlert, TrendingUp, Users, X } from 'lucide-react';

// The admin panel's frame, modelled on Stripe / Linear: a short sidebar of work areas, and each
// area's tools as sub-tabs along the top of the page, next to the global search. Sub-tabs can show
// a count of items waiting ("Requests 3"), and each area remembers the sub-tab you last used.

export type AdminNavGroup = { id: string; label: string; items: Array<{ id: string; label: string }> };

const AREA_ICONS: Record<string, LucideIcon> = {
   people: Users,
   loans: Landmark,
   risk: ShieldAlert,
   growth: TrendingUp,
   support: MessageCircle,
   more: Ellipsis
};

const LAST_TAB_KEY = 'moodeng.admin.lastTab.';
const NO_COUNTS: Record<string, number> = {};

// Per-browser convenience only — storage can be unavailable (private mode, blocked site data).
const readLastTab = (areaId: string): string | null => {
   try {
      return window.localStorage.getItem(LAST_TAB_KEY + areaId);
   } catch {
      return null;
   }
};
const writeLastTab = (areaId: string, tab: string) => {
   try {
      window.localStorage.setItem(LAST_TAB_KEY + areaId, tab);
   } catch {
      // ignore
   }
};

interface AdminShellProps {
   adminName: string;
   adminInitial: string;
   groups: AdminNavGroup[];
   activeTab: string;
   onSelectTab: (tab: string) => void;
   // Items waiting per sub-tab id, shown as a badge on the tab and summed on its area.
   counts?: Record<string, number>;
   search: ReactNode;
   children: ReactNode;
}

function CountBadge({ value, active }: { value: number; active?: boolean }) {
   return (
      <span
         className={`min-w-[20px] rounded-full px-1.5 py-px text-center text-[11px] font-black tabular-nums ${active ? 'bg-[#8336f0] text-white' : 'bg-[#2a1453] text-[#c9a7ff]'}`}
      >
         {value > 99 ? '99+' : value}
      </span>
   );
}

export default function AdminShell({
   adminName,
   adminInitial,
   groups,
   activeTab,
   onSelectTab,
   counts = NO_COUNTS,
   search,
   children
}: AdminShellProps) {
   const [mobileOpen, setMobileOpen] = useState(false);
   const subTabsRef = useRef<HTMLElement>(null);

   const areas = groups.filter((group) => group.items.length > 0);
   const activeArea = areas.find((area) => area.items.some((item) => item.id === activeTab)) ?? areas[0];
   const areaCount = (area: AdminNavGroup) => area.items.reduce((sum, item) => sum + (counts[item.id] ?? 0), 0);

   const activeAreaId = activeArea?.id;
   useEffect(() => {
      if (activeAreaId) writeLastTab(activeAreaId, activeTab);
   }, [activeAreaId, activeTab]);

   // On narrow screens the sub-tab row scrolls sideways — keep the active one in view.
   useEffect(() => {
      subTabsRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
   }, [activeTab]);

   const openArea = (area: AdminNavGroup) => {
      const remembered = readLastTab(area.id);
      onSelectTab(area.items.some((item) => item.id === remembered) ? (remembered as string) : area.items[0].id);
      setMobileOpen(false);
   };

   return (
      <main className="min-h-screen bg-[#120429] text-white lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
         {mobileOpen ? (
            <button
               type="button"
               aria-label="Close menu"
               onClick={() => setMobileOpen(false)}
               className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
         ) : null}

         <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-[#2a1453] bg-[#0d0320] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
         >
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[#2a1453] px-4">
               <a
                  href="/account/settings"
                  title="Account settings"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#8336f0] text-base font-black text-white no-underline"
               >
                  {adminInitial}
               </a>
               <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black leading-tight">{adminName}</p>
                  <p className="truncate text-xs text-[#a89bb8]">Moodeng Credit admin</p>
               </div>
               <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#a89bb8] hover:bg-[#1c0a3a] hover:text-white lg:hidden"
               >
                  <X className="h-4 w-4" />
               </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Admin areas">
               {areas.map((area) => {
                  const Icon = AREA_ICONS[area.id] ?? Ellipsis;
                  const active = area.id === activeArea?.id;
                  const count = areaCount(area);
                  return (
                     <button
                        key={area.id}
                        type="button"
                        onClick={() => openArea(area)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-bold transition-colors ${active ? 'bg-[#2a1453] text-white shadow-[inset_2px_0_0_#8336f0]' : 'text-[#c4b8d6] hover:bg-[#1c0a3a] hover:text-white'}`}
                     >
                        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[#b98cff]' : 'text-[#8f82a6]'}`} />
                        <span className="flex-1 truncate">{area.label}</span>
                        {count > 0 ? <CountBadge value={count} active={active} /> : null}
                     </button>
                  );
               })}
            </nav>

            <div className="shrink-0 border-t border-[#2a1453] px-4 py-3">
               <p className="flex items-center gap-2 text-xs font-bold text-[#a89bb8]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  Live Supabase data
               </p>
            </div>
         </aside>

         <div className="min-w-0">
            <header className="sticky top-0 z-30 border-b border-[#2a1453] bg-[#120429]/90 backdrop-blur">
               <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
                  <button
                     type="button"
                     aria-label="Open menu"
                     onClick={() => setMobileOpen(true)}
                     className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#c4b8d6] hover:bg-[#1c0a3a] lg:hidden"
                  >
                     <Menu className="h-5 w-5" />
                  </button>
                  <p className="hidden shrink-0 text-lg font-black md:block">{activeArea?.label}</p>
                  <div className="ml-auto w-full max-w-xl">{search}</div>
               </div>

               {activeArea && activeArea.items.length > 1 ? (
                  <nav
                     ref={subTabsRef}
                     aria-label={`${activeArea.label} sections`}
                     className="-mb-px flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden"
                  >
                     {activeArea.items.map((item) => {
                        const active = item.id === activeTab;
                        const count = counts[item.id] ?? 0;
                        return (
                           <button
                              key={item.id}
                              type="button"
                              onClick={() => onSelectTab(item.id)}
                              aria-current={active ? 'page' : undefined}
                              className={`flex h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-bold transition-colors ${active ? 'border-[#8336f0] text-white' : 'border-transparent text-[#a89bb8] hover:text-white'}`}
                           >
                              {item.label}
                              {count > 0 ? <CountBadge value={count} active={active} /> : null}
                           </button>
                        );
                     })}
                  </nav>
               ) : null}
            </header>

            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
         </div>
      </main>
   );
}
