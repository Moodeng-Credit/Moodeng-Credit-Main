import { type JSX, useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { TelegramLogo } from '@/components/auth/TelegramLoginTile';

import {
   type AppLoginTicket,
   clearAppLogin,
   deviceOs,
   pollAppLogin,
   savedAppLogin,
   startAppLogin,
   telegramAppLink,
   telegramWebLink
} from '@/lib/telegramAppLogin';
import type { AppDispatch } from '@/store/store';
import { completeTelegramSignIn } from '@/views/indonesia/completeTelegramSignIn';
import { pick, useIdLang } from '@/views/indonesia/idFlow';

/**
 * "Daftar dengan Telegram" on /id — signs in through the Telegram APP, so it works inside Facebook's
 * and TikTok's browsers (src/lib/telegramAppLogin.ts). Tap → Telegram opens on our bot → Start →
 * back here, this page notices within ~2 s and carries on to onboarding.
 */

const POLL_MS = 2000;

const COPY = {
   id: {
      waitingTitle: 'Di Telegram: tekan Start, lalu pilih angka ini',
      waitingBody: 'Lalu kembali ke sini. Halaman ini akan lanjut sendiri.',
      numberLabel: 'Angka kamu',
      reopen: 'Buka Telegram lagi',
      notOpening: 'Telegram tidak terbuka?',
      manual: (bot: string) => `Buka Telegram, cari @${bot}, tekan Start.`,
      copyLink: 'Salin link',
      copied: 'Tersalin ✓',
      signingIn: 'Masuk…',
      expired: 'Waktunya habis. Tekan tombol lagi.',
      failed: 'Gagal masuk. Coba lagi.',
      linkedEmail: 'Telegram ini sudah terhubung ke akun Moodeng lain yang masuk dengan email.'
   },
   en: {
      waitingTitle: 'In Telegram: tap Start, then pick this number',
      waitingBody: 'Then come back here. This page carries on by itself.',
      numberLabel: 'Your number',
      reopen: 'Open Telegram again',
      notOpening: 'Telegram didn’t open?',
      manual: (bot: string) => `Open Telegram, search @${bot}, tap Start.`,
      copyLink: 'Copy link',
      copied: 'Copied ✓',
      signingIn: 'Signing in…',
      expired: 'Time ran out. Tap the button again.',
      failed: 'Couldn’t sign in. Try again.',
      linkedEmail: 'This Telegram is linked to another Moodeng account that signs in with email.'
   }
};

const goldClass =
   'flex min-h-[60px] w-full items-center justify-center gap-3 rounded-[18px] px-5 text-[19px] font-extrabold tracking-[-0.01em] text-[#4a2a00] shadow-[0_4px_0_#d99a00,0_10px_22px_rgba(255,190,26,0.35)] transition active:translate-y-[2px]';
const softClass =
   'flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[16px] border-2 border-[#ecdfb8] bg-white px-4 text-[16px] font-bold text-[#6b4a00] transition active:scale-[0.99] dark:border-[#4a3d1c] dark:bg-[#1c1710] dark:text-[#ffd36b]';
const goldStyle = { backgroundImage: 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)' };

export default function TelegramAppSignIn({
   label,
   variant = 'gold',
   idIntent = true,
   preview = false
}: {
   label: string;
   variant?: 'gold' | 'soft';
   /** From /id: join the Indonesia track after signing in. */
   idIntent?: boolean;
   /** Screenshots / design review (dev builds): a made-up ticket, no server calls. 'waiting' = after the tap. */
   preview?: false | 'idle' | 'waiting';
}): JSX.Element {
   const lang = useIdLang();
   const t = pick(lang, COPY);
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const queryClient = useQueryClient();
   // A ticket is fetched as soon as the page shows, so the button is a real link: in-app browsers only
   // hand a tg:// / intent:// link to the Telegram app when it comes straight from a tap.
   const [ticket, setTicket] = useState<AppLoginTicket | null>(() =>
      preview
         ? { code: 'preview', pollSecret: 'preview', botUsername: 'MoodengCreditBot', startParam: 'login_preview', expiresAt: new Date(Date.now() + 600_000).toISOString(), matchNumber: 47 }
         : savedAppLogin()
   );
   const [opened, setOpened] = useState(() => preview === 'waiting' || (!preview && Boolean(savedAppLogin())));
   const [signingIn, setSigningIn] = useState(false);
   const [error, setError] = useState('');
   const [copied, setCopied] = useState(false);
   const finishing = useRef(false);
   const os = deviceOs();

   const fetchTicket = useCallback(async () => {
      try {
         setTicket(await startAppLogin(idIntent ? 'id' : undefined));
         setError('');
      } catch (err) {
         setError(err instanceof Error ? err.message : t.failed);
      }
   }, [idIntent, t.failed]);

   useEffect(() => {
      if (!ticket && !preview) void fetchTicket();
   }, [ticket, fetchTicket, preview]);

   // Refresh a ticket a minute before it runs out while nobody has tapped yet.
   useEffect(() => {
      if (!ticket || opened) return undefined;
      const ms = new Date(ticket.expiresAt).getTime() - Date.now() - 60_000;
      const timer = window.setTimeout(() => {
         clearAppLogin();
         setTicket(null);
      }, Math.max(ms, 5_000));
      return () => window.clearTimeout(timer);
   }, [ticket, opened]);

   const check = useCallback(async () => {
      if (!ticket || finishing.current) return;
      const result = await pollAppLogin(ticket);
      if (result.status === 'waiting') return;
      if (result.status === 'session') {
         finishing.current = true;
         setSigningIn(true);
         clearAppLogin();
         const done = await completeTelegramSignIn({ session: result.session, idIntent, dispatch, queryClient });
         if ('error' in done) {
            finishing.current = false;
            setSigningIn(false);
            setError(done.error);
            return;
         }
         navigate(done.path, { replace: true });
         return;
      }
      // expired / used / invalid / error: start over with a fresh ticket.
      clearAppLogin();
      setOpened(false);
      setTicket(null);
      setError(
         result.status === 'expired'
            ? t.expired
            : result.status === 'error' && result.code === 'LINKED_TO_EMAIL_ACCOUNT'
              ? t.linkedEmail
              : result.status === 'error'
                ? result.message
                : t.failed
      );
   }, [ticket, idIntent, dispatch, queryClient, navigate, t.expired, t.failed, t.linkedEmail]);

   // While waiting: check every 2 s, and right away when they come back to this tab.
   useEffect(() => {
      if (!opened || !ticket || preview) return undefined;
      void check();
      const timer = window.setInterval(() => void check(), POLL_MS);
      const onVisible = () => {
         if (document.visibilityState === 'visible') void check();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      return () => {
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', onVisible);
         window.removeEventListener('focus', onVisible);
      };
   }, [opened, ticket, check, preview]);

   const appHref = ticket ? telegramAppLink(ticket, os) : undefined;
   const webHref = ticket ? telegramWebLink(ticket) : undefined;
   const gold = variant === 'gold';

   const copyLink = async () => {
      if (!webHref) return;
      try {
         await navigator.clipboard.writeText(webHref);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 2000);
      } catch {
         // The manual line is on screen.
      }
   };

   if (signingIn) {
      return (
         <div className={gold ? goldClass : softClass} style={gold ? goldStyle : undefined} aria-busy="true">
            <TelegramLogo size={gold ? 30 : 24} />
            <span>{t.signingIn}</span>
         </div>
      );
   }

   if (opened && ticket) {
      return (
         <div className="flex flex-col gap-3" data-i18n-skip>
            <div className="rounded-[16px] border-2 border-[#bfe3f5] bg-[#eef8fd] px-4 py-3 text-center dark:border-[#1d4a63] dark:bg-[#0f2230]">
               <p className="text-[17px] font-extrabold text-[#0b4f71] dark:text-[#9fd8f5]">{t.waitingTitle}</p>
               <p className="mt-2 text-[13px] font-bold uppercase tracking-wide text-[#2b6b8c] dark:text-[#8cc3dd]">{t.numberLabel}</p>
               <p className="text-[56px] font-black leading-[60px] tracking-[0.08em] text-[#0b4f71] dark:text-white" aria-live="polite">
                  {ticket.matchNumber}
               </p>
               <p className="mt-1 text-[15px] text-[#2b6b8c] dark:text-[#8cc3dd]">{t.waitingBody}</p>
            </div>
            <a href={appHref} className={softClass} rel="noreferrer" target={os === 'other' ? '_blank' : undefined}>
               <TelegramLogo size={24} />
               <span>{t.reopen}</span>
            </a>
            <details className="text-[14px] text-[#7a6a4f] dark:text-[#bfb29a]">
               <summary className="cursor-pointer font-semibold">{t.notOpening}</summary>
               <div className="mt-2 flex flex-col gap-2">
                  <p>{t.manual(ticket.botUsername)}</p>
                  <div className="flex gap-2">
                     <a href={webHref} className="font-semibold text-[#229ED9] underline" rel="noreferrer" target="_blank">
                        t.me/{ticket.botUsername}
                     </a>
                     <button type="button" onClick={() => void copyLink()} className="font-semibold underline">
                        {copied ? t.copied : t.copyLink}
                     </button>
                  </div>
               </div>
            </details>
            {error ? <p className="text-center text-[14px] font-semibold text-[#b42318]">{error}</p> : null}
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-2" data-i18n-skip>
         <a
            href={appHref}
            aria-disabled={!appHref}
            onClick={(event) => {
               if (!appHref) {
                  event.preventDefault();
                  return;
               }
               setOpened(true);
            }}
            className={`${gold ? goldClass : softClass} ${appHref ? '' : 'pointer-events-none opacity-70'}`}
            style={gold ? goldStyle : undefined}
            rel="noreferrer"
            target={os === 'other' ? '_blank' : undefined}
         >
            <TelegramLogo size={gold ? 30 : 24} />
            <span>{label}</span>
         </a>
         {error ? <p className="text-center text-[14px] font-semibold text-[#b42318]">{error}</p> : null}
      </div>
   );
}
