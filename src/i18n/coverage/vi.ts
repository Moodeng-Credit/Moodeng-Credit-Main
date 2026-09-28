import { vietnameseCoverageA } from '@/i18n/coverage/viA';
import { vietnameseCoverageB } from '@/i18n/coverage/viB';
import { vietnameseCoverageC } from '@/i18n/coverage/viC';
import { vietnameseCoverageLanding } from '@/i18n/coverage/viLanding';

export const screenCoverage: Record<string, string> = {
   ...vietnameseCoverageA,
   ...vietnameseCoverageB,
   ...vietnameseCoverageC,
   ...vietnameseCoverageLanding
};
