import { type ReactNode, useEffect, useMemo, useState } from 'react';

import {
   buildMessengerIntentLink,
   buildMessengerVerifyLink,
   isAndroidBrowser,
   isDesktopBrowser,
   MESSENGER_APP_CHAT_LINK,
   MESSENGER_DESKTOP_CHAT_LINK,
   MESSENGER_PLAY_STORE_LINK,
   NO_MESSENGER_PARAM
} from '@/config/contactVerification';
import { idTrackErrorText, MOODENG_FACEBOOK_PAGE_URL } from '@/lib/idTrack';
import { detectInAppBrowser } from '@/lib/inAppBrowser';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { inputClass, pick, reportIdStep } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { AppIcon, DoneRow, ErrorText, GoldButton, GoldLink, SoftLink, StepHead, WaitRow } from '@/views/indonesia/ui';

// Step 3, Facebook, three parts:
//   1. Messenger: send our Page the code (start_or_reuse_messenger_code; SendPulse confirms it and
//      stamps messenger_verified_at). The way into Messenger differs by phone, like ContactsStep:
//      iPhone Safari/Chrome → m.me with the code; Android Chrome → an intent that comes back here with
//      ?nomsgr=1 when Messenger isn't installed (buildMessengerIntentLink), plus paste the code;
//      in-app browsers → copy the code, open the chat, paste; computers → facebook.com chat + paste.
//   2. Follow our Page (they tick "I followed").
//   3. Their Facebook profile link → save_my_facebook_profile(p_url, p_followed).

const COPY = {
   id: {
      title: 'Hubungkan Facebook',
      subtitle: '3 langkah kecil.',
      m1: 'Kirim kode di Messenger',
      getCode: 'Ambil kode',
      openMessenger: 'Buka Messenger',
      pasteHint: 'Tempel kode ini di chat Moodeng Credit, lalu kirim:',
      iosHint: 'Tidak jalan? Kirim kode ini ke Moodeng Credit di Messenger:',
      copy: 'Salin',
      copied: 'Tersalin',
      waiting: 'Menunggu kode kamu…',
      noMessenger: 'Messenger belum terpasang di HP ini.',
      installMessenger: 'Pasang Messenger',
      useFacebook: 'Atau pakai Facebook',
      messengerDone: 'Messenger terhubung',
      m2: 'Ikuti halaman kami',
      followButton: 'Buka halaman Moodeng',
      followed: 'Saya sudah mengikuti',
      m3: 'Link profil Facebook kamu',
      profileHint: 'Facebook → Profil → ⋯ → Salin link',
      save: 'Simpan',
      profileDone: 'Profil tersimpan, halaman diikuti',
      next: 'Lanjut',
      error: 'Gagal. Coba lagi sebentar lagi.'
   },
   en: {
      title: 'Connect Facebook',
      subtitle: '3 small steps.',
      m1: 'Send the code on Messenger',
      getCode: 'Get the code',
      openMessenger: 'Open Messenger',
      pasteHint: 'Paste this code in the Moodeng Credit chat, then send:',
      iosHint: 'Didn’t work? Send this code to Moodeng Credit on Messenger:',
      copy: 'Copy',
      copied: 'Copied',
      waiting: 'Waiting for your code…',
      noMessenger: 'Messenger isn’t installed on this phone.',
      installMessenger: 'Install Messenger',
      useFacebook: 'Or use Facebook',
      messengerDone: 'Messenger connected',
      m2: 'Follow our page',
      followButton: 'Open the Moodeng page',
      followed: 'I followed the page',
      m3: 'Your Facebook profile link',
      profileHint: 'Facebook → Profile → ⋯ → Copy link',
      save: 'Save',
      profileDone: 'Profile saved, page followed',
      next: 'Continue',
      error: 'Couldn’t start. Try again in a moment.'
   }
};

// Android without Messenger leaves this page for facebook.com: keep the same code when they come back.
const CODE_KEY = 'moodeng.idMessengerCode';
const CODE_TTL_MS = 25 * 60 * 1000;
const readSavedCode = (userId: string): string | null => {
   try {
      const saved = JSON.parse(window.sessionStorage.getItem(CODE_KEY) ?? 'null') as { userId: string; code: string; at: number } | null;
      return saved && saved.userId === userId && Date.now() - saved.at < CODE_TTL_MS ? saved.code : null;
   } catch {
      return null;
   }
};
const saveCode = (userId: string, code: string) => {
   try {
      window.sessionStorage.setItem(CODE_KEY, JSON.stringify({ userId, code, at: Date.now() }));
   } catch {
      // ignore
   }
};

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Where Chrome lands when Messenger isn't installed: this step, marked. */
const noMessengerReturnUrl = () => {
   const url = new URL(window.location.href);
   url.searchParams.set('step', 'facebook');
   url.searchParams.set(NO_MESSENGER_PARAM, '1');
   return url.toString();
};

function Part({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
   return (
      <div className="flex flex-col gap-3 rounded-[20px] border border-[#f0e6c8] bg-white p-4 dark:border-[#2e2638] dark:bg-[#1a1524]">
         <p className="flex items-center gap-2 text-[17px] font-extrabold">
            <span
               className={`grid size-7 shrink-0 place-items-center rounded-full text-[14px] ${done ? 'bg-[#2f9e44] text-white' : 'bg-[#ffd75a] text-[#4a2a00]'}`}
            >
               {done ? '✓' : n}
            </span>
            {title}
         </p>
         {children}
      </div>
   );
}

export default function FacebookStep({ data, user, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const [code, setCode] = useState<string | null>(() => readSavedCode(user.id));
   const [codeBusy, setCodeBusy] = useState(false);
   const [codeError, setCodeError] = useState('');
   const [copied, setCopied] = useState(false);
   const [followed, setFollowed] = useState(false);
   const [profileUrl, setProfileUrl] = useState('');
   const [saving, setSaving] = useState(false);
   const [saveError, setSaveError] = useState('');

   const device = useMemo(() => {
      const inApp = detectInAppBrowser();
      const android = isAndroidBrowser();
      const ios = !android && isIOS();
      return {
         android,
         androidChrome: android && !inApp.isInApp,
         iosSafari: ios && !inApp.isInApp,
         desktop: !android && !ios && isDesktopBrowser()
      };
   }, []);
   // Read once: Chrome came back with ?nomsgr=1 (Messenger isn't installed).
   const noMessengerApp = useMemo(() => new URLSearchParams(window.location.search).get(NO_MESSENGER_PARAM) === '1', []);

   // Drop ?nomsgr=1 from the address once read, so a reload doesn't keep saying it.
   useEffect(() => {
      if (!noMessengerApp) return;
      const url = new URL(window.location.href);
      url.searchParams.delete(NO_MESSENGER_PARAM);
      window.history.replaceState(window.history.state, '', url.toString());
   }, [noMessengerApp]);

   const getCode = async () => {
      if (codeBusy) return;
      setCodeBusy(true);
      setCodeError('');
      try {
         // Reuses a live code (the bot may already have sent one), so asking again is harmless.
         const { data: newCode, error } = await getSupabaseBrowserClient().rpc('start_or_reuse_messenger_code');
         if (error || !newCode) throw error ?? new Error('No code returned');
         setCode(String(newCode));
         saveCode(user.id, String(newCode));
      } catch (err) {
         console.error('[IdOnboarding] start_or_reuse_messenger_code failed', err);
         setCodeError(t.error);
      } finally {
         setCodeBusy(false);
      }
   };

   // Ready before the tap (iPhone hands a tapped m.me link straight to Messenger).
   useEffect(() => {
      if (!data.messenger && !code) void getCode();
      // Once per visit.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Back from Messenger: check right away.
   useEffect(() => {
      if (data.messenger || !code) return undefined;
      const onVisible = () => {
         if (document.visibilityState === 'visible') void refresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      return () => {
         document.removeEventListener('visibilitychange', onVisible);
         window.removeEventListener('focus', onVisible);
      };
   }, [data.messenger, code, refresh]);

   const copyCode = async () => {
      if (!code) return;
      try {
         await navigator.clipboard.writeText(code);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 2000);
      } catch {
         // Clipboard blocked: the code is on screen.
      }
   };

   const saveProfile = async () => {
      if (saving) return;
      setSaving(true);
      setSaveError('');
      const { error } = await getSupabaseBrowserClient().rpc('save_my_facebook_profile', {
         p_url: profileUrl.trim(),
         p_followed: followed
      });
      setSaving(false);
      if (error) {
         setSaveError(idTrackErrorText(error.message, lang));
         return;
      }
      void reportIdStep('facebook');
      await refresh();
   };

   const messengerHref = !code
      ? undefined
      : device.iosSafari
        ? buildMessengerVerifyLink(code)
        : device.androidChrome
          ? buildMessengerIntentLink(noMessengerReturnUrl())
          : device.desktop
            ? MESSENGER_DESKTOP_CHAT_LINK
            : MESSENGER_APP_CHAT_LINK;
   // m.me with the code needs nothing else; every other way, they paste the code.
   const pasteNeeded = !device.iosSafari;

   const codeBox = code ? (
      <div className="flex items-center gap-2">
         <code className="flex-1 rounded-lg bg-[#fff6dc] px-3 py-2 text-center text-[20px] font-bold tracking-wide dark:bg-[#2a220f]">
            {code}
         </code>
         <button
            className="rounded-lg border border-[#ecdfb8] bg-white px-3 py-2 text-[14px] font-bold text-[#6b4a00] dark:border-[#4a3d1c] dark:bg-transparent dark:text-[#ffd36b]"
            onClick={() => void copyCode()}
            type="button"
         >
            {copied ? t.copied : t.copy}
         </button>
      </div>
   ) : null;

   return (
      <>
         <StepHead image={CONNECT_HIPPOS.hello} title={t.title} subtitle={data.steps.facebook ? undefined : t.subtitle} />

         <Part done={data.messenger} n={1} title={t.m1}>
            {data.messenger ? (
               <DoneRow>{t.messengerDone}</DoneRow>
            ) : !code ? (
               <>
                  <GoldButton busy={codeBusy} onClick={() => void getCode()}>
                     {t.getCode}
                  </GoldButton>
                  <ErrorText>{codeError}</ErrorText>
               </>
            ) : (
               <>
                  {noMessengerApp ? (
                     <>
                        <p className="text-[15px] font-bold text-[#a3321f] dark:text-[#ffb4a6]">{t.noMessenger}</p>
                        <GoldLink href={MESSENGER_PLAY_STORE_LINK} rel="noopener noreferrer" target="_blank">
                           <AppIcon app="messenger" className="text-[22px]" />
                           {t.installMessenger}
                        </GoldLink>
                        <SoftLink href={MESSENGER_DESKTOP_CHAT_LINK} rel="noopener noreferrer" target="_blank">
                           <AppIcon app="facebook" className="text-[20px]" />
                           {t.useFacebook}
                        </SoftLink>
                     </>
                  ) : (
                     <GoldLink
                        href={messengerHref}
                        onClick={pasteNeeded ? () => void copyCode() : undefined}
                        rel="noopener noreferrer"
                        target={device.desktop ? '_blank' : undefined}
                     >
                        <AppIcon app="messenger" className="text-[22px]" />
                        {t.openMessenger}
                     </GoldLink>
                  )}
                  <p className="text-[14px] leading-[19px] text-[#5a4a2f] dark:text-[#d8cbb0]">{pasteNeeded ? t.pasteHint : t.iosHint}</p>
                  {codeBox}
                  <WaitRow>{t.waiting}</WaitRow>
               </>
            )}
         </Part>

         <Part done={data.facebookProfile} n={2} title={t.m2}>
            {data.facebookProfile ? null : (
               <>
                  <SoftLink href={MOODENG_FACEBOOK_PAGE_URL} rel="noopener noreferrer" target="_blank">
                     <AppIcon app="facebook" className="text-[20px]" />
                     {t.followButton}
                  </SoftLink>
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[14px] bg-[#fffaf0] px-3 text-[16px] font-bold dark:bg-[#120e1a]">
                     <input
                        checked={followed}
                        className="size-6 accent-[#ffbe1a]"
                        onChange={(e) => setFollowed(e.target.checked)}
                        type="checkbox"
                     />
                     {t.followed}
                  </label>
               </>
            )}
         </Part>

         <Part done={data.facebookProfile} n={3} title={t.m3}>
            {data.facebookProfile ? (
               <DoneRow>{t.profileDone}</DoneRow>
            ) : (
               <>
                  <input
                     autoCapitalize="none"
                     autoCorrect="off"
                     className={inputClass}
                     inputMode="url"
                     onChange={(e) => setProfileUrl(e.target.value)}
                     placeholder="facebook.com/namakamu"
                     type="url"
                     value={profileUrl}
                  />
                  <p className="text-[13px] text-[#7a6a4f] dark:text-[#bfb29a]">{t.profileHint}</p>
                  <GoldButton busy={saving} disabled={!profileUrl.trim() || !followed} onClick={() => void saveProfile()}>
                     {t.save}
                  </GoldButton>
                  <ErrorText>{saveError}</ErrorText>
               </>
            )}
         </Part>

         {data.steps.facebook ? <GoldButton onClick={onDone}>{t.next}</GoldButton> : null}
      </>
   );
}
