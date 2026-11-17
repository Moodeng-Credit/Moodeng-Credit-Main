import { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import BrandedVideo from '@/components/BrandedVideo';
import { fetchJourneyV2, type JourneyV2, PRE_KYC_CONNECT_PATH } from '@/hooks/usePreKycGate';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton, StepTrail } from '@/views/dashboard/components/connectKit';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

// /onboarding/verify — journey v2 (supabase/migrations/20261117200000_journey_v2.sql). Right after
// sign-up a new borrower:
//   1. sends 1 month of proof of income (/documents, with its AI checks),
//   2. watches the 3 short videos to the end,
//   3. waits for the AI check on that proof: pass → onboarding (/onboarding/connect: Facebook,
//      WhatsApp, about you, book the call); hold → the team decides (Approve / Decline on Telegram).
// Anyone it doesn't apply to (switch off, older account, approved…) goes straight to /onboarding/connect.

const PREVIEW: Record<string, JourneyV2> = {
   income: { applies: true, income: 'none', videos_watched: 0, videos: [] },
   videos: {
      applies: true,
      income: 'checking',
      videos_watched: 1,
      videos: [
         { id: 'G4hibvp-T9g', title: 'How to get started (6 simple steps)', tall: true },
         { id: 'SMasdjEpDkg', title: 'How to cash out your loan' },
         { id: 'Eu9JzDMOSmw', title: 'How to repay in 1 minute' }
      ]
   },
   checking: { applies: true, income: 'checking', videos_watched: 3, videos: [] },
   hold: { applies: true, income: 'hold', videos_watched: 3, videos: [] },
   resend: { applies: true, income: 'resend', videos_watched: 0, videos: [] }
};

const card = 'flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card';
const STEPS = ['Income', 'Videos', 'Check'];

export default function VerifyFirst() {
   const navigate = useNavigate();
   const location = useLocation();
   const queryClient = useQueryClient();
   const user = useSelector((state: RootState) => state.auth.user);
   const previewKey = import.meta.env.DEV && location.pathname.includes('preview') ? new URLSearchParams(location.search).get('view') ?? 'income' : null;
   const preview = previewKey ? (PREVIEW[previewKey] ?? PREVIEW.income) : null;

   const { data, isLoading } = useQuery({
      queryKey: ['journey-v2', user?.id, user?.loanAccessStatus],
      queryFn: fetchJourneyV2,
      enabled: Boolean(user) && !preview,
      // While the AI reads their proof, look again every few seconds.
      refetchInterval: (query) => (query.state.data?.income === 'checking' ? 5000 : query.state.data?.income === 'hold' ? 30000 : false)
   });
   const v2 = preview ?? data;
   const [videoIndex, setVideoIndex] = useState<number | null>(null);
   const [ended, setEnded] = useState(false);
   const [broken, setBroken] = useState(false);
   const [saving, setSaving] = useState(false);

   if (!preview && (!user || isLoading)) {
      return (
         <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="size-7 animate-spin text-[#7661f9]" />
         </div>
      );
   }
   // Not for them, or all done: onboarding takes it from here.
   if (!v2?.applies || v2.done) return <Navigate replace to={PRE_KYC_CONNECT_PATH} />;

   const videos = v2.videos ?? [];
   const watched = Math.min(v2.videos_watched ?? 0, videos.length);
   const income = v2.income ?? 'none';
   const needsIncome = income === 'none' || income === 'resend' || income === 'declined';
   const index = videoIndex ?? watched;
   const video = videos[index];

   const nextVideo = async () => {
      setSaving(true);
      if (!preview) {
         await getSupabaseBrowserClient()
            .rpc('journey_videos_watched', { p_count: index + 1 })
            .then(({ error }) => {
               if (error) console.warn('journey_videos_watched failed', error.message);
            });
      }
      setSaving(false);
      setEnded(false);
      setBroken(false);
      if (index + 1 < videos.length) setVideoIndex(index + 1);
      else {
         setVideoIndex(null);
         void queryClient.invalidateQueries({ queryKey: ['journey-v2'] });
      }
   };

   let body;
   if (needsIncome) {
      body = (
         <div className={card}>
            <ConnectHero
               image={CONNECT_HIPPOS.cashout}
               subtitle={
                  income === 'resend'
                     ? 'We couldn’t use the last one. Please send it again.'
                     : income === 'declined'
                       ? 'The team couldn’t accept the last one. Send another.'
                       : 'Show us 1 month of your income.'
               }
               title="Proof of income"
               trail={<StepTrail current={0} steps={STEPS} />}
            />
            <ul className="flex flex-col gap-1.5 text-[15px] text-[#594d65] dark:text-[#d9cfe8]">
               <li>📱 GCash, Maya or bank history (last 30 days)</li>
               <li>🧾 or your payslip</li>
               <li>🛵 or your earnings screen (Grab, Shopee, Upwork…)</li>
            </ul>
            <PrimaryButton onClick={() => navigate('/documents?back=verify')}>Send my proof</PrimaryButton>
         </div>
      );
   } else if (video && index < videos.length && (videoIndex !== null || watched < videos.length)) {
      const canGo = ended || broken || Boolean(preview);
      body = (
         <div className={card} key={video.id}>
            <ConnectHero
               image={CONNECT_HIPPOS.call}
               subtitle={`Video ${index + 1} of ${videos.length}`}
               title={video.title || 'Watch this'}
               trail={<StepTrail current={1} steps={STEPS} />}
            />
            <BrandedVideo onBroken={() => setBroken(true)} onEnded={() => setEnded(true)} tall={video.tall ?? false} videoId={video.id} />
            <PrimaryButton disabled={!canGo || saving} onClick={() => void nextVideo()}>
               {saving ? <Loader2 aria-label="Saving" className="mx-auto size-5 animate-spin" /> : canGo ? (index + 1 < videos.length ? 'Next video' : 'Done') : 'Watch to the end'}
            </PrimaryButton>
         </div>
      );
   } else {
      const hold = income === 'hold';
      body = (
         <div className={card}>
            <ConnectHero
               image={CONNECT_HIPPOS.waiting}
               subtitle={hold ? 'The team is looking at it. We’ll message you, usually within a day.' : 'Usually a few minutes. You can close this — we’ll message you.'}
               title={hold ? 'Almost there' : 'Checking your proof…'}
               trail={<StepTrail current={2} steps={STEPS} />}
            />
            {hold ? null : (
               <div className="flex justify-center py-2">
                  <Loader2 className="size-7 animate-spin text-[#7661f9]" />
               </div>
            )}
            <GhostButton onClick={() => navigate('/documents?back=verify')}>See what I sent</GhostButton>
         </div>
      );
   }

   return (
      <div className="connect-ui mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-dv2-page">
         <OnboardingHeader
            hideBack
            soundToggle
            tooltip="Questions? Message Moodeng Credit on Facebook or email support@moodeng.app — we usually reply within a day."
         />
         <div className="flex flex-col gap-4 px-4 pb-16 pt-2">{body}</div>
      </div>
   );
}
