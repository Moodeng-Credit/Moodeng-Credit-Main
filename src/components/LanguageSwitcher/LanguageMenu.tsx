import { useEffect, useId, useRef, useState } from 'react';

import { Check, ChevronDown, Globe } from 'lucide-react';

import { type LocaleCode, useLocalization } from '@/i18n';

// Written out per language (not run through the page translator) because the menu is also how
// people escape a language they can't read.
const SUGGESTED_LABEL: Record<LocaleCode, string> = {
   en: 'Suggested',
   fil: 'Mungkahi',
   id: 'Disarankan',
   th: 'แนะนำ',
   vi: 'Gợi ý'
};

interface LanguageMenuProps {
   className?: string;
   tone?: 'dark' | 'light';
}

// Compact header control: a globe button showing the current language that opens a list of every
// language in its own script, with the visitor's likely language marked "Suggested".
export default function LanguageMenu({ className = '', tone = 'light' }: LanguageMenuProps) {
   const { chooseLocale, locale, locales, suggestedLocale, t } = useLocalization();
   const [isOpen, setIsOpen] = useState(false);
   const rootRef = useRef<HTMLDivElement>(null);
   const listId = useId();
   const current = locales.find((language) => language.code === locale) ?? locales[0];
   const isDark = tone === 'dark';

   useEffect(() => {
      if (!isOpen) return;
      const onPointerDown = (event: PointerEvent) => {
         if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
      };
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') setIsOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      return () => {
         document.removeEventListener('pointerdown', onPointerDown);
         document.removeEventListener('keydown', onKeyDown);
      };
   }, [isOpen]);

   return (
      <div ref={rootRef} className={`relative ${className}`} data-i18n-skip>
         <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-label={t('language.selector')}
            onClick={() => setIsOpen((open) => !open)}
            className={`inline-flex h-11 items-center gap-1 rounded-md-pill px-md-2 text-md-b2 font-semibold shadow-md-card focus:outline-none focus-visible:ring-2 ${
               isDark
                  ? 'bg-white/10 text-white focus-visible:ring-white/70'
                  : 'bg-white text-md-primary-2000 focus-visible:ring-md-primary-300'
            }`}
         >
            <Globe aria-hidden="true" size={18} />
            <span>{current.shortLabel}</span>
            <ChevronDown aria-hidden="true" size={16} />
         </button>

         {isOpen ? (
            <ul
               id={listId}
               role="listbox"
               aria-label={t('language.selector')}
               className="absolute right-0 top-[calc(100%+8px)] z-[60] w-56 rounded-md-lg border border-md-neutral-300 bg-white p-1 shadow-md-card"
            >
               {locales.map((language) => {
                  const isActive = language.code === locale;
                  return (
                     <li key={language.code} role="option" aria-selected={isActive}>
                        <button
                           type="button"
                           lang={language.htmlLang}
                           onClick={() => {
                              chooseLocale(language.code);
                              setIsOpen(false);
                           }}
                           className={`flex w-full items-center justify-between gap-2 rounded-md-input px-md-3 py-md-2 text-left text-md-b1 font-semibold ${
                              isActive ? 'bg-md-primary-100 text-md-primary-1200' : 'text-md-neutral-1400 hover:bg-md-neutral-200'
                           }`}
                        >
                           <span>{language.label}</span>
                           <span className="flex items-center gap-1">
                              {language.code === suggestedLocale && !isActive ? (
                                 <span className="rounded-md-sm bg-md-primary-300 px-1.5 text-md-b4 font-semibold text-md-primary-1200">
                                    {SUGGESTED_LABEL[language.code]}
                                 </span>
                              ) : null}
                              {isActive ? <Check aria-hidden="true" size={16} strokeWidth={3} /> : null}
                           </span>
                        </button>
                     </li>
                  );
               })}
            </ul>
         ) : null}
      </div>
   );
}
