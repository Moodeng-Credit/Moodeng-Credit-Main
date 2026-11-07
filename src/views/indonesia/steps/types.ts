import type { IdOnboarding } from '@/lib/idTrack';
import type { User } from '@/types/authTypes';
import type { IdLang } from '@/views/indonesia/idFlow';

/** What every /id/onboarding step gets from the page. */
export type IdStepProps = {
   data: IdOnboarding;
   user: User;
   lang: IdLang;
   /** Re-reads my_id_onboarding() (the page also polls it while a step waits on something outside). */
   refresh: () => Promise<unknown>;
   /** Moves on to the next unfinished step. */
   onDone: () => void;
};
