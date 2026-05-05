import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';
import { type AdminDirectoryUser, type AdminOverview, type AdminUser, getAdminOverview, getCurrentAdmin, listAdminDirectoryUsers, sendNoticeToUsername, upsertAccountRestrictionByUsername } from './adminSupabase';

type TabKey = 'users' | 'defaults' | 'requests' | 'risk' | 'notifications';
type UserKind = 'all' | 'borrower' | 'lender';

const demoUsers = [
   { name: 'Cookiemonster1337', role: 'borrower', wallet: '0x71c...9d42', status: 'active', risk: 'high', note: 'Blocked from new loans because 2 defaults are unresolved.', evidence: '2 defaults, $71.50 total due, 5 recovery messages' },
   { name: 'ScamRequestGuy', role: 'borrower', wallet: '0x999...bad1', status: 'banned', risk: 'high', note: 'Repeated fake requests and abusive messages.', evidence: '4 reports, 3 deleted requests, 2 abusive messages' },
   { name: 'MaybeDuplicate123', role: 'borrower', wallet: '0x444...dupe', status: 'watchlist', risk: 'medium', note: 'Possible duplicate wallet pattern.', evidence: 'Wallet overlaps with banned account' },
   { name: 'LateButResponsive', role: 'borrower', wallet: '0x555...payd', status: 'active', risk: 'low', note: 'Was late before but repaid after support chat.', evidence: 'No abuse reports' },
   { name: 'BaseBuilder', role: 'lender', wallet: '0x8a4...19b0', status: 'active', risk: 'low', note: 'Original lender on one overdue loan.', evidence: 'No account restriction needed' },
   { name: 'OnchainNina', role: 'lender', wallet: '0x31d...f6aa', status: 'active', risk: 'low', note: 'Original lender on smaller overdue loan.', evidence: 'No reports' }
];

const defaultCases = [
   { borrower: 'Cookiemonster1337', lender: 'BaseBuilder', amount: '$55.00', due: '2026-04-15', late: '20 days late', status: 'blocked' },
   { borrower: 'Cookiemonster1337', lender: 'OnchainNina', amount: '$16.50', due: '2026-04-26', late: '9 days late', status: 'blocked' }
];

const loanRequests = [
   { borrower: 'SpamLoan420', wallet: '0x420...spam', amount: '$250', status: 'reported', risk: 'high', reason: 'Looks like scam request and has two user reports.', evidence: '2 reports, suspicious external payment language', audit: 'Reported by lender, hidden from featured feed' },
   { borrower: 'Cookiemonster1337', wallet: '0x71c...9d42', amount: '$40', status: 'duplicate', risk: 'medium', reason: 'Similar active request already exists.', evidence: 'Same borrower, similar amount, same day', audit: 'Duplicate match detected, review queued' },
   { borrower: 'NewBorrowerPH', wallet: '0x777...newp', amount: '$25', status: 'active', risk: 'low', reason: 'Missing clear repayment date.', evidence: 'No lender reports, but repayment terms are incomplete', audit: 'Validation flagged missing due date' }
];

const notices = [
   { audience: 'borrower' as const, title: 'Repayment plan saved', body: 'Your repayment was split into 3 payments. You are blocked until the plan is complete.' },
   { audience: 'lender' as const, title: 'Loan repayment changed', body: 'A loan you funded was converted into a payment plan. You can view each scheduled payment.' },
   { audience: 'candidate_lender' as const, title: 'Bridge recovery opportunity', body: 'A borrower is requesting a short bridge recovery loan. Review the details before funding.' },
   { audience: 'borrower' as const, title: 'Account notice', body: 'Your account needs attention from the Moodeng team. Contact support if you need help.' }
];

function badgeClass(value: string) {
   if (['banned', 'blocked', 'high', 'reported'].includes(value)) return 'bg-red-100 text-red-700';
   if (['active', 'low'].includes(value)) return 'bg-emerald-100 text-emerald-700';
   if (['watchlist', 'medium', 'duplicate'].includes(value)) return 'bg-amber-100 text-amber-800';
   return 'bg-purple-100 text-purple-700';
}

function Badge({ children, tone }: { children: string; tone?: string }) {
   return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${badgeClass(tone ?? children.toLowerCase())}`}>{children}</span>;
}

function StatCard({ label, value, note }: { label: string; value: number | string; note: string }) {
   return (
      <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
         <p className="text-sm font-black uppercase tracking-wide text-slate-500">{label}</p>
         <strong className="mt-3 block text-4xl font-black text-[#1c053d]">{value}</strong>
         <p className="mt-1 text-sm font-bold text-slate-500">{note}</p>
      </div>
   );
}

function SectionShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
   return (
      <section className="rounded-3xl border border-purple-100 bg-white shadow-sm">
         <div className="border-b border-purple-100 p-5">
            <h2 className="text-3xl font-black text-[#1c053d]">{title}</h2>
            <p className="mt-1 text-lg text-slate-600">{subtitle}</p>
         </div>
         {children}
      </section>
   );
}

export default function AdminPanel() {
   const reduxUser = useSelector((state: RootState) => state.auth.user);
   const [admin, setAdmin] = useState<AdminUser | null>(null);
   const [overview, setOverview] = useState<AdminOverview | null>(null);
   const [directoryUsers, setDirectoryUsers] = useState<AdminDirectoryUser[]>([]);
   const [tab, setTab] = useState<TabKey>('users');
   const [userKind, setUserKind] = useState<UserKind>('all');
   const [search, setSearch] = useState('');
   const [selectedUser, setSelectedUser] = useState(0);
   const [selectedDefault, setSelectedDefault] = useState(0);
   const [selectedRequest, setSelectedRequest] = useState(0);
   const [selectedNotice, setSelectedNotice] = useState(0);
   const [noticeUsername, setNoticeUsername] = useState('');
   const [noticeTitle, setNoticeTitle] = useState('Account notice');
   const [noticeBody, setNoticeBody] = useState('Please open Moodeng and review this account notice.');
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);

   const currentAdminName = useMemo(() => admin?.display_name ?? reduxUser?.username ?? 'Cookiemonster admin', [admin?.display_name, reduxUser?.username]);
   const visibleUsers = demoUsers.filter((user) => (userKind === 'all' || user.role === userKind) && `${user.name} ${user.wallet} ${user.note}`.toLowerCase().includes(search.toLowerCase()));
   const activeUser = visibleUsers[selectedUser] ?? visibleUsers[0] ?? demoUsers[0];
   const activeDefault = defaultCases[selectedDefault] ?? defaultCases[0];
   const activeRequest = loanRequests[selectedRequest] ?? loanRequests[0];
   const activeNotice = notices[selectedNotice] ?? notices[0];

   async function refreshSupabase(searchValue = search) {
      const [nextOverview, nextUsers] = await Promise.all([getAdminOverview(), listAdminDirectoryUsers(searchValue)]);
      setOverview(nextOverview);
      setDirectoryUsers(nextUsers);
   }

   useEffect(() => {
      let alive = true;
      async function load() {
         try {
            const currentAdmin = await getCurrentAdmin(reduxUser?.id);
            if (!alive) return;
            setAdmin(currentAdmin);
            if (currentAdmin) await refreshSupabase('');
         } catch (caught) {
            if (alive) setError(caught instanceof Error ? caught.message : 'Could not load admin panel.');
         } finally {
            if (alive) setLoading(false);
         }
      }
      load();
      return () => { alive = false; };
   }, [reduxUser?.id]);

   async function handleGlobalSearch(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setSelectedUser(0);
      if (admin) await refreshSupabase(search);
   }

   async function handleSendNotice(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setStatusMessage(null);
      setError(null);
      try {
         await sendNoticeToUsername(
            noticeUsername || activeUser.name,
            { audience: activeNotice.audience, notice_type: 'admin_notice', title: noticeTitle, body: noticeBody, metadata: { source: 'admin_panel_workspace' } },
            admin?.user_id ?? reduxUser?.id ?? null
         );
         setStatusMessage(`Notification sent to ${noticeUsername || activeUser.name}. It will show when they open Moodeng.`);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not send notification.');
      }
   }

   async function handleBanUser(username = activeUser.name) {
      setStatusMessage(null);
      setError(null);
      try {
         await upsertAccountRestrictionByUsername({ username, status: 'banned', reason: 'manual', risk_level: 'high', admin_note: `Banned by ${currentAdminName} from the admin workspace.`, updated_by: admin?.user_id ?? reduxUser?.id ?? null });
         setStatusMessage(`${username} is now marked banned.`);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not update restriction.');
      }
   }

   if (loading) return <main className="min-h-screen bg-[#120429] p-6 text-white">Checking admin access...</main>;

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
      <main className="min-h-screen bg-[#f7f5fb] text-[#1c053d]">
         <div className="grid min-h-screen lg:grid-cols-[320px_1fr]">
            <aside className="bg-[#120429] p-6 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
               <div className="flex items-center gap-4">
                  <a href="/account/settings" title="Account settings" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-purple-700 text-3xl font-black text-white outline-offset-4 focus-visible:outline focus-visible:outline-4 focus-visible:outline-purple-200">{currentAdminName.slice(0, 1).toUpperCase()}</a>
                  <div>
                     <p className="text-sm font-black uppercase tracking-[0.16em] text-purple-200">Admin panel</p>
                     <h1 className="text-3xl font-black leading-tight">{currentAdminName}</h1>
                     <p className="text-purple-100">Moodeng Credit</p>
                  </div>
               </div>

               <nav className="mt-8 grid gap-3">
                  {[
                     ['users', 'User directory'],
                     ['defaults', 'Default recovery'],
                     ['requests', 'Delete loan requests'],
                     ['risk', 'Risk assessment'],
                     ['notifications', 'Notifications']
                  ].map(([key, label]) => (
                     <button key={key} onClick={() => setTab(key as TabKey)} className={`rounded-2xl border px-5 py-4 text-left text-xl font-black ${tab === key ? 'border-purple-500 bg-purple-950/60 text-white' : 'border-transparent text-purple-100 hover:bg-purple-950/40'}`}>{label}</button>
                  ))}
               </nav>

               <div className="mt-8 rounded-2xl border border-purple-500 bg-purple-950/40 p-5">
                  <p className="text-purple-200">Logged in as</p>
                  <strong className="mt-2 block text-2xl">{currentAdminName}</strong>
                  <p className="mt-2 text-purple-200">Owner access</p>
               </div>
            </aside>

            <div className="space-y-6 p-5 lg:p-8">
               <div>
                  <h2 className="text-5xl font-black">{tab === 'users' ? 'User directory' : tab === 'defaults' ? 'Default recovery' : tab === 'requests' ? 'Delete loan requests' : tab === 'risk' ? 'Risk assessment' : 'Notifications'}</h2>
                  <p className="mt-2 text-xl text-slate-600">{tab === 'users' ? 'Search every borrower and lender, then manage the selected account.' : tab === 'defaults' ? 'Pick a defaulted loan, then choose a recovery path.' : tab === 'requests' ? 'Review, show details, or delete suspicious loan requests.' : tab === 'risk' ? 'Review each user risk profile and risk factors.' : 'Choose users and send notifications that appear when they open Moodeng.'}</p>
               </div>

               <form onSubmit={handleGlobalSearch} className="rounded-3xl border border-purple-100 bg-white p-4 shadow-sm">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users, wallets, lenders, loan requests" className="w-full rounded-2xl border border-purple-100 px-5 py-4 text-xl" />
               </form>

               {statusMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{statusMessage}</div> : null}
               {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

               <section className="grid gap-4 md:grid-cols-4">
                  <StatCard label="All users" value={overview?.defaultedLoanCount ? Math.max(overview.defaultedLoanCount, 8) : 8} note="Total accounts" />
                  <StatCard label="Needs review" value={overview?.recoveryReviewCount ?? 3} note="Open items" />
                  <StatCard label="Defaults" value={overview?.defaultedLoanCount ?? 2} note="Blocked loans" />
                  <StatCard label="Loan requests" value={overview?.loanRequestReviewCount ?? 8} note="Posted requests" />
               </section>

               {tab === 'users' ? (
                  <SectionShell title="People" subtitle="Full account list. Split by borrower or lender when needed.">
                     <div className="border-b border-purple-100 p-5">
                        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-purple-100 bg-white p-1">
                           {(['all', 'borrower', 'lender'] as UserKind[]).map((kind) => <button key={kind} onClick={() => { setUserKind(kind); setSelectedUser(0); }} className={`rounded-xl px-4 py-3 text-lg font-black ${userKind === kind ? 'bg-purple-700 text-white' : 'text-slate-600'}`}>{kind === 'all' ? 'Everyone' : kind === 'borrower' ? 'Borrowers' : 'Lenders'}</button>)}
                        </div>
                     </div>
                     <div className="divide-y divide-purple-100">
                        {visibleUsers.map((user, index) => (
                           <div key={user.name}>
                              <button onClick={() => setSelectedUser(selectedUser === index ? -1 : index)} className="grid w-full grid-cols-[1fr_auto] gap-4 p-5 text-left hover:bg-purple-50">
                                 <div className="flex gap-4">
                                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-purple-700 text-xl font-black text-white">{user.name[0]}</div>
                                    <div>
                                       <h3 className="text-2xl font-black underline">{user.name}</h3>
                                       <div className="mt-2 flex flex-wrap gap-2"><Badge>{user.role}</Badge><Badge tone={user.status}>{user.status}</Badge><Badge tone={user.risk}>{user.risk} risk</Badge></div>
                                       <p className="mt-2 text-lg text-slate-600">{user.wallet} · {user.note}</p>
                                    </div>
                                 </div>
                                 <strong className="text-2xl">{selectedUser === index ? 'Close' : 'Manage'}</strong>
                              </button>
                              {selectedUser === index ? (
                                 <div className="grid gap-4 bg-white p-5 md:grid-cols-2">
                                    <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4"><p className="font-black uppercase text-slate-500">Evidence</p><strong className="mt-2 block text-xl">{user.evidence}</strong></div>
                                    <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4"><p className="font-black uppercase text-slate-500">Admin note</p><strong className="mt-2 block text-xl">{user.note}</strong></div>
                                    <a href={`/user/${user.name}`} className="rounded-2xl bg-[#34234f] px-5 py-4 text-center text-lg font-black text-white">Dashboard</a>
                                    <button onClick={() => handleBanUser(user.name)} className="rounded-2xl bg-red-600 px-5 py-4 text-lg font-black text-white">Ban user</button>
                                 </div>
                              ) : null}
                           </div>
                        ))}
                     </div>
                  </SectionShell>
               ) : null}

               {tab === 'defaults' ? (
                  <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                     <SectionShell title="Default cases" subtitle="Pick a defaulted loan, then choose a recovery path.">
                        <div className="divide-y divide-purple-100">
                           {defaultCases.map((item, index) => <button key={`${item.borrower}-${item.amount}`} onClick={() => setSelectedDefault(index)} className={`w-full p-5 text-left ${selectedDefault === index ? 'bg-purple-50' : ''}`}><div className="flex justify-between gap-4"><div><h3 className="text-2xl font-black">{item.borrower}</h3><p className="mt-2 text-lg text-slate-600">Defaulted to {item.lender} · due {item.due} · {item.late}</p><div className="mt-3"><Badge tone="blocked">Blocked</Badge></div></div><strong className="text-3xl">{item.amount}</strong></div></button>)}
                        </div>
                     </SectionShell>
                     <SectionShell title="Recovery workspace" subtitle="Choose a recovery path and fill the details.">
                        <div className="space-y-4 p-5">
                           <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4"><p className="font-black uppercase text-slate-500">Selected loan</p><strong className="mt-2 block text-2xl">{activeDefault.borrower} owes {activeDefault.amount} to {activeDefault.lender}</strong></div>
                           {['Extend loan', 'Payment plan', 'Bridge recovery loan', 'Manual resolution'].map((label) => <button key={label} className="w-full rounded-2xl border border-purple-200 bg-white p-5 text-left text-2xl font-black hover:bg-purple-50">{label}<p className="mt-1 text-base font-normal text-slate-600">{label === 'Extend loan' ? 'Same lender, new due date.' : label === 'Payment plan' ? 'Same lender, split repayment into pieces.' : label === 'Bridge recovery loan' ? 'New lender pays the old lender directly.' : 'Waive, dispute, reporting error, or keep blocked.'}</p></button>)}
                           <textarea className="min-h-28 w-full rounded-2xl border border-purple-100 p-4" defaultValue="Case manager note goes here." />
                           <button className="w-full rounded-2xl bg-purple-700 p-4 text-xl font-black text-white">Save recovery plan</button>
                        </div>
                     </SectionShell>
                  </div>
               ) : null}

               {tab === 'requests' ? (
                  <SectionShell title="Delete loan requests" subtitle="Use show information before deleting suspicious requests.">
                     <div className="divide-y divide-purple-100">
                        {loanRequests.map((request, index) => <div key={request.borrower}><button onClick={() => setSelectedRequest(selectedRequest === index ? -1 : index)} className="grid w-full grid-cols-[1fr_auto] gap-4 p-5 text-left"><div><h3 className="text-2xl font-black underline">{request.borrower}</h3><p className="mt-2 text-lg text-slate-600">{request.wallet} · {request.reason}</p><div className="mt-3 flex gap-2"><Badge tone={request.status}>{request.status}</Badge><Badge tone={request.risk}>{request.risk} risk</Badge></div></div><strong className="text-3xl">{request.amount}</strong></button>{selectedRequest === index ? <div className="grid gap-4 p-5 md:grid-cols-2"><div className="rounded-2xl border border-purple-100 bg-purple-50 p-4"><p className="font-black uppercase text-slate-500">Evidence</p><strong>{request.evidence}</strong></div><div className="rounded-2xl border border-purple-100 bg-purple-50 p-4"><p className="font-black uppercase text-slate-500">Audit trail</p><strong>{request.audit}</strong></div><button className="rounded-2xl bg-[#34234f] p-4 font-black text-white">Show information</button><button className="rounded-2xl bg-red-600 p-4 font-black text-white">Delete request</button></div> : null}</div>)}
                     </div>
                  </SectionShell>
               ) : null}

               {tab === 'risk' ? (
                  <SectionShell title="Risk assessment" subtitle="Each user has a risk profile and factors.">
                     <div className="grid gap-4 p-5 md:grid-cols-2">{demoUsers.slice(0, 4).map((user) => <div key={user.name} className="rounded-2xl border border-purple-100 bg-purple-50 p-5"><h3 className="text-2xl font-black">{user.name}</h3><div className="mt-3 flex gap-2"><Badge tone={user.risk}>{user.risk} risk</Badge><Badge tone={user.status}>{user.status}</Badge></div><p className="mt-3 text-lg text-slate-600">{user.evidence}</p></div>)}</div>
                  </SectionShell>
               ) : null}

               {tab === 'notifications' ? (
                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                     <SectionShell title="Notification previews" subtitle="Inspect borrower and lender popups separately.">
                        <div className="grid gap-4 p-5">{notices.map((notice, index) => <button key={notice.title} onClick={() => { setSelectedNotice(index); setNoticeTitle(notice.title); setNoticeBody(notice.body); }} className={`rounded-2xl border p-5 text-left ${selectedNotice === index ? 'border-purple-500 bg-purple-50' : 'border-purple-100'}`}><Badge>{notice.audience}</Badge><h3 className="mt-3 text-2xl font-black">{notice.title}</h3><p className="mt-2 text-lg text-slate-600">{notice.body}</p></button>)}</div>
                     </SectionShell>
                     <SectionShell title="Choose users and send notification" subtitle="This creates a notice shown when that user opens Moodeng.">
                        <form onSubmit={handleSendNotice} className="space-y-4 p-5"><input value={noticeUsername} onChange={(event) => setNoticeUsername(event.target.value)} placeholder="Username" className="w-full rounded-2xl border border-purple-100 p-4 text-lg" /><input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} className="w-full rounded-2xl border border-purple-100 p-4 text-lg" /><textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} className="min-h-36 w-full rounded-2xl border border-purple-100 p-4 text-lg" /><button className="w-full rounded-2xl bg-purple-700 p-4 text-xl font-black text-white">Send notification</button></form>
                     </SectionShell>
                  </div>
               ) : null}

               {directoryUsers.length ? <p className="text-sm text-slate-500">Loaded {directoryUsers.length} real Supabase users for admin search.</p> : null}
            </div>
         </div>
      </main>
   );
}
