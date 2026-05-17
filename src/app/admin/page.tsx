'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';

import {
   type AdminDefaultCase,
   type AdminDirectoryUser,
   type AdminIntegrityRun,
   type AdminLoanRequest,
   type AdminOverview,
   type AdminUser,
   getAdminOverview,
   getCurrentAdmin,
   getLatestAdminIntegrityRun,
   listAdminDefaultCases,
   listAdminDirectoryUsers,
   listAdminLoanRequests,
   logAdminAction,
   type NoticeAudience,
   type RecoveryPath,
   saveDefaultRecoveryPlan,
   sendNoticeToUsername,
   upsertAccountRestrictionByUserId,
   upsertLoanRequestReview
} from './adminSupabase';
import RiskAssessmentSection from './RiskAssessmentSection';

type AdminTab = 'users' | 'defaults' | 'requests' | 'risk' | 'notifications';
type PersonRole = 'all' | 'borrower' | 'lender' | 'unset';

type NoticeTemplate = {
   id: string;
   audience: Exclude<NoticeAudience, 'admin'>;
   title: string;
   body: string;
};

const navItems: Array<{ id: AdminTab; label: string }> = [
   { id: 'users', label: 'User directory' },
   { id: 'defaults', label: 'Default recovery' },
   { id: 'requests', label: 'Loan request review' },
   { id: 'risk', label: 'Risk assessment' },
   { id: 'notifications', label: 'Notifications' }
];

const recoveryPaths: Array<{ name: RecoveryPath; label: string; detail: string }> = [
   { name: 'repay_now', label: 'Repay now', detail: 'Keep the account paused and direct the borrower to repay or contact support.' },
   { name: 'extension', label: 'Extend loan', detail: 'Record a possible extension path for the same lender and borrower.' },
   { name: 'payment_plan', label: 'Payment plan', detail: 'Record smaller scheduled repayments for the borrower to complete.' },
   { name: 'bridge_loan', label: 'Bridge refinance', detail: 'Record a recovery path where a new lender helps resolve the old lender.' },
   { name: 'manual', label: 'Manual resolution', detail: 'Use this for disputes, waivers, reporting errors, or team-only notes.' }
];

const noticeTemplates: NoticeTemplate[] = [
   {
      id: 'borrower-overdue',
      audience: 'borrower',
      title: 'Action needed on your loan',
      body: 'A repayment is overdue. Please repay now or message Moodeng Credit support so we can help review the next step.'
   },
   {
      id: 'borrower-payment-plan',
      audience: 'borrower',
      title: 'Payment plan update',
      body: 'Your repayment plan has been reviewed. Borrowing stays paused until the overdue repayment is resolved.'
   },
   {
      id: 'lender-overdue',
      audience: 'lender',
      title: 'Repayment support update',
      body: 'A loan you funded is overdue. The Moodeng team is reviewing the borrower account and recovery options.'
   },
   {
      id: 'candidate-bridge',
      audience: 'candidate_lender',
      title: 'Recovery funding review',
      body: 'A borrower may need bridge support. Review the borrower details carefully before deciding whether to help.'
   }
];

function badgeTone(value: string) {
   if (['banned', 'blocked', 'deleted', 'high', 'overdue', 'needs_review'].includes(value)) return 'bg-red-100 text-red-800';
   if (['watchlist', 'reported', 'duplicate', 'medium', 'Partial'].includes(value)) return 'bg-amber-100 text-amber-900';
   if (['active', 'kept', 'low', 'Paid', 'ACTIVE'].includes(value)) return 'bg-emerald-100 text-emerald-800';
   if (['lender', 'Lent'].includes(value)) return 'bg-blue-100 text-blue-800';
   return 'bg-purple-100 text-purple-800';
}

function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: string }) {
   return (
      <span className={`inline-flex rounded-full px-4 py-2 text-sm font-black uppercase tracking-wide ${badgeTone(tone)}`}>{children}</span>
   );
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

function DirectoryMetric({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: string }) {
   return (
      <div
         className={`rounded-2xl border p-4 ${tone === 'danger' ? 'border-red-200 bg-red-50' : tone === 'warning' ? 'border-amber-200 bg-amber-50' : tone === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-[#eadff8] bg-[#fbf8ff]'}`}
      >
         <p className="text-xs font-black uppercase tracking-wide text-[#6f627e]">{label}</p>
         <strong className="mt-1 block break-words text-lg font-black text-[#1c053d]">{value}</strong>
      </div>
   );
}

function EmptyPanel({ message }: { message: string }) {
   return <div className="rounded-3xl border border-[#eadff8] bg-white p-6 text-lg font-bold text-[#6f627e]">{message}</div>;
}

function formatMoney(value: number | null | undefined) {
   const amount = Number(value ?? 0);
   return amount.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
   });
}

function formatDate(value: string | null | undefined) {
   if (!value) return 'No date';
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return 'No date';
   return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined) {
   if (!value) return 'Never checked';
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return 'Never checked';
   return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function shortWallet(wallet: string | null | undefined) {
   if (!wallet) return 'No wallet';
   if (wallet.length <= 14) return wallet;
   return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function walletLabel(user: AdminDirectoryUser) {
   if (!user.wallet_address) return 'No wallet saved';
   return user.wallet_provider ?? user.wallet_connector_name ?? 'Wallet saved';
}

function statusTone(user: AdminDirectoryUser): 'danger' | 'warning' | 'success' | 'default' {
   if (user.account_status === 'banned' || user.restriction?.status === 'banned') return 'danger';
   if (user.account_status === 'blocked' || user.restriction?.status === 'watchlist') return 'warning';
   return 'success';
}

function riskTone(user: AdminDirectoryUser) {
   if (user.restriction?.status === 'banned' || user.account_status === 'banned') return 'high';
   if (user.overdueLoanCount > 0 || user.restriction?.status === 'watchlist' || user.account_status === 'blocked') return 'high';
   return user.riskProfile?.risk_level ?? 'low';
}

function requestStatus(request: AdminLoanRequest) {
   return request.review?.status ?? 'visible';
}

function recoveryPathLabel(path: RecoveryPath | null | undefined) {
   return recoveryPaths.find((item) => item.name === path)?.label ?? 'Not selected';
}

function roleLabel(role: AdminDirectoryUser['user_role']) {
   return role === 'unset' ? 'no role' : role;
}

export default function AdminPanel() {
   const reduxUser = useSelector((state: RootState) => state.auth.user);
   const [activeTab, setActiveTab] = useState<AdminTab>('users');
   const [admin, setAdmin] = useState<AdminUser | null>(null);
   const [overview, setOverview] = useState<AdminOverview | null>(null);
   const [integrityRun, setIntegrityRun] = useState<AdminIntegrityRun | null>(null);
   const [users, setUsers] = useState<AdminDirectoryUser[]>([]);
   const [defaultCases, setDefaultCases] = useState<AdminDefaultCase[]>([]);
   const [loanRequests, setLoanRequests] = useState<AdminLoanRequest[]>([]);
   const [search, setSearch] = useState('');
   const [roleFilter, setRoleFilter] = useState<PersonRole>('all');
   const [selectedUserId, setSelectedUserId] = useState('');
   const [selectedDefaultCaseId, setSelectedDefaultCaseId] = useState('');
   const [selectedRecoveryPath, setSelectedRecoveryPath] = useState<RecoveryPath>('repay_now');
   const [recoveryNote, setRecoveryNote] = useState('');
   const [selectedRequestId, setSelectedRequestId] = useState('');
   const [requestReviewNote, setRequestReviewNote] = useState('Reviewed from the admin panel.');
   const [selectedTemplateId, setSelectedTemplateId] = useState(noticeTemplates[0].id);
   const [noticeUsername, setNoticeUsername] = useState('');
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);
   const [adminDataLoading, setAdminDataLoading] = useState(false);
   const [adminDataLoaded, setAdminDataLoaded] = useState(false);

   const currentAdminName = useMemo(
      () => admin?.display_name ?? reduxUser?.username ?? 'Moodeng admin',
      [admin?.display_name, reduxUser?.username]
   );
   const adminInitial = currentAdminName.trim().charAt(0).toUpperCase() || 'M';
   const filteredDirectory = users.filter((user) => roleFilter === 'all' || user.user_role === roleFilter);
   const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
   const selectedDefaultCase = defaultCases.find((item) => item.id === selectedDefaultCaseId) ?? defaultCases[0] ?? null;
   const selectedRequest = loanRequests.find((request) => request.id === selectedRequestId) ?? loanRequests[0] ?? null;
   const selectedTemplate = noticeTemplates.find((template) => template.id === selectedTemplateId) ?? noticeTemplates[0];
   const suggestedNoticeUsers = users
      .filter((user) =>
         selectedTemplate.audience === 'candidate_lender' ? user.user_role === 'lender' : user.user_role === selectedTemplate.audience
      )
      .slice(0, 8);
   const noticeSearch = noticeUsername.trim().toLowerCase();
   const noticeRecipientRows = (noticeSearch ? users : suggestedNoticeUsers)
      .filter((user) => {
         if (!noticeSearch) return true;
         return `${user.username} ${user.wallet_address ?? ''} ${user.email ?? ''}`.toLowerCase().includes(noticeSearch);
      })
      .slice(0, 8);

   async function refresh(searchValue = search, options: { showLoading?: boolean } = {}) {
      if (options.showLoading) setAdminDataLoading(true);
      setError(null);

      try {
         const [nextOverview, nextIntegrityRun, nextUsers, nextDefaults, nextLoanRequests] = await Promise.all([
            getAdminOverview(),
            getLatestAdminIntegrityRun(),
            listAdminDirectoryUsers(searchValue),
            listAdminDefaultCases(),
            listAdminLoanRequests()
         ]);

         setOverview(nextOverview);
         setIntegrityRun(nextIntegrityRun);
         setUsers(nextUsers);
         setDefaultCases(nextDefaults);
         setLoanRequests(nextLoanRequests);
         setAdminDataLoaded(true);
         setSelectedDefaultCaseId((current) => current || nextDefaults[0]?.id || '');
         setSelectedRequestId((current) => current || nextLoanRequests[0]?.id || '');
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not load live admin data.');
      } finally {
         if (options.showLoading) setAdminDataLoading(false);
      }
   }

   useEffect(() => {
      let alive = true;

      async function load() {
         try {
            setLoading(true);
            const currentAdmin = await getCurrentAdmin(reduxUser?.id);
            if (!alive) return;

            setAdmin(currentAdmin);
            setLoading(false);
            if (currentAdmin) {
               await refresh('', { showLoading: true });
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
      await refresh(search, { showLoading: true });
   }

   async function handleWatchlistUser(user: AdminDirectoryUser, severity: 'watchlist' | 'ban_review') {
      setError(null);
      setStatusMessage(null);

      try {
         await upsertAccountRestrictionByUserId({
            user_id: user.id,
            status: 'watchlist',
            reason: severity === 'ban_review' ? 'manual' : user.overdueLoanCount > 0 ? 'default' : 'manual',
            risk_level: severity === 'ban_review' || user.overdueLoanCount > 0 ? 'high' : 'medium',
            evidence_summary:
               severity === 'ban_review'
                  ? 'Flagged for ban review. No ban was applied.'
                  : `${user.overdueLoanCount} overdue loans; ${formatMoney(user.outstandingDue)} outstanding.`,
            admin_note: severity === 'ban_review' ? `Ban review requested by ${currentAdminName}.` : `Watchlisted by ${currentAdminName}.`,
            updated_by: admin?.user_id ?? reduxUser?.id ?? null
         });
         await logAdminAction({
            action: severity === 'ban_review' ? 'ban_review_flagged' : 'account_watchlisted',
            target_table: 'admin_account_restrictions',
            target_user_id: user.id,
            metadata: { username: user.username, source: 'live_admin_panel' }
         });
         setStatusMessage(`${user.username} was flagged for review. No ban was applied.`);
         await refresh(search);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not update this user.');
      }
   }

   async function handleClearRestriction(user: AdminDirectoryUser) {
      setError(null);
      setStatusMessage(null);

      try {
         await upsertAccountRestrictionByUserId({
            user_id: user.id,
            status: 'active',
            reason: 'manual',
            risk_level: 'low',
            evidence_summary: 'Restriction cleared from live admin panel.',
            admin_note: `Cleared by ${currentAdminName}.`,
            updated_by: admin?.user_id ?? reduxUser?.id ?? null
         });
         setStatusMessage(`${user.username} restriction cleared.`);
         await refresh(search);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not clear this user.');
      }
   }

   async function handleLoanRequestAction(action: 'keep' | 'remove_review') {
      if (!selectedRequest) return;
      setError(null);
      setStatusMessage(null);

      const nextStatus = action === 'keep' ? 'kept' : 'deleted';

      try {
         await upsertLoanRequestReview({
            loan_id: selectedRequest.id,
            borrower_user_id: selectedRequest.borrower_user_id,
            status: nextStatus,
            reason: action === 'keep' ? 'manual' : 'unsafe',
            risk_level: action === 'keep' ? 'low' : 'high',
            evidence_summary:
               action === 'keep' ? 'Admin reviewed and kept visible.' : 'Admin flagged this request for removal. No loan row was deleted.',
            admin_note: requestReviewNote,
            reviewed_by: admin?.user_id ?? reduxUser?.id ?? null
         });
         setStatusMessage(
            action === 'keep'
               ? `${selectedRequest.borrower?.username ?? 'This request'} was reviewed and kept visible.`
               : `${selectedRequest.borrower?.username ?? 'This request'} was flagged for removal review. No loan row was deleted.`
         );
         await refresh(search);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not review this loan request.');
      }
   }

   async function handleSaveRecoveryPath() {
      if (!selectedDefaultCase) return;
      setError(null);
      setStatusMessage(null);

      try {
         await saveDefaultRecoveryPlan({
            item: selectedDefaultCase,
            recovery_path: selectedRecoveryPath,
            note: recoveryNote || `${recoveryPathLabel(selectedRecoveryPath)} selected by ${currentAdminName}.`,
            actor_user_id: admin?.user_id ?? reduxUser?.id ?? null,
            payload: {
               source: 'live_admin_panel',
               amount_due: selectedDefaultCase.amount_due,
               days_late: selectedDefaultCase.days_late
            }
         });
         setStatusMessage(`${recoveryPathLabel(selectedRecoveryPath)} saved for ${selectedDefaultCase.borrower}.`);
         await refresh(search);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not save this recovery path.');
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
               metadata: { source: 'live_admin_panel', case_manager: currentAdminName }
            },
            admin?.user_id ?? reduxUser?.id ?? null
         );
         setStatusMessage(`Notification sent to ${noticeUsername}.`);
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
                  <a
                     href="/account/settings"
                     className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#8336f0] text-3xl font-black text-white no-underline focus:outline focus:outline-4 focus:outline-offset-4 focus:outline-purple-200 sm:h-20 sm:w-20 sm:text-4xl"
                     title="Account settings"
                  >
                     {adminInitial}
                  </a>
                  <div className="min-w-0">
                     <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-200">Live admin panel</p>
                     <h1 className="mt-1 max-w-full break-words text-2xl font-black leading-tight sm:text-3xl">{currentAdminName}</h1>
                     <p className="mt-1 text-lg text-purple-200">Moodeng Credit</p>
                  </div>
               </div>

               <nav className="mt-12 grid gap-4">
                  {navItems.map((item) => (
                     <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`rounded-2xl border px-6 py-5 text-left text-xl font-black ${activeTab === item.id ? 'border-[#8336f0] bg-[#2a1453] text-white' : 'border-transparent text-purple-200 hover:border-[#8336f0] hover:bg-[#20103e]'}`}
                     >
                        {item.label}
                     </button>
                  ))}
               </nav>

               <div className="mt-12 rounded-3xl border border-[#8336f0] bg-[#241044] p-6">
                  <p className="text-lg text-purple-200">Data source</p>
                  <strong className="mt-2 block break-words text-2xl font-black">Supabase live data</strong>
                  <p className="mt-2 text-lg text-purple-200">No scaffold users or mock loans.</p>
               </div>
            </aside>

            <section className="min-w-0 p-5 sm:p-8 lg:p-10">
               {error ? (
                  <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-lg font-bold text-red-800">{error}</div>
               ) : null}
               {statusMessage ? (
                  <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-lg font-bold text-emerald-800">
                     {statusMessage}
                  </div>
               ) : null}
               {integrityRun?.status && integrityRun.status !== 'success' ? (
                  <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-lg font-bold text-amber-900">
                     Daily data check found {integrityRun.issue_count} item{integrityRun.issue_count === 1 ? '' : 's'} to review. Last
                     checked {formatDateTime(integrityRun.created_at)}.
                  </div>
               ) : null}
               {adminDataLoading ? (
                  <div className="mb-5 rounded-3xl border border-purple-200 bg-purple-50 p-5 text-lg font-bold text-purple-900">
                     Loading live Supabase data...
                  </div>
               ) : null}

               {activeTab === 'users' ? (
                  <section className="space-y-6">
                     <div>
                        <h2 className="break-words text-4xl font-black tracking-normal sm:text-5xl">User directory</h2>
                        <p className="mt-3 max-w-3xl text-2xl text-[#6f627e]">
                           Search live borrowers and lenders, review real wallet/account details, and flag accounts for follow-up.
                        </p>
                     </div>

                     <form onSubmit={handleSearch} className="rounded-3xl border border-[#eadff8] bg-white p-5 shadow-sm">
                        <input
                           value={search}
                           onChange={(event) => setSearch(event.target.value)}
                           placeholder="Search users, wallets, emails"
                           className="h-16 w-full rounded-2xl border border-[#ded0ef] px-6 text-2xl text-[#1c053d]"
                        />
                        <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-[#ded0ef] text-center text-lg font-black">
                           {(['all', 'borrower', 'lender', 'unset'] as const).map((role) => (
                              <button
                                 key={role}
                                 type="button"
                                 onClick={() => setRoleFilter(role)}
                                 className={`py-4 capitalize ${roleFilter === role ? 'bg-[#8336f0] text-white' : 'bg-white text-[#6f627e]'}`}
                              >
                                 {role === 'all' ? 'Everyone' : role === 'unset' ? 'No role' : `${role}s`}
                              </button>
                           ))}
                        </div>
                     </form>

                     <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="All users" value={overview?.allUserCount ?? users.length} note="Live account count" />
                        <StatCard label="Open requests" value={overview?.openLoanRequestCount ?? 0} note="Live request board" />
                        <StatCard label="Overdue loans" value={overview?.defaultedLoanCount ?? 0} note="Needs support review" />
                        <StatCard
                           label="Daily check"
                           value={integrityRun?.issue_count ?? 0}
                           note={
                              integrityRun ? `${integrityRun.status} · ${formatDateTime(integrityRun.created_at)}` : 'Waiting for first run'
                           }
                        />
                     </div>

                     <div className="overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                        {!adminDataLoaded ? <EmptyPanel message="Loading user directory from Supabase..." /> : null}
                        {adminDataLoaded
                           ? filteredDirectory.map((user) => (
                                <article key={user.id} className="border-b border-[#eadff8] last:border-b-0">
                                   <div className="grid gap-5 p-6">
                                      <div className="flex flex-wrap items-start justify-between gap-4">
                                         <div className="flex min-w-0 gap-4">
                                            <button
                                               type="button"
                                               onClick={() => setSelectedUserId(user.id)}
                                               className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#8336f0] text-2xl font-black text-white"
                                            >
                                               {user.username.charAt(0).toUpperCase()}
                                            </button>
                                            <div className="min-w-0">
                                               <button
                                                  type="button"
                                                  onClick={() => setSelectedUserId(user.id)}
                                                  className="text-left text-3xl font-black underline decoration-2 underline-offset-4"
                                               >
                                                  {user.username}
                                               </button>
                                               <div className="mt-3 flex flex-wrap gap-3">
                                                  <Badge tone={user.user_role}>{roleLabel(user.user_role)}</Badge>
                                                  <Badge tone={user.account_status}>{user.account_status}</Badge>
                                                  <Badge tone={riskTone(user)}>{riskTone(user)} risk</Badge>
                                                  <Badge tone={user.is_world_id ?? 'INACTIVE'}>
                                                     {user.is_world_id === 'ACTIVE' ? 'verified' : 'not verified'}
                                                  </Badge>
                                                  {user.restriction ? (
                                                     <Badge tone={user.restriction.status}>admin {user.restriction.status}</Badge>
                                                  ) : null}
                                               </div>
                                               <p className="mt-3 break-all text-xl text-[#6f627e]">
                                                  {user.email ?? 'No email'} · {walletLabel(user)} · joined {formatDate(user.created_at)}
                                               </p>
                                            </div>
                                         </div>
                                         <button
                                            type="button"
                                            onClick={() => setSelectedUserId(user.id)}
                                            className="rounded-2xl bg-[#34234f] px-6 py-4 text-xl font-black text-white"
                                         >
                                            Manage
                                         </button>
                                      </div>
                                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                                         <DirectoryMetric
                                            label="Account"
                                            value={user.restriction?.status ?? user.account_status}
                                            tone={statusTone(user)}
                                         />
                                         <DirectoryMetric
                                            label="Wallet"
                                            value={`${shortWallet(user.wallet_address)} · ${user.wallet_chain_id ? `chain ${user.wallet_chain_id}` : walletLabel(user)}`}
                                            tone={user.wallet_address ? 'success' : 'warning'}
                                         />
                                         <DirectoryMetric
                                            label="Borrowed loans"
                                            value={`${user.borrowedLoanCount} total · ${formatMoney(user.totalBorrowedAmount)}`}
                                         />
                                         <DirectoryMetric
                                            label="Active loans"
                                            value={user.activeLoanCount}
                                            tone={user.activeLoanCount > 2 ? 'warning' : 'default'}
                                         />
                                         <DirectoryMetric
                                            label="Paid loans"
                                            value={`${user.paidLoanCount} paid · ${formatMoney(user.totalRepaidAmount)}`}
                                            tone={user.paidLoanCount > 0 ? 'success' : 'default'}
                                         />
                                         <DirectoryMetric
                                            label="Overdue loans"
                                            value={user.overdueLoanCount}
                                            tone={user.overdueLoanCount > 0 ? 'danger' : 'success'}
                                         />
                                         <DirectoryMetric
                                            label="Outstanding"
                                            value={formatMoney(user.outstandingDue)}
                                            tone={user.outstandingDue > 0 ? 'warning' : 'success'}
                                         />
                                         <DirectoryMetric label="Open requests" value={user.openRequestCount} />
                                         <DirectoryMetric
                                            label="Credit metrics"
                                            value={`CS ${user.cs ?? 0} · MAL ${user.mal ?? 0} · NAL ${user.nal ?? 0}`}
                                         />
                                         <DirectoryMetric label="Lender activity" value={`${user.lentLoanCount} funded`} />
                                         <DirectoryMetric
                                            label="Last loan activity"
                                            value={formatDate(user.lastLoanAt ?? user.updated_at)}
                                         />
                                      </div>
                                   </div>
                                   {selectedUser?.id === user.id ? (
                                      <div className="border-t border-[#eadff8] bg-[#fbf8ff] p-6">
                                         <div className="flex flex-wrap items-center justify-between gap-3">
                                            <h3 className="text-3xl font-black">Selected account</h3>
                                            <button
                                               type="button"
                                               onClick={() => setSelectedUserId('')}
                                               className="rounded-full border border-[#ded0ef] bg-white px-5 py-3 text-lg font-black text-[#6b21a8]"
                                            >
                                               Collapse
                                            </button>
                                         </div>
                                         <div className="mt-5 grid gap-4 md:grid-cols-2">
                                            <div className="rounded-2xl border border-[#eadff8] bg-white p-5">
                                               <p className="text-sm font-black uppercase text-[#6f627e]">Name</p>
                                               <strong className="mt-2 block break-words text-3xl">{user.username}</strong>
                                            </div>
                                            <div className="rounded-2xl border border-[#eadff8] bg-white p-5">
                                               <p className="text-sm font-black uppercase text-[#6f627e]">Wallet</p>
                                               <strong className="mt-2 block break-all text-2xl">{shortWallet(user.wallet_address)}</strong>
                                               <p className="mt-2 text-lg font-bold text-[#6f627e]">
                                                  {user.wallet_provider ?? user.wallet_connector_name ?? 'No wallet provider saved'}
                                               </p>
                                            </div>
                                            <div className="rounded-2xl border border-[#eadff8] bg-white p-5">
                                               <p className="text-sm font-black uppercase text-[#6f627e]">Borrower activity</p>
                                               <strong className="mt-2 block text-2xl">
                                                  {user.openRequestCount} open requests · {user.activeLoanCount} active ·{' '}
                                                  {user.paidLoanCount} paid
                                               </strong>
                                            </div>
                                            <div className="rounded-2xl border border-[#eadff8] bg-white p-5">
                                               <p className="text-sm font-black uppercase text-[#6f627e]">Outstanding</p>
                                               <strong className="mt-2 block text-3xl">{formatMoney(user.outstandingDue)}</strong>
                                               <p className="mt-2 text-lg font-bold text-[#6f627e]">
                                                  {user.overdueLoanCount} overdue loans
                                               </p>
                                            </div>
                                            <div className="rounded-2xl border border-[#eadff8] bg-white p-5">
                                               <p className="text-sm font-black uppercase text-[#6f627e]">Credit</p>
                                               <strong className="mt-2 block text-3xl">${user.cs ?? 0}</strong>
                                               <p className="mt-2 text-lg font-bold text-[#6f627e]">
                                                  MAL {user.mal ?? 0} · NAL {user.nal ?? 0}
                                               </p>
                                            </div>
                                            <div className="rounded-2xl border border-[#eadff8] bg-white p-5">
                                               <p className="text-sm font-black uppercase text-[#6f627e]">Admin status</p>
                                               <strong className="mt-2 block text-2xl">
                                                  {user.restriction?.status ?? user.account_status}
                                               </strong>
                                               <p className="mt-2 text-lg font-bold text-[#6f627e]">
                                                  {user.restriction?.admin_note ?? 'No admin restriction note.'}
                                               </p>
                                            </div>
                                         </div>
                                         <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                            <a
                                               href={`/user/${encodeURIComponent(user.username)}`}
                                               className="rounded-2xl bg-[#34234f] px-5 py-4 text-center text-xl font-black text-white no-underline"
                                            >
                                               Open profile
                                            </a>
                                            <button
                                               type="button"
                                               onClick={() => {
                                                  setNoticeUsername(user.username);
                                                  setActiveTab('notifications');
                                               }}
                                               className="rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white"
                                            >
                                               Send notice
                                            </button>
                                            <button
                                               type="button"
                                               onClick={() => handleWatchlistUser(user, 'watchlist')}
                                               className="rounded-2xl bg-amber-500 px-5 py-4 text-xl font-black text-white"
                                            >
                                               Watchlist
                                            </button>
                                            <button
                                               type="button"
                                               onClick={() => handleWatchlistUser(user, 'ban_review')}
                                               className="rounded-2xl bg-red-600 px-5 py-4 text-xl font-black text-white"
                                            >
                                               Flag ban review
                                            </button>
                                            <button
                                               type="button"
                                               onClick={() => handleClearRestriction(user)}
                                               className="rounded-2xl bg-emerald-600 px-5 py-4 text-xl font-black text-white"
                                            >
                                               Clear restriction
                                            </button>
                                         </div>
                                         <p className="mt-3 text-base font-bold text-[#6f627e]">
                                            Flag ban review does not ban anyone. It records an admin review item only.
                                         </p>
                                      </div>
                                   ) : null}
                                </article>
                             ))
                           : null}
                        {adminDataLoaded && !filteredDirectory.length ? <EmptyPanel message="No users match these filters." /> : null}
                     </div>
                  </section>
               ) : null}

               {activeTab === 'defaults' ? (
                  <section className="space-y-6">
                     <div>
                        <h2 className="break-words text-4xl font-black sm:text-5xl">Default recovery</h2>
                        <p className="mt-3 text-2xl text-[#6f627e]">
                           Live overdue loans plus active recovery cases. Saving a path creates or updates a recovery case and audit action.
                        </p>
                     </div>
                     <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="Overdue loans" value={overview?.defaultedLoanCount ?? 0} note="Live from loans" />
                        <StatCard label="Recovery cases" value={overview?.recoveryReviewCount ?? 0} note="Needs review / active" />
                        <StatCard label="Active loans" value={overview?.activeLoanCount ?? 0} note="Funded and unpaid" />
                        <StatCard label="High risk" value={overview?.highRiskProfileCount ?? 0} note="Risk profile rows" />
                     </div>
                     {!defaultCases.length ? <EmptyPanel message="No overdue loans or active recovery cases found." /> : null}
                     {defaultCases.length ? (
                        <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,520px)_minmax(0,1fr)]">
                           <div className="self-start overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                              {defaultCases.map((item) => (
                                 <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                       setSelectedDefaultCaseId(item.id);
                                       setSelectedRecoveryPath(item.recovery_path ?? 'repay_now');
                                       setRecoveryNote(item.admin_note ?? '');
                                    }}
                                    className={`block w-full border-b border-[#eadff8] p-5 text-left transition last:border-b-0 hover:bg-[#fbf8ff] ${
                                       selectedDefaultCase?.id === item.id ? 'bg-[#fbf8ff]' : 'bg-white'
                                    }`}
                                 >
                                    <div className="flex items-start justify-between gap-4">
                                       <div>
                                          <h3 className="text-2xl font-black">{item.borrower}</h3>
                                          <p className="mt-2 text-lg text-[#6f627e]">
                                             Lender: {item.lender} · due {formatDate(item.due_date)}
                                          </p>
                                       </div>
                                       <strong className="text-3xl font-black">{formatMoney(item.amount_due)}</strong>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                       <Badge tone={item.days_late > 0 ? 'overdue' : 'default'}>{item.days_late} days late</Badge>
                                       <Badge tone={item.status}>{item.status.replace('_', ' ')}</Badge>
                                       <Badge tone={item.source}>{item.source === 'overdue_loan' ? 'live loan' : 'recovery case'}</Badge>
                                    </div>
                                    <p className="mt-4 text-lg leading-7 text-[#6f627e]">
                                       {item.evidence_summary ?? item.borrower_explanation ?? 'No admin evidence note yet.'}
                                    </p>
                                 </button>
                              ))}
                           </div>
                           {selectedDefaultCase ? (
                              <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                                 <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                       <h3 className="text-3xl font-black">Recovery plan</h3>
                                       <p className="mt-2 text-lg font-bold text-[#6f627e]">
                                          {selectedDefaultCase.borrower} owes {formatMoney(selectedDefaultCase.amount_due)}.
                                       </p>
                                    </div>
                                    <Badge tone={selectedDefaultCase.status}>{selectedDefaultCase.status.replace('_', ' ')}</Badge>
                                 </div>
                                 <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                    {recoveryPaths.map((path) => (
                                       <button
                                          key={path.name}
                                          type="button"
                                          onClick={() => setSelectedRecoveryPath(path.name)}
                                          className={`rounded-2xl border p-5 text-left transition ${
                                             selectedRecoveryPath === path.name
                                                ? 'border-[#8336f0] bg-[#f4edff] shadow-[0_0_0_3px_rgba(131,54,240,0.12)]'
                                                : 'border-[#ded0ef] bg-[#fbf8ff] hover:border-[#8336f0]'
                                          }`}
                                       >
                                          <span className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-black uppercase tracking-wide text-[#8336f0]">
                                             {selectedRecoveryPath === path.name ? 'Selected' : 'Choose'}
                                          </span>
                                          <strong className="block text-2xl font-black">{path.label}</strong>
                                          <span className="mt-2 block text-lg text-[#6f627e]">{path.detail}</span>
                                       </button>
                                    ))}
                                 </div>
                                 <label className="mt-5 grid gap-2 text-sm font-black uppercase tracking-wide text-[#6f627e]">
                                    Admin note
                                    <textarea
                                       value={recoveryNote}
                                       onChange={(event) => setRecoveryNote(event.target.value)}
                                       className="min-h-28 rounded-2xl border border-[#ded0ef] p-4 text-lg font-bold normal-case tracking-normal text-[#1c053d]"
                                       placeholder="Record the team decision or next step"
                                    />
                                 </label>
                                 <button
                                    type="button"
                                    onClick={handleSaveRecoveryPath}
                                    className="mt-5 w-full rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white"
                                 >
                                    Save recovery plan
                                 </button>
                                 <p className="mt-3 text-base font-bold text-[#6f627e]">
                                    This records the plan and audit action. It does not silently change repayment amounts or send money.
                                 </p>
                              </div>
                           ) : null}
                        </div>
                     ) : null}
                  </section>
               ) : null}

               {activeTab === 'requests' ? (
                  <section className="space-y-6">
                     <div>
                        <h2 className="break-words text-4xl font-black sm:text-5xl">Loan request review</h2>
                        <p className="mt-3 text-2xl text-[#6f627e]">
                           Live open requests from the request board. Review actions write to admin review records.
                        </p>
                     </div>
                     {!loanRequests.length ? <EmptyPanel message="No open loan requests found." /> : null}
                     {loanRequests.length ? (
                        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                           <div className="overflow-hidden rounded-3xl border border-[#eadff8] bg-white shadow-sm">
                              {loanRequests.map((request) => (
                                 <button
                                    key={request.id}
                                    type="button"
                                    onClick={() => setSelectedRequestId(request.id)}
                                    className={`block w-full border-b border-[#eadff8] p-6 text-left last:border-b-0 ${selectedRequest?.id === request.id ? 'bg-[#fbf8ff]' : 'bg-white'}`}
                                 >
                                    <div className="flex items-center justify-between gap-4">
                                       <h3 className="text-3xl font-black underline underline-offset-4">
                                          {request.borrower?.username ?? 'Unknown borrower'}
                                       </h3>
                                       <strong className="text-3xl">{formatMoney(request.loan_amount)}</strong>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-3">
                                       <Badge tone={request.borrower?.user_role ?? 'borrower'}>
                                          {request.borrower?.user_role ?? 'borrower'}
                                       </Badge>
                                       <Badge tone={requestStatus(request)}>{requestStatus(request).replace('_', ' ')}</Badge>
                                       <Badge tone={request.borrower?.is_world_id ?? 'INACTIVE'}>
                                          {request.borrower?.is_world_id === 'ACTIVE' ? 'verified' : 'not verified'}
                                       </Badge>
                                    </div>
                                    <p className="mt-3 text-xl text-[#6f627e]">{request.reason}</p>
                                 </button>
                              ))}
                           </div>
                           {selectedRequest ? (
                              <div className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                                 <h3 className="text-3xl font-black">Request detail</h3>
                                 <p className="mt-2 text-xl text-[#6f627e]">Review clearly. This does not ban the borrower.</p>
                                 <div className="mt-5 grid gap-4">
                                    <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5">
                                       <p className="text-sm font-black uppercase text-[#6f627e]">Borrower</p>
                                       <strong className="mt-2 block text-3xl underline">
                                          {selectedRequest.borrower?.username ?? 'Unknown borrower'}
                                       </strong>
                                    </div>
                                    <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5">
                                       <p className="text-sm font-black uppercase text-[#6f627e]">Terms</p>
                                       <strong className="mt-2 block text-2xl">
                                          {formatMoney(selectedRequest.loan_amount)} request ·{' '}
                                          {formatMoney(selectedRequest.total_repayment_amount)} repay · due{' '}
                                          {formatDate(selectedRequest.due_date)}
                                       </strong>
                                    </div>
                                    <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5">
                                       <p className="text-sm font-black uppercase text-[#6f627e]">Reason</p>
                                       <strong className="mt-2 block text-2xl">{selectedRequest.reason}</strong>
                                    </div>
                                    <div className="rounded-2xl border border-[#eadff8] bg-[#fbf8ff] p-5">
                                       <p className="text-sm font-black uppercase text-[#6f627e]">Posted</p>
                                       <strong className="mt-2 block text-2xl">{formatDate(selectedRequest.created_at)}</strong>
                                    </div>
                                    {selectedRequest.review ? (
                                       <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                                          <p className="text-sm font-black uppercase text-emerald-700">Review status</p>
                                          <strong className="mt-2 block text-2xl text-emerald-800">{selectedRequest.review.status}</strong>
                                       </div>
                                    ) : null}
                                 </div>
                                 <label className="mt-5 grid gap-2 text-sm font-black uppercase tracking-wide text-[#6f627e]">
                                    Review note
                                    <textarea
                                       value={requestReviewNote}
                                       onChange={(event) => setRequestReviewNote(event.target.value)}
                                       className="min-h-28 rounded-2xl border border-[#ded0ef] p-4 text-lg font-bold normal-case tracking-normal text-[#1c053d]"
                                    />
                                 </label>
                                 <button
                                    type="button"
                                    onClick={() => handleLoanRequestAction('remove_review')}
                                    className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-4 text-xl font-black text-white"
                                 >
                                    Flag for removal review
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => handleLoanRequestAction('keep')}
                                    className="mt-3 w-full rounded-2xl border border-[#ded0ef] bg-white px-5 py-4 text-xl font-black text-[#34234f]"
                                 >
                                    Reviewed, keep visible
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => {
                                       setNoticeUsername(selectedRequest.borrower?.username ?? '');
                                       setSelectedTemplateId('borrower-overdue');
                                       setActiveTab('notifications');
                                    }}
                                    className="mt-3 w-full rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white"
                                 >
                                    Notify borrower
                                 </button>
                              </div>
                           ) : null}
                        </div>
                     ) : null}
                  </section>
               ) : null}

               {activeTab === 'risk' ? (
                  <RiskAssessmentSection
                     directoryRows={users}
                     adminDataLoading={adminDataLoading}
                     adminDataLoaded={adminDataLoaded}
                     currentAdminId={admin?.user_id ?? reduxUser?.id ?? null}
                     onSwitchToNotifications={(username) => {
                        setNoticeUsername(username);
                        setActiveTab('notifications');
                     }}
                  />
               ) : null}

               {activeTab === 'notifications' ? (
                  <section className="space-y-6">
                     <div>
                        <h2 className="break-words text-4xl font-black sm:text-5xl">Notifications</h2>
                        <p className="mt-3 text-2xl text-[#6f627e]">
                           Send in-app notices to real users. These appear when they open Moodeng.
                        </p>
                     </div>
                     <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                        <div className="grid gap-4">
                           {noticeTemplates.map((template) => (
                              <button
                                 key={template.id}
                                 type="button"
                                 onClick={() => setSelectedTemplateId(template.id)}
                                 className={`rounded-3xl border p-6 text-left shadow-sm ${selectedTemplateId === template.id ? 'border-[#8336f0] bg-[#fbf8ff]' : 'border-[#eadff8] bg-white'}`}
                              >
                                 <Badge tone={template.audience}>{template.audience.replace('_', ' ')}</Badge>
                                 <h3 className="mt-4 text-3xl font-black">{template.title}</h3>
                                 <p className="mt-3 text-xl text-[#6f627e]">{template.body}</p>
                              </button>
                           ))}
                        </div>
                        <form onSubmit={handleSendNotice} className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                           <h3 className="text-3xl font-black">Send notification</h3>
                           <p className="mt-2 text-xl text-[#6f627e]">Selected: {selectedTemplate.title}</p>
                           <input
                              value={noticeUsername}
                              onChange={(event) => setNoticeUsername(event.target.value)}
                              placeholder="Username"
                              className="mt-5 h-16 w-full rounded-2xl border border-[#ded0ef] px-5 text-2xl"
                           />
                           <div className="mt-4 rounded-3xl border border-[#eadff8] bg-white">
                              <div className="border-b border-[#eadff8] p-4">
                                 <p className="text-sm font-black uppercase tracking-wide text-[#6f627e]">Matching users</p>
                                 <p className="mt-1 text-base font-bold text-[#6f627e]">
                                    Click a person below to fill the username before sending.
                                 </p>
                              </div>
                              <div className="max-h-80 overflow-y-auto">
                                 {noticeRecipientRows.length ? (
                                    noticeRecipientRows.map((user) => (
                                       <button
                                          key={user.id}
                                          type="button"
                                          onClick={() => setNoticeUsername(user.username)}
                                          className={`flex w-full items-start gap-3 border-b border-[#f0e8fb] p-4 text-left last:border-b-0 ${
                                             noticeUsername === user.username ? 'bg-[#fbf8ff]' : 'bg-white hover:bg-[#fbf8ff]'
                                          }`}
                                       >
                                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#8336f0] text-lg font-black text-white">
                                             {user.username.charAt(0).toUpperCase()}
                                          </span>
                                          <span className="min-w-0 flex-1">
                                             <span className="block break-words text-xl font-black text-[#1c053d]">{user.username}</span>
                                             <span className="mt-1 block break-all text-base font-bold text-[#6f627e]">
                                                {shortWallet(user.wallet_address)}
                                             </span>
                                          </span>
                                          <Badge tone={user.user_role}>{roleLabel(user.user_role)}</Badge>
                                       </button>
                                    ))
                                 ) : (
                                    <div className="p-5 text-lg font-bold text-[#6f627e]">
                                       {adminDataLoading && !adminDataLoaded
                                          ? 'Loading matching users from Supabase...'
                                          : 'No matching users found. Check the spelling or search by wallet.'}
                                    </div>
                                 )}
                              </div>
                           </div>
                           <div className="mt-5 rounded-3xl border border-[#eadff8] bg-[#fbf8ff] p-5">
                              <Badge tone={selectedTemplate.audience}>{selectedTemplate.audience.replace('_', ' ')}</Badge>
                              <h4 className="mt-4 text-3xl font-black">{selectedTemplate.title}</h4>
                              <p className="mt-3 text-xl text-[#6f627e]">{selectedTemplate.body}</p>
                           </div>
                           <button className="mt-5 w-full rounded-2xl bg-[#8336f0] px-5 py-4 text-xl font-black text-white">
                              Send notification
                           </button>
                        </form>
                     </div>
                  </section>
               ) : null}
            </section>
         </div>
      </main>
   );
}
