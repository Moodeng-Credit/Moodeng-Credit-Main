import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Proof-of-income sending, shared by /documents (src/app/documents/page.tsx) and the Indonesia
// onboarding's income step (src/views/indonesia/steps/IncomeStep.tsx). Files go to the private
// income-docs bucket; submit_income_document() records the send and pings the team.

export const MAX_FILES = 6;
export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
export const ACCEPTED = new Set(ACCEPT.split(','));

export type IncomeDocStatus = {
   stage: 'checking' | 'resend' | 'in_review' | 'approved' | 'declined';
   file_count: number;
   sent_at: string;
   reason: string | null;
} | null;

/** Their latest proof-of-income send (get_my_income_document), or null when none / on error. */
export const fetchIncomeDocStatus = async (): Promise<IncomeDocStatus> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_my_income_document');
   if (error) return null;
   const row = (Array.isArray(data) ? data[0] : data) as IncomeDocStatus | undefined;
   return row ?? null;
};

/**
 * Uploads the files to the private income-docs bucket and records the send (submit_income_document),
 * which pings the team and starts the automatic checks. `onFileDone` ticks once per file.
 */
export const uploadIncomeDocuments = async (
   files: File[],
   options: { note?: string; amount?: number | null; repay?: number | null; onFileDone?: () => void } = {}
): Promise<{ ok: true; count: number } | { ok: false; error: 'signin' | 'too_many' | 'failed' }> => {
   const supabase = getSupabaseBrowserClient();
   const { data: auth } = await supabase.auth.getUser();
   const userId = auth.user?.id;
   if (!userId) return { ok: false, error: 'signin' };
   const uploaded: Array<{ path: string; name: string; mime: string; size: number }> = [];
   for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'document';
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
         .from('income-docs')
         .upload(path, file, { contentType: file.type, upsert: false });
      if (!uploadError) uploaded.push({ path, name: file.name.slice(0, 200), mime: file.type, size: file.size });
      options.onFileDone?.();
   }
   const { error: submitError } = uploaded.length
      ? await supabase.rpc('submit_income_document', {
           p_files: uploaded,
           p_note: options.note?.trim() || null,
           p_amount: options.amount ?? null,
           p_repay: options.repay ?? null
        })
      : { error: new Error('nothing uploaded') };
   if (submitError) return { ok: false, error: /too many/i.test(submitError.message) ? 'too_many' : 'failed' };
   return { ok: true, count: uploaded.length };
};
