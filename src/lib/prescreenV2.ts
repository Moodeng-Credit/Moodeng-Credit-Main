// Pre-screening v2 on moodeng.app/screen (migration 20261120170500_prescreen_v2.sql): the job questions,
// live job photos, the optional certificate of employment, the medical question and answer coaching.
// The AI calls ride on check-loan-input (supabase/functions/_shared/prescreenV2.ts). Everything here
// fails open: a slow or broken AI never blocks anyone.
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** The page says it can show v2 questions; the server only adds them when its switch is on too. */
export const PRESCREEN_CAPS = ['v2'];

/** Seconds from the photo ask to the upload before it counts as late (the server decides; this is the clock shown). */
export const PHOTO_SECONDS = 300;
/** A camera-app file older than this before the ask is an old photo (gallery), not one taken now. */
export const OLD_FILE_MS = 2 * 60_000;
/** A photo picked from the gallery counts if it was taken in the last 2 months (farmers already have crop and harvest photos). */
export const GALLERY_MAX_AGE_MS = 60 * 86_400_000;

export type MedicalChoice = 'none' | 'paid' | 'future' | 'ongoing';
export const MEDICAL_CHOICES: Array<{ id: MedicalChoice; label: string }> = [
   { id: 'none', label: 'No, the loan is for something else' },
   { id: 'paid', label: 'For a bill I already paid' },
   { id: 'future', label: 'For a cost coming up' },
   { id: 'ongoing', label: 'For a cost every month' }
];

const NO_WORDS = /^(no+|none|nope|nah|wala( po| naman| pa)?|hindi( po)?|tidak( ada)?|nothing|n\/?a|wala po kami|no po|nothing po)[.!\s]*$/i;
/** "No" / "wala" / "tidak": no medical problem (same words as the server's saidNoMedical). */
export const saidNo = (text: string | null | undefined) => NO_WORDS.test((text ?? '').trim());

export type PlannedQuestion = { id: string; text: string; hint?: string; kind?: string; min?: number; alt?: string; optional?: boolean };

/** After "What is your job?": the AI's follow-ups + photo asks, written into the row. Null = try again. */
export const planJobQuestions = async (token: string, job: string, locale = 'en'): Promise<PlannedQuestion[] | null> => {
   const { data, error } = await getSupabaseBrowserClient().functions.invoke('check-loan-input', {
      body: { kind: 'prescreen_job', token, job, locale: ['fil', 'id'].includes(locale) ? locale : 'en' }
   });
   const res = data as { ok?: boolean; questions?: PlannedQuestion[] } | null;
   if (error || !res?.ok || !Array.isArray(res.questions) || !res.questions.length) return null;
   return res.questions;
};

/** One gentle hint when a typed answer is too vague for its question; '' = fine (or the AI was slow). */
export const coachHint = async (token: string, q: string, answer: string, locale: string): Promise<string> => {
   try {
      const call = getSupabaseBrowserClient().functions.invoke('check-loan-input', {
         body: { kind: 'prescreen_coach', token, q, answer, locale: ['fil', 'id'].includes(locale) ? locale : 'en' }
      });
      const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 9000));
      const result = (await Promise.race([call, timeout])) as { data?: { ok?: boolean; hint?: string } | null } | null;
      const verdict = result?.data;
      return verdict?.ok === false && typeof verdict.hint === 'string' ? verdict.hint.slice(0, 200) : '';
   } catch {
      return '';
   }
};

/**
 * The AI's look at a file they just uploaded: a document for a 'doc' question (COE, work permit) or a job
 * photo (`alt` = the "not at work right now?" ask). One sentence on what to send or take instead when it
 * doesn't fit, or '' (fine, or the AI was slow). Advice only.
 */
export const docHint = async (token: string, q: string, path: string, locale: string, alt = false): Promise<string> => {
   try {
      const call = getSupabaseBrowserClient().functions.invoke('check-loan-input', {
         body: { kind: 'prescreen_doc', token, q, path, alt, locale: ['fil', 'id'].includes(locale) ? locale : 'en' }
      });
      const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000));
      const result = (await Promise.race([call, timeout])) as { data?: { ok?: boolean; hint?: string } | null } | null;
      const verdict = result?.data;
      return verdict?.ok === false && typeof verdict.hint === 'string' ? verdict.hint.slice(0, 220) : '';
   } catch {
      return '';
   }
};

/**
 * The AI's look and listen at an answer they just recorded (prescreen_clip): one warm sentence on what
 * would help (face not visible, hard to hear, didn't answer), or '' (fine, too big, or the AI was slow).
 * Advice only — they can always use the clip.
 */
export const clipHint = async (token: string, q: string, path: string, locale: string): Promise<string> => {
   try {
      const call = getSupabaseBrowserClient().functions.invoke('check-loan-input', {
         body: { kind: 'prescreen_clip', token, q, path, locale: ['fil', 'id'].includes(locale) ? locale : 'en' }
      });
      const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 11000));
      const result = (await Promise.race([call, timeout])) as { data?: { ok?: boolean; hint?: string } | null } | null;
      const verdict = result?.data;
      return verdict?.ok === false && typeof verdict.hint === 'string' ? verdict.hint.slice(0, 220) : '';
   } catch {
      return '';
   }
};

/** A photo, made small enough for the AI and Telegram (longest side 1280 px, JPEG). */
export const shrinkImage = async (
   source: CanvasImageSource & { width?: number; height?: number },
   w: number,
   h: number
): Promise<Blob | null> => {
   const scale = Math.min(1, 1280 / Math.max(w, h));
   const canvas = document.createElement('canvas');
   canvas.width = Math.max(1, Math.round(w * scale));
   canvas.height = Math.max(1, Math.round(h * scale));
   const ctx = canvas.getContext('2d');
   if (!ctx) return null;
   ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
   return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82));
};

/** A picked image file → a small JPEG (iPhone HEIC included, where the browser can open it). */
export const shrinkFile = async (file: File): Promise<Blob | null> => {
   try {
      const bitmap = await createImageBitmap(file);
      const out = await shrinkImage(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      return out;
   } catch {
      return file.type === 'image/jpeg' || file.type === 'image/png' ? file : null;
   }
};

/** "4:05" */
export const clock = (ms: number) => {
   const sec = Math.max(0, Math.ceil(ms / 1000));
   return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

// A different hippo for each kind of question on /screen (Gemini-made, 2026-11-20), so the same one
// isn't on every step. Unknown ids fall back by kind.
const PRESCREEN_HIPPO_DIR = '/hippos/prescreen';
const HIPPO_BY_ID: Record<string, string> = {
   intro: 'intro',
   borrowed: 'borrowed',
   purpose: 'purpose',
   grow: 'grow',
   job: 'job',
   job_video: 'jobvideo',
   coe: 'coe',
   medical: 'medical'
};
export const prescreenHippo = (q: { id: string; kind?: string } | null | undefined, opts: { expired?: boolean } = {}): string => {
   const name = !q
      ? 'income'
      : q.kind === 'photo'
        ? opts.expired
           ? 'timesup'
           : 'photo'
        : (HIPPO_BY_ID[q.id] ??
          (/^job_q/.test(q.id)
             ? 'followup'
             : q.kind === 'video' || !q.kind
               ? 'intro'
               : q.kind === 'medical'
                 ? 'medical'
                 : q.kind === 'doc'
                   ? 'coe'
                   : 'followup'));
   return `${PRESCREEN_HIPPO_DIR}/${name}.webp`;
};

/** Rough minutes left from this question on (incl. proof of income when still to do). Pure. */
export const minutesLeft = (questions: Array<{ kind?: string }>, index: number, proofLeft: boolean): number => {
   const per = (k?: string) => (k === 'photo' ? 1.5 : k === 'video' || !k ? 1 : k === 'doc' ? 1 : 0.5);
   const total = questions.slice(index).reduce((sum, q) => sum + per(q.kind), 0) + (proofLeft ? 2 : 0);
   return Math.max(1, Math.round(total));
};
