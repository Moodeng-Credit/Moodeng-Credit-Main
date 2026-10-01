import { Check } from 'lucide-react';

import { type LocaleCode, useLocalization } from '@/i18n';

const PICKER_COPY: Record<LocaleCode, { title: string; body: string; suggested: string }> = {
   en: {
      title: 'Choose your language',
      body: 'You can change it anytime in Account settings.',
      suggested: 'Suggested'
   },
   fil: {
      title: 'Piliin ang wika mo',
      body: 'Puwede mo itong palitan anumang oras sa Account settings.',
      suggested: 'Mungkahi'
   },
   id: {
      title: 'Pilih bahasa kamu',
      body: 'Kamu bisa menggantinya kapan saja di Pengaturan akun.',
      suggested: 'Disarankan'
   },
   th: {
      title: 'เลือกภาษาของคุณ',
      body: 'คุณเปลี่ยนภาษาได้ทุกเมื่อในการตั้งค่าบัญชี',
      suggested: 'แนะนำ'
   },
   vi: {
      title: 'Chọn ngôn ngữ của bạn',
      body: 'Bạn có thể đổi bất cứ lúc nào trong Cài đặt tài khoản.',
      suggested: 'Gợi ý'
   }
};

// First onboarding screen: every language in its own script, the visitor's likely language
// (browser region / time zone) marked "Suggested". Picking one switches the whole app at once.
export function OnboardingLanguagePicker() {
   const { chooseLocale, locale, locales, suggestedLocale } = useLocalization();
   const copy = PICKER_COPY[locale] ?? PICKER_COPY.en;

   return (
      <section
         aria-labelledby="onboarding-language-title"
         className="flex flex-col gap-md-2 w-full rounded-[12px] border border-md-neutral-300 bg-white dark:bg-white/5 p-md-4"
         data-i18n-skip
      >
         <div className="flex flex-col gap-md-0">
            <h3 id="onboarding-language-title" className="text-md-h5 text-md-heading">
               {copy.title}
            </h3>
            <p className="text-md-b2 text-md-neutral-700">{copy.body}</p>
         </div>
         <div className="flex flex-wrap gap-md-1" role="group" aria-labelledby="onboarding-language-title">
            {locales.map((language) => {
               const isActive = language.code === locale;
               const isSuggested = language.code === suggestedLocale && !isActive;
               return (
                  <button
                     key={language.code}
                     type="button"
                     lang={language.htmlLang}
                     aria-pressed={isActive}
                     onClick={() => chooseLocale(language.code)}
                     className={`inline-flex items-center gap-1 rounded-md-pill px-md-3 py-md-1 text-md-b2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-300 ${
                        isActive
                           ? 'bg-md-primary-1200 text-white'
                           : 'border border-md-neutral-600 bg-white text-md-neutral-1400 hover:border-md-primary-900 dark:bg-transparent dark:text-md-neutral-300'
                     }`}
                  >
                     {isActive ? <Check aria-hidden="true" size={14} strokeWidth={3} /> : null}
                     <span>{language.label}</span>
                     {isSuggested ? (
                        <span className="rounded-md-sm bg-md-primary-300 px-1.5 text-md-b4 font-semibold text-md-primary-1200">
                           {PICKER_COPY[language.code].suggested}
                        </span>
                     ) : null}
                  </button>
               );
            })}
         </div>
      </section>
   );
}
