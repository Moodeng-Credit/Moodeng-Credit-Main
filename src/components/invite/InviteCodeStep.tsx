import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { Check, Loader2 } from 'lucide-react';
import posthog from 'posthog-js';

import type { LocaleCode } from '@/i18n/translations';
import { useLocalization } from '@/i18n/LocalizationProvider';
import { applyInviteCode } from '@/lib/friendReferrals';
import {
   cleanInviteInput,
   type InviteSuggestion,
   markCodeStepDone,
   parkInviteCode,
   suggestInviteCode
} from '@/lib/inviteCodeStep';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

const COPY = {
   en: {
      title: 'Who invited you?',
      subtitle: 'Type their name or code so they get credit.',
      placeholder: 'Their name or code',
      tap: 'Tap to use',
      matched: '{name} invited you! 🎉',
      matchedCode: 'Code {code} found! 🎉',
      notFound: 'No code like that yet. Keep typing or ask them.',
      next: 'Continue',
      skip: 'No one invited me',
      error: 'Couldn’t add it. Try again.'
   },
   fil: {
      title: 'Sino ang nag-invite sa’yo?',
      subtitle: 'I-type ang pangalan o code nila para ma-credit sila.',
      placeholder: 'Pangalan o code nila',
      tap: 'I-tap para gamitin',
      matched: 'Inimbitahan ka ni {name}! 🎉',
      matchedCode: 'Nahanap ang code {code}! 🎉',
      notFound: 'Wala pang ganyang code. Ituloy lang o itanong sa kanila.',
      next: 'Tuloy',
      skip: 'Walang nag-invite sa akin',
      error: 'Hindi naidagdag. Subukan ulit.'
   },
   id: {
      title: 'Siapa yang mengundangmu?',
      subtitle: 'Ketik nama atau kodenya supaya mereka dapat kredit.',
      placeholder: 'Nama atau kode mereka',
      tap: 'Ketuk untuk pakai',
      matched: '{name} mengundangmu! 🎉',
      matchedCode: 'Kode {code} ketemu! 🎉',
      notFound: 'Kode belum ketemu. Lanjut ketik atau tanya mereka.',
      next: 'Lanjut',
      skip: 'Tidak ada yang mengundang',
      error: 'Gagal menambahkan. Coba lagi.'
   },
   th: {
      title: 'ใครชวนคุณมา?',
      subtitle: 'พิมพ์ชื่อหรือโค้ดของเขา เพื่อให้เขาได้เครดิต',
      placeholder: 'ชื่อหรือโค้ดของเขา',
      tap: 'แตะเพื่อใช้',
      matched: '{name} ชวนคุณมา! 🎉',
      matchedCode: 'เจอโค้ด {code} แล้ว! 🎉',
      notFound: 'ยังไม่พบโค้ดนี้ พิมพ์ต่อหรือถามเขาอีกครั้ง',
      next: 'ต่อไป',
      skip: 'ไม่มีใครชวน',
      error: 'เพิ่มไม่สำเร็จ ลองอีกครั้ง'
   },
   vi: {
      title: 'Ai đã mời bạn?',
      subtitle: 'Nhập tên hoặc mã của họ để họ được ghi nhận.',
      placeholder: 'Tên hoặc mã của họ',
      tap: 'Chạm để dùng',
      matched: '{name} đã mời bạn! 🎉',
      matchedCode: 'Đã tìm thấy mã {code}! 🎉',
      notFound: 'Chưa có mã này. Gõ tiếp hoặc hỏi lại họ.',
      next: 'Tiếp tục',
      skip: 'Không ai mời tôi',
      error: 'Không thêm được. Thử lại.'
   },
   es: {
      title: '¿Quién te ha invitado?',
      subtitle: 'Escribe su nombre o código para que se lo reconozcamos.',
      placeholder: 'Su nombre o código',
      tap: 'Toca para usarlo',
      matched: '¡{name} te ha invitado! 🎉',
      matchedCode: '¡Código {code} encontrado! 🎉',
      notFound: 'Todavía no hay ningún código así. Sigue escribiendo o pregúntaselo.',
      next: 'Continuar',
      skip: 'Nadie me ha invitado',
      error: 'No se ha podido añadir. Inténtalo de nuevo.'
   }
} satisfies Record<LocaleCode, Record<string, string>>;

const track = (action: 'shown' | 'added' | 'skipped', source: string, code?: string) => {
   try {
      posthog.capture('invite_code_step', { action, source, ...(code ? { code } : {}) });
   } catch {
      // Analytics must never block the step.
   }
};

const INPUT_TEXT = 'text-[22px] font-extrabold tracking-[0.06em]';

/**
 * "Who invited you?" — the first screen of sign-up and of the pre-screening link. As they type, the
 * matching code finishes itself in light purple (MAH → MAHJID): tap the chip, Tab or → to fill it in,
 * and the hippo cheers "Mahjid invited you!". Signed out, the code is parked and attached right after
 * sign-up; signed in, it's added now. "No one invited me" is one tap.
 */
export default function InviteCodeStep({
   source,
   signedIn,
   onDone
}: {
   source: 'signup' | 'screen';
   signedIn: boolean;
   onDone: () => void;
}) {
   const { locale } = useLocalization();
   const copy = COPY[locale] ?? COPY.en;
   const [input, setInput] = useState('');
   const [suggestion, setSuggestion] = useState<InviteSuggestion | null>(null);
   const [looking, setLooking] = useState(false);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const inputRef = useRef<HTMLInputElement>(null);
   const lastAsked = useRef('');

   useEffect(() => track('shown', source), [source]);

   // Ask the server for the code their typing points to (debounced; the newest answer wins).
   useEffect(() => {
      setError('');
      if (input.length < 2) {
         setSuggestion(null);
         setLooking(false);
         return;
      }
      if (suggestion && suggestion.code.startsWith(input)) {
         lastAsked.current = input;
         setLooking(false);
         return;
      }
      setLooking(true);
      lastAsked.current = input;
      const timer = window.setTimeout(() => {
         void suggestInviteCode(input).then((found) => {
            if (lastAsked.current !== input) return;
            setSuggestion(found);
            setLooking(false);
         });
      }, 220);
      return () => window.clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text starts a lookup
   }, [input]);

   // A prefix (MAH) or their full name as one word (MAHJIDMARCELO) both point to MAHJID.
   const match =
      suggestion && input.length >= 2 && (suggestion.code.startsWith(input) || input.startsWith(suggestion.code)) ? suggestion : null;
   const exact = match && match.code === input ? match : null;
   const ghost = match && !exact && match.code.startsWith(input) ? match.code.slice(input.length) : '';

   const fill = () => {
      if (!match) return;
      setInput(match.code);
      inputRef.current?.focus();
   };

   const finish = async () => {
      if (!exact || busy) return;
      if (!signedIn) {
         parkInviteCode(exact.code);
         // Put it on the address too, so "Open in Chrome" (a different browser, empty storage) carries it.
         try {
            const url = new URL(window.location.href);
            url.searchParams.set('ref', exact.code);
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
         } catch {
            // Only the hand-off loses it; this browser still has it parked.
         }
      } else {
         setBusy(true);
         const result = await applyInviteCode(exact.code);
         setBusy(false);
         // Already has a code (the first one stays) is fine too; anything else, say so and let them skip.
         if (!result.ok && result.reason !== 'already') {
            setError(copy.error);
            return;
         }
      }
      markCodeStepDone();
      track('added', source, exact.code);
      onDone();
   };

   const skip = () => {
      markCodeStepDone();
      track('skipped', source);
      onDone();
   };

   const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (match && !exact && (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'Enter')) {
         event.preventDefault();
         fill();
      } else if (event.key === 'Enter') {
         event.preventDefault();
         void finish();
      }
   };

   const title = exact
      ? exact.inviter
         ? copy.matched.replace('{name}', exact.inviter)
         : copy.matchedCode.replace('{code}', exact.code)
      : copy.title;
   const notFound = input.length >= 2 && !looking && !match;

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-4 px-4 pb-16 pt-4">
            <div className="flex items-center justify-center gap-2">
               <img alt="" className="size-7 rounded-full object-contain" src="/moodenglogo.png" />
               <span className="text-[16px] font-extrabold text-[#3b2f4a] dark:text-[#f5f0ff]">Moodeng Credit</span>
            </div>

            <div className="flex flex-col gap-4 overflow-hidden rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
               <ConnectHero
                  image={exact ? CONNECT_HIPPOS.approved : CONNECT_HIPPOS.codeCopied}
                  key={exact ? 'yay' : 'ask'}
                  subtitle={exact ? undefined : copy.subtitle}
                  title={title}
               />

               <div
                  className={`relative flex items-center rounded-[16px] border-2 bg-white transition-colors dark:bg-[#1b1526] ${
                     exact
                        ? 'border-[#22a06b] shadow-[0_0_0_4px_rgba(34,160,107,0.12)]'
                        : 'border-[#e2dcee] focus-within:border-[#7661f9] focus-within:shadow-[0_0_0_4px_rgba(118,97,249,0.12)] dark:border-[#3a2d4f]'
                  }`}
               >
                  {/* The rest of the matching code, in light purple right after what they typed. */}
                  <div
                     aria-hidden="true"
                     className={`pointer-events-none absolute inset-y-0 left-0 right-12 flex items-center overflow-hidden whitespace-pre px-4 ${INPUT_TEXT}`}
                  >
                     <span className="invisible">{input}</span>
                     <span className="text-[#c9bef9] dark:text-[#5d4f8a]">{ghost}</span>
                  </div>
                  <input
                     aria-label={copy.title}
                     autoCapitalize="characters"
                     autoComplete="off"
                     autoCorrect="off"
                     className={`relative min-w-0 flex-1 bg-transparent px-4 py-3.5 uppercase text-[#3b2f4a] outline-none placeholder:text-[16px] placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-[#b3a9c2] dark:text-[#f5f0ff] ${INPUT_TEXT}`}
                     enterKeyHint={ghost ? 'done' : 'go'}
                     inputMode="text"
                     maxLength={24}
                     onChange={(event) => setInput(cleanInviteInput(event.target.value))}
                     onKeyDown={onKeyDown}
                     placeholder={copy.placeholder}
                     ref={inputRef}
                     spellCheck={false}
                     value={input}
                  />
                  <span className="grid w-12 shrink-0 place-items-center">
                     {exact ? (
                        <span className="grid size-7 place-items-center rounded-full bg-[#22a06b] text-white">
                           <Check className="size-4" strokeWidth={3} />
                        </span>
                     ) : looking ? (
                        <Loader2 className="size-5 animate-spin text-[#b3a9c2]" />
                     ) : null}
                  </span>
               </div>

               {match && !exact ? (
                  <button
                     className="connect-bubble-in flex w-full items-center gap-3 rounded-[16px] border-2 border-dashed border-[#c9bef9] bg-[#f8f4ff] px-4 py-3 text-left transition active:scale-[0.98] dark:border-[#4b3d75] dark:bg-[#1e1630]"
                     onClick={fill}
                     type="button"
                  >
                     <span className="text-[22px]" aria-hidden="true">
                        👆
                     </span>
                     <span className="min-w-0 flex-1">
                        <span className="block text-[18px] font-extrabold tracking-[0.06em] text-[#6b55f7] dark:text-[#b4a6ff]">
                           {match.code}
                        </span>
                        {match.inviter ? (
                           <span className="block text-[13px] font-semibold text-[#7b6b8c] dark:text-[#b9abcc]">{match.inviter}</span>
                        ) : null}
                     </span>
                     <span className="shrink-0 rounded-full bg-[#6b55f7] px-3 py-1.5 text-[13px] font-bold text-white">{copy.tap}</span>
                  </button>
               ) : null}

               {notFound ? <p className="text-center text-[14px] font-semibold text-[#8a7c9c]">{copy.notFound}</p> : null}
               {error ? <p className="text-center text-[14px] font-semibold text-[#c2410c]">{error}</p> : null}

               <PrimaryButton disabled={!exact || busy} onClick={() => void finish()}>
                  {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : copy.next}
               </PrimaryButton>
               <GhostButton className="-mt-1" onClick={skip}>
                  {copy.skip}
               </GhostButton>
            </div>
         </div>
      </div>
   );
}
