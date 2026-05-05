import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';
import {
   type AdminDirectoryUser,
   type AdminOverview,
   type AdminUser,
   getAdminOverview,
   getCurrentAdmin,
   listAdminDirectoryUsers,
   sendNoticeToUsername,
   upsertAccountRestrictionByUsername
} from './adminSupabase';

function StatCard({ label, value }: { label: string; value: number }) {
   return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
         <p className="text-sm font-black uppercase tracking-wide text-slate-500">{label}</p>
         <strong className="mt-3 block text-4xl font-black text-[#08002f]">{value}</strong>
      </div>
   );
}

export default function AdminPanel() {
   const reduxUser = useSelector((state: RootState) => state.auth.user);
   const [admin, setAdmin] = useState<AdminUser | null>(null);
   const [overview, setOverview] = useState<AdminOverview | null>(null);
   const [users, setUsers] = useState<AdminDirectoryUser[]>([]);
   const [search, setSearch] = useState('');
   const [noticeUsername, setNoticeUsername] = useState('');
   const [noticeTitle, setNoticeTitle] = useState('Account notice');
   const [noticeBody, setNoticeBody] = useState('Please open Moodeng and review this account notice.');
   const [restrictionUsername, setRestrictionUsername] = useState('');
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);

   const currentAdminName = useMemo(() => admin?.display_name ?? reduxUser?.username ?? 'admin', [admin?.display_name, reduxUser?.username]);

   async function refresh(searchValue = search) {
      const [nextOverview, nextUsers] = await Promise.all([getAdminOverview(), listAdminDirectoryUsers(searchValue)]);
      setOverview(nextOverview);
      setUsers(nextUsers);
   }

   useEffect(() => {
      let alive = true;

      async function load() {
         try {
            setLoading(true);
            const currentAdmin = await getCurrentAdmin(reduxUser?.id);
            if (!alive) return;

            setAdmin(currentAdmin);
            if (currentAdmin) {
               await refresh('');
            }
         } catch (caught) {
            if (alive) setError(caught instanceof Error ? caught.message : 'Could not load admin panel.');
         } finally {
            if (alive) setLoading(false);
         }
      }

      load();
      return () => {
         alive = false;
      };
   }, [reduxUser?.id]);

   async function handleSearch(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError(null);
      await refresh(search);
   }

   async function handleSendNotice(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError(null);
      setStatusMessage(null);

      try {
         await sendNoticeToUsername(
            noticeUsername,
            {
               audience: 'borrower',
               notice_type: 'admin_notice',
               title: noticeTitle,
               body: noticeBody,
               metadata: { source: 'admin_panel' }
            },
            admin?.user_id ?? reduxUser?.id ?? null
         );
         setStatusMessage(`Notification sent to ${noticeUsername}. It will show when they open Moodeng.`);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not send notification.');
      }
   }

   async function handleBanUser(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError(null);
      setStatusMessage(null);

      try {
         await upsertAccountRestrictionByUsername({
            username: restrictionUsername,
            status: 'banned',
            reason: 'manual',
            risk_level: 'high',
            admin_note: `Banned by ${currentAdminName} from the admin panel.`,
            updated_by: admin?.user_id ?? reduxUser?.id ?? null
         });
         setStatusMessage(`${restrictionUsername} is now marked banned.`);
         await refresh(search);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not update restriction.');
      }
   }

   if (loading) {
      return <main className="min-h-screen bg-slate-950 p-6 text-white">Checking admin access...</main>;
   }

   if (!admin) {
      return (
         <main className="min-h-screen bg-slate-50 p-6">
            <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
               <p className="text-sm font-black uppercase tracking-wide text-red-600">Admin panel</p>
               <h1 className="mt-3 text-3xl font-black text-[#08002f]">You do not have access</h1>
               <p className="mt-2 text-slate-600">Only approved Moodeng admins can open this panel.</p>
               {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            </section>
         </main>
      );
   }

   return (
      <main className="min-h-screen bg-[#f7f5fb] p-5 text-[#1c053d]">
         <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-col gap-4 rounded-3xl bg-[#120429] p-6 text-white sm:flex-row sm:items-center">
               <a
                  href="/account/settings"
                  title="Account settings"
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-purple-700 text-3xl font-black text-white outline-offset-4 focus-visible:outline focus-visible:outline-4 focus-visible:outline-purple-200"
               >
                  {currentAdminName.slice(0, 1).toUpperCase()}
               </a>
               <div>
                  <p className="text-sm font-black uppercase tracking-wide text-purple-200">Admin panel</p>
                  <h1 className="mt-2 text-4xl font-black">Moodeng admin</h1>
                  <p className="mt-2 text-purple-100">Signed in as {currentAdminName}</p>
               </div>
            </header>

            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}
            {statusMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{statusMessage}</div> : null}

            <section className="grid gap-4 md:grid-cols-5">
               <StatCard label="Defaults" value={overview?.defaultedLoanCount ?? 0} />
               <StatCard label="Needs review" value={overview?.recoveryReviewCount ?? 0} />
               <StatCard label="Banned" value={overview?.bannedUserCount ?? 0} />
               <StatCard label="Loan requests" value={overview?.loanRequestReviewCount ?? 0} />
               <StatCard label="High risk" value={overview?.highRiskProfileCount ?? 0} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
               <div className="rounded-3xl border border-purple-100 bg-white shadow-sm">
                  <div className="border-b border-purple-100 p-5">
                     <h2 className="text-2xl font-black">People</h2>
                     <p className="mt-1 text-slate-600">Search real Supabase users by username or wallet.</p>
                  </div>
                  <form onSubmit={handleSearch} className="flex gap-3 border-b border-purple-100 p-5">
                     <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search username or wallet"
                        className="min-w-0 flex-1 rounded-2xl border border-purple-100 px-4 py-3"
                     />
                     <button className="rounded-2xl bg-[#34234f] px-5 py-3 font-black text-white">Search</button>
                  </form>
                  <div className="divide-y divide-purple-100">
                     {users.map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-4 p-5">
                           <div>
                              <h3 className="text-xl font-black">{user.username ?? 'Unnamed user'}</h3>
                              <p className="mt-1 text-slate-600">{user.wallet_address ?? 'No wallet on file'}</p>
                           </div>
                           <a className="rounded-2xl bg-purple-700 px-4 py-3 font-black text-white" href={`/user/${user.username ?? ''}`}>
                              Dashboard
                           </a>
                        </div>
                     ))}
                     {!users.length ? <p className="p-5 text-slate-600">No users found.</p> : null}
                  </div>
               </div>

               <div className="space-y-4">
                  <form onSubmit={handleSendNotice} className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm">
                     <h2 className="text-2xl font-black">Send notification</h2>
                     <p className="mt-1 text-slate-600">This creates a notice on the user account, shown when they open Moodeng.</p>
                     <input value={noticeUsername} onChange={(event) => setNoticeUsername(event.target.value)} placeholder="Username" className="mt-4 w-full rounded-2xl border border-purple-100 px-4 py-3" />
                     <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Title" className="mt-3 w-full rounded-2xl border border-purple-100 px-4 py-3" />
                     <textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="Message" className="mt-3 min-h-28 w-full rounded-2xl border border-purple-100 px-4 py-3" />
                     <button className="mt-4 w-full rounded-2xl bg-purple-700 px-5 py-3 font-black text-white">Send notification</button>
                  </form>

                  <form onSubmit={handleBanUser} className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
                     <h2 className="text-2xl font-black">Ban user</h2>
                     <p className="mt-1 text-slate-600">This upserts the user restriction row in Supabase.</p>
                     <input value={restrictionUsername} onChange={(event) => setRestrictionUsername(event.target.value)} placeholder="Username" className="mt-4 w-full rounded-2xl border border-red-100 px-4 py-3" />
                     <button className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-3 font-black text-white">Ban user</button>
                  </form>
               </div>
            </section>
         </div>
      </main>
   );
}
