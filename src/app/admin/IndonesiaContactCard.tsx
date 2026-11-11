'use client';

import { useEffect, useState } from 'react';

import IndonesiaBadge from '@/components/IndonesiaBadge';

import { type AdminIndoProfile, fetchIndonesiaProfiles, telegramUrl, whatsappChatUrl } from '@/app/admin/indonesiaAdmin';

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const STATE_CLASS: Record<string, string> = {
   approved: 'bg-[#e7f6ec] text-[#1f7a3d]',
   review: 'bg-[#fff6db] text-[#8a6100]',
   sent: 'bg-[#fff6db] text-[#8a6100]',
   started: 'bg-[#fff6db] text-[#8a6100]',
   resend: 'bg-[#fde8e8] text-[#b42318]',
   declined: 'bg-[#fde8e8] text-[#b42318]'
};

function StateChip({ label, state }: { label: string; state: string | null }) {
   return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_CLASS[state ?? ''] ?? 'bg-[#ececea] text-[#7a7a7a]'}`}>
         {label}: {state ?? 'none'}
      </span>
   );
}

/**
 * How the team reaches an Indonesia-track borrower: Telegram, WhatsApp (with a "Chat on WhatsApp"
 * link to message them directly), Facebook profile and Walt address, plus their KYC and income-doc
 * state. Pass `profile` when it's already loaded, or `userId` to load it (renders nothing for anyone
 * not on the track).
 */
export default function IndonesiaContactCard({ profile: given, userId }: { profile?: AdminIndoProfile | null; userId?: string | null }) {
   const [loaded, setLoaded] = useState<AdminIndoProfile | null>(null);
   useEffect(() => {
      if (given !== undefined || !userId) return undefined;
      let cancelled = false;
      void fetchIndonesiaProfiles([userId]).then((map) => {
         if (!cancelled) setLoaded(map.get(userId) ?? null);
      });
      return () => {
         cancelled = true;
      };
   }, [given, userId]);
   const profile = given !== undefined ? given : loaded;
   if (!profile) return null;

   const wa = whatsappChatUrl(profile.whatsappNumber);
   const tg = telegramUrl(profile.telegramUsername);
   const linkClass = 'font-semibold text-[#2f6fdc] underline underline-offset-2';
   return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-[#ce1126]/25 border-t-[3px] border-t-[#ce1126] bg-[#fff8f8] px-3 py-2 text-[13px] text-[#37352f]">
         <div className="flex flex-wrap items-center gap-2">
            <IndonesiaBadge />
            <StateChip label="KYC" state={profile.kyc === 'not started' ? null : profile.kyc} />
            <StateChip label="Income doc" state={profile.incomeDoc} />
         </div>
         <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
               <b>Telegram:</b>{' '}
               {tg ? (
                  <a className={linkClass} href={tg} rel="noopener noreferrer" target="_blank">
                     @{profile.telegramUsername?.replace(/^@/, '')}
                  </a>
               ) : (
                  '—'
               )}
            </span>
            <span>
               <b>WhatsApp:</b> {profile.whatsappNumber ? `+${profile.whatsappNumber.replace(/\D/g, '')}` : '—'}
               {profile.whatsappNumber && !profile.whatsappVerified ? ' (not verified)' : ''}
               {wa ? (
                  <>
                     {' · '}
                     <a className={linkClass} href={wa} rel="noopener noreferrer" target="_blank">
                        Chat on WhatsApp
                     </a>
                  </>
               ) : null}
            </span>
            <span>
               <b>Facebook:</b>{' '}
               {profile.facebookProfileUrl && /^https:\/\//i.test(profile.facebookProfileUrl) ? (
                  <a className={linkClass} href={profile.facebookProfileUrl} rel="noopener noreferrer" target="_blank">
                     Profile
                  </a>
               ) : (
                  '—'
               )}
            </span>
            <span>
               <b>Walt:</b>{' '}
               {profile.waltAddress ? (
                  <a
                     className={linkClass}
                     href={`https://bscscan.com/address/${profile.waltAddress}`}
                     rel="noopener noreferrer"
                     target="_blank"
                     title={profile.waltAddress}
                  >
                     {short(profile.waltAddress)}
                  </a>
               ) : (
                  '—'
               )}
            </span>
         </div>
      </div>
   );
}
