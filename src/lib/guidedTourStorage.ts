type GuidedTourStats = {
   completedAt: string | null;
   shownCount: number;
};

const STORAGE_PREFIX = 'moodeng.guidedTour';

export const BORROWER_GUIDED_TOUR_ID = 'borrower-onboarding-tour-v1';
export const LENDER_GUIDED_TOUR_ID = 'lender-onboarding-tour-v1';
export const GENERAL_GUIDED_TOUR_ID = 'general-onboarding-tour-v1';

const canUseLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getTourKey = (tourId: string, userId?: string) => {
   const normalizedUserId = userId?.trim() || 'guest';
   return `${STORAGE_PREFIX}.${tourId}.${normalizedUserId}`;
};

const readNumber = (key: string) => {
   if (!canUseLocalStorage()) return 0;
   const value = window.localStorage.getItem(key);
   const parsed = value ? Number.parseInt(value, 10) : 0;
   return Number.isFinite(parsed) ? parsed : 0;
};

export const getGuidedTourStats = (tourId: string, userId?: string): GuidedTourStats => {
   if (!canUseLocalStorage()) {
      return {
         completedAt: null,
         shownCount: 0
      };
   }

   const key = getTourKey(tourId, userId);
   return {
      completedAt: window.localStorage.getItem(`${key}.completedAt`),
      shownCount: readNumber(`${key}.shownCount`)
   };
};

export const hasCompletedGuidedTour = (tourId: string, userId?: string) => {
   return Boolean(getGuidedTourStats(tourId, userId).completedAt);
};

export const shouldShowGuidedTour = (tourId: string, userId?: string, force = false) => {
   if (force) return true;
   return !hasCompletedGuidedTour(tourId, userId);
};

export const recordGuidedTourShown = (tourId: string, userId?: string) => {
   if (!canUseLocalStorage()) return 0;

   const key = getTourKey(tourId, userId);
   const countKey = `${key}.shownCount`;
   const nextCount = readNumber(countKey) + 1;
   window.localStorage.setItem(countKey, String(nextCount));
   window.localStorage.setItem(`${key}.lastShownAt`, new Date().toISOString());
   return nextCount;
};

export const markGuidedTourCompleted = (tourId: string, userId?: string) => {
   if (!canUseLocalStorage()) return;
   window.localStorage.setItem(`${getTourKey(tourId, userId)}.completedAt`, new Date().toISOString());
};
