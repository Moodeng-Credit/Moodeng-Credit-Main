'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';
import {
   type AdminDirectoryUser,
   type AdminOverview,
   type AdminUser,
   type DefaultedLoanRow,
   type LoanRequestReviewRow,
   type RecoveryCaseRow,
   type RiskProfileRow,
   getAdminOverview,
   getCurrentAdmin,
   listAdminDirectoryUsers,
   listDefaultedLoans,
   listLoanRequestReviews,
   listRecoveryCases,
   listRiskProfiles,
   sendNoticeToUsername,
   upsertAccountRestrictionByUsername
} from './adminSupabase';

type AdminTab = 'users' | 'defaults' | 'requests' | 'risk' | 'notifications';
type PersonRole = 'all' | 'borrowers' | 'lenders';

const navItems: Array<{ id: AdminTab; label: string }> = [
   { id: 'users', label: 'User directory' },
   { id: 'defaults', label: 'Default recovery' },
   { id: 'requests', label: 'Delete loan requests' },
   { id: 'risk', label: 'Risk assessment' },
   { id: 'notifications', label: 'Notifications' }
];

const recoveryPaths = [
   { name: 'Extend loan', detail: 'Same lender, new due date. Borrower and lender both get a notice.' },
   { name: 'Payment plan', detail: 'Same lender, split repayment into smaller scheduled payments.' },
   { name: 'Bridge refinance', detail: 'Borrower applies with evidence and deposit. New lender pays the old lender.' },
   { name: 'Manual resolution', detail: 'Waive, reporting error, dispute, keep blocked, or admin-only note.' }
];

const noticeTemplates = [
   {
      id: 'borrower-blocked',
      audience: 'borrower' as const,
      title: 'Action needed on your account',
      body: 'Your borrowing is paused because a loan is overdue. Repay now or contact support to request recovery mode.'
   },
   {
      id: 'borrower-plan',
      audience: 'borrower' as const,
      title: 'Payment plan confirmed',
      body: 'Your overdue repayment has been split into scheduled payments. Borrowing stays paused until the plan is complete.'
   },
   {
      id: 'lender-missed',
      audience: 'lender' as const,
      title: 'Loan repayment missed',
      body: 'A borrower missed repayment. Our team is contacting the borrower and reviewing recovery options.'
   },
   {
      id: 'candidate-bridge',
      audience: 'candidate_lender' as const,
      title: 'Bridge recovery opportunity',
      body: 'A borrower has submitted recovery evidence and a deposit. If approved, your bridge loan is routed to the original lender.'
   }
];

function formatMoney(value: number | string | null | undefined) {
   if (value === null || value === undefined || value === '') return 'Amount not set';
   const numberValue = Number(value);
   if (Number.isNaN(numberValue)) return String(value);
   return `$${numberValue.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
   if (!value) return 'Date not set';
   return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getLoanDue(loan: DefaultedLoanRow) {
   const repayment = Number(loan.total_repayment_amount ?? loan.loan_amount ?? 0);
   const repaid = Number(loan.repaid_amount ?? 0);
   if (Number.isNaN(repayment)) return loan.total_repayment_amount ?? loan.loan_amount;
   return Math.max(repayment - (Number.isNaN(repaid) ? 0 : repaid), 0);
}

function Badge({ children, tone = 'purple' }: { children: ReactNode; tone?: 'purple' | 'green' | 'yellow' | 'red' | 'gray' }) {
   const colors = {
      purple: 'bg-purple-100 text-purple-800',
      green: 'bg-emerald-100 text-emerald-800',
      yellow: 'bg-amber-100 text-amber-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-slate-100 text-slate-700'
   };

   return <span className={`inline-flex rounded-full px-4 py-2 text-sm font-black uppercase tracking-wide ${colors[tone]}`}>{children}</span>;
}

function StatCard({ label, value, note }: { label: string; value: number; note: string }) {
   return (
      <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
         <p className="text-sm font-black uppercase tracking-wide text-[#6f627e]">{label}</p>
         <strong className="mt-3 block text-5xl font-black text-[#1c053d]">{value}</strong>
         <p className="mt-2 text-sm font-bold text-[#6f627e]">{note}</p>
      </div>
   );
}

function EmptyState({ title, body }: { title: string; body: string }) {
   return (
      <div className="rounded-3xl border border-[#eadff8] bg-white p-8 shadow-sm">
         <h3 className="text-3xl font-black">{title}</h3>
         <p className="mt-3 text-xl text-[#6f627e]">{body}</p>
      </div>
   );
}

export default function AdminPanel() {
   const reduxUser = useSelector((state: RootState) => state.auth.user);
   const [activeTab, setActiveTab] = useState<AdminTab>('users');
   const [admin, setAdmin] = useState<AdminUser | null>(null);
   const [overview, setOverview] = useState<AdminOverview | null>(null);
   const [users, setUsers] = useState<AdminDirectoryUser[]>([]);
   const [defaultedLoans, setDefaultedLoans] = useState<DefaultedLoanRow[]>([]);
   const [recoveryCases, setRecoveryCases] = useState<RecoveryCaseRow[]>([]);
   const [loanRequestReviews, setLoanRequestReviews] = useState<LoanRequestReviewRow[]>([]);
   const [riskProfiles, setRiskProfiles] = useState<RiskProfileRow[]>([]);
   const [search, setSearch] = useState('');
   const [roleFilter, setRoleFilter] = useState<PersonRole>('all');
   const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
   const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
   const [selectedTemplateId, setSelectedTemplateId] = useState(noticeTemplates[0].id);
   const [noticeUsername, setNoticeUsername] = useState('');
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);

   const currentAdminName = useMemo(() => admin?.display_name ?? reduxUser?.username ?? 'Moodeng admin', [admin?.display_name, reduxUser?.username]);
   const adminInitial = currentAdminName.trim().charAt(0).toUpperCase() || 'A';
   const visibleUsers = users.filter((user) => {
      if (roleFilter === 'all') return true;
      return true;
   });
   const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
   const selectedTemplate = noticeTemplates.find((template) => template.id === selectedTemplateId) ?? noticeTemplates[0];
   const selectedRequest = loanRequestReviews.find((request) => request.id === selectedRequestId) ?? loanRequestReviews[0] ?? null;

   async function refresh(searchValue = search) {
      const [nextOverview, nextUsers, nextDefaultedLoans, nextRecoveryCases, nextLoanRequestReviews, nextRiskProfiles] = await Promise.all([
         getAdminOverview(),
         listAdminDirectoryUsers(searchValue),
         listDefaultedLoans(),
         listRecoveryCases(),
         listLoanRequestReviews(),
         listRiskProfiles()
      ]);

      setOverview(nextOverview);
      setUsers(nextUsers);
      setDefaultedLoans(nextDefaultedLoans);
      setRecoveryCases(nextRecoveryCases);
      setLoanRequestReviews(nextLoanRequestReviews);
      setRiskProfiles(nextRiskProfiles);
      setSelectedUserId((current) => current ?? nextUsers[0]?.id ?? null);
      setSelectedRequestId((current) => current ?? nextLoanRequestReviews[0]?.id ?? null);
   }

   useEffect(() => {
      let alive = true;

      async function load() {
         try {
            setLoading(true);
            const currentAdmin = await getCurrentAdmin(reduxUser?.id);
            if (!alive) return;

            setAdmin(currentAdmin);
            if (currentAdmin) await refresh('');
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

   async function handleBan(username: string | null) {
      if (!username) return;
      setError(null);
      setStatusMessage(null);

      try {
         await upsertAccountRestrictionByUsername({
            username,
            status: 'banned',
            reason: 'manual',
            risk_level: 'high',
            admin_note: `Banned by ${currentAdminName} from the admin workspace.`,
            updated_by: admin?.user_id ?? reduxUser?.id ?? null
         });
         setStatusMessage(`${username} is now marked banned in Supabase.`);
         await refresh(search);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not ban this user.');
      }
   }

   async function handleSendNotice(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError(null);
      setStatusMessage(null);

      try {
         await sendNoticeToUsername(
            noticeUsername,
            {
               audience: selectedTemplate.audience,
               notice_type: selectedTemplate.id,
               title: selectedTemplate.title,
               body: selectedTemplate.body,
               metadata: { source: 'admin_workspace', case_manager: currentAdminName }
            },
            admin?.user_id ?? reduxUser?.id ?? null
         );
         setStatusMessage(`Notification sent to ${noticeUsername}. It will show when they open Moodeng.`);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not send notification.');
      }
   }

   if (loading) return <main className="min-h-screen bg-[#120429] p-8 text-xl font-black text-white">Checking admin access...</main>;

   if (!admin) {
      return (
         <main className="min-h-screen bg-[#f7f5fb] p-6">
            <section className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
               <p className="text-sm font-black uppercase tracking-wide text-red-600">Admin panel</p>
               <h1 className="mt-3 text-4xl font-black text-[#08002f]">You do not have access</h1>
               <p className="mt-3 text-lg text-slate-600">Only approved Moodeng admins can open this panel.</p>
               {error ? <p className="mt-5 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p> : null}
            </section>
         </main>
      );
   }

   return (
      <main className="min-h-screen bg-[#f7f5fb] text-[#1c053d]">
         <div className="grid min-h-screen lg:grid-cols-[320px_1fr]">
            <aside className="bg-[#120429] p-8 text-white lg:sticky lg:top-0 lg:h-screen">
               <div className="flex items-center gap-5">
                  <a href="/account/settings" className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#8336f0] text-4xl font-black text-white no-underline focus:outline focus:outline-4 focus:outline-offset-4 focus:outline-purple-200" title="Account settings">
                     {adminInitial}
                  </a>
                  <div>
                     <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-200">Admin panel</p>
                     <h1 className="mt-1 text-3xl font-black leading-tight">{currentAdminName}</h1>
                     <p className="mt-1 text-lg text-purple-200">Moodeng Credit</p>
                  </div>
               </div>

               <nav className="mt-12 grid gap-4">
                  {navItems.map((item) => (
                     <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={`rounded-2xl border px-6 py-5 text-left text-xl font-black ${activeTab === item.id ? 'border-[#8336f0] bg-[#2a1453] text-white' : 'border-transparent text-purple-200 hover:border-[#8336f0] hover:bg-[#20103e]'}`}>
                        {item.label}
                     </button>
                  ))}
               </nav>

               <div className="mt-12 rounded-3xl border border-[#8336f0] bg-[#241044] p-6">
                  <p className="text-lg text-purple-200">Logged in as</p>
                  <strong className="mt-2 block text-2xl font-black">{currentAdminName}</strong>
                  <p className="mt-2 text-lg text-purple-200">Owner access</p>
               </div>
            </aside>

            <section className="min-w-0 p-5 sm:p-8 lg:p-10">
               {error ? <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-lg font-bold text-red-800">{error}</div> : null}
               {statusMessage ? <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-lg font-bold text-emerald-800">{statusMessage}</div> : null}

               {activeTab === 'users' ? (
                  <section className="space-y-6">
                     <div>
                        <h2 className="text-5xl font-black tracking-normal">User directory</h2>
                        <p className="mt-3 max-w-3xl text-2xl text-[#6f627e]">Search real borrowers and lenders from Supabase, then manage the selected account directly under that person.</p>
                     </div>

                     <form onSubmit={handleSearch} className="rounded-3xl border border-[#eadff8] bg-white p-5 shadow-sm">
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users or wallets" className="h-16 w-full rounded-2xl border border-[#ded0ef] px-6 text-2xl text-[#1c053d]" />
                        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#ded0ef] text-center text-xl font-black">
                           {(['all', 'borrowers', 'lenders'] as const).map((role) => (
                              <button key={role} type="button" onClick={() => setRoleFilter(role)} className={`py-4 capitalize ${roleFilter === role ? 'bg-[#8336f0] text-white' : 'bg-white text-[#6f627e]'}`}>
                                 {role === 'all' ? 'Everyone' : role}
                              </button>
                           ))}
                        </div>
                     </form>

                     <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="All users" value={users.length} note="Loaded from Supabase" />
                        <StatCard label="Needs review" value={overview?.recoveryReviewCount ?? 0} note="Open recovery cases" />
                        <StatCard label="Defaults" value={overview?.defaultedLoanCount ?? 0} note="Overdue loans" />
                        <StatCard label="Loan requests" value={overview?.loanRequestReviewCount ?? 0} note="Review queue" />
                     </div>

                     <div className="overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                        {visibleUsers.map((user) => (
                           <article key={user.id} className="border-b border-[#eadff8] last:border-b-0">
                              <div className="grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                                 <div className="flex gap-4">
                                    <button type="button" onClick={() => setSelectedUserId(user.id)} className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#8336f0] text-2xl font-black text-white">
                                       {(user.username ?? '?').charAt(0).toUpperCase()}
                                    </button>
                                    <div>
                                       <button type="button" onClick={() => setSelectedUserId(user.id)} className="text-left text-3xl font-black underline decoration-2 underline-offset-4">
                                          {user.username ?? 'Unnamed user'}
                                       </button>
                                       <p className="mt-3 text-xl text-[#6f627e]">{user.wallet_address ?? 'No wallet on file'}</p>
                                    </div>
                                 </div>
                                 <button type="button" onClick={() => setSelectedUserId(user.id)} className="rounded-2xl bg-[#34234f] px-6 py-4 text-xl font-black text-white">Manage</button>
                              </div>
                              {selectedUser?.id === user.id ? (
                                 <div className="border-t border-[#eadff8] bg-[#fbf8ff] p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                       <h3 className="text-3xl font-black">Selected account</h3>
                                       <button type="button" onClick={() => setSelectedUserId(null)} className="rounded-full border border-[#ded0ef] bg-white px-5 py-3 text-lg font-black text-[#6b21a8]">Collapse</button>
                                    </div>
                                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                                       <div className="rounded-2xl border border-[#eadff8] bg-white p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Name</p><strong className="mt-2 block text-3xl">{user.username ?? 'Unnamed user'}</strong></div>
                                       <div className="rounded-2xl border border-[#eadff8] bg-white p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Wallet</p><strong className="mt-2 block text-3xl">{user.wallet_address ?? 'No wallet on file'}</strong></div>
                                    </div>
                                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                       <a href={`/user/${encodeURIComponent(user.username ?? '')}`} className="rounded-2xl bg-[#34234f] px-5 py-4 text-center text-xl font-black text-white no-underline">Open dashboard</a>
                                       <button type="button" onClick={() => { setNoticeUsername(user.username ?? ''); setActiveTab('notifications'); }} className="rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white">Send notification</button>
                                       <button type="button" onClick={() => handleBan(user.username)} className="rounded-2xl bg-red-600 px-5 py-4 text-xl font-black text-white">Ban account</button>
                                    </div>
                                 </div>
                              ) : null}
                           </article>
                        ))}
                        {!visibleUsers.length ? <div className="p-6"><EmptyState title="No users found" body="This is live Supabase data. Try another search or clear the filters." /></div> : null}
                     </div>
                  </section>
               ) : null}

               {activeTab === 'defaults' ? (
                  <section className="space-y-6">
                     <div><h2 className="text-5xl font-black">Default recovery</h2><p className="mt-3 text-2xl text-[#6f627e]">Real overdue loans and recovery cases from Supabase.</p></div>
                     <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                        <div className="space-y-5">
                           <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                              <h3 className="text-3xl font-black">Overdue loans</h3>
                              <div className="mt-5 divide-y divide-[#eadff8]">
                                 {defaultedLoans.map((loan) => (
                                    <div key={loan.id} className="py-5 first:pt-0 last:pb-0">
                                       <div className="flex items-start justify-between gap-4"><div><h4 className="text-2xl font-black">{loan.borrower_wallet ?? loan.borrower_user_id ?? 'Unknown borrower'}</h4><p className="mt-2 text-lg text-[#6f627e]">Lender: {loan.lender_wallet ?? loan.lender_user_id ?? 'Unknown lender'} · due {formatDate(loan.due_date)}</p></div><strong className="text-3xl font-black">{formatMoney(getLoanDue(loan))}</strong></div>
                                       <div className="mt-3 flex flex-wrap gap-2"><Badge tone="red">{loan.repayment_status ?? 'overdue'}</Badge><Badge tone="gray">{loan.tracking_id ?? loan.id}</Badge></div>
                                    </div>
                                 ))}
                                 {!defaultedLoans.length ? <EmptyState title="No overdue loans" body="No defaulted loan rows are currently returned by Supabase." /> : null}
                              </div>
                           </div>
                           <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                              <h3 className="text-3xl font-black">Recovery cases</h3>
                              <div className="mt-5 divide-y divide-[#eadff8]">
                                 {recoveryCases.map((recoveryCase) => (
                                    <div key={recoveryCase.id} className="py-5 first:pt-0 last:pb-0">
                                       <h4 className="text-2xl font-black">{recoveryCase.borrower_user_id}</h4>
                                       <p className="mt-2 text-lg text-[#6f627e]">Status: {recoveryCase.status} · Path: {recoveryCase.recovery_path ?? 'not chosen yet'}</p>
                                       <p className="mt-2 text-lg text-[#6f627e]">{recoveryCase.evidence_summary ?? recoveryCase.admin_note ?? 'No admin note yet.'}</p>
                                    </div>
                                 ))}
                                 {!recoveryCases.length ? <EmptyState title="No recovery cases yet" body="When borrowers apply for recovery mode, the real cases will appear here." /> : null}
                              </div>
                           </div>
                        </div>
                        <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                           <h3 className="text-3xl font-black">Available recovery paths</h3>
                           <p className="mt-2 text-lg text-[#6f627e]">These buttons are intentionally not fake-saving yet. The next wiring step is to attach each one to a selected real case.</p>
                           <div className="mt-5 grid gap-4">
                              {recoveryPaths.map((path) => (<div key={path.name} className="rounded-2xl border border-[#ded0ef] bg-[#fbf8ff] p-5"><strong className="block text-2xl font-black">{path.name}</strong><span className="mt-2 block text-lg text-[#6f627e]">{path.detail}</span></div>))}
                           </div>
                        </div>
                     </div>
                  </section>
               ) : null}

               {activeTab === 'requests' ? (
                  <section className="space-y-6">
                     <div><h2 className="text-5xl font-black">Delete loan requests</h2><p className="mt-3 text-2xl text-[#6f627e]">Real loan request review rows from Supabase.</p></div>
                     <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                        <div className="overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                           {loanRequestReviews.map((request) => (
                              <button key={request.id} type="button" onClick={() => setSelectedRequestId(request.id)} className={`block w-full border-b border-[#eadff8] p-6 text-left last:border-b-0 ${selectedRequestId === request.id ? 'bg-[#fbf8ff]' : 'bg-white'}`}>
                                 <div className="flex items-center justify-between gap-4"><h3 className="text-3xl font-black underline underline-offset-4">{request.users?.username ?? request.borrower_user_id ?? 'Unknown borrower'}</h3><strong className="text-3xl">{formatMoney(request.loans?.loan_amount as string | number | null | undefined)}</strong></div>
                                 <div className="mt-3 flex flex-wrap gap-3"><Badge tone="purple">request review</Badge><Badge tone={request.status === 'deleted' ? 'red' : request.status === 'kept' ? 'green' : 'yellow'}>{request.status}</Badge></div>
                                 <p className="mt-3 text-xl text-[#6f627e]">{request.evidence_summary ?? request.admin_note ?? 'No evidence summary yet.'}</p>
                              </button>
                           ))}
                           {!loanRequestReviews.length ? <div className="p-6"><EmptyState title="No loan requests in review" body="No admin loan request review rows are currently returned by Supabase." /></div> : null}
                        </div>
                        <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                           <h3 className="text-3xl font-black">Request detail</h3>
                           {selectedRequest ? <><p className="mt-2 text-xl text-[#6f627e]">Delete only with a clear reason.</p><div className="mt-5 grid gap-4"><div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Borrower</p><strong className="mt-2 block text-3xl underline">{selectedRequest.users?.username ?? selectedRequest.borrower_user_id ?? 'Unknown borrower'}</strong></div><div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Reason</p><strong className="mt-2 block text-2xl">{selectedRequest.reason ?? 'No reason set'}</strong></div><div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Evidence</p><strong className="mt-2 block text-2xl">{selectedRequest.evidence_summary ?? 'No evidence summary yet'}</strong></div></div><button type="button" className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-4 text-xl font-black text-white">Delete request wiring next</button></> : <EmptyState title="No request selected" body="Select a real loan request review first." />}
                        </div>
                     </div>
                  </section>
               ) : null}

               {activeTab === 'risk' ? (
                  <section className="space-y-6">
                     <div><h2 className="text-5xl font-black">Risk assessment</h2><p className="mt-3 text-2xl text-[#6f627e]">Real risk profiles and factors from Supabase.</p></div>
                     <div className="grid gap-5 xl:grid-cols-2">
                        {riskProfiles.map((profile) => (<article key={profile.id} className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><h3 className="text-3xl font-black">{profile.users?.username ?? profile.user_id}</h3><Badge tone={profile.risk_level === 'high' ? 'red' : profile.risk_level === 'medium' ? 'yellow' : 'green'}>{profile.risk_level} risk</Badge></div><p className="mt-4 text-xl text-[#6f627e]">Score {profile.override_score ?? profile.score}. {profile.algorithm_note ?? 'No algorithm note yet.'}</p><div className="mt-5 rounded-2xl bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Risk factors</p><strong className="mt-2 block text-2xl">{profile.admin_risk_factors?.length ?? 0} factors recorded</strong></div></article>))}
                        {!riskProfiles.length ? <EmptyState title="No risk profiles yet" body="When the risk algorithm writes rows, real profiles will appear here." /> : null}
                     </div>
                  </section>
               ) : null}

               {activeTab === 'notifications' ? (
                  <section className="space-y-6">
                     <div><h2 className="text-5xl font-black">Notifications</h2><p className="mt-3 text-2xl text-[#6f627e]">Choose a real user and send a notice into Supabase. These show on their screen when they open Moodeng.</p></div>
                     <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                        <div className="grid gap-4">
                           {noticeTemplates.map((template) => (<button key={template.id} type="button" onClick={() => setSelectedTemplateId(template.id)} className={`rounded-3xl border p-6 text-left shadow-sm ${selectedTemplateId === template.id ? 'border-[#8336f0] bg-[#fbf8ff]' : 'border-[#eadff8] bg-white'}`}><Badge tone="purple">{template.audience.replace('_', ' ')}</Badge><h3 className="mt-4 text-3xl font-black">{template.title}</h3><p className="mt-3 text-xl text-[#6f627e]">{template.body}</p></button>))}
                        </div>
                        <form onSubmit={handleSendNotice} className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                           <h3 className="text-3xl font-black">Send notification</h3>
                           <p className="mt-2 text-xl text-[#6f627e]">Selected: {selectedTemplate.title}</p>
                           <input value={noticeUsername} onChange={(event) => setNoticeUsername(event.target.value)} placeholder="Real username" className="mt-5 h-16 w-full rounded-2xl border border-[#ded0ef] px-5 text-2xl" />
                           <div className="mt-5 rounded-3xl border border-[#eadff8] bg-[#fbf8ff] p-5"><Badge tone="purple">{selectedTemplate.audience.replace('_', ' ')}</Badge><h4 className="mt-4 text-3xl font-black">{selectedTemplate.title}</h4><p className="mt-3 text-xl text-[#6f627e]">{selectedTemplate.body}</p></div>
                           <button className="mt-5 w-full rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white">Send notification</button>
                        </form>
                     </div>
                  </section>
               ) : null}
            </section>
         </div>
      </main>
   );
}
