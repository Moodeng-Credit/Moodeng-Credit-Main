import { spanishCoverageA } from '@/i18n/coverage/esA';
import { spanishCoverageB } from '@/i18n/coverage/esB';
import { spanishCoverageC } from '@/i18n/coverage/esC';
import { spanishCoverageD } from '@/i18n/coverage/esD';
import { spanishCoverageE } from '@/i18n/coverage/esE';
import { spanishCoverageF } from '@/i18n/coverage/esF';

export const screenCoverage: Record<string, string> = {
   ...spanishCoverageA,
   ...spanishCoverageB,
   ...spanishCoverageC,
   ...spanishCoverageD,
   ...spanishCoverageE,
   ...spanishCoverageF
};
