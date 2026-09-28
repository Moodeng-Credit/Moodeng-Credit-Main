import { indonesianCoverageA } from '@/i18n/coverage/idA';
import { indonesianCoverageB } from '@/i18n/coverage/idB';
import { indonesianCoverageC } from '@/i18n/coverage/idC';
import { indonesianCoverageD } from '@/i18n/coverage/idD';
import { indonesianCoverageLanding } from '@/i18n/coverage/idLanding';

export const screenCoverage: Record<string, string> = {
   ...indonesianCoverageA,
   ...indonesianCoverageB,
   ...indonesianCoverageC,
   ...indonesianCoverageD,
   ...indonesianCoverageLanding
};
