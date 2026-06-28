'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   type DetectionAccount,
   type DetectionLinkType,
   type DetectionOverview,
   type SelfLendingLoan,
   getDetectionOverview
} from './adminSupabase';

const LINK_LABEL: Record<DetectionLinkType, string> = {
   same_wallet_on_loan: 'Same wallet on this loan',
   shared_wallet: 'Shared wallet (history)',
   shared_email: 'Same email',
   shared_ip: 'Same IP',
   shared_subnet: 'Same network block'
};

const STRONG_LINKS: DetectionLinkType[] = ['same_wallet_on_loan', 'shared_wallet', 'shared_email'];

function linkClass(link: DetectionLinkType): string {
   return STRONG_LINKS.includes(link)
      ? 'bg-red-900/50 text-red-300 border border-red-800'
      : 'bg-amber-900/40 text-amber-300 border border-amber-800/70';
}

function splitByRole(accounts: DetectionAccount[]) {
   const borrowers = accounts.filter((a) => a.role === 'borrower');
   const lenders = accounts.filter((a) => a.role === 'lender');
   const other = accounts.filter((a) => a.role !== 'borrower' && a.role !== 'lender');
   return { borrowers, lenders, other };
}

function AccountChip({ account }: { account: DetectionAccount }) {
   return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#241044] px-3 py-1 text-base font-bold text-white">
         {account.username ?? account.user_id.slice(0, 8)}
         {account.whitelisted ? (
            <span className="rounded-full bg-[#1c053d] px-2 py-0.5 text-xs font-black uppercase text-purple-300">
               team
            </span>
         ) : null}
      </span>
   );
}

// Two-column borrower | lender split, the core "who's on each side" view.
function RoleSplit({ accounts }: { accounts: DetectionAccount[] }) {
   const { borrowers, lenders, other } = splitByRole(accounts);
   const bothSides = borrowers.length > 0 && lenders.length > 0;
   return (
      <div className="mt-4">
         {bothSides ? (
            <div className="mb-3 rounded-2xl border border-red-800 bg-red-950/60 px-4 py-2 text-lg font-black text-red-300">
               ⚠ Both a borrower AND a lender in this group — self-lending shape
            </div>
         ) : null}
         <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#241044] p-4">
               <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">
                  Borrowers ({borrowers.length})
               </p>
               <div className="mt-2 flex flex-wrap gap-2">
                  {borrowers.length ? (
                     borrowers.map((a) => <AccountChip key={a.user_id} account={a} />)
                  ) : (
                     <span className="text-base font-bold text-[#6f6385]">none</span>
                  )}
               </div>
            </div>
            <div className="rounded-2xl bg-[#241044] p-4">
               <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">
                  Lenders ({lenders.length})
               </p>
               <div className="mt-2 flex flex-wrap gap-2">
                  {lenders.length ? (
                     lenders.map((a) => <AccountChip key={a.user_id} account={a} />)
                  ) : (
                     <span className="text-base font-bold text-[#6f6385]">none</span>
                  )}
               </div>
            </div>
         </div>
         {other.length ? (
            <div className="mt-3 rounded-2xl bg-[#1c0a3a] p-3">
               <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">
                  Role unset ({other.length})
               </p>
               <div className="mt-2 flex flex-wrap gap-2">
                  {other.map((a) => (
                     <AccountChip key={a.user_id} account={a} />
                  ))}
               </div>
            </div>
         ) : null}
      </div>
   );
}

function LoanCard({ loan }: { loan: SelfLendingLoan }) {
   const strong = loan.strongest === 'strong';
   return (
      <article
         className={`rounded-3xl border bg-[#1c0a3a] p-6 ${strong ? 'border-red-800' : 'border-amber-800/60'}`}
      >
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <h3 className="break-words text-3xl font-black">
                  Loan {loan.tracking_id ?? loan.loan_id.slice(0, 8)}
               </h3>
               <p className="mt-1 text-lg font-bold text-[#a89bb8]">
                  {loan.loan_amount != null ? `${loan.loan_amount} ${loan.coin ?? ''}`.trim() : '—'}
                  {loan.loan_status ? ` · ${loan.loan_status}` : ''}
                  {loan.created_at ? ` · ${new Date(loan.created_at).toLocaleDateString()}` : ''}
               </p>
            </div>
            <span
               className={`rounded-full px-4 py-1 text-base font-black uppercase ${strong ? 'bg-red-900/50 text-red-300' : 'bg-amber-900/50 text-amber-300'}`}
            >
               {strong ? 'Strong link' : 'Circumstantial'}
            </span>
         </div>

         <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#241044] p-4">
               <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">Borrower</p>
               <div className="mt-2">
                  <AccountChip account={loan.borrower} />
               </div>
               {loan.borrower.email ? (
                  <p className="mt-2 break-all text-sm font-bold text-[#6f6385]">{loan.borrower.email}</p>
               ) : null}
            </div>
            <div className="rounded-2xl bg-[#241044] p-4">
               <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">Lender</p>
               <div className="mt-2">
                  <AccountChip account={loan.lender} />
               </div>
               {loan.lender.email ? (
                  <p className="mt-2 break-all text-sm font-bold text-[#6f6385]">{loan.lender.email}</p>
               ) : null}
            </div>
         </div>

         <div className="mt-4">
            <p className="text-sm font-black uppercase tracking-wide text-[#a89bb8]">Linked by</p>
            <div className="mt-2 flex flex-wrap gap-2">
               {loan.links.map((link) => (
                  <span key={link} className={`rounded-full px-3 py-1 text-base font-black ${linkClass(link)}`}>
                     {LINK_LABEL[link]}
                  </span>
               ))}
            </div>
         </div>
      </article>
   );
}

export default function SelfLendingSection() {
   const [data, setData] = useState<DetectionOverview | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         setData(await getDetectionOverview());
      } catch (e) {
         setError(e instanceof Error ? e.message : String(e));
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   // Account clusters where both a borrower and a lender appear — the ones that
   // matter for self-lending. Pure shared things with only one role are demoted.
   const walletClusters = useMemo(() => data?.shared_wallets ?? [], [data]);
   const ipClusters = useMemo(() => data?.shared_ips ?? [], [data]);
   const subnetClusters = useMemo(() => data?.subnet_clusters ?? [], [data]);
   const emailClusters = useMemo(() => data?.email_collisions ?? [], [data]);
   const loans = useMemo(() => data?.self_lending_loans ?? [], [data]);

   return (
      <section className="space-y-6">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <h2 className="break-words text-4xl font-black sm:text-5xl">Self-lending?</h2>
               <p className="mt-3 text-2xl text-[#a89bb8]">
                  Is anyone lending to themselves? Realized self-deals first (a loan whose two sides are
                  linked accounts), then groups of accounts that share a wallet, IP, network block, or
                  email — split into who&apos;s borrowing vs lending.
               </p>
            </div>
            <button
               type="button"
               onClick={load}
               disabled={loading}
               className="rounded-2xl bg-[#1c053d] px-5 py-3 text-lg font-black text-white disabled:opacity-50"
            >
               {loading ? 'Loading…' : 'Refresh'}
            </button>
         </div>

         {error ? (
            <div className="rounded-3xl border border-red-900 bg-red-950/60 p-6 text-2xl font-black text-red-300">
               {error}
            </div>
         ) : null}

         {/* 1. Realized self-lending — actual loans linking two accounts */}
         <div className="space-y-4">
            <h3 className="text-3xl font-black">
               Realized self-lending{' '}
               <span className="text-xl font-bold text-[#a89bb8]">({loans.length})</span>
            </h3>
            {loans.length ? (
               <div className="grid gap-5 xl:grid-cols-2">
                  {loans.map((loan) => (
                     <LoanCard key={loan.loan_id} loan={loan} />
                  ))}
               </div>
            ) : (
               <div className="rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6 text-2xl font-black">
                  {loading ? 'Checking loans…' : 'No loans found where the borrower and lender are linked. 🎉'}
               </div>
            )}
         </div>

         {/* 2. Linked account clusters — borrower vs lender split per shared thing */}
         <ClusterGroup
            title="Shared wallets"
            subtitle="Same wallet on 2+ accounts"
            count={walletClusters.length}
            items={walletClusters.map((c) => ({
               key: c.wallet_address,
               heading: c.wallet_address,
               whitelisted: c.all_whitelisted,
               accounts: c.accounts
            }))}
         />
         <ClusterGroup
            title="Shared emails"
            subtitle="Same canonical email (Gmail dot/plus collapsed)"
            count={emailClusters.length}
            items={emailClusters.map((c) => ({
               key: c.canonical_email,
               heading: c.canonical_email,
               whitelisted: false,
               accounts: c.accounts
            }))}
         />
         <ClusterGroup
            title="Shared IPs"
            subtitle="Same login IP on 2+ accounts"
            count={ipClusters.length}
            items={ipClusters.map((c) => ({
               key: c.ip_hash_short,
               heading: `${c.ip_hash_short}…${c.city ? ` · ${c.city}` : ''}${c.country ? `, ${c.country}` : ''}${c.is_hosting ? ' · datacenter' : ''}`,
               whitelisted: c.all_whitelisted,
               accounts: c.accounts
            }))}
         />
         <ClusterGroup
            title="Shared network blocks"
            subtitle="2+ accounts from the same /24 (IPv6 /48)"
            count={subnetClusters.length}
            items={subnetClusters.map((c) => ({
               key: c.subnet_hash_short,
               heading: `${c.subnet_hash_short}…${c.asn_org ? ` · ${c.asn_org}` : ''}${c.country ? ` · ${c.country}` : ''}`,
               whitelisted: c.all_whitelisted,
               accounts: c.accounts
            }))}
         />
      </section>
   );
}

interface ClusterItem {
   key: string;
   heading: string;
   whitelisted: boolean;
   accounts: DetectionAccount[];
}

function ClusterGroup({
   title,
   subtitle,
   count,
   items
}: {
   title: string;
   subtitle: string;
   count: number;
   items: ClusterItem[];
}) {
   // Sort the "both borrower + lender" groups to the top — those are the leads.
   const sorted = useMemo(() => {
      return [...items].sort((a, b) => {
         const aBoth = splitByRole(a.accounts).borrowers.length > 0 && splitByRole(a.accounts).lenders.length > 0;
         const bBoth = splitByRole(b.accounts).borrowers.length > 0 && splitByRole(b.accounts).lenders.length > 0;
         return Number(bBoth) - Number(aBoth);
      });
   }, [items]);

   return (
      <div className="space-y-4">
         <h3 className="text-3xl font-black">
            {title} <span className="text-xl font-bold text-[#a89bb8]">({count})</span>
         </h3>
         <p className="-mt-2 text-lg font-bold text-[#a89bb8]">{subtitle}</p>
         {sorted.length ? (
            <div className="space-y-4">
               {sorted.map((item) => (
                  <article key={item.key} className="rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6">
                     <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="break-all text-xl font-black text-white">{item.heading}</code>
                        {item.whitelisted ? (
                           <span className="rounded-full bg-[#1c053d] px-3 py-1 text-xs font-black uppercase text-purple-300">
                              all team accounts
                           </span>
                        ) : null}
                     </div>
                     <RoleSplit accounts={item.accounts} />
                  </article>
               ))}
            </div>
         ) : (
            <div className="rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               None
            </div>
         )}
      </div>
   );
}
