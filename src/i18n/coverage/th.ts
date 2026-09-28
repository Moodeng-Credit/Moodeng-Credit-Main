import { thaiCoverageA } from '@/i18n/coverage/thA';
import { thaiCoverageB } from '@/i18n/coverage/thB';
import { thaiCoverageC } from '@/i18n/coverage/thC';
import { thaiCoverageD } from '@/i18n/coverage/thD';
import { thaiCoverageLanding } from '@/i18n/coverage/thLanding';

export const screenCoverage: Record<string, string> = {
   ...thaiCoverageA,
   ...thaiCoverageB,
   ...thaiCoverageC,
   ...thaiCoverageD,
   ...thaiCoverageLanding
};
