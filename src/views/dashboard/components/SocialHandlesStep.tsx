import { useState } from 'react';

import {
   cleanSocialHandle,
   isValidSocialHandle,
   saveMySocialHandles,
   type SocialHandles,
   socialHandlesErrorText,
   socialProfileUrl,
   type SocialSite
} from '@/lib/socialHandles';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

const SITES: { site: SocialSite; label: string; icon: string; placeholder: string }[] = [
   { site: 'instagram', label: 'Instagram', icon: DASHBOARD_V2_ASSETS.shareInstagram, placeholder: '@yourname' },
   { site: 'tiktok', label: 'TikTok', icon: DASHBOARD_V2_ASSETS.shareTiktok, placeholder: '@yourname' }
];

/**
 * Loan form, $60 and up: "More ways to reach you" — Instagram and/or TikTok. One is enough;
 * "I don't use these" lets them through (saved, so it doesn't ask again).
 */
export function SocialHandlesStep({
   initial,
   onContinue,
   onBack
}: {
   initial: SocialHandles | null;
   onContinue: (saved: SocialHandles) => void;
   onBack: () => void;
}) {
   const [values, setValues] = useState<Record<SocialSite, string>>({
      instagram: initial?.instagram ?? '',
      tiktok: initial?.tiktok ?? ''
   });
   const cleaned = {
      instagram: cleanSocialHandle(values.instagram, 'instagram'),
      tiktok: cleanSocialHandle(values.tiktok, 'tiktok')
   };
   const bad = (site: SocialSite) => cleaned[site] !== '' && !isValidSocialHandle(cleaned[site], site);
   const hasOne = (cleaned.instagram !== '' || cleaned.tiktok !== '') && !bad('instagram') && !bad('tiktok');

   // Plain state, no React Query: the loan form also renders where there's no query provider (tests).
   const [isPending, setIsPending] = useState(false);
   const [errorText, setErrorText] = useState<string | null>(null);
   const save = {
      isPending,
      mutate: (skip: boolean) => {
         setIsPending(true);
         setErrorText(null);
         saveMySocialHandles({ instagram: cleaned.instagram, tiktok: cleaned.tiktok, skip })
            .then(onContinue)
            .catch((err: { message?: string }) => setErrorText(socialHandlesErrorText(err?.message)))
            .finally(() => setIsPending(false));
      }
   };

   return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <ConnectHero image={CONNECT_HIPPOS.hello} title="More ways to reach you" subtitle="Add your Instagram or TikTok. One is enough." />
         <div className="flex flex-col gap-3">
            {SITES.map(({ site, label, icon, placeholder }) => (
               <div key={site} className="flex flex-col gap-1">
                  <label className="flex items-center gap-3 rounded-[14px] border border-[#e1dbe8] bg-white px-3 py-2 dark:border-[#3a3047] dark:bg-[#1d1726]">
                     <img src={icon} alt="" className="h-9 w-9 shrink-0" />
                     <span className="sr-only">{label}</span>
                     <input
                        value={values[site]}
                        onChange={(e) => setValues((v) => ({ ...v, [site]: e.target.value }))}
                        placeholder={`${label} ${placeholder}`}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={120}
                        className="min-w-0 flex-1 bg-transparent text-[16px] text-[#594d65] outline-none placeholder:text-[#b3a9c0] dark:text-[#e6def2]"
                     />
                     {cleaned[site] && !bad(site) ? (
                        <a
                           href={socialProfileUrl(cleaned[site], site)}
                           target="_blank"
                           rel="noreferrer"
                           className="shrink-0 text-[14px] font-semibold text-[#6b55f7] dark:text-[#b3a6ff]"
                        >
                           Check it
                        </a>
                     ) : null}
                  </label>
                  {bad(site) ? <p className="px-1 text-[13px] text-red-600 dark:text-red-400">That {label} name doesn&apos;t look right.</p> : null}
               </div>
            ))}
         </div>
         {errorText ? <p className="text-[14px] text-red-600 dark:text-red-400">{errorText}</p> : null}
         <div className="mt-auto flex flex-col gap-1 pt-1">
            <PrimaryButton disabled={!hasOne || save.isPending} onClick={() => save.mutate(false)}>
               {save.isPending ? 'Saving…' : 'Continue'}
            </PrimaryButton>
            <GhostButton disabled={save.isPending} onClick={() => save.mutate(true)}>
               I don&apos;t use these
            </GhostButton>
            <GhostButton onClick={onBack}>Back</GhostButton>
         </div>
      </div>
   );
}
