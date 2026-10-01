import { useOptionalLocalization } from '@/i18n/LocalizationProvider';
import { currentSentences, SENTENCES } from '@/i18n/sentences';

// Small text components for sentences that wrap a number or a name (see sentences.ts). They read
// the current language themselves, so the screens that use them don't need to.

// Falls back to the page language when rendered outside the provider (e.g. isolated component tests).
function useSentences() {
   const localization = useOptionalLocalization();
   return localization ? (SENTENCES[localization.locale] ?? SENTENCES.en) : currentSentences();
}

export function UniqueLendersLabel({ count }: { count: number }) {
   return <>{useSentences().uniqueLenders(count)}</>;
}

export function MoreCharactersLabel({ count, toGo = false }: { count: number; toGo?: boolean }) {
   const sentences = useSentences();
   return <>{toGo ? sentences.moreCharactersToGo(count) : sentences.moreCharacters(count)}</>;
}

export function FundLoanTitle({ name }: { name: string }) {
   return <>{useSentences().fundLoanTitle(name)}</>;
}

export function FundedLoanBody({ name }: { name: string }) {
   return <>{useSentences().fundedLoanBody(name)}</>;
}

export function TransferAddressLabel({ exchange }: { exchange: string }) {
   return <>{useSentences().transferAddress(exchange)}</>;
}
