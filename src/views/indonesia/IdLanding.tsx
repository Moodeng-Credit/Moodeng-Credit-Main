import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Loading from '@/components/Loading';

import { ID_ONBOARDING_QUERY_KEY, useIdOnboarding } from '@/hooks/useIdOnboarding';

import { useLocalization } from '@/i18n/LocalizationProvider';
import { ID_PATHS, idTrackErrorText } from '@/lib/idTrack';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import {
   idWaBridgeVisible,
   pick,
   TELEGRAM_APP_STORE_URL,
   TELEGRAM_PLAY_STORE_URL,
   useIdLang,
   useIdTrackSwitch,
   useIdWaBridgeSwitch
} from '@/views/indonesia/idFlow';
import TelegramAppSignIn from '@/views/indonesia/TelegramAppSignIn';
import { AppIcon, Card, ErrorText, GoldButton, IdBanner, IdPage } from '@/views/indonesia/ui';
import WhatsAppBridgeButton from '@/views/indonesia/WhatsAppBridgeButton';

// moodeng.app/id — where Indonesians land from Facebook / TikTok ads (often inside those apps'
// browsers). Bahasa first. One job: get them signed up with Telegram (the bot then messages them about
// everything), and say plainly that Telegram, WhatsApp and Facebook are all needed.
//
// WhatsApp entry (get_id_wa_bridge 'on', or 'test' with ?wa=1): the page leads with "Chat di WhatsApp"
// and three short steps; the Telegram button stays underneath for people who already have Telegram.
// People who leave Facebook's browser don't come back to it, so that path never needs this page again.

const COPY = {
   id: {
      title: 'Pinjaman kecil, cepat',
      subtitle: '$5 – $10, lewat Telegram',
      points: ['⚡ Cepat', '💵 $5 atau $10', '📱 Lewat Telegram'],
      needTitle: 'Kamu perlu:',
      required: 'Wajib',
      walt: 'Dengan Telegram, ubah dolar ke rupiah (dan balik) dengan mudah, kurs bagus (Walt P2P).',
      noTelegram: 'Belum punya Telegram?',
      cta: 'Daftar dengan Telegram',
      continue: 'Lanjut',
      closedTitle: 'Belum dibuka',
      closedBody: 'Pendaftaran Indonesia segera dibuka.',
      signInMember: 'Sudah daftar? Masuk dengan Telegram',
      howTitle: 'Caranya:',
      how: ['Chat kami di WhatsApp', 'Pasang Telegram (kami pandu)', 'Daftar di Telegram'],
      haveTelegram: 'Sudah punya Telegram?',
      noTelegramYet: 'Belum punya Telegram? Chat di WhatsApp',
      lender: 'Akun pemberi pinjaman tidak bisa ikut.',
      notIndonesia: 'Bukan dari Indonesia?'
   },
   en: {
      title: 'Small loans, fast',
      subtitle: '$5 – $10, through Telegram',
      points: ['⚡ Fast', '💵 $5 or $10', '📱 Through Telegram'],
      needTitle: 'You need:',
      required: 'Required',
      walt: 'With Telegram you turn dollars into rupiah (and back) easily, at good rates (Walt P2P).',
      noTelegram: 'No Telegram yet?',
      cta: 'Sign up with Telegram',
      continue: 'Continue',
      closedTitle: 'Not open yet',
      closedBody: 'Indonesia sign-up opens soon.',
      signInMember: 'Already joined? Sign in with Telegram',
      howTitle: 'How it works:',
      how: ['Chat with us on WhatsApp', 'Install Telegram (we guide you)', 'Sign up in Telegram'],
      haveTelegram: 'Already have Telegram?',
      noTelegramYet: 'No Telegram yet? Chat on WhatsApp',
      lender: 'Lender accounts can’t join.',
      notIndonesia: 'Not from Indonesia?'
   }
};

const NEEDED_APPS = ['telegram', 'whatsapp', 'facebook'] as const;

const waLinkClass = 'self-center py-1 text-[14px] font-semibold text-[#7a6a4f] underline dark:text-[#bfb29a]';

export default function IdLanding() {
   const lang = useIdLang();
   const t = pick(lang, COPY);
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const queryClient = useQueryClient();
   const [searchParams] = useSearchParams();
   // Dev builds only: ?preview=1 shows the Telegram button ready to tap (screenshots / design review).
   const landingPreview = import.meta.env.DEV && searchParams.get('preview') === '1';
   const { setLocale, hasChosenLocale } = useLocalization();
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const signedIn = Boolean(user?.id && username);
   const idTrack = useIdOnboarding();
   const trackSwitch = useIdTrackSwitch();
   const waBridgeSwitch = useIdWaBridgeSwitch();
   const [joining, setJoining] = useState(false);
   const [joinError, setJoinError] = useState('');
   const [waOpened, setWaOpened] = useState(false);
   const [waTelegram, setWaTelegram] = useState(false);

   // Bahasa first, unless they picked a language themselves (or the link says ?lang=en).
   useEffect(() => {
      const fromUrl = searchParams.get('lang');
      if (fromUrl === 'en' || fromUrl === 'id') setLocale(fromUrl);
      else if (!hasChosenLocale) setLocale('id');
      // Once, on arrival.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Back from the Telegram callback when joining failed.
   const joined = searchParams.get('joined');
   const closed = trackSwitch.data === 'off' || joined === 'closed';
   const joinedMessage =
      joined === 'existing'
         ? idTrackErrorText('id_track_existing_borrower', lang)
         : joined === 'lender'
           ? t.lender
           : joined === 'error'
             ? idTrackErrorText(undefined, lang)
             : '';

   // Dev builds only: ?preview=wa / ?preview=wa-sent show the WhatsApp entry without the server switch.
   const waPreview = import.meta.env.DEV ? searchParams.get('preview') : null;
   const waEntry =
      !signedIn && !closed && (idWaBridgeVisible(waBridgeSwitch.data, searchParams) || waPreview === 'wa' || waPreview === 'wa-sent');

   // After the tap the steps card makes way for "tap send in WhatsApp" (and the buttons stop sticking).
   const waTapped = waOpened || waPreview === 'wa-sent';

   if (!isAuthChecked || (signedIn && idTrack.isLoading)) return <Loading />;
   if (signedIn && idTrack.isIndo) return <Navigate replace to={ID_PATHS.onboarding} />;

   // Already signed in some other way (not on the track yet): join without signing in again.
   const joinNow = async () => {
      if (joining) return;
      setJoining(true);
      setJoinError('');
      const { error } = await getSupabaseBrowserClient().rpc('join_id_track');
      if (error) {
         setJoining(false);
         setJoinError(error.message?.includes('lender') ? t.lender : idTrackErrorText(error.message, lang));
         return;
      }
      await dispatch(fetchUser())
         .unwrap()
         .catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: [ID_ONBOARDING_QUERY_KEY] });
      navigate(ID_PATHS.onboarding, { replace: true });
   };

   return (
      <IdPage banner={<IdBanner image={CONNECT_HIPPOS.hello} title={t.title} subtitle={t.subtitle} />}>
         <div className="flex flex-wrap gap-2">
            {t.points.map((point) => (
               <span
                  key={point}
                  className="rounded-full bg-white px-3 py-1.5 text-[15px] font-bold text-[#5a3d00] shadow-[0_1px_0_#f0e6c8] dark:bg-[#1a1524] dark:text-[#ffd36b] dark:shadow-none"
               >
                  {point}
               </span>
            ))}
         </div>

         {closed ? (
            <Card className="border-[#ffd36b] bg-[#fff6dc] dark:bg-[#2a220f]">
               <p className="text-[20px] font-extrabold">⏳ {t.closedTitle}</p>
               <p className="text-[16px] text-[#6b4a00] dark:text-[#e6cf8f]">{t.closedBody}</p>
            </Card>
         ) : null}

         {waEntry && (waTapped || waTelegram) ? null : waEntry ? (
            <Card>
               <p className="text-[18px] font-extrabold">{t.howTitle}</p>
               <ol className="flex flex-col gap-2">
                  {t.how.map((line, index) => (
                     <li key={line} className="flex items-center gap-3 rounded-[14px] bg-[#fffaf0] px-3 py-2.5 dark:bg-[#120e1a]">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ffd75a] text-[14px] font-extrabold text-[#4a2a00]">
                           {index + 1}
                        </span>
                        <span className="flex-1 text-[17px] font-bold">{line}</span>
                        <AppIcon app={index === 0 ? 'whatsapp' : 'telegram'} className="text-[26px]" />
                     </li>
                  ))}
               </ol>
            </Card>
         ) : (
            <>
               <Card>
                  <p className="text-[18px] font-extrabold">{t.needTitle}</p>
                  <ul className="flex flex-col gap-2">
                     {NEEDED_APPS.map((app) => (
                        <li key={app} className="flex items-center gap-3 rounded-[14px] bg-[#fffaf0] px-3 py-2.5 dark:bg-[#120e1a]">
                           <AppIcon app={app} className="text-[30px]" />
                           <span className="flex-1 text-[18px] font-bold capitalize">{app === 'whatsapp' ? 'WhatsApp' : app}</span>
                           <span className="rounded-full bg-[#ffe9a8] px-2 py-0.5 text-[12px] font-bold text-[#6b4a00] dark:bg-[#3a2c0b] dark:text-[#ffd36b]">
                              {t.required}
                           </span>
                        </li>
                     ))}
                  </ul>
                  <p className="flex items-start gap-2 text-[15px] leading-[20px] text-[#5a4a2f] dark:text-[#d8cbb0]">
                     <span aria-hidden="true">💱</span>
                     <span>{t.walt}</span>
                  </p>
               </Card>

               <div className="flex flex-col gap-2">
                  <p className="text-[15px] font-semibold text-[#7a6a4f] dark:text-[#bfb29a]">{t.noTelegram}</p>
                  <div className="grid grid-cols-2 gap-2">
                     <a
                        className="flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] bg-black px-3 text-[15px] font-bold text-white dark:bg-white dark:text-black"
                        href={TELEGRAM_PLAY_STORE_URL}
                        rel="noopener noreferrer"
                        target="_blank"
                     >
                        <i aria-hidden="true" className="fab fa-google-play text-[18px]" />
                        Play Store
                     </a>
                     <a
                        className="flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] bg-black px-3 text-[15px] font-bold text-white dark:bg-white dark:text-black"
                        href={TELEGRAM_APP_STORE_URL}
                        rel="noopener noreferrer"
                        target="_blank"
                     >
                        <i aria-hidden="true" className="fab fa-apple text-[20px]" />
                        App Store
                     </a>
                  </div>
               </div>
            </>
         )}

         <div
            className={
               waEntry && (waTapped || waTelegram)
                  ? 'flex flex-col gap-2 pt-2'
                  : waEntry
                    ? 'sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 bg-[#fffaf0] px-4 pb-3 pt-2 dark:bg-[#100d17]'
                    : 'sticky bottom-3 mt-auto flex flex-col gap-2 pt-2'
            }
         >
            <ErrorText>{joinError || joinedMessage}</ErrorText>
            {signedIn ? (
               closed ? null : (
                  <GoldButton busy={joining} onClick={() => void joinNow()}>
                     {t.continue}
                  </GoldButton>
               )
            ) : closed ? (
               // Closed to new people; anyone already on the track still signs in here.
               <TelegramAppSignIn label={t.signInMember} variant="soft" preview={landingPreview && 'idle'} />
            ) : waEntry ? (
               // One button per screen: WhatsApp, or (after the small link) Telegram.
               waTelegram ? (
                  <>
                     <TelegramAppSignIn label={t.cta} preview={waPreview ? 'idle' : false} />
                     <button className={waLinkClass} onClick={() => setWaTelegram(false)} type="button">
                        {t.noTelegramYet}
                     </button>
                  </>
               ) : (
                  <>
                     <WhatsAppBridgeButton onOpened={() => setWaOpened(true)} preview={waPreview === 'wa-sent'} />
                     <button className={waLinkClass} onClick={() => setWaTelegram(true)} type="button">
                        {t.haveTelegram}
                     </button>
                  </>
               )
            ) : (
               <TelegramAppSignIn label={t.cta} preview={landingPreview && 'idle'} />
            )}
         </div>

         <Link className="text-center text-[14px] font-semibold text-[#8a7a5a] underline dark:text-[#bfb29a]" to="/sign-up">
            {t.notIndonesia}
         </Link>
      </IdPage>
   );
}
