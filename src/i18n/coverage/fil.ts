import { filipinoCoverageA } from '@/i18n/coverage/filA';
import { filipinoCoverageB } from '@/i18n/coverage/filB';
import { filipinoCoverageC } from '@/i18n/coverage/filC';
import { filipinoCoverageE } from '@/i18n/coverage/filE';
import { filipinoCoverageLanding } from '@/i18n/coverage/filLanding';

export const screenCoverage: Record<string, string> = {
   ...filipinoCoverageA,
   ...filipinoCoverageB,
   ...filipinoCoverageC,
   ...filipinoCoverageE,
   ...filipinoCoverageLanding
};
