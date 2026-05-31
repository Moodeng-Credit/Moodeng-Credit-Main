import { type FC } from 'react';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';

const MODAL_NOTE_COPY = {
   en: {
      content: 'Privacy-First proof of personhood. Verify without revealing your identity.'
   },
   fil: {
      content: 'Privacy-first na proof of personhood. Mag-verify nang hindi inilalantad ang identity mo.'
   },
   id: {
      content: 'Proof of personhood yang mengutamakan privasi. Verifikasi tanpa membuka identitas kamu.'
   }
} satisfies Record<LocaleCode, { content: string }>;

export const ModalNote: FC = () => {
   const { locale } = useLocalization();
   const copy = MODAL_NOTE_COPY[locale] ?? MODAL_NOTE_COPY.en;

   return (
      <div className="px-4 text-xs font-sans text-gray-600 mb-3 sm:mb-5">
         <p className="font-semibold text-gray-500 ">{copy.content}</p>
      </div>
   );
};
