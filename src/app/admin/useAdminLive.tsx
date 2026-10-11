'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { getUsername } from '@/app/admin/adminLiveData';
import { ADMIN_STATUS_META, deriveAccessRequestStatus, deriveBorrowerStatus, deriveLoanStatus } from '@/app/admin/adminStatus';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

// Live admin panel: one Supabase Realtime channel for the whole page (tables added to the
// supabase_realtime publication in 20261011150000_admin_realtime_publication.sql). Sections register
// a reload for the tables they show; changes are debounced into one reload. If realtime can't
// connect, every section falls back to polling. Changed rows flash briefly with who changed them.

export type AdminLiveTable =
   | 'users'
   | 'loans'
   | 'loan_access_requests'
   | 'voucher_claims'
   | 'loan_refunds'
   | 'admin_account_restrictions'
   | 'admin_audit_logs'
   | 'account_status_audit_logs';

export const ADMIN_LIVE_TABLES: AdminLiveTable[] = [
   'users',
   'loans',
   'loan_access_requests',
   'voucher_claims',
   'loan_refunds',
   'admin_account_restrictions',
   'admin_audit_logs',
   'account_status_audit_logs'
];

const DEBOUNCE_MS = 800;
const POLL_MS = 30000;
const FLASH_MS = 6000;

export interface AdminLiveFlash {
   at: number;
   label: string;
   actorName: string | null;
   own: boolean;
}

type Listener = (tables: Set<AdminLiveTable>) => void;

interface AdminLiveContextValue {
   connected: boolean;
   subscribe: (listener: Listener) => () => void;
   flashes: Record<string, AdminLiveFlash>;
   // Own actions: flash the row right away instead of waiting for the realtime echo.
   markChanged: (id: string, label: string) => void;
}

const AdminLiveContext = createContext<AdminLiveContextValue | null>(null);

type Row = Record<string, unknown>;
const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

// What changed, in badge words, plus the ids a section might key its row on.
function describeChange(table: AdminLiveTable, row: Row): { ids: string[]; label: string; actorId: string | null } | null {
   const id = str(row.id);
   switch (table) {
      case 'users':
         return { ids: [id].filter(Boolean) as string[], label: ADMIN_STATUS_META[deriveBorrowerStatus(row)].label, actorId: null };
      case 'loans':
         return {
            ids: [id, str(row.borrower_user_id)].filter(Boolean) as string[],
            label: ADMIN_STATUS_META[deriveLoanStatus(row)].label,
            actorId: str(row.refunded_by) ?? str(row.offplatform_settled_by)
         };
      case 'loan_access_requests':
         return {
            ids: [id, str(row.user_id)].filter(Boolean) as string[],
            label: ADMIN_STATUS_META[deriveAccessRequestStatus({ status: str(row.status), expires_at: str(row.expires_at) })].label,
            actorId: str(row.decided_by)
         };
      case 'voucher_claims':
         return { ids: [id, str(row.user_id)].filter(Boolean) as string[], label: `Voucher ${String(row.status ?? '')}`, actorId: null };
      case 'loan_refunds':
         return {
            ids: [id, str(row.loan_id), str(row.borrower_user_id)].filter(Boolean) as string[],
            label: 'Refunded',
            actorId: str(row.refunded_by)
         };
      case 'admin_account_restrictions':
         return {
            ids: [id, str(row.user_id)].filter(Boolean) as string[],
            label: row.status === 'banned' ? 'Banned' : row.status === 'watchlist' ? 'Watchlist' : 'Restriction cleared',
            actorId: str(row.updated_by)
         };
      case 'admin_audit_logs':
         return {
            ids: [str(row.target_id), str(row.target_user_id)].filter(Boolean) as string[],
            label: String(row.action ?? 'Updated').replace(/_/g, ' '),
            actorId: str(row.actor_user_id)
         };
      case 'account_status_audit_logs':
         return {
            ids: [str(row.target_user_id)].filter(Boolean) as string[],
            label: `Account ${String(row.new_status ?? '')}`,
            actorId: str(row.actor_user_id)
         };
      default:
         return null;
   }
}

export function AdminLiveProvider({ enabled = true, children }: { enabled?: boolean; children: ReactNode }) {
   const [connected, setConnected] = useState(false);
   const [flashes, setFlashes] = useState<Record<string, AdminLiveFlash>>({});
   const listeners = useRef(new Set<Listener>());
   const pending = useRef(new Set<AdminLiveTable>());
   const timer = useRef<number | null>(null);
   const names = useRef(new Map<string, string | null>());

   const emit = useCallback((tables: Iterable<AdminLiveTable>) => {
      for (const t of tables) pending.current.add(t);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
         const batch = new Set(pending.current);
         pending.current.clear();
         listeners.current.forEach((listener) => listener(batch));
      }, DEBOUNCE_MS);
   }, []);

   const flash = useCallback((ids: string[], value: AdminLiveFlash) => {
      if (!ids.length) return;
      setFlashes((current) => {
         const next = { ...current };
         // Drop stale entries while we're here.
         for (const [key, f] of Object.entries(next)) if (value.at - f.at > FLASH_MS) delete next[key];
         for (const id of ids) {
            // Keep a known actor (e.g. from the audit log) over a later actor-less echo of the same change.
            const prior = next[id];
            next[id] =
               prior && value.at - prior.at < 2000 && !value.actorName && prior.actorName
                  ? { ...value, actorName: prior.actorName, own: prior.own }
                  : value;
         }
         return next;
      });
   }, []);

   const markChanged = useCallback(
      (id: string, label: string) => flash([id], { at: Date.now(), label, actorName: 'you', own: true }),
      [flash]
   );

   useEffect(() => {
      if (!enabled || !isSupabaseBrowserConfigured()) return;
      const supabase = getSupabaseBrowserClient();
      let poll: number | null = null;
      const startPolling = () => {
         if (poll) return;
         poll = window.setInterval(() => emit(ADMIN_LIVE_TABLES), POLL_MS);
      };
      const stopPolling = () => {
         if (poll) window.clearInterval(poll);
         poll = null;
      };

      let channel = supabase.channel('admin-live');
      for (const table of ADMIN_LIVE_TABLES) {
         channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
            emit([table]);
            const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Row;
            const change = describeChange(table, row);
            if (!change) return;
            const at = Date.now();
            const { actorId } = change;
            if (actorId && !names.current.has(actorId)) {
               void getUsername(actorId).then((name) => {
                  names.current.set(actorId, name);
                  flash(change.ids, { at, label: change.label, actorName: name, own: false });
               });
            }
            flash(change.ids, { at, label: change.label, actorName: actorId ? (names.current.get(actorId) ?? null) : null, own: false });
         });
      }
      channel.subscribe((status) => {
         if (status === 'SUBSCRIBED') {
            setConnected(true);
            stopPolling();
         } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setConnected(false);
            startPolling();
         }
      });
      // Until the socket confirms, poll so nothing goes stale.
      startPolling();

      return () => {
         stopPolling();
         if (timer.current) window.clearTimeout(timer.current);
         void supabase.removeChannel(channel);
      };
   }, [enabled, emit, flash]);

   const subscribe = useCallback((listener: Listener) => {
      listeners.current.add(listener);
      return () => {
         listeners.current.delete(listener);
      };
   }, []);

   const value = useMemo(() => ({ connected, subscribe, flashes, markChanged }), [connected, subscribe, flashes, markChanged]);
   return <AdminLiveContext.Provider value={value}>{children}</AdminLiveContext.Provider>;
}

export function useAdminLive() {
   return useContext(AdminLiveContext);
}

/**
 * Re-run `reload` (debounced) whenever one of `tables` changes. The reload should be quiet — it runs
 * in the background while the admin is looking at the tab.
 */
export function useAdminLiveReload(tables: AdminLiveTable[], reload: () => unknown) {
   const live = useContext(AdminLiveContext);
   const reloadRef = useRef(reload);
   reloadRef.current = reload;
   const key = tables.join(',');
   useEffect(() => {
      if (!live) return;
      const watched = new Set(key.split(','));
      return live.subscribe((changed) => {
         for (const t of changed) {
            if (watched.has(t)) {
               void reloadRef.current();
               return;
            }
         }
      });
   }, [live, key]);
}

/** The recent change for a row (by row id or user id), or null once it's older than a few seconds. */
export function useAdminLiveFlash(...ids: Array<string | null | undefined>): AdminLiveFlash | null {
   const live = useContext(AdminLiveContext);
   const [, rerender] = useReducer((n: number) => n + 1, 0);
   let found: AdminLiveFlash | null = null;
   for (const id of ids) {
      const f = id ? live?.flashes[id] : undefined;
      if (f && Date.now() - f.at < FLASH_MS && (!found || f.at > found.at)) found = f;
   }
   const at = found?.at;
   useEffect(() => {
      if (!at) return;
      const t = window.setTimeout(() => rerender(), Math.max(0, FLASH_MS - (Date.now() - at)));
      return () => window.clearTimeout(t);
   }, [at]);
   return found;
}

/** Highlight wrapper class + "Approved by @x · just now" line for a recently changed row. */
export function AdminLiveFlashNote({ flash }: { flash: AdminLiveFlash | null }) {
   if (!flash) return null;
   const by = flash.own ? ' by you' : flash.actorName ? ` by @${flash.actorName}` : '';
   return (
      <span className="inline-flex rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-200">
         {flash.label.charAt(0).toUpperCase() + flash.label.slice(1)}
         {by} · just now
      </span>
   );
}

export const ADMIN_FLASH_CLASS = 'ring-2 ring-amber-400/70 bg-amber-400/5 transition-colors duration-700';

/** Wraps a row: highlights it and shows "Approved by @x · just now" after a live change. */
export function AdminLiveRow({
   ids,
   className = '',
   children
}: {
   ids: Array<string | null | undefined>;
   className?: string;
   children?: ReactNode;
}) {
   const flash = useAdminLiveFlash(...ids);
   return (
      <div className={`${className} ${flash ? ADMIN_FLASH_CLASS : ''}`}>
         {flash ? (
            <div className="mb-2">
               <AdminLiveFlashNote flash={flash} />
            </div>
         ) : null}
         {children}
      </div>
   );
}

/** Lets a component outside the provider (the page itself) reload on live changes. */
export function AdminLiveReloader({ tables, onChange }: { tables: AdminLiveTable[]; onChange: () => unknown }) {
   useAdminLiveReload(tables, onChange);
   return null;
}
