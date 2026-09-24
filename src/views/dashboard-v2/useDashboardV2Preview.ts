import { useSearchParams } from 'react-router-dom';

import { useLocalization } from '@/i18n';
import { isPreviewHost } from '@/lib/previewHost';
import { SAMPLE_STATES } from '@/views/dashboard-v2/sampleStates';
import type { DashboardV2Language, DashboardV2Model, DashboardV2PreviewState } from '@/views/dashboard-v2/types';
import { useDashboardV2Model } from '@/views/dashboard-v2/useDashboardV2Model';

export const PREVIEW_STATES: { id: DashboardV2PreviewState; label: string }[] = [
   { id: 'real', label: 'My data' },
   { id: 'unverified', label: 'Unverified' },
   { id: 'verified', label: 'Verified' },
   { id: 'defaulted', label: 'Defaulted' },
   { id: 'rewarded', label: 'Voucher earned' }
];

const isPreviewState = (value: string | null): value is DashboardV2PreviewState => PREVIEW_STATES.some((state) => state.id === value);

export interface DashboardV2PreviewContext {
   model: DashboardV2Model;
   previewState: DashboardV2PreviewState;
   isReal: boolean;
   isSignedIn: boolean;
   isReady: boolean;
   language: DashboardV2Language;
   /** Carries the preview state + language onto links between preview pages. */
   previewSearch: string;
}

/** Real data when signed in ("My data"), otherwise the Figma sample for the chosen state. */
export function useDashboardV2Preview(): DashboardV2PreviewContext {
   const [searchParams] = useSearchParams();
   const { locale } = useLocalization();
   const { model: realModel, isSignedIn, isReady } = useDashboardV2Model();
   const requestedState = searchParams.get('state');
   const previewState: DashboardV2PreviewState = isPreviewState(requestedState) ? requestedState : isSignedIn ? 'real' : 'verified';
   const isReal = previewState === 'real' && isSignedIn;
   // Follow the language the user picked in the app: Filipino copy only for Filipino, English for
   // everyone else. The preview bar's ?lang= toggle still overrides it for the team.
   const requestedLanguage = searchParams.get('lang');
   const language: DashboardV2Language =
      requestedLanguage === 'en' || requestedLanguage === 'fil' ? requestedLanguage : locale === 'fil' ? 'fil' : 'en';
   // On the live domain, real users get clean URLs (no ?state=/lang=). The preview
   // state only rides along on dev and Vercel preview hosts, where the team uses it.
   const previewSearch = isPreviewHost() ? `?${new URLSearchParams({ state: previewState, lang: language }).toString()}` : '';

   return {
      model: isReal ? realModel : SAMPLE_STATES[previewState === 'real' ? 'verified' : previewState],
      previewState,
      isReal,
      isSignedIn,
      isReady,
      language,
      previewSearch
   };
}
