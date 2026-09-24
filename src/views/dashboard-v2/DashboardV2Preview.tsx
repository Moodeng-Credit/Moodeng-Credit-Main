import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';

import { type DashboardV2PreviewContext, PREVIEW_STATES } from '@/views/dashboard-v2/useDashboardV2Preview';

export default function DashboardV2PreviewBar({
   previewState,
   isSignedIn,
   language
}: Pick<DashboardV2PreviewContext, 'previewState' | 'isSignedIn' | 'language'>) {
   const [searchParams, setSearchParams] = useSearchParams();
   const update = (key: 'state' | 'lang', value: string) => {
      const next = new URLSearchParams(searchParams);
      next.set(key, value);
      setSearchParams(next, { replace: true });
   };

   return (
      <div className="sticky top-0 z-30 flex items-center gap-2 bg-[#1c053d]/90 px-3 py-2 backdrop-blur">
         <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#c9bfe6]">Preview</span>
         <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Dashboard preview state">
            {PREVIEW_STATES.map((state) => {
               const isDisabled = state.id === 'real' && !isSignedIn;
               const isActive = state.id === previewState && !isDisabled;
               return (
                  <button
                     key={state.id}
                     type="button"
                     role="tab"
                     aria-selected={isActive}
                     disabled={isDisabled}
                     title={isDisabled ? 'Sign in to see your real data' : undefined}
                     onClick={() => update('state', state.id)}
                     className={clsx(
                        'shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold transition',
                        isActive ? 'bg-white text-[#1c053d]' : 'text-white/80',
                        isDisabled && 'cursor-not-allowed opacity-40'
                     )}
                  >
                     {state.label}
                  </button>
               );
            })}
         </div>
         <button
            type="button"
            onClick={() => update('lang', language === 'en' ? 'fil' : 'en')}
            className="shrink-0 rounded-full border border-white/30 px-2 py-0.5 text-[11px] font-bold text-white"
            aria-label="Switch language"
         >
            {language === 'en' ? 'EN' : 'FIL'}
         </button>
      </div>
   );
}
