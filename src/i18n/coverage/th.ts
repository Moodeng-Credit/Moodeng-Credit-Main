import { thaiCoverageA } from '@/i18n/coverage/thA';
import { thaiCoverageB } from '@/i18n/coverage/thB';
import { thaiCoverageC } from '@/i18n/coverage/thC';
import { thaiCoverageLanding } from '@/i18n/coverage/thLanding';
import { thaiCoverageD } from '@/i18n/coverage/thD';

export const screenCoverage: Record<string, string> = {
   ...thaiCoverageA,
   ...thaiCoverageB,
   ...thaiCoverageC,
   ...thaiCoverageD
};
