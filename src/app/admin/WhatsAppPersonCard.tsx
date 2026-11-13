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

const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Where they live, most specific first: "Cebu City, Cebu, Central Visayas". */
export const placeOf = (p: PersonCard | null | undefined) => {
   const id = p?.identity;
   const parts = [id?.city, id?.province, id?.region].filter((v): v is string => Boolean(v?.trim())).map((v) => titleCase(v.trim()));
   const unique = parts.filter((v, i) => parts.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);
   return unique.length ? unique.join(', ') : p?.application?.location || null;
};

const genderLabel = (g: string | null | undefined) => (g === 'M' ? 'Male' : g === 'F' ? 'Female' : g || null);

/** "28 · F · Cebu" for the chat list. */
export const aboutLine = (p: PersonCard | null | undefined) => {
   if (!p) return null;
   const city = p.identity?.city || p.identity?.province || p.application?.location;
   const bits = [p.identity?.age ? String(p.identity.age) : null, p.identity?.gender || null, city ? titleCase(city) : null].filter(
      Boolean
   );
   return bits.length ? bits.join(' · ') : null;
};

/** Application money bands ("200_400", "under_200", "700_plus") as "$200–400 / month". */
const bandLabel = (band: string) => {
   const range = band.match(/^(\d+)_(\d+)$/);
   if (range) return `$${range[1]}–${range[2]} / month`;
   const under = band.match(/^under_(\d+)$/);
   if (under) return `Under $${under[1]} / month`;
   const plus = band.match(/^(\d+)_plus$/);
   if (plus) return `$${plus[1]}+ / month`;
   return band;
};

/** Phone sign-ups get a made-up phone_…@moodeng.app address; don't show it as if it were theirs. */
const isRealEmail = (email: string | null) =>
   Boolean(email) && !email!.endsWith('.local') && !/^phone_[0-9a-f]+@moodeng\.app$/i.test(email!);
const workLabel: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', freelance: 'Freelance', none: 'No job' };
const paydayLabel = (a: NonNullable<PersonCard['application']>) => {
   const base = { 'mid-month': 'Mid-month', 'end-of-month': 'End of month', irregular: 'Irregular' }[a.paydayType ?? ''] ?? a.paydayType;
   if (!base) return null;
   const days = a.paydayStart && a.paydayEnd ? ` (${a.paydayStart}–${a.paydayEnd})` : a.paydayStart ? ` (${a.paydayStart})` : '';
   return `${base}${days}`;
};

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
                     {isRealEmail(person.email) ? <Row label="Email">{person.email}</Row> : null}
                     {person.market ? <Row label="Country">{person.market.toUpperCase()}</Row> : null}
                     <Row label="Loan access">{accessLabel[person.loanAccess ?? 'none'] ?? person.loanAccess}</Row>
                     {person.riskBand ? <Row label="Risk">{person.riskBand}</Row> : null}
                     {person.accountStatus && person.accountStatus !== 'active' ? (
                        <Row label="Account">⚠️ {person.accountStatus}</Row>
                     ) : null}
                     {matchedBy === 'phone' ? <Row label="Matched by">phone number</Row> : null}
                  </div>
               </div>

               {/* Who they are (ID check) — for picking affiliates and seeing which areas we reach. */}
               {(() => {
                  const id = person.identity;
                  const place = placeOf(person);
                  if (!id?.age && !id?.gender && !place) return null;
                  return (
                     <div className="rounded-2xl bg-[#140726] p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-[#a89bb8]">About them (ID check)</p>
                        <div className="mt-1 divide-y divide-[#2a1453]">
                           {id?.age ? (
                              <Row label="Age">
                                 {id.age}
                                 {id.birthDate ? (
                                    <span className="font-normal text-[#a89bb8]"> · born {bangkokDate(id.birthDate)}</span>
                                 ) : null}
                              </Row>
                           ) : null}
                           {genderLabel(id?.gender) ? <Row label="Gender">{genderLabel(id?.gender)}</Row> : null}
                           {place ? <Row label="Lives in">{place}</Row> : null}
                           {id?.country ? <Row label="ID country">{id.country}</Row> : null}
                        </div>
                     </div>
                  );
               })()}

               {/* Job and income — what they wrote in the application, plus the screening call. */}
               {(() => {
                  const app = person.application;
                  const call = person.call;
                  const payday = app ? paydayLabel(app) : null;
                  const has =
                     app?.profession ||
                     app?.incomeType ||
                     app?.monthlyIncome ||
                     app?.incomeDescription ||
                     payday ||
                     call?.role ||
                     call?.loanUse;
                  if (!has) return null;
                  return (
                     <div className="rounded-2xl bg-[#140726] p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-[#a89bb8]">Job & income (application)</p>
                        <div className="mt-1 divide-y divide-[#2a1453]">
                           {app?.profession ? <Row label="Job">{app.profession}</Row> : null}
                           {call?.role && call.role.trim().toLowerCase() !== app?.profession?.trim().toLowerCase() ? (
                              <Row label="Job (call)">{call.role}</Row>
                           ) : null}
                           {app?.incomeType ? <Row label="Work">{workLabel[app.incomeType] ?? app.incomeType}</Row> : null}
                           {app?.monthlyIncome ? <Row label="Income">{bandLabel(app.monthlyIncome)}</Row> : null}
                           {app?.monthlyExpenses ? <Row label="Expenses">{bandLabel(app.monthlyExpenses)}</Row> : null}
                           {payday ? <Row label="Payday">{payday}</Row> : null}
                           {app?.otherIncome ? <Row label="Other income">{app.otherIncome}</Row> : null}
                           {call?.loanUse ? <Row label="Loan for">{call.loanUse}</Row> : null}
                           {call?.referral ? <Row label="Heard via">{call.referral}</Row> : null}
                        </div>
                        {app?.incomeDescription ? (
                           <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[#1c0a3a] px-3 py-2 text-xs text-purple-100">
                              “{app.incomeDescription}”
                           </p>
                        ) : null}
                     </div>
                  );
               })()}

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
