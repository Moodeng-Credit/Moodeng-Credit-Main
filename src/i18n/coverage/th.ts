import { thaiCoverageA } from '@/i18n/coverage/thA';
import { thaiCoverageB } from '@/i18n/coverage/thB';
import { thaiCoverageC } from '@/i18n/coverage/thC';
import { thaiCoverageD } from '@/i18n/coverage/thD';
import { thaiCoverageE } from '@/i18n/coverage/thE';
import { thaiCoverageF } from '@/i18n/coverage/thF';
import { thaiCoverageG } from '@/i18n/coverage/thG';
import { thaiCoverageLanding } from '@/i18n/coverage/thLanding';

export const screenCoverage: Record<string, string> = {
   ...thaiCoverageA,
   ...thaiCoverageB,
   ...thaiCoverageC,
   ...thaiCoverageD,
   ...thaiCoverageE,
   ...thaiCoverageF,
   ...thaiCoverageG,
   ...thaiCoverageLanding
};
