import type { ReactNode } from 'react';

import { Loader2 } from 'lucide-react';

import { useLocalization } from '@/i18n';

/** Bahasa first; English when the app is set to English. */
export type WaltLang = 'id' | 'en';

export function useWaltLang(): { lang: WaltLang; toggle: () => void } {
   const { locale, chooseLocale } = useLocalization();
   const lang: WaltLang = locale === 'en' ? 'en' : 'id';
   return { lang, toggle: () => chooseLocale(lang === 'id' ? 'en' : 'id') };
}

export function LangToggle({ lang, onToggle }: { lang: WaltLang; onToggle: () => void }) {
   return (
      <button
         type="button"
         onClick={onToggle}
         className="rounded-full border border-[var(--border-card,#e5e0f5)] px-[10px] py-[3px] text-[11px] font-bold text-[var(--text-muted,#6b6090)]"
      >
         {lang === 'id' ? 'English' : 'Bahasa'}
      </button>
   );
}

export const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function GoldButton({
   children,
   onClick,
   disabled,
   busy,
   type = 'button'
}: {
   children: ReactNode;
   onClick?: () => void;
   disabled?: boolean;
   busy?: boolean;
   type?: 'button' | 'submit';
}) {
   return (
      <button
         type={type}
         onClick={onClick}
         disabled={disabled || busy}
         className="flex min-h-[52px] w-full items-center justify-center gap-[8px] rounded-[36px] bg-[linear-gradient(85deg,#ffe27a_0%,#ffbe1a_98%)] px-[16px] py-[12px] text-[16px] font-bold text-[#4a2a00] shadow-[0_6px_16px_rgba(255,180,0,0.35)] transition active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
      >
         {busy && <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />}
         {children}
      </button>
   );
}

/** Walt's tile: Telegram blue with a wallet glyph (no brand artwork). */
export function WaltIcon({ size = 46 }: { size?: number }) {
   return (
      <span
         aria-hidden="true"
         className="flex shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#37aee2_0%,#1e96c8_100%)] text-white"
         style={{ width: size, height: size }}
      >
         <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="6" width="18" height="13" rx="3" />
            <path d="M16 12.5h2" strokeLinecap="round" />
            <path d="M6 6l9-3 1 3" strokeLinejoin="round" />
         </svg>
      </span>
   );
}
