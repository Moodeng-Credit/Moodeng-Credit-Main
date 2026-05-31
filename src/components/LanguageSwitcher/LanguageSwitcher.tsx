import { Check } from 'lucide-react';

import { type LocaleCode, type TranslationKey, useLocalization } from '@/i18n';

interface LanguageSwitcherProps {
   className?: string;
   tone?: 'dark' | 'light';
   variant?: 'compact' | 'full' | 'menu';
}

const LANGUAGE_NAME_KEYS: Record<LocaleCode, TranslationKey> = {
   en: 'language.english',
   fil: 'language.filipino',
   id: 'language.indonesian',
   th: 'language.thai',
   vi: 'language.vietnamese'
};

export default function LanguageSwitcher({ className = '', tone = 'dark', variant = 'compact' }: LanguageSwitcherProps) {
   const { locale, locales, setLocale, t } = useLocalization();
   const isLight = tone === 'light';
   const isFull = variant === 'full';
   const groupClasses = isFull
      ? 'flex w-full flex-col gap-2'
      : isLight
        ? 'inline-flex items-center rounded-md-pill border border-md-primary-100 bg-white p-1 shadow-md-card'
        : 'inline-flex items-center rounded-md-pill border border-white/15 bg-white/[0.08] p-1';
   const activeClasses = isLight ? 'bg-md-primary-1200 text-md-neutral-50 shadow-sm' : 'bg-md-neutral-50 text-md-neutral-2000 shadow-sm';
   const inactiveClasses = isLight
      ? 'text-md-neutral-1200 hover:bg-md-primary-100 hover:text-md-primary-1200'
      : 'text-white/70 hover:bg-white/10 hover:text-white';
   const focusClasses = isLight ? 'focus-visible:ring-md-primary-300' : 'focus-visible:ring-white/70';

   const buttons = (
      <div className={groupClasses} role="group" aria-label={t('language.selector')}>
         {locales.map((language) => {
            const isActive = language.code === locale;
            const languageName = isFull ? language.label : t(LANGUAGE_NAME_KEYS[language.code]);
            const visibleLabel = isFull ? language.label : language.shortLabel;
            const fullRowClasses = isActive
               ? 'border-[1.5px] border-md-primary-900 bg-white text-md-heading shadow-sm'
               : 'border border-md-neutral-600 bg-white text-md-neutral-1200 hover:border-md-primary-100 hover:text-md-primary-1200';

            return (
               <button
                  key={language.code}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={t('language.switchTo', { language: languageName })}
                  title={languageName}
                  data-i18n-skip={isFull ? true : undefined}
                  onClick={() => setLocale(language.code)}
                  className={[
                     isFull
                        ? 'flex w-full items-center justify-between gap-3 rounded-md-input px-4 py-3 text-left text-md-b1 font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2'
                        : 'min-w-[38px] rounded-md-pill px-2.5 py-1 text-xs font-semibold leading-4 transition-colors focus:outline-none focus-visible:ring-2',
                     focusClasses,
                     isFull ? fullRowClasses : isActive ? activeClasses : inactiveClasses
                  ].join(' ')}
               >
                  <span className={isFull ? 'block min-w-0 whitespace-normal break-words' : 'block truncate'}>{visibleLabel}</span>
                  {isFull ? (
                     <span
                        aria-hidden="true"
                        className={[
                           'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
                           isActive ? 'bg-md-primary-1200 text-white' : 'border border-md-neutral-600 bg-white text-transparent'
                        ].join(' ')}
                     >
                        <Check size={15} strokeWidth={3} />
                     </span>
                  ) : null}
               </button>
            );
         })}
      </div>
   );

   if (variant === 'menu') {
      return (
         <div
            className={`flex items-center justify-between rounded-md-input border px-3 py-2 ${
               isLight ? 'border-md-primary-100 bg-white' : 'border-white/15 bg-white/[0.06]'
            } ${className}`}
         >
            <span className={`text-sm font-medium ${isLight ? 'text-md-neutral-1200' : 'text-white/75'}`}>{t('language.label')}</span>
            {buttons}
         </div>
      );
   }

   return <div className={className}>{buttons}</div>;
}
