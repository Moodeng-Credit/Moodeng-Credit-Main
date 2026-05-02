import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const BUCKET = 'avatars';

/**
 * Uploads a cropped avatar file for the currently authenticated user.
 *
 * Stores at: avatars/{userId}/{timestamp}-{random}.{ext}
 * Returns the public URL of the uploaded file.
 *
 * Note: previous avatars are left in storage (orphaned). Each upload creates
 * a unique path so old URLs remain valid until explicitly cleaned up.
 */
export async function uploadAvatarForCurrentUser(file: File): Promise<string> {
   const supabase = getSupabaseBrowserClient();

   const {
      data: { user },
      error: authError,
   } = await supabase.auth.getUser();

   if (authError || !user) {
      throw new Error('You must be signed in to upload an avatar.');
   }

   // Derive extension from MIME type (canvas always outputs image/jpeg here)
   const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
   const timestamp = Date.now();
   const random = Math.random().toString(36).slice(2, 10);
   const path = `${user.id}/${timestamp}-${random}.${ext}`;

   const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

   if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
   }

   const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
   return data.publicUrl;
}
