import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { Check, Loader2 } from 'lucide-react';

import { useLocalization } from '@/i18n/LocalizationProvider';
import { GOLD_GRADIENT, useIdLang } from '@/views/indonesia/idFlow';

/**
 * The small visual kit for the Indonesia screens: a phone-width page with a Moodeng banner, a big gold
 * main button, quiet secondary buttons, and the ID | EN switch. Everything carries data-i18n-skip so
 * the app-wide DOM translator leaves our own Bahasa/English copy alone.
 */

const GOLD_TEXT = '#4a2a00';

const goldClass =
   'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] px-5 text-[18px] font-extrabold tracking-[-0.01em] shadow-[0_4px_0_#d99a00,0_10px_22px_rgba(255,190,26,0.35)] transition active:translate-y-[2px] active:shadow-[0_2px_0_#d99a00] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';

export function GoldButton({
   children,
   className = '',
   busy = false,
   disabled,
   ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
   return (
      <button
         type="button"
         {...rest}
         disabled={disabled || busy}
         aria-busy={busy}
         className={`${goldClass} ${className}`}
         style={{ backgroundImage: GOLD_GRADIENT, color: GOLD_TEXT }}
      >
         {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" strokeWidth={3} /> : null}
         {children}
      </button>
   );
}

/** The gold button as a real link (opening other apps from a tap works in in-app browsers). */
export function GoldLink({ children, className = '', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
   return (
      <a {...rest} className={`${goldClass} ${className}`} style={{ backgroundImage: GOLD_GRADIENT, color: GOLD_TEXT }}>
         {children}
      </a>
   );
}

const softClass =
   'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#ecdfb8] bg-white px-4 text-[16px] font-bold text-[#6b4a00] transition active:scale-[0.99] disabled:opacity-50 dark:border-[#4a3d1c] dark:bg-[#1c1710] dark:text-[#ffd36b]';

export function SoftButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
   return (
      <button type="button" {...rest} className={`${softClass} ${className}`}>
         {children}
      </button>
   );
}

export function SoftLink({ children, className = '', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
   return (
      <a {...rest} className={`${softClass} ${className}`}>
         {children}
      </a>
   );
}

/** ID | EN. Picking one switches the whole app (and is remembered like any language choice). */
export function LangToggle() {
   const { chooseLocale } = useLocalization();
   const lang = useIdLang();
   return (
      <div
         role="group"
         aria-label="Bahasa / Language"
         className="flex rounded-full border border-[#ecdfb8] bg-white/80 p-0.5 text-[13px] font-bold dark:border-[#4a3d1c] dark:bg-black/30"
      >
         {(['id', 'en'] as const).map((code) => (
            <button
               key={code}
               type="button"
               aria-pressed={lang === code}
               onClick={() => chooseLocale(code)}
               className={`min-w-[40px] rounded-full px-2.5 py-1 ${lang === code ? 'bg-[#ffd75a] text-[#4a2a00]' : 'text-[#8a7a5a] dark:text-[#c9b98f]'}`}
            >
               {code.toUpperCase()}
            </button>
         ))}
      </div>
   );
}

/** Phone-width page with the gold Moodeng banner on top. */
export function IdPage({
   children,
   banner,
   top,
   skipBody = true
}: {
   children: ReactNode;
   banner?: ReactNode;
   top?: ReactNode;
   /** False when the body embeds shared English components the app's translator must reach. */
   skipBody?: boolean;
}) {
   return (
      <div className="min-h-screen bg-[#fffaf0] text-[#2b2116] dark:bg-[#100d17] dark:text-[#f5efe3]">
         <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col">
            <div data-i18n-skip className="flex items-center justify-between gap-3 px-4 pt-3">
               <div className="flex min-w-0 items-center gap-2">
                  <img alt="" aria-hidden="true" className="size-7 rounded-full" src="/moodenglogo.png" />
                  <span className="truncate text-[15px] font-extrabold tracking-[-0.01em]">Moodeng Credit</span>
               </div>
               <LangToggle />
            </div>
            {top ? <div data-i18n-skip>{top}</div> : null}
            {banner ? <div data-i18n-skip>{banner}</div> : null}
            <div className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-4" data-i18n-skip={skipBody ? true : undefined}>
               {children}
            </div>
         </div>
      </div>
   );
}

/** Hippo art in a soft gold banner with one short headline. */
export function IdBanner({ image, title, subtitle }: { image: string; title: ReactNode; subtitle?: ReactNode }) {
   return (
      <div className="mx-4 mt-3 flex items-end gap-2 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#fff3c4] via-[#ffe58a] to-[#ffc93b] px-4 pt-3 dark:from-[#3a2c0b] dark:via-[#2c220c] dark:to-[#1d160a]">
         <div className="min-w-0 flex-1 pb-4">
            <h1 className="text-[26px] font-extrabold leading-[30px] tracking-[-0.02em] text-[#3d2600] dark:text-[#ffe9a8]">{title}</h1>
            {subtitle ? (
               <p className="mt-1 text-[16px] font-semibold leading-[21px] text-[#6b4a00] dark:text-[#e6cf8f]">{subtitle}</p>
            ) : null}
         </div>
         <img alt="" aria-hidden="true" className="h-[120px] w-[104px] shrink-0 select-none object-contain" draggable={false} src={image} />
      </div>
   );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
   return (
      <div
         className={`flex flex-col gap-3 rounded-[20px] border border-[#f0e6c8] bg-white p-4 shadow-[0_2px_0_#f0e6c8] dark:border-[#2e2638] dark:bg-[#1a1524] dark:shadow-none ${className}`}
      >
         {children}
      </div>
   );
}

/** One step's heading: hippo + title (+ one short line). */
export function StepHead({ image, title, subtitle }: { image: string; title: ReactNode; subtitle?: ReactNode }) {
   return (
      <div className="flex items-center gap-3">
         <img alt="" aria-hidden="true" className="h-[84px] w-[72px] shrink-0 select-none object-contain" draggable={false} src={image} />
         <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold leading-[26px] tracking-[-0.01em]">{title}</h2>
            {subtitle ? <p className="mt-1 text-[15px] leading-[20px] text-[#7a6a4f] dark:text-[#bfb29a]">{subtitle}</p> : null}
         </div>
      </div>
   );
}

/** A green "done" row. */
export function DoneRow({ children }: { children: ReactNode }) {
   return (
      <div className="flex items-center gap-3 rounded-[16px] bg-[#eafbef] px-4 py-3 text-[16px] font-bold text-[#1f7a3d] dark:bg-[#12301e] dark:text-[#8fe3a8]">
         <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#2f9e44] text-white">
            <Check aria-hidden="true" className="size-4" strokeWidth={3} />
         </span>
         <span className="min-w-0 flex-1">{children}</span>
      </div>
   );
}

/** A spinner row for "waiting for …". */
export function WaitRow({ children }: { children: ReactNode }) {
   return (
      <div
         aria-live="polite"
         className="flex items-center gap-3 rounded-[16px] bg-[#fff6dc] px-4 py-3 text-[15px] font-semibold text-[#6b4a00] dark:bg-[#2a220f] dark:text-[#ffd36b]"
      >
         <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin" strokeWidth={3} />
         <span className="min-w-0">{children}</span>
      </div>
   );
}

export function ErrorText({ children }: { children: ReactNode }) {
   if (!children) return null;
   return <p className="text-[15px] font-semibold text-[#c0392b] dark:text-[#ff8a7a]">{children}</p>;
}

/** Brand icons (Font Awesome is loaded app-wide). */
export function AppIcon({
   app,
   className = 'text-[28px]'
}: {
   app: 'telegram' | 'whatsapp' | 'facebook' | 'messenger';
   className?: string;
}) {
   const map = {
      telegram: { icon: 'fa-telegram', color: '#229ED9' },
      whatsapp: { icon: 'fa-whatsapp', color: '#25D366' },
      facebook: { icon: 'fa-facebook', color: '#1877F2' },
      messenger: { icon: 'fa-facebook-messenger', color: '#0084FF' }
   } as const;
   return <i aria-hidden="true" className={`fab ${map[app].icon} leading-none ${className}`} style={{ color: map[app].color }} />;
}
