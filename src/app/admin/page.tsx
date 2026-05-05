'use client';

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

type AdminTab = 'users' | 'defaults' | 'requests' | 'risk' | 'notifications';
type PersonRole = 'borrower' | 'lender';
type RiskLevel = 'low' | 'medium' | 'high';
type AccountStatus = 'active' | 'watchlist' | 'banned';

type DirectoryRow = {
   id: string;
   username: string;
   wallet: string;
   role: PersonRole;
   status: AccountStatus;
   risk: RiskLevel;
   note: string;
   evidence: string;
   adminNote: string;
};

type LoanRequest = {
   id: string;
   borrower: string;
   amount: string;
   status: string;
   reason: string;
   evidence: string;
   posted: string;
};

type NoticeTemplate = {
   id: string;
   audience: 'borrower' | 'lender' | 'candidate_lender';
   title: string;
   body: string;
};

const navItems: Array<{ id: AdminTab; label: string }> = [
   { id: 'users', label: 'User directory' },
   { id: 'defaults', label: 'Default recovery' },
   { id: 'requests', label: 'Delete loan requests' },
   { id: 'risk', label: 'Risk assessment' },
   { id: 'notifications', label: 'Notifications' }
];

const scaffoldUsers: DirectoryRow[] = [
   {
      id: 'cookiemonster1337',
      username: 'Cookiemonster1337',
      wallet: '0x71c...9d42',
      role: 'borrower',
      status: 'active',
      risk: 'high',
      note: 'Blocked from new loans because 2 defaults are unresolved.',
      evidence: '2 defaults, $71.50 total due, 5 recovery messages',
      adminNote: 'Case manager: Cookiemonster admin. Recovery mode is open.'
   },
   {
      id: 'scamrequestguy',
      username: 'ScamRequestGuy',
      wallet: '0x999...bad1',
      role: 'borrower',
      status: 'banned',
      risk: 'high',
      note: 'Repeated fake requests and abusive messages.',
      evidence: '4 reports, 3 deleted requests, 2 abusive messages',
      adminNote: 'Reviewed by Cookiemonster admin. User can appeal through support.'
   },
   {
      id: 'maybeduplicate123',
      username: 'MaybeDuplicate123',
      wallet: '0x444...dupe',
      role: 'borrower',
      status: 'watchlist',
      risk: 'medium',
      note: 'Possible duplicate wallet pattern.',
      evidence: '1 duplicate wallet signal, 1 matching device note',
      adminNote: 'Needs second admin review before ban.'
   },
   {
      id: 'basebuilder',
      username: 'BaseBuilder',
      wallet: '0x8a4...19b0',
      role: 'lender',
      status: 'active',
      risk: 'low',
      note: 'Original lender on one overdue loan.',
      evidence: '1 active default recovery case',
      adminNote: 'Should receive lender-facing recovery notices.'
   }
];

const defaultCases = [
   {
      id: 'default-1',
      borrower: 'Cookiemonster1337',
      lender: 'BaseBuilder',
      amount: '$55.00',
      due: '2026-04-15',
      status: 'Blocked',
      summary: '20 days late. Borrower can repay immediately or request recovery mode.'
   },
   {
      id: 'default-2',
      borrower: 'Cookiemonster1337',
      lender: 'OnchainNina',
      amount: '$16.50',
      due: '2026-04-20',
      status: 'Blocked',
      summary: '15 days late. Smaller default, same borrower, same case manager.'
   }
];

const recoveryPaths = [
   { name: 'Extend loan', detail: 'Same lender, new due date. Borrower and lender both get a notice.' },
   { name: 'Payment plan', detail: 'Same lender, split repayment into smaller scheduled payments.' },
   { name: 'Bridge refinance', detail: 'Borrower applies with evidence and deposit. New lender pays the old lender.' },
   { name: 'Manual resolution', detail: 'Waive, reporting error, dispute, keep blocked, or admin-only note.' }
];

const loanRequests: LoanRequest[] = [
   {
      id: 'loan-request-1',
      borrower: 'SpamLoan420',
      amount: '$250',
      status: 'reported',
      reason: 'Looks like scam request and has two user reports.',
      evidence: '2 reports, suspicious external payment language',
      posted: 'May 5, 2026'
   },
   {
      id: 'loan-request-2',
      borrower: 'MaybeDuplicate123',
      amount: '$80',
      status: 'needs review',
      reason: 'Possible duplicate request from same wallet pattern.',
      evidence: 'Duplicate wallet signal and repeated amount pattern',
      posted: 'May 5, 2026'
   },
   {
      id: 'loan-request-3',
      borrower: 'LateButResponsive',
      amount: '$35',
      status: 'visible',
      reason: 'Normal request. Keep visible unless a new report arrives.',
      evidence: 'No reports, prior late repayment resolved with support',
      posted: 'May 4, 2026'
   }
];

const noticeTemplates: NoticeTemplate[] = [
   {
      id: 'borrower-blocked',
      audience: 'borrower',
      title: 'Action needed on your account',
      body: 'Your borrowing is paused because a loan is overdue. Repay now or contact support to request recovery mode.'
   },
   {
      id: 'borrower-plan',
      audience: 'borrower',
      title: 'Payment plan confirmed',
      body: 'Your overdue repayment has been split into scheduled payments. Borrowing stays paused until the plan is complete.'
   },
   {
      id: 'lender-missed',
      audience: 'lender',
      title: 'Loan repayment missed',
      body: 'A borrower missed repayment. Our team is contacting the borrower and reviewing recovery options.'
   },
   {
      id: 'candidate-bridge',
      audience: 'candidate_lender',
      title: 'Bridge recovery opportunity',
      body: 'A borrower has submitted recovery evidence and a deposit. If approved, your bridge loan is routed to the original lender.'
   }
];

function statusClasses(status: AccountStatus | string) {
   if (status === 'banned' || status === 'Blocked') return 'bg-red-100 text-red-800';
   if (status === 'watchlist' || status === 'needs review' || status === 'reported') return 'bg-amber-100 text-amber-800';
   return 'bg-emerald-100 text-emerald-800';
}

function riskClasses(risk: RiskLevel) {
   if (risk === 'high') return 'bg-red-100 text-red-800';
   if (risk === 'medium') return 'bg-amber-100 text-amber-800';
   return 'bg-emerald-100 text-emerald-800';
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
   return <span className={`inline-flex rounded-full px-4 py-2 text-sm font-black uppercase tracking-wide ${className}`}>{children}</span>;
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

function EmptyOrError({ message }: { message: string }) {
   return <div className="rounded-3xl border border-[#eadff8] bg-white p-6 text-lg font-bold text-[#6f627e]">{message}</div>;
}

function directoryFromSupabase(users: AdminDirectoryUser[]): DirectoryRow[] {
   return users.map((user) => ({
      id: user.id,
      username: user.username ?? 'Unnamed user',
      wallet: user.wallet_address ?? 'No wallet on file',
      role: 'borrower',
      status: 'active',
      risk: 'medium',
      note: 'Live Supabase user. Review account details before taking action.',
      evidence: 'Loaded from Supabase user directory.',
      adminNote: 'No scaffold note attached yet.'
   }));
}

export default function AdminPanel() {
   const reduxUser = useSelector((state: RootState) => state.auth.user);
   const [activeTab, setActiveTab] = useState<AdminTab>('users');
   const [admin, setAdmin] = useState<AdminUser | null>(null);
   const [overview, setOverview] = useState<AdminOverview | null>(null);
   const [users, setUsers] = useState<AdminDirectoryUser[]>([]);
   const [search, setSearch] = useState('');
   const [roleFilter, setRoleFilter] = useState<'all' | PersonRole>('all');
   const [selectedUserId, setSelectedUserId] = useState(scaffoldUsers[0].id);
   const [selectedDefaultCaseId, setSelectedDefaultCaseId] = useState(defaultCases[0].id);
   const [selectedRecoveryPathName, setSelectedRecoveryPathName] = useState(recoveryPaths[0].name);
   const [selectedRequestId, setSelectedRequestId] = useState(loanRequests[0].id);
   const [selectedTemplateId, setSelectedTemplateId] = useState(noticeTemplates[0].id);
   const [noticeUsername, setNoticeUsername] = useState('');
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);

   const currentAdminName = useMemo(() => admin?.display_name ?? reduxUser?.username ?? 'Cookiemonster admin', [admin?.display_name, reduxUser?.username]);
   const adminInitial = currentAdminName.trim().charAt(0).toUpperCase() || 'C';
   const directoryRows = users.length ? directoryFromSupabase(users) : scaffoldUsers;
   const filteredDirectory = directoryRows.filter((user) => roleFilter === 'all' || user.role === roleFilter);
   const selectedUser = directoryRows.find((user) => user.id === selectedUserId) ?? filteredDirectory[0] ?? scaffoldUsers[0];
   const selectedDefaultCase = defaultCases.find((item) => item.id === selectedDefaultCaseId) ?? defaultCases[0];
   const selectedRecoveryPath = recoveryPaths.find((path) => path.name === selectedRecoveryPathName) ?? recoveryPaths[0];
   const selectedRequest = loanRequests.find((request) => request.id === selectedRequestId) ?? loanRequests[0];
   const selectedTemplate = noticeTemplates.find((template) => template.id === selectedTemplateId) ?? noticeTemplates[0];

   async function refresh(searchValue = search) {
      const [nextOverview, nextUsers] = await Promise.all([getAdminOverview(), listAdminDirectoryUsers(searchValue)]);
      setOverview(nextOverview);
      setUsers(nextUsers);
      if (nextUsers[0]) setSelectedUserId(nextUsers[0].id);
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

   async function handleBan(username: string) {
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

   if (loading) {
      return <main className="min-h-screen bg-[#120429] p-8 text-xl font-black text-white">Checking admin access...</main>;
   }

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
         <div className="grid min-h-screen lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <aside className="overflow-hidden bg-[#120429] p-6 text-white sm:p-8 lg:sticky lg:top-0 lg:h-screen">
               <div className="flex min-w-0 items-center gap-4">
                  <a href="/account/settings" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#8336f0] text-3xl font-black text-white no-underline focus:outline focus:outline-4 focus:outline-offset-4 focus:outline-purple-200 sm:h-20 sm:w-20 sm:text-4xl" title="Account settings">
                     {adminInitial}
                  </a>
                  <div className="min-w-0">
                     <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-200">Admin panel</p>
                     <h1 className="mt-1 max-w-full break-words text-2xl font-black leading-tight sm:text-3xl">{currentAdminName}</h1>
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
                  <strong className="mt-2 block break-words text-2xl font-black">{currentAdminName}</strong>
                  <p className="mt-2 text-lg text-purple-200">Owner access</p>
               </div>
            </aside>

            <section className="min-w-0 p-5 sm:p-8 lg:p-10">
               {error ? <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-lg font-bold text-red-800">{error}</div> : null}
               {statusMessage ? <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-lg font-bold text-emerald-800">{statusMessage}</div> : null}

               {activeTab === 'users' ? (
                  <section className="space-y-6">
                     <div>
                        <h2 className="break-words text-4xl font-black tracking-normal sm:text-5xl">User directory</h2>
                        <p className="mt-3 max-w-3xl text-2xl text-[#6f627e]">Search every borrower and lender, then manage the selected account directly under that person.</p>
                     </div>

                     <form onSubmit={handleSearch} className="rounded-3xl border border-[#eadff8] bg-white p-5 shadow-sm">
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users, wallets, lenders, loan requests" className="h-16 w-full rounded-2xl border border-[#ded0ef] px-6 text-2xl text-[#1c053d]" />
                        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#ded0ef] text-center text-xl font-black">
                           {(['all', 'borrower', 'lender'] as const).map((role) => (
                              <button key={role} type="button" onClick={() => setRoleFilter(role)} className={`py-4 capitalize ${roleFilter === role ? 'bg-[#8336f0] text-white' : 'bg-white text-[#6f627e]'}`}>
                                 {role === 'all' ? 'Everyone' : `${role}s`}
                              </button>
                           ))}
                        </div>
                     </form>

                     <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="All users" value={directoryRows.length} note="Total accounts" />
                        <StatCard label="Needs review" value={overview?.recoveryReviewCount ?? 0} note="Open items" />
                        <StatCard label="Defaults" value={overview?.defaultedLoanCount ?? defaultCases.length} note="Borrowing paused" />
                        <StatCard label="Loan requests" value={overview?.loanRequestReviewCount ?? loanRequests.length} note="Request queue" />
                     </div>

                     <div className="overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                        {filteredDirectory.map((user) => (
                           <article key={user.id} className="border-b border-[#eadff8] last:border-b-0">
                              <div className="grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                                 <div className="flex gap-4">
                                    <button type="button" onClick={() => setSelectedUserId(user.id)} className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#8336f0] text-2xl font-black text-white">
                                       {user.username.charAt(0).toUpperCase()}
                                    </button>
                                    <div>
                                       <button type="button" onClick={() => setSelectedUserId(user.id)} className="text-left text-3xl font-black underline decoration-2 underline-offset-4">
                                          {user.username}
                                       </button>
                                       <div className="mt-3 flex flex-wrap gap-3">
                                          <Badge className="bg-purple-100 text-purple-800">{user.role}</Badge>
                                          <Badge className={statusClasses(user.status)}>{user.status}</Badge>
                                          <Badge className={riskClasses(user.risk)}>{user.risk} risk</Badge>
                                       </div>
                                       <p className="mt-3 text-xl text-[#6f627e]">{user.wallet} · {user.note}</p>
                                    </div>
                                 </div>
                                 <button type="button" onClick={() => setSelectedUserId(user.id)} className="rounded-2xl bg-[#34234f] px-6 py-4 text-xl font-black text-white">
                                    Manage
                                 </button>
                              </div>
                              {selectedUser?.id === user.id ? (
                                 <div className="border-t border-[#eadff8] bg-[#fbf8ff] p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                       <h3 className="text-3xl font-black">Selected account</h3>
                                       <button type="button" onClick={() => setSelectedUserId('')} className="rounded-full border border-[#ded0ef] bg-white px-5 py-3 text-lg font-black text-[#6b21a8]">Collapse</button>
                                    </div>
                                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                                       <div className="rounded-2xl border border-[#eadff8] bg-white p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Name</p><strong className="mt-2 block text-3xl">{user.username}</strong></div>
                                       <div className="rounded-2xl border border-[#eadff8] bg-white p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Wallet</p><strong className="mt-2 block text-3xl">{user.wallet}</strong></div>
                                       <div className="rounded-2xl border border-[#eadff8] bg-white p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Evidence</p><strong className="mt-2 block text-2xl">{user.evidence}</strong></div>
                                       <div className="rounded-2xl border border-[#eadff8] bg-white p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Admin note</p><strong className="mt-2 block text-2xl">{user.adminNote}</strong></div>
                                    </div>
                                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                       <a href={`/user/${encodeURIComponent(user.username)}`} className="rounded-2xl bg-[#34234f] px-5 py-4 text-center text-xl font-black text-white no-underline">Open dashboard</a>
                                       <button type="button" onClick={() => { setNoticeUsername(user.username); setActiveTab('notifications'); }} className="rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white">Send notification</button>
                                       <button type="button" onClick={() => handleBan(user.username)} className="rounded-2xl bg-red-600 px-5 py-4 text-xl font-black text-white">Ban account</button>
                                    </div>
                                 </div>
                              ) : null}
                           </article>
                        ))}
                        {!filteredDirectory.length ? <EmptyOrError message="No users match these filters." /> : null}
                     </div>
                  </section>
               ) : null}

               {activeTab === 'defaults' ? (
                  <section className="space-y-6">
                     <div><h2 className="break-words text-4xl font-black sm:text-5xl">Default recovery</h2><p className="mt-3 text-2xl text-[#6f627e]">Pick a defaulted loan, then choose a recovery path.</p></div>
                     <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                        <div className="overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                           {defaultCases.map((item) => (
                              <button
                                 key={item.id}
                                 type="button"
                                 onClick={() => setSelectedDefaultCaseId(item.id)}
                                 className={`block w-full border-b border-[#eadff8] p-6 text-left last:border-b-0 ${
                                    selectedDefaultCaseId === item.id ? 'bg-[#fbf8ff]' : 'bg-white'
                                 }`}
                              >
                                 <div className="flex items-start justify-between gap-4">
                                    <div><h3 className="text-3xl font-black">{item.borrower}</h3><p className="mt-2 text-xl text-[#6f627e]">Defaulted to {item.lender} · due {item.due}</p></div>
                                    <strong className="text-4xl font-black">{item.amount}</strong>
                                 </div>
                                 <Badge className={`mt-4 ${statusClasses(item.status)}`}>{item.status}</Badge>
                                 <p className="mt-4 text-xl text-[#6f627e]">{item.summary}</p>
                              </button>
                           ))}
                        </div>
                        <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                           <h3 className="text-3xl font-black">Choose recovery path</h3>
                           <div className="mt-5 grid gap-4">
                              {recoveryPaths.map((path) => (
                                 <button
                                    key={path.name}
                                    type="button"
                                    onClick={() => setSelectedRecoveryPathName(path.name)}
                                    className={`rounded-2xl border p-5 text-left transition ${
                                       selectedRecoveryPathName === path.name
                                          ? 'border-[#8336f0] bg-[#f4edff] shadow-[0_0_0_3px_rgba(131,54,240,0.12)]'
                                          : 'border-[#ded0ef] bg-[#fbf8ff] hover:border-[#8336f0]'
                                    }`}
                                 >
                                    <span className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-black uppercase tracking-wide text-[#8336f0]">
                                       {selectedRecoveryPathName === path.name ? 'Selected' : 'Choose'}
                                    </span>
                                    <strong className="block text-2xl font-black">{path.name}</strong>
                                    <span className="mt-2 block text-lg text-[#6f627e]">{path.detail}</span>
                                 </button>
                              ))}
                           </div>
                           <div className="mt-5 rounded-3xl border border-[#eadff8] bg-[#fbf8ff] p-5">
                              <p className="text-sm font-black uppercase tracking-wide text-[#6f627e]">Current selection</p>
                              <h4 className="mt-2 text-2xl font-black">{selectedRecoveryPath.name}</h4>
                              <p className="mt-2 text-lg text-[#6f627e]">
                                 Apply to {selectedDefaultCase.borrower}'s {selectedDefaultCase.amount} default with {selectedDefaultCase.lender}.
                              </p>
                              <div className="mt-5 grid gap-3">
                                 <button
                                    type="button"
                                    onClick={() => {
                                       setNoticeUsername(selectedDefaultCase.borrower);
                                       setSelectedTemplateId(selectedRecoveryPath.name === 'Payment plan' ? 'borrower-plan' : 'borrower-blocked');
                                       setActiveTab('notifications');
                                    }}
                                    className="rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white"
                                 >
                                    Prepare borrower notice
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => setStatusMessage(`${selectedRecoveryPath.name} selected for ${selectedDefaultCase.borrower}. Backend recovery action still needs approval wiring.`)}
                                    className="rounded-2xl border border-[#ded0ef] bg-white px-5 py-4 text-xl font-black text-[#34234f]"
                                 >
                                    Mark path selected
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                  </section>
               ) : null}

               {activeTab === 'requests' ? (
                  <section className="space-y-6">
                     <div><h2 className="break-words text-4xl font-black sm:text-5xl">Delete loan requests</h2><p className="mt-3 text-2xl text-[#6f627e]">Review requests in a clean list. Expand one at a time before deleting.</p></div>
                     <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                        <div className="overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                           {loanRequests.map((request) => (
                              <button key={request.id} type="button" onClick={() => setSelectedRequestId(request.id)} className={`block w-full border-b border-[#eadff8] p-6 text-left last:border-b-0 ${selectedRequestId === request.id ? 'bg-[#fbf8ff]' : 'bg-white'}`}>
                                 <div className="flex items-center justify-between gap-4"><h3 className="text-3xl font-black underline underline-offset-4">{request.borrower}</h3><strong className="text-3xl">{request.amount}</strong></div>
                                 <div className="mt-3 flex flex-wrap gap-3"><Badge className="bg-purple-100 text-purple-800">borrower</Badge><Badge className={statusClasses(request.status)}>{request.status}</Badge></div>
                                 <p className="mt-3 text-xl text-[#6f627e]">{request.reason}</p>
                              </button>
                           ))}
                        </div>
                        <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                           <h3 className="text-3xl font-black">Request detail</h3>
                           <p className="mt-2 text-xl text-[#6f627e]">Delete only with a clear reason.</p>
                           <div className="mt-5 grid gap-4">
                              <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Borrower</p><strong className="mt-2 block text-3xl underline">{selectedRequest.borrower}</strong></div>
                              <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Request reason</p><strong className="mt-2 block text-2xl">{selectedRequest.reason}</strong></div>
                              <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Evidence</p><strong className="mt-2 block text-2xl">{selectedRequest.evidence}</strong></div>
                              <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Posted</p><strong className="mt-2 block text-2xl">{selectedRequest.posted}</strong></div>
                           </div>
                           <button type="button" className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-4 text-xl font-black text-white">Delete request</button>
                           <button type="button" className="mt-3 w-full rounded-2xl border border-[#ded0ef] bg-white px-5 py-4 text-xl font-black text-[#34234f]">Leave visible</button>
                        </div>
                     </div>
                  </section>
               ) : null}

               {activeTab === 'risk' ? (
                  <section className="space-y-6">
                     <div><h2 className="break-words text-4xl font-black sm:text-5xl">Risk assessment</h2><p className="mt-3 text-2xl text-[#6f627e]">A place for the scoring algorithm and the plain-English reasons behind each account risk.</p></div>
                     <div className="grid gap-5 xl:grid-cols-2">
                        {scaffoldUsers.map((user) => (
                           <article key={user.id} className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                              <div className="flex items-start justify-between gap-3"><h3 className="text-3xl font-black">{user.username}</h3><Badge className={riskClasses(user.risk)}>{user.risk} risk</Badge></div>
                              <p className="mt-4 text-xl text-[#6f627e]">{user.note}</p>
                              <div className="mt-5 rounded-2xl bg-[#fbf8ff] p-5"><p className="text-sm font-black uppercase text-[#6f627e]">Risk factors</p><strong className="mt-2 block text-2xl">{user.evidence}</strong></div>
                           </article>
                        ))}
                     </div>
                  </section>
               ) : null}

               {activeTab === 'notifications' ? (
                  <section className="space-y-6">
                     <div><h2 className="break-words text-4xl font-black sm:text-5xl">Notifications</h2><p className="mt-3 text-2xl text-[#6f627e]">Choose users and send notifications. These show on their screen when they open Moodeng.</p></div>
                     <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                        <div className="grid gap-4">
                           {noticeTemplates.map((template) => (
                              <button key={template.id} type="button" onClick={() => setSelectedTemplateId(template.id)} className={`rounded-3xl border p-6 text-left shadow-sm ${selectedTemplateId === template.id ? 'border-[#8336f0] bg-[#fbf8ff]' : 'border-[#eadff8] bg-white'}`}>
                                 <Badge className="bg-purple-100 text-purple-800">{template.audience.replace('_', ' ')}</Badge>
                                 <h3 className="mt-4 text-3xl font-black">{template.title}</h3>
                                 <p className="mt-3 text-xl text-[#6f627e]">{template.body}</p>
                              </button>
                           ))}
                        </div>
                        <form onSubmit={handleSendNotice} className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                           <h3 className="text-3xl font-black">Send notification</h3>
                           <p className="mt-2 text-xl text-[#6f627e]">Selected: {selectedTemplate.title}</p>
                           <input value={noticeUsername} onChange={(event) => setNoticeUsername(event.target.value)} placeholder="Username" className="mt-5 h-16 w-full rounded-2xl border border-[#ded0ef] px-5 text-2xl" />
                           <div className="mt-5 rounded-3xl border border-[#eadff8] bg-[#fbf8ff] p-5">
                              <Badge className="bg-purple-100 text-purple-800">{selectedTemplate.audience.replace('_', ' ')}</Badge>
                              <h4 className="mt-4 text-3xl font-black">{selectedTemplate.title}</h4>
                              <p className="mt-3 text-xl text-[#6f627e]">{selectedTemplate.body}</p>
                           </div>
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
