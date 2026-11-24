// "About you" — one card on sign-up (/sign-up) and pre-screening (/screen): gender, age, kids
// (George 2026-11-24). Self-reported, for Growth (who signs up / drops off); Didit's ID read stays the
// checked source. Before there's an account the answers wait here and are saved right after sign-up
// (App.tsx → saveParkedAboutYou); a signed-in person's answers are saved at once (save_about_you).
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type AboutGender = 'female' | 'male';
export type AboutYouAnswers = { gender: AboutGender; age: number; kids: number };

const PARK_KEY = 'md_about_you';
const DONE_KEY = 'md_about_you_done';

export const MIN_AGE = 18;
export const MAX_AGE = 99;

export const validAboutYou = (a: Partial<AboutYouAnswers> | null | undefined): a is AboutYouAnswers =>
   Boolean(
      a &&
      (a.gender === 'female' || a.gender === 'male') &&
      Number.isInteger(a.age) &&
      (a.age as number) >= MIN_AGE &&
      (a.age as number) <= MAX_AGE &&
      Number.isInteger(a.kids) &&
      (a.kids as number) >= 0 &&
      (a.kids as number) <= 20
   );

const markDone = () => {
   try {
      window.localStorage.setItem(DONE_KEY, String(Date.now()));
   } catch {
      // Storage blocked: they may see the card once more.
   }
};

/** This browser already answered (parked or saved). */
export const aboutYouDoneHere = () => {
   try {
      return Boolean(window.localStorage.getItem(DONE_KEY) || window.localStorage.getItem(PARK_KEY));
   } catch {
      return false;
   }
};

/** Signed out: keep the answers until the account exists. */
export function parkAboutYou(answers: AboutYouAnswers): void {
   try {
      window.localStorage.setItem(PARK_KEY, JSON.stringify({ ...answers, at: Date.now() }));
   } catch {
      // Storage blocked: the answers are lost; the card shows again in pre-screening.
   }
   markDone();
}

/** Signed in: save now. Never throws — false when it didn't save. */
export async function saveAboutYou(answers: AboutYouAnswers): Promise<boolean> {
   if (!validAboutYou(answers)) return false;
   try {
      const { data, error } = await getSupabaseBrowserClient().rpc('save_about_you', {
         p_gender: answers.gender,
         p_age: answers.age,
         p_kids: answers.kids
      });
      if (error || data !== true) return false;
      markDone();
      return true;
   } catch {
      return false;
   }
}

/** Right after sign-up: save what was answered before the account existed (once). */
export async function saveParkedAboutYou(): Promise<void> {
   let parked: (Partial<AboutYouAnswers> & { at?: number }) | null = null;
   try {
      parked = JSON.parse(window.localStorage.getItem(PARK_KEY) ?? 'null');
   } catch {
      return;
   }
   if (!parked) return;
   const clear = () => {
      try {
         window.localStorage.removeItem(PARK_KEY);
      } catch {
         // Nothing to clear.
      }
   };
   // Older than 7 days: a different person may be on this phone now.
   if (!validAboutYou(parked) || !parked.at || Date.now() - parked.at > 7 * 86_400_000) return clear();
   if (await saveAboutYou(parked)) clear();
}

/** Signed in: have they answered already (on any device)? Unknown (offline) counts as answered. */
export async function aboutYouDoneOnAccount(): Promise<boolean> {
   try {
      const { data, error } = await getSupabaseBrowserClient().rpc('about_you_done');
      if (error) return true;
      return data === true;
   } catch {
      return true;
   }
}
