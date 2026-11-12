import { type ReactElement, useCallback, useEffect, useState } from 'react';

import { Check } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Loading from '@/components/Loading';

import { useIdOnboarding } from '@/hooks/useIdOnboarding';

import { ID_PATHS, ID_STEP_ORDER, type IdOnboarding as IdOnboardingData, type IdStepKey } from '@/lib/idTrack';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { currentIdStep, ID_STEP_LABELS, isIdStepKey, pick, useIdLang } from '@/views/indonesia/idFlow';
import AboutStep from '@/views/indonesia/steps/AboutStep';
import CallStep from '@/views/indonesia/steps/CallStep';
import ContinueInTelegram from '@/views/indonesia/steps/ContinueInTelegram';
import TelegramAppSignIn from '@/views/indonesia/TelegramAppSignIn';
import FacebookStep from '@/views/indonesia/steps/FacebookStep';
import IncomeStep from '@/views/indonesia/steps/IncomeStep';
import KycStep from '@/views/indonesia/steps/KycStep';
import TelegramStep from '@/views/indonesia/steps/TelegramStep';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import WaltStep from '@/views/indonesia/steps/WaltStep';
import WhatsAppStep from '@/views/indonesia/steps/WhatsAppStep';
import { GoldButton, IdPage, StepHead } from '@/views/indonesia/ui';

// moodeng.app/id/onboarding — the Indonesia track's 8 steps (src/lib/idTrack.ts; the order and what
// counts as done live in SQL, id_onboarding_status). It opens on their next step; ?step=<key> opens one
// (the bot's links, the trail, Didit's return). A step ahead of their next one shows what to finish
// first. Steps that wait on something outside the app (Telegram Start, the WhatsApp / Messenger code,
// Didit, the team) poll my_id_onboarding() every few seconds.

const STEPS: Record<IdStepKey, (props: IdStepProps) => ReactElement> = {
   telegram: TelegramStep,
   whatsapp: WhatsAppStep,
   facebook: FacebookStep,
   about: AboutStep,
   income: IncomeStep,
   kyc: KycStep,
   walt: WaltStep,
   call: CallStep
};

// Steps that wait on something outside the app.
const POLLED: ReadonlySet<IdStepKey> = new Set(['telegram', 'whatsapp', 'facebook', 'kyc', 'call']);
// Steps needing the camera or file uploads: offer "continue in Telegram" if that fails in this browser.
const CAMERA_OR_UPLOAD: ReadonlySet<IdStepKey> = new Set(['income', 'kyc']);
// Steps that embed shared (English, app-translated) components: the DOM translator must reach them.
const TRANSLATED: ReadonlySet<IdStepKey> = new Set(['about', 'call']);

const COPY = {
   id: {
      step: (n: number, all: number) => `Langkah ${n} dari ${all}`,
      lockedTitle: 'Belum bisa',
      lockedBody: (label: string) => `Selesaikan “${label}” dulu.`,
      goNext: (label: string) => `Ke ${label}`,
      logOut: 'Keluar'
   },
   en: {
      step: (n: number, all: number) => `Step ${n} of ${all}`,
      lockedTitle: 'Not yet',
      lockedBody: (label: string) => `Finish “${label}” first.`,
      goNext: (label: string) => `Go to ${label}`,
      logOut: 'Log out'
   }
};

function Trail({ data, current, onPick }: { data: IdOnboardingData; current: IdStepKey; onPick: (step: IdStepKey) => void }) {
   const lang = useIdLang();
   const t = pick(lang, COPY);
   const index = ID_STEP_ORDER.indexOf(current);
   const nextIndex = isIdStepKey(data.next) ? ID_STEP_ORDER.indexOf(data.next) : ID_STEP_ORDER.length;
   return (
      <div className="px-4 pt-3">
         <ol className="flex items-center justify-between gap-1" aria-label={t.step(index + 1, ID_STEP_ORDER.length)}>
            {ID_STEP_ORDER.map((key, i) => {
               const done = data.steps[key];
               const isCurrent = key === current;
               const reachable = done || i <= nextIndex;
               return (
                  <li key={key} className="flex flex-1 items-center">
                     <button
                        aria-current={isCurrent ? 'step' : undefined}
                        aria-label={pick(lang, ID_STEP_LABELS[key])}
                        className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-extrabold transition ${
                           done
                              ? 'bg-[#2f9e44] text-white'
                              : isCurrent
                                ? 'bg-[#ffd75a] text-[#4a2a00] ring-4 ring-[#ffe9a8] dark:ring-[#4a3a10]'
                                : 'bg-[#efe6cc] text-[#9a8a6a] dark:bg-[#2a2335] dark:text-[#8a7f99]'
                        } ${isCurrent && done ? 'ring-4 ring-[#bfeccb] dark:ring-[#1d4a2c]' : ''}`}
                        disabled={!reachable}
                        onClick={() => onPick(key)}
                        type="button"
                     >
                        {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3.5} /> : i + 1}
                     </button>
                     {i < ID_STEP_ORDER.length - 1 ? (
                        <span className={`mx-0.5 h-1 flex-1 rounded-full ${done ? 'bg-[#2f9e44]' : 'bg-[#efe6cc] dark:bg-[#2a2335]'}`} />
                     ) : null}
                  </li>
               );
            })}
         </ol>
         <p className="mt-2 text-center text-[14px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">
            {t.step(index + 1, ID_STEP_ORDER.length)} · {pick(lang, ID_STEP_LABELS[current])}
         </p>
      </div>
   );
}

/** /id/onboarding-preview?step=<key> (preview builds only, like /repay-preview): every earlier step
 *  shows done, nothing is saved, and server calls just fail. For screenshots and design review. */
const previewData = (step: IdStepKey): IdOnboardingData => {
   const at = ID_STEP_ORDER.indexOf(step);
   return {
      market: 'ID',
      track: 'on',
      rules: { amounts: [5, 10], maxTermDays: 14 },
      steps: Object.fromEntries(ID_STEP_ORDER.map((k, i) => [k, i < at])) as Record<IdStepKey, boolean>,
      messenger: false,
      facebookProfile: false,
      incomeState: null,
      kycApproved: false,
      kycState: '',
      access: 'none',
      readyForKyc: at >= ID_STEP_ORDER.indexOf('kyc'),
      readyForCall: at >= ID_STEP_ORDER.indexOf('call'),
      next: step
   };
};
const PREVIEW_USER = { id: 'preview', username: 'preview', walletAddress: '0x0000000000000000000000000000000000000001' } as unknown as User;

// A way out of onboarding: sign out and land back on moodeng.app/id.
function LogOutLink({ lang }: { lang: IdStepProps['lang'] }) {
   const t = pick(lang, COPY);
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const [loggingOut, setLoggingOut] = useState(false);
   const logOut = async () => {
      setLoggingOut(true);
      await dispatch(logoutUser());
      navigate(ID_PATHS.landing, { replace: true });
   };
   return (
      <button
         className="mx-auto mt-auto pt-6 text-[14px] font-semibold text-[#8a7a5c] underline underline-offset-4 disabled:opacity-50 dark:text-[#a89a80]"
         data-i18n-skip
         disabled={loggingOut}
         onClick={() => void logOut()}
         type="button"
      >
         {t.logOut}
      </button>
   );
}

export function IdOnboardingPreview() {
   const lang = useIdLang();
   const [searchParams, setSearchParams] = useSearchParams();
   const stepParam = searchParams.get('step');
   if (stepParam === 'signin') {
      return (
         <IdPage skipBody={false}>
            <div className="flex flex-col gap-4">
               <StepHead image="/hippos/thinking.png" title="Daftar dengan Telegram" />
               <TelegramAppSignIn label="Daftar dengan Telegram" preview="waiting" />
            </div>
         </IdPage>
      );
   }
   const current: IdStepKey = isIdStepKey(stepParam) ? stepParam : 'telegram';
   const data = previewData(current);
   const Step = STEPS[current];
   const goTo = (step: IdStepKey | null) => setSearchParams(step ? { step } : {});
   return (
      <IdPage skipBody={false} top={<Trail current={current} data={{ ...data, next: 'call' }} onPick={goTo} />}>
         <div key={current} className="flex flex-col gap-4" data-i18n-skip={TRANSLATED.has(current) ? undefined : true}>
            <Step data={data} lang={lang} onDone={() => undefined} refresh={async () => undefined} user={PREVIEW_USER} />
         </div>
         <LogOutLink lang={lang} />
      </IdPage>
   );
}

export default function IdOnboarding() {
   const lang = useIdLang();
   const t = pick(lang, COPY);
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const authLoading = useSelector((state: RootState) => state.auth.isLoading);
   const signedIn = Boolean(user?.id && username);
   const [searchParams, setSearchParams] = useSearchParams();
   const stepParam = searchParams.get('step');
   const [poll, setPoll] = useState(true);
   const { data, isIndo, isLoading, refresh } = useIdOnboarding({ poll });

   const current: IdStepKey | null = data && isIndo ? (isIdStepKey(stepParam) ? stepParam : currentIdStep(data)) : null;
   useEffect(() => {
      setPoll(current ? POLLED.has(current) : false);
   }, [current]);

   const goTo = useCallback(
      (step: IdStepKey | null) => {
         const next = new URLSearchParams();
         if (step) next.set('step', step);
         setSearchParams(next);
         window.scrollTo({ top: 0 });
      },
      [setSearchParams]
   );

   // A finished step moves on to whatever is next now (re-read first, so it's current).
   const onDone = useCallback(() => {
      void refresh().then(() => goTo(null));
   }, [refresh, goTo]);

   if (!isAuthChecked || authLoading) return <Loading />;
   if (!signedIn || !user) return <Navigate replace to={ID_PATHS.landing} />;
   if (isLoading || !data) return <Loading />;
   if (!isIndo || !current) return <Navigate replace to={ID_PATHS.landing} />;

   const nextIndex = isIdStepKey(data.next) ? ID_STEP_ORDER.indexOf(data.next) : ID_STEP_ORDER.length;
   const locked = !data.steps[current] && ID_STEP_ORDER.indexOf(current) > nextIndex;
   const Step = STEPS[current];
   const nextLabel = isIdStepKey(data.next) ? pick(lang, ID_STEP_LABELS[data.next]) : '';

   return (
      <IdPage skipBody={false} top={<Trail current={current} data={data} onPick={goTo} />}>
         {locked ? (
            <div data-i18n-skip className="flex flex-col gap-4">
               <StepHead image="/hippos/thinking.png" title={t.lockedTitle} subtitle={t.lockedBody(nextLabel)} />
               <GoldButton onClick={() => goTo(null)}>{t.goNext(nextLabel)}</GoldButton>
            </div>
         ) : (
            <div key={current} className="flex flex-col gap-4" data-i18n-skip={TRANSLATED.has(current) ? undefined : true}>
               <Step data={data} lang={lang} onDone={onDone} refresh={refresh} user={user} />
               {CAMERA_OR_UPLOAD.has(current) && !data.steps[current] ? <ContinueInTelegram lang={lang} step={current} /> : null}
            </div>
         )}
         <LogOutLink lang={lang} />
      </IdPage>
   );
}
