'use client';

// "Who is this?" for the WhatsApp tab: the person's WhatsApp name and number, who they are in Moodeng,
// how active they are and where their loans stand. Data: private.admin_person_card (SQL).
import type { PersonCard } from '@/app/admin/adminSupabase';

const DAY = 86_400_000;

export const relativeTime = (iso: string | null | undefined) => {
   if (!iso) return null;
   const t = Date.parse(iso);
   if (Number.isNaN(t)) return null;
   const diff = Date.now() - t;
   if (diff < 60_000) return 'just now';
   if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
   if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`;
   if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`;
   if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo ago`;
   return `${Math.floor(diff / (365 * DAY))}y ago`;
};

const bangkokDate = (iso: string | null | undefined) =>
   iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const money = (n: number | null | undefined) => {
   const v = Number(n ?? 0);
   return `$${v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

/** Days past the due date (positive = late), or null when there's no due date. */
export const daysLate = (dueDate: string | null | undefined) => {
   if (!dueDate) return null;
   const t = Date.parse(dueDate);
   return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / DAY);
};

export const personName = (p: PersonCard) =>
   p.kycName || p.displayName || p.facebookName || (p.username ? `@${p.username}` : 'Moodeng user');

/** Short loan line for the chat list: "Loan out · $40 due 15 Nov" / "3 days late". */
export function LoanBadge({ person }: { person: PersonCard | null }) {
   const loan = person?.activeLoan;
   if (!loan) return null;
   const late = daysLate(loan.dueDate);
   const isLate = late !== null && late > 0;
   return (
      <span
         className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
            isLate ? 'bg-red-500/20 text-red-300' : 'bg-amber-400/15 text-amber-200'
         }`}
      >
         {isLate ? `${late}d late · ${money(loan.owed)}` : `Loan out · ${money(loan.owed)}`}
      </span>
   );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
   <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-xs font-bold text-[#a89bb8]">{label}</span>
      <span className="min-w-0 text-right font-bold text-white [overflow-wrap:anywhere]">{children}</span>
   </div>
);

const accessLabel: Record<string, string> = {
   approved: '✅ Approved',
   pending: '⏳ Pending',
   rejected: '⛔ Rejected',
   none: 'Not applied'
};

export default function WhatsAppPersonCard({
   whatsappName,
   phone,
   person,
   matchedBy,
   lastWhatsAppAt,
   onMessage
}: {
   whatsappName: string | null;
   phone: string | null;
   person: PersonCard | null;
   matchedBy?: 'whatsapp' | 'phone' | null;
   lastWhatsAppAt?: string | null;
   onMessage?: () => void;
}) {
   const loan = person?.activeLoan ?? null;
   const late = daysLate(loan?.dueDate);
   const adminLink = person ? `/admin?q=${encodeURIComponent(person.username ? `@${person.username}` : person.userId)}` : null;

   return (
      <div className="space-y-4 p-4">
         {/* WhatsApp side: exactly what their WhatsApp profile shows. */}
         <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#25D366]">On WhatsApp</p>
            <p className="mt-1 text-lg font-black [overflow-wrap:anywhere]">{whatsappName || 'No profile name'}</p>
            <p className="text-sm text-[#a89bb8]">{phone ? `+${phone}` : person?.phone ? `+${person.phone}` : 'No number'}</p>
            {lastWhatsAppAt ? <p className="mt-0.5 text-xs text-[#a89bb8]">Last message {relativeTime(lastWhatsAppAt)}</p> : null}
            {onMessage ? (
               <button
                  type="button"
                  onClick={onMessage}
                  className="mt-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-black text-[#0b2a17] hover:brightness-110"
               >
                  Message on WhatsApp
               </button>
            ) : null}
         </div>

         {!person ? (
            <div className="rounded-2xl border border-dashed border-[#4a3570] p-3 text-sm text-[#a89bb8]">
               Not linked to a Moodeng account — their WhatsApp number isn&apos;t on any account. Search their name above to find them.
            </div>
         ) : (
            <>
               {/* Loans. */}
               <div
                  className={`rounded-2xl p-3 ${loan ? (late !== null && late > 0 ? 'bg-red-500/10 ring-1 ring-red-400/40' : 'bg-amber-400/10 ring-1 ring-amber-300/30') : 'bg-[#140726]'}`}
               >
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#a89bb8]">Loans</p>
                  {loan ? (
                     <div className="mt-1">
                        <p className="text-lg font-black">
                           {money(loan.owed)}{' '}
                           <span className="text-sm font-bold text-[#a89bb8]">still owed of {money(loan.amount)} borrowed</span>
                        </p>
                        <p className={`text-sm font-bold ${late !== null && late > 0 ? 'text-red-300' : 'text-amber-200'}`}>
                           {late === null
                              ? 'No due date'
                              : late > 0
                                ? `${late} day${late === 1 ? '' : 's'} late (due ${bangkokDate(loan.dueDate)})`
                                : late === 0
                                  ? `Due today`
                                  : `Due ${bangkokDate(loan.dueDate)} (in ${-late} day${late === -1 ? '' : 's'})`}
                        </p>
                     </div>
                  ) : (
                     <p className="mt-1 text-sm font-bold text-white">No loan out right now</p>
                  )}
                  <div className="mt-2 divide-y divide-[#2a1453]/70">
                     <Row label="Repaid">
                        {person.loans.repaid} loan{person.loans.repaid === 1 ? '' : 's'}
                        {person.loans.repaidLate ? ` (${person.loans.repaidLate} late)` : ''}
                     </Row>
                     <Row label="Borrowed in total">{money(person.loans.totalBorrowed)}</Row>
                     {person.loans.requested ? <Row label="Unfunded requests">{person.loans.requested}</Row> : null}
                  </div>
               </div>
               {/* Who they are in Moodeng. */}
               <div className="rounded-2xl bg-[#140726] p-3">
                  <div className="flex items-start justify-between gap-2">
                     <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wide text-[#c9a4ff]">In Moodeng</p>
                        <p className="mt-1 font-black [overflow-wrap:anywhere]">{personName(person)}</p>
                        {person.username ? <p className="text-xs font-bold text-[#c9a4ff]">@{person.username}</p> : null}
                     </div>
                     {adminLink ? (
                        <a
                           href={adminLink}
                           className="shrink-0 rounded-lg border border-[#2a1453] px-2 py-1 text-[11px] font-black text-purple-200 hover:border-[#8336f0]"
                        >
                           Open ↗
                        </a>
                     ) : null}
                  </div>
                  <div className="mt-2 divide-y divide-[#2a1453]">
                     {person.kycName ? <Row label="ID name">{person.kycName}</Row> : null}
                     {person.facebookName ? <Row label="Facebook">{person.facebookName}</Row> : null}
                     {person.email && !person.email.endsWith('.local') ? <Row label="Email">{person.email}</Row> : null}
                     {person.market ? <Row label="Country">{person.market.toUpperCase()}</Row> : null}
                     <Row label="Loan access">{accessLabel[person.loanAccess ?? 'none'] ?? person.loanAccess}</Row>
                     {person.riskBand ? <Row label="Risk">{person.riskBand}</Row> : null}
                     {person.accountStatus && person.accountStatus !== 'active' ? (
                        <Row label="Account">⚠️ {person.accountStatus}</Row>
                     ) : null}
                     {matchedBy === 'phone' ? <Row label="Matched by">phone number</Row> : null}
                  </div>
               </div>

               {/* How active. */}
               <div className="rounded-2xl bg-[#140726] p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#a89bb8]">Activity</p>
                  <div className="mt-1 divide-y divide-[#2a1453]">
                     <Row label="Last in the app">{relativeTime(person.lastSignInAt) ?? 'never'}</Row>
                     <Row label="Signed up">{bangkokDate(person.signedUpAt)}</Row>
                     <Row label="Last loan">{relativeTime(person.loans.lastLoanAt) ?? 'none yet'}</Row>
                  </div>
               </div>
            </>
         )}
      </div>
   );
}
