'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import {
   Activity,
   Bell,
   Blocks,
   CalendarClock,
   CalendarDays,
   ChevronDown,
   Clock,
   Coins,
   Contact,
   Croissant,
   Droplets,
   FileText,
   Inbox,
   Landmark,
   LayoutDashboard,
   LifeBuoy,
   type LucideIcon,
   Map as MapIcon,
   Menu,
   MessageCircle,
   Package,
   Presentation,
   Repeat,
   ShieldAlert,
   Tag,
   Terminal,
   Ticket,
   TrendingUp,
   Undo2,
   Users,
   UserX,
   X
} from 'lucide-react';

// The admin panel's frame: a compact grouped sidebar (a drawer on phones) and a sticky top bar with
// breadcrumbs and the global search. Modelled on Linear / Vercel / shadcn-style app shells — small
// type and dense navigation so nearly all of the screen goes to the work surface.

export type AdminNavGroup = { id: string; label: string; items: Array<{ id: string; label: string }> };

const ICONS: Record<string, LucideIcon> = {
   users: Users,
   calendar: CalendarDays,
   'borrower-contacts': Contact,
   analytics: TrendingUp,
   'ux-health': Activity,
   'on-chain': Blocks,
   loans: Landmark,
   pricing: Tag,
   'coming-due': Clock,
   extensions: CalendarClock,
   requests: Inbox,
   refunds: Undo2,
   defaults: LifeBuoy,
   points: Coins,
   'trust-points': Croissant,
   risk: ShieldAlert,
   'self-lending': Repeat,
   'mule-risk': UserX,
   referrals: Ticket,
   notifications: Bell,
   chat: MessageCircle,
   relay: Droplets,
   'demo-platform': Presentation,
   'demo-b2c-dashboard': LayoutDashboard,
   'demo-b2c-assets': Package,
   'demo-monday': FileText,
   'demo-map': MapIcon,
   'demo-console': Terminal,
   'demo-spec': FileText
};

// Demo groups start folded away — they're for sales calls, not day-to-day operations.
const isDemoGroup = (id: string) => id.startsWith('demo');

interface AdminShellProps {
   adminName: string;
   adminInitial: string;
   groups: AdminNavGroup[];
   activeTab: string;
   onSelectTab: (tab: string) => void;
   search: ReactNode;
   children: ReactNode;
}

export default function AdminShell({ adminName, adminInitial, groups, activeTab, onSelectTab, search, children }: AdminShellProps) {
   const [mobileOpen, setMobileOpen] = useState(false);
   const [folded, setFolded] = useState<Record<string, boolean>>(() =>
      Object.fromEntries(groups.filter((g) => isDemoGroup(g.id)).map((g) => [g.id, true]))
   );

   const activeGroup = groups.find((g) => g.items.some((item) => item.id === activeTab));
   const activeItem = activeGroup?.items.find((item) => item.id === activeTab);

   const select = (tab: string) => {
      onSelectTab(tab);
      setMobileOpen(false);
   };

   return (
      <main className="min-h-screen bg-[#120429] text-white lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
         {mobileOpen ? (
            <button
               type="button"
               aria-label="Close menu"
               onClick={() => setMobileOpen(false)}
               className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
         ) : null}

         <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[#2a1453] bg-[#0d0320] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
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

            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Admin sections">
               {groups.map((group) => {
                  const containsActive = group.id === activeGroup?.id;
                  const isFolded = Boolean(folded[group.id]) && !containsActive;
                  return (
                     <div key={group.id} className="mb-3">
                        <button
                           type="button"
                           onClick={() => setFolded((current) => ({ ...current, [group.id]: !isFolded }))}
                           aria-expanded={!isFolded}
                           className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#8f82a6] hover:text-white"
                        >
                           {group.label}
                           <ChevronDown
                              className={`h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100 ${isFolded ? '-rotate-90 opacity-100' : ''}`}
                           />
                        </button>
                        {!isFolded ? (
                           <ul className="mt-0.5 space-y-0.5">
                              {group.items.map((item) => {
                                 const Icon = ICONS[item.id] ?? FileText;
                                 const active = item.id === activeTab;
                                 return (
                                    <li key={item.id}>
                                       <button
                                          type="button"
                                          onClick={() => select(item.id)}
                                          aria-current={active ? 'page' : undefined}
                                          className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-semibold transition-colors ${active ? 'bg-[#2a1453] text-white shadow-[inset_2px_0_0_#8336f0]' : 'text-[#c4b8d6] hover:bg-[#1c0a3a] hover:text-white'}`}
                                       >
                                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#b98cff]' : 'text-[#8f82a6]'}`} />
                                          <span className="truncate">{item.label}</span>
                                       </button>
                                    </li>
                                 );
                              })}
                           </ul>
                        ) : null}
                     </div>
                  );
               })}
            </nav>

            <div className="shrink-0 border-t border-[#2a1453] px-4 py-3">
               <p className="flex items-center gap-2 text-xs font-bold text-[#a89bb8]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  Live Supabase data · no mock users
               </p>
            </div>
         </aside>

         <div className="min-w-0">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#2a1453] bg-[#120429]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
               <button
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setMobileOpen(true)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#c4b8d6] hover:bg-[#1c0a3a] lg:hidden"
               >
                  <Menu className="h-5 w-5" />
               </button>
               <p className="hidden min-w-0 shrink-0 items-center gap-2 text-sm md:flex">
                  <span className="text-[#8f82a6]">{activeGroup?.label ?? 'Admin'}</span>
                  <span className="text-[#3d1f6e]">/</span>
                  <span className="truncate font-black">{activeItem?.label ?? ''}</span>
               </p>
               <div className="ml-auto w-full max-w-xl">{search}</div>
            </header>

            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
         </div>
      </main>
   );
}
