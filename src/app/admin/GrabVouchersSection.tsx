'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
   type AdminUnclaimedVoucher,
   type AdminVoucherClaim,
   type AdminVoucherClaimStatus,
   type AdminVoucherContact,
   type AdminVoucherReward,
   addVoucherCodes,
   getVoucherCodeStock,
   listUnclaimedVouchers,
   listVoucherClaims,
   listVoucherContacts,
   logAdminAction,
   sendVoucherCodeForClaim,
   updateVoucherClaimStatus,
   type VoucherCodeStock
} from '@/app/admin/adminSupabase';
import { AdminLiveRow, useAdminLiveReload } from '@/app/admin/useAdminLive';
import { parseVoucherCodes, VOUCHER_LINK_PHP } from '@/app/admin/voucherCodes';

type View = 'to-send' | 'sent' | 'unclaimed' | 'rejected';

const REWARD_LABEL: Record<AdminVoucherReward, string> = {
   first_on_time_repayment: 'First on-time repayment',
   referral_inviter: 'Referral — inviter',
   referral_invitee: 'Referral — invited friend',
   tier_rising: 'Reached Rising',
   tier_prime: 'Reached Prime',
   tier_apex: 'Reached Apex'
};

const EMAIL_SUBJECT = 'Your Moodeng food voucher';

const php = (amount: number) => `₱${amount.toLocaleString()}`;
const sum = (rows: Array<{ amount_php: number }>) => rows.reduce((total, row) => total + row.amount_php, 0);
const claimEmail = (claim: AdminVoucherClaim) => claim.email ?? claim.account_email;

function formatDate(value: string | null) {
   if (!value) return '—';
   return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// KYC returns ISO-3 issuing countries; logins return ISO-2.
const ISO3_TO_ISO2: Record<string, string> = {
   PHL: 'PH',
   IDN: 'ID',
   MYS: 'MY',
   SGP: 'SG',
   THA: 'TH',
   VNM: 'VN',
   QAT: 'QA',
   ARE: 'AE',
   SAU: 'SA',
   KWT: 'KW',
   JPN: 'JP',
   HKG: 'HK',
   MAC: 'MO',
   TWN: 'TW',
   KOR: 'KR',
   USA: 'US',
   CAN: 'CA',
   GBR: 'GB',
   AUS: 'AU'
};

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const countryName = (iso2: string) => regionNames?.of(iso2) ?? iso2;
const flag = (iso2: string) =>
   /^[A-Z]{2}$/.test(iso2) ? String.fromCodePoint(...[...iso2].map((char) => 127397 + char.charCodeAt(0))) : '';

type Whereabouts = { tone: 'ph' | 'abroad' | 'unknown'; country: string | null; kycCountry: string | null };

// Where the borrower is now: latest real (non-VPN) login, falling back to their ID's country.
function whereabouts(contact: AdminVoucherContact | undefined): Whereabouts {
   const kycCountry = contact?.kyc_country ? (ISO3_TO_ISO2[contact.kyc_country] ?? contact.kyc_country) : null;
   const country = contact?.login_country ?? kycCountry;
   if (!country) return { tone: 'unknown', country: null, kycCountry };
   return { tone: country === 'PH' ? 'ph' : 'abroad', country, kycCountry };
}

const locationText = (contact: AdminVoucherContact | undefined) => {
   const where = whereabouts(contact);
   if (!where.country) return '';
   const city = contact?.login_country ? contact.login_city : null;
   return [city, countryName(where.country)].filter(Boolean).join(', ');
};

function LocationBadge({ contact }: { contact: AdminVoucherContact | undefined }) {
   const where = whereabouts(contact);
   if (where.tone === 'unknown') {
      return <span className="rounded-full bg-[#241044] px-3 py-1 text-sm font-black text-[#a89bb8]">📍 Location unknown</span>;
   }
   if (where.tone === 'ph') {
      return <span className="rounded-full bg-[#123d2a] px-3 py-1 text-sm font-black text-[#6ee7a8]">{flag('PH')} In the Philippines</span>;
   }
   return (
      <span className="rounded-full bg-[#3d2d12] px-3 py-1 text-sm font-black text-[#facc6b]">
         ⚠ {flag(where.country!)} In {countryName(where.country!)} — Grab PH may not work
      </span>
   );
}

function LocationDetails({ contact }: { contact: AdminVoucherContact | undefined }) {
   if (!contact) return <span className="text-[#6f6385]">—</span>;
   const where = whereabouts(contact);
   const others = contact.login_countries.filter((iso2) => iso2 !== contact.login_country);
   return (
      <span className="block space-y-0.5">
         {contact.login_country ? (
            <span className="block">
               Logs in from {flag(contact.login_country)} {locationText(contact)}
               {contact.login_at ? <span className="text-[#6f6385]"> · last {formatDate(contact.login_at)}</span> : null}
            </span>
         ) : (
            <span className="block text-[#6f6385]">No login location yet</span>
         )}
         {where.kycCountry ? (
            <span className="block text-sm text-[#a89bb8]">
               ID: {flag(where.kycCountry)} {countryName(where.kycCountry)}
               {contact.kyc_area ? ` · address in ${contact.kyc_area}` : ''}
            </span>
         ) : null}
         {others.length > 0 ? (
            <span className="block text-sm text-[#a89bb8]">
               Also seen in: {others.map((iso2) => `${flag(iso2)} ${countryName(iso2)}`).join(', ')}
            </span>
         ) : null}
      </span>
   );
}

function FacebookDetails({ contact }: { contact: AdminVoucherContact | undefined }) {
   const link = contact?.facebook_contact && /^https?:\/\//i.test(contact.facebook_contact) ? contact.facebook_contact : null;
   if (!contact?.facebook_name && !contact?.facebook_contact && !contact?.messenger_verified) {
      return <span className="text-[#6f6385]">Not connected</span>;
   }
   return (
      <span className="inline-flex flex-wrap items-center gap-2">
         {link ? (
            <a className="font-bold text-[#c4a2ff] underline" href={link} target="_blank" rel="noreferrer">
               {contact.facebook_name ?? 'Profile'}
            </a>
         ) : (
            <span>{contact.facebook_name ?? contact.facebook_contact ?? 'Name not saved'}</span>
         )}
         {contact.messenger_verified ? (
            <span className="rounded-lg bg-[#123d2a] px-2 py-0.5 text-xs font-black text-[#6ee7a8]">Messenger ✓</span>
         ) : null}
      </span>
   );
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null>>) {
   const cell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
   const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
   const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
   const link = document.createElement('a');
   link.href = url;
   link.download = filename;
   link.click();
   URL.revokeObjectURL(url);
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'owe' | 'done' }) {
   const border =
      tone === 'owe'
         ? 'border-[#8a6a1f] bg-[#2a2010]'
         : tone === 'done'
           ? 'border-[#1f6b48] bg-[#0f2a1e]'
           : 'border-[#2a1453] bg-[#1c0a3a]';
   return (
      <div className={`rounded-2xl border p-5 ${border}`}>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <strong className="mt-2 block text-4xl font-black text-white">{value}</strong>
         <p className="mt-1 text-sm font-bold text-[#a89bb8]">{note}</p>
      </div>
   );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
   return (
      <div className="min-w-0">
         <dt className="text-xs font-black uppercase tracking-wide text-[#6f6385]">{label}</dt>
         <dd className="break-words text-base">{children}</dd>
      </div>
   );
}

/**
 * Admin "Food vouchers" tab: the Xoxo link stock (paste links bought with Xoxoday → Send to self),
 * everyone who claimed a voucher, what we still owe, a sent confirmation (time + who), and borrowers
 * who earned one but haven't claimed yet. Claims are sent automatically on claim; "Send code" here and
 * on the Telegram card retries one (Xoxo links, else Bitrefill).
 */
/** The links / codes a claim got: Xoxo links open, Bitrefill codes are copied. */
function VoucherLinks({
   claim,
   copied,
   onCopy
}: {
   claim: AdminVoucherClaim;
   copied: string | null;
   onCopy: (key: string, text: string) => Promise<void>;
}) {
   return (
      <span className="flex flex-wrap items-center gap-2">
         {claim.links.map((link, index) => {
            const key = `link-${claim.id}-${index}`;
            return (
               <span key={link} className="inline-flex items-center gap-1.5">
                  {/^https?:\/\//.test(link) ? (
                     <a className="font-mono text-sm font-bold text-[#c4a2ff] underline" href={link} target="_blank" rel="noreferrer">
                        {link.replace(/^https?:\/\//, '')}
                     </a>
                  ) : (
                     <span className="font-mono text-sm font-bold">{link}</span>
                  )}
                  <button
                     type="button"
                     onClick={() => void onCopy(key, link)}
                     className="rounded-lg bg-[#241044] px-2 py-0.5 text-xs font-black text-[#a89bb8]"
                  >
                     {copied === key ? 'Copied' : 'Copy'}
                  </button>
               </span>
            );
         })}
      </span>
   );
}

/** Sent tab: one line per voucher — who, how much, what they picked, when, and whether it arrived. */
function WhoGotWhat({ claims, contacts }: { claims: AdminVoucherClaim[]; contacts: Record<string, AdminVoucherContact> }) {
   return (
      <div className="overflow-x-auto rounded-2xl border border-[#2a1453]">
         <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#1c0a3a] text-xs font-black uppercase tracking-wide text-[#a89bb8]">
               <tr>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Facebook</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Got</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Arrived?</th>
               </tr>
            </thead>
            <tbody>
               {claims.map((claim) => (
                  <tr key={claim.id} className="border-t border-[#2a1453]">
                     <td className="px-4 py-2.5 font-bold">
                        {claim.full_name}
                        {claim.username ? <span className="ml-1.5 font-normal text-[#6f6385]">@{claim.username}</span> : null}
                     </td>
                     <td className="px-4 py-2.5">
                        {contacts[claim.user_id]?.facebook_name ?? contacts[claim.user_id]?.facebook_contact ?? (
                           <span className="text-[#6f6385]">{contacts[claim.user_id]?.messenger_verified ? 'Messenger ✓, no name' : '—'}</span>
                        )}
                     </td>
                     <td className="px-4 py-2.5 text-right font-black">{php(claim.amount_php)}</td>
                     <td className="px-4 py-2.5">
                        {claim.brand === 'grabmart' ? '🛒 GrabMart' : '🍗 Food'}
                        {claim.links.length ? (
                           <span className="ml-1.5 text-[#6f6385]">
                              · {claim.links.length} {claim.links.length === 1 ? 'link' : 'links'}
                           </span>
                        ) : (
                           <span className="ml-1.5 text-[#6f6385]">· by hand</span>
                        )}
                     </td>
                     <td className="px-4 py-2.5 text-[#a89bb8]">{formatDate(claim.sent_at)}</td>
                     <td className="px-4 py-2.5">
                        {claim.received_at ? (
                           <span className="font-black text-[#6ee7a8]">Got it ✅</span>
                        ) : claim.receipt_issue_at ? (
                           <span className="font-black text-[#ff8fa3]">Didn&apos;t get it</span>
                        ) : (
                           <span className="text-[#6f6385]">No answer yet</span>
                        )}
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}

export default function GrabVouchersSection() {
   const [claims, setClaims] = useState<AdminVoucherClaim[]>([]);
   const [unclaimed, setUnclaimed] = useState<AdminUnclaimedVoucher[]>([]);
   const [contacts, setContacts] = useState<Record<string, AdminVoucherContact>>({});
   const [view, setView] = useState<View>('to-send');
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [busyId, setBusyId] = useState<string | null>(null);
   const [copied, setCopied] = useState<string | null>(null);
   const [stock, setStock] = useState<VoucherCodeStock[]>([]);
   const [linksInput, setLinksInput] = useState('');
   const [notice, setNotice] = useState<string | null>(null);

   const refresh = useCallback(async () => {
      setError(null);
      try {
         const [claimRows, unclaimedRows, stockRows] = await Promise.all([
            listVoucherClaims(),
            listUnclaimedVouchers(),
            getVoucherCodeStock().catch(() => [])
         ]);
         setClaims(claimRows);
         setUnclaimed(unclaimedRows);
         setStock(stockRows);
         const userIds = [...new Set([...claimRows, ...unclaimedRows].map((row) => row.user_id))];
         // Location/Facebook are extras: if they fail to load, the voucher list still works.
         const contactRows = await listVoucherContacts(userIds).catch(() => []);
         setContacts(Object.fromEntries(contactRows.map((row) => [row.user_id, row])));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load vouchers.');
      } finally {
         setIsLoading(false);
      }
   }, []);

   useEffect(() => {
      void refresh();
   }, [refresh]);
   useAdminLiveReload(['voucher_claims', 'loans'], refresh);

   const pending = useMemo(() => claims.filter((claim) => claim.status === 'pending'), [claims]);
   const sent = useMemo(
      () => claims.filter((claim) => claim.status === 'sent').sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? '')),
      [claims]
   );
   const rejected = useMemo(() => claims.filter((claim) => claim.status === 'rejected'), [claims]);
   // Oldest first, so whoever has waited longest is at the top.
   const toSend = useMemo(() => [...pending].reverse(), [pending]);
   const waitingPeople = useMemo(() => [...new Map(pending.map((claim) => [claim.user_id, claim.full_name])).entries()], [pending]);
   const waitingAbroad = waitingPeople.filter(([userId]) => whereabouts(contacts[userId]).tone === 'abroad');

   const linksLeft = stock.find((row) => row.amount_php === VOUCHER_LINK_PHP)?.available ?? 0;
   const linksOwed = pending.reduce((total, claim) => total + Math.max(Math.ceil(claim.amount_php / VOUCHER_LINK_PHP), 1), 0);
   const pastedLinks = parseVoucherCodes(linksInput);

   const sendCode = async (claim: AdminVoucherClaim) => {
      setBusyId(claim.id);
      setNotice(null);
      try {
         const result = await sendVoucherCodeForClaim(claim.id);
         setNotice(result.summary);
         await refresh();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not send the voucher.');
      } finally {
         setBusyId(null);
      }
   };

   const addLinks = async () => {
      if (pastedLinks.length === 0) return;
      setNotice(null);
      try {
         const result = await addVoucherCodes(VOUCHER_LINK_PHP, pastedLinks, 'xoxoday');
         setLinksInput('');
         setNotice(`Added ${result.added} ₱${VOUCHER_LINK_PHP} link${result.added === 1 ? '' : 's'}${result.skipped ? ` (${result.skipped} already in stock)` : ''}.`);
         await refresh();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not add the links.');
      }
   };

   const copy = async (key: string, text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
   };

   const uniqueEmails = (emails: Array<string | null>) =>
      [...new Set(emails.filter((email): email is string => Boolean(email)))].join(', ');

   const setStatus = async (claim: AdminVoucherClaim, status: AdminVoucherClaimStatus) => {
      let note: string | null = 'Sent from admin panel';
      if (status === 'rejected') {
         note = window.prompt('Reason for rejecting (team only):', claim.admin_note ?? '');
         if (note === null) return;
      } else if (status === 'pending') {
         if (!window.confirm(`Move ${claim.full_name}'s ${php(claim.amount_php)} voucher back to "to send"?`)) return;
         note = null;
      }
      setBusyId(claim.id);
      try {
         await updateVoucherClaimStatus(claim.id, status, note);
         await logAdminAction({
            action: `voucher_claim_${status}`,
            target_table: 'voucher_claims',
            target_id: claim.id,
            target_user_id: claim.user_id,
            metadata: { reward: claim.reward, amount_php: claim.amount_php }
         }).catch(() => undefined);
         await refresh();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not update the claim.');
      } finally {
         setBusyId(null);
      }
   };

   const exportClaims = () =>
      downloadCsv(
         `grab-vouchers-${new Date().toISOString().slice(0, 10)}.csv`,
         [
            'Status',
            'Name',
            'Email',
            'Mobile',
            'Location now',
            'ID country',
            'Facebook',
            'Username',
            'Reward',
            'Amount PHP',
            'Claimed',
            'Sent',
            'Got it',
            'Voucher',
            'Note'
         ],
         claims.map((claim) => [
            claim.status,
            claim.full_name,
            claimEmail(claim),
            claim.mobile,
            locationText(contacts[claim.user_id]),
            whereabouts(contacts[claim.user_id]).kycCountry,
            contacts[claim.user_id]?.facebook_name ?? contacts[claim.user_id]?.facebook_contact ?? null,
            claim.username,
            REWARD_LABEL[claim.reward] ?? claim.reward,
            claim.amount_php,
            claim.created_at,
            claim.sent_at,
            claim.received_at ? 'yes' : claim.receipt_issue_at ? 'no' : null,
            claim.links.join(' '),
            claim.admin_note
         ])
      );

   const views: Array<{ id: View; label: string; count: number }> = [
      { id: 'to-send', label: 'To send', count: pending.length },
      { id: 'sent', label: 'Sent', count: sent.length },
      { id: 'unclaimed', label: 'Earned, not claimed', count: unclaimed.length },
      { id: 'rejected', label: 'Rejected', count: rejected.length }
   ];

   const claimCard = (claim: AdminVoucherClaim) => {
      const email = claimEmail(claim);
      return (
         <AdminLiveRow key={claim.id} ids={[claim.id]} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
            <div className="flex flex-wrap items-center gap-3">
               <span className="text-2xl font-black">{php(claim.amount_php)}</span>
               <span className="text-lg font-black">{claim.full_name}</span>
               <span className="font-bold text-[#a89bb8]">{REWARD_LABEL[claim.reward] ?? claim.reward}</span>
               <span className="rounded-full bg-[#241044] px-2.5 py-0.5 text-sm font-black text-[#c4a2ff]">
                  {claim.brand === 'grabmart' ? '🛒 GrabMart' : '🍗 Food link'}
               </span>
               {claim.received_at ? (
                  <span className="rounded-full bg-[#123d2a] px-2.5 py-0.5 text-sm font-black text-[#6ee7a8]">Got it ✅</span>
               ) : claim.receipt_issue_at ? (
                  <span className="rounded-full bg-[#3d1220] px-2.5 py-0.5 text-sm font-black text-[#ff8fa3]">Didn&apos;t get it — resend</span>
               ) : null}
               <LocationBadge contact={contacts[claim.user_id]} />
               {claim.status === 'sent' ? (
                  <span className="ml-auto rounded-full bg-[#123d2a] px-3 py-1 text-sm font-black text-[#6ee7a8]">
                     ✓ Sent {formatDate(claim.sent_at)}
                  </span>
               ) : (
                  <span className="ml-auto text-sm text-[#6f6385]">Claimed {formatDate(claim.created_at)}</span>
               )}
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
               <Field label="Email">
                  {email ? (
                     <span className="inline-flex flex-wrap items-center gap-2">
                        <a
                           className="font-bold text-[#c4a2ff] underline"
                           href={`mailto:${email}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`}
                        >
                           {email}
                        </a>
                        <button
                           type="button"
                           onClick={() => void copy(`email-${claim.id}`, email)}
                           className="rounded-lg bg-[#241044] px-2 py-0.5 text-xs font-black text-[#a89bb8]"
                        >
                           {copied === `email-${claim.id}` ? 'Copied' : 'Copy'}
                        </button>
                        {!claim.email ? <span className="text-xs text-[#6f6385]">(account email)</span> : null}
                     </span>
                  ) : (
                     <span className="text-[#ff8fa3]">No email — use mobile</span>
                  )}
               </Field>
               <Field label="Mobile (GCash)">{claim.mobile}</Field>
               <Field label="User">{claim.username ? `@${claim.username}` : claim.user_id}</Field>
               <div className="sm:col-span-2">
                  <Field label="Location">
                     <LocationDetails contact={contacts[claim.user_id]} />
                  </Field>
               </div>
               <Field label="Facebook">
                  <FacebookDetails contact={contacts[claim.user_id]} />
               </Field>
               {claim.links.length ? (
                  <div className="sm:col-span-3">
                     <Field label={claim.links.length === 1 ? 'Voucher' : 'Vouchers'}>
                        <VoucherLinks claim={claim} copied={copied} onCopy={copy} />
                     </Field>
                  </div>
               ) : null}
               {claim.admin_note ? <Field label="Note">{claim.admin_note}</Field> : null}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
               {claim.status === 'pending' ? (
                  <>
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void sendCode(claim)}
                        className="rounded-xl bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        {busyId === claim.id ? 'Sending…' : '✅ Send code'}
                     </button>
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void setStatus(claim, 'sent')}
                        className="rounded-xl bg-[#241044] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        Mark sent by hand
                     </button>
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void setStatus(claim, 'rejected')}
                        className="rounded-xl bg-[#34234f] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        Reject
                     </button>
                  </>
               ) : (
                  <button
                     type="button"
                     disabled={busyId === claim.id}
                     onClick={() => void setStatus(claim, 'pending')}
                     className="rounded-xl bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8] disabled:opacity-50"
                  >
                     Undo — back to “to send”
                  </button>
               )}
            </div>
         </AdminLiveRow>
      );
   };

   const listFor: Record<Exclude<View, 'unclaimed'>, AdminVoucherClaim[]> = { 'to-send': toSend, sent, rejected };
   const emailsForView =
      view === 'unclaimed' ? uniqueEmails(unclaimed.map((row) => row.email)) : uniqueEmails(listFor[view].map(claimEmail));

   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Food vouchers</h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               Claims are emailed automatically: Moo-food gets one ₱50 Xoxo link per ₱50 from the stock below (the borrower picks Jollibee,
               Chowking, Greenwich, Mang Inasal or Red Ribbon); Moo-snacks gets a GrabMart code from Bitrefill, which also covers food when
               the stock is empty. Anything under “To send” didn’t go out on its own: add links, then tap Send code.
            </p>
         </div>

         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="We owe now" value={php(sum(pending))} note={`${pending.length} claimed, not sent yet`} tone="owe" />
            <Stat
               label="Sent"
               value={php(sum(sent))}
               note={`${sent.length} ${sent.length === 1 ? 'voucher' : 'vouchers'} delivered`}
               tone="done"
            />
            <Stat
               label="Earned, not claimed"
               value={php(sum(unclaimed))}
               note={`${unclaimed.length} ${unclaimed.length === 1 ? 'voucher' : 'vouchers'} could still be claimed`}
            />
            <Stat label="Total if all claimed" value={php(sum(pending) + sum(unclaimed))} note="Owed now + earned, not claimed" />
         </div>

         <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
            <div className="flex flex-wrap items-baseline gap-3">
               <h3 className="text-lg font-black">₱{VOUCHER_LINK_PHP} Xoxo link stock</h3>
               <span className={`font-black ${linksLeft <= 5 ? 'text-[#facc6b]' : 'text-[#6ee7a8]'}`}>
                  {linksLeft} left{linksLeft <= 5 ? ' — restock soon' : ''}
               </span>
               {linksOwed > 0 ? <span className="text-sm text-[#a89bb8]">{linksOwed} needed for claims waiting now</span> : null}
            </div>
            <p className="mt-1 text-sm text-[#a89bb8]">
               Xoxoday → Send Reward Link → Moodeng food reward → Send to self → quantity. Paste the links from that email here, one per
               line. Each link shows on the claim it went to (Sent → who got what).
            </p>
            <textarea
               id="voucher-links-input"
               value={linksInput}
               onChange={(event) => setLinksInput(event.target.value)}
               rows={3}
               placeholder="https://plum.gift/…"
               className="mt-3 w-full rounded-xl border border-[#2a1453] bg-[#120626] p-3 font-mono text-sm text-white"
            />
            <button
               type="button"
               disabled={pastedLinks.length === 0}
               onClick={() => void addLinks()}
               className="mt-2 rounded-xl bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-40"
            >
               Add {pastedLinks.length || ''} link{pastedLinks.length === 1 ? '' : 's'}
            </button>
         </div>

         {notice ? <p className="rounded-xl bg-[#123d2a] px-4 py-3 font-bold text-[#6ee7a8]">{notice}</p> : null}

         {waitingAbroad.length > 0 ? (
            <p className="rounded-xl border border-[#8a6a1f] bg-[#2a2010] px-4 py-3 font-bold text-[#facc6b]">
               ⚠ {waitingAbroad.length} of {waitingPeople.length} people waiting are outside the Philippines right now (
               {waitingAbroad.map(([userId, name]) => `${name} — ${countryName(whereabouts(contacts[userId]).country!)}`).join(', ')}). A
               Philippine food voucher may not work for them — message them before sending.
            </p>
         ) : null}

         <div className="flex flex-wrap items-center gap-2">
            {views.map((item) => (
               <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${view === item.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
               >
                  {item.label} ({item.count})
               </button>
            ))}
            <div className="ml-auto flex gap-2">
               <button
                  type="button"
                  disabled={!emailsForView}
                  onClick={() => void copy('all-emails', emailsForView)}
                  className="rounded-xl bg-[#241044] px-4 py-1.5 text-sm font-black text-white disabled:opacity-40"
               >
                  {copied === 'all-emails' ? 'Copied' : 'Copy emails in this list'}
               </button>
               <button
                  type="button"
                  disabled={claims.length === 0}
                  onClick={exportClaims}
                  className="rounded-xl bg-[#241044] px-4 py-1.5 text-sm font-black text-white disabled:opacity-40"
               >
                  Download CSV
               </button>
            </div>
         </div>

         {error ? <p className="rounded-xl bg-[#3d1220] px-4 py-3 font-bold text-[#ff8fa3]">{error}</p> : null}
         {isLoading ? <p className="text-[#a89bb8]">Loading…</p> : null}

         {!isLoading && view === 'sent' && sent.length > 0 ? <WhoGotWhat claims={sent} contacts={contacts} /> : null}

         {!isLoading && view !== 'unclaimed' ? (
            <div className="space-y-3">
               {listFor[view].length === 0 ? (
                  <p className="text-[#6f6385]">{view === 'to-send' ? 'Nothing to send — all caught up.' : `No ${view} vouchers.`}</p>
               ) : (
                  listFor[view].map(claimCard)
               )}
            </div>
         ) : null}

         {!isLoading && view === 'unclaimed' ? (
            <div className="space-y-3">
               <p className="text-sm text-[#a89bb8]">
                  These borrowers earned a voucher but haven’t tapped Claim in the app yet. Nudge them to claim it there — the claim form
                  collects their name and number.
               </p>
               {unclaimed.length === 0 ? (
                  <p className="text-[#6f6385]">Everyone who earned a voucher has claimed it.</p>
               ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[#2a1453]">
                     <table className="w-full min-w-[960px] text-left">
                        <thead className="bg-[#1c0a3a] text-xs font-black uppercase tracking-wide text-[#a89bb8]">
                           <tr>
                              <th className="px-4 py-3">Borrower</th>
                              <th className="px-4 py-3">Email</th>
                              <th className="px-4 py-3">Location</th>
                              <th className="px-4 py-3">Facebook</th>
                              <th className="px-4 py-3">Earned for</th>
                              <th className="px-4 py-3 text-right">Amount</th>
                           </tr>
                        </thead>
                        <tbody>
                           {unclaimed.map((row) => (
                              <tr
                                 key={`${row.user_id}-${row.reward}-${row.friend_referral_id ?? ''}`}
                                 className="border-t border-[#2a1453]"
                              >
                                 <td className="px-4 py-3 font-bold">
                                    {row.display_name || (row.username ? `@${row.username}` : row.user_id.slice(0, 8))}
                                 </td>
                                 <td className="px-4 py-3">
                                    {row.email ? (
                                       <a className="text-[#c4a2ff] underline" href={`mailto:${row.email}`}>
                                          {row.email}
                                       </a>
                                    ) : (
                                       <span className="text-[#6f6385]">—</span>
                                    )}
                                 </td>
                                 <td className="px-4 py-3">
                                    <span className="block">
                                       {whereabouts(contacts[row.user_id]).country
                                          ? `${flag(whereabouts(contacts[row.user_id]).country!)} ${locationText(contacts[row.user_id])}`
                                          : '—'}
                                    </span>
                                    {whereabouts(contacts[row.user_id]).tone === 'abroad' ? (
                                       <span className="text-xs font-black text-[#facc6b]">⚠ Outside the Philippines</span>
                                    ) : null}
                                 </td>
                                 <td className="px-4 py-3 text-sm">
                                    <FacebookDetails contact={contacts[row.user_id]} />
                                 </td>
                                 <td className="px-4 py-3 text-[#a89bb8]">{REWARD_LABEL[row.reward] ?? row.reward}</td>
                                 <td className="px-4 py-3 text-right font-black">{php(row.amount_php)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         ) : null}
      </section>
   );
}
