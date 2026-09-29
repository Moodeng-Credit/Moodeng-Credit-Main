import { useLocalization } from '@/i18n/LocalizationProvider';
import { SENTENCES } from '@/i18n/sentences';

// Small text components for sentences that wrap a number or a name (see sentences.ts). They read
// the current language themselves, so the screens that use them don't need to.

function useSentences() {
   const { locale } = useLocalization();
   return SENTENCES[locale] ?? SENTENCES.en;
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
