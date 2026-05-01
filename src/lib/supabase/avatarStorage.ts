import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const DEFAULT_AVATAR_BUCKET = 'avatars';

function getAvatarBucketName(): string {
   return (import.meta.env.VITE_SUPABASE_AVATAR_BUCKET ?? DEFAULT_AVATAR_BUCKET).trim() || DEFAULT_AVATAR_BUCKET;
}

function getFileExtension(file: File): string {
   const explicitExtension = file.name.split('.').pop()?.trim().toLowerCase();
   if (explicitExtension) {
      return explicitExtension;
   }

   const mimeExtension = file.type.split('/').pop()?.trim().toLowerCase();
   if (mimeExtension === 'jpeg') {
      return 'jpg';
   }

   return mimeExtension || 'jpg';
}

function extractStorageObjectPath(url: string | undefined, bucket: string): string | null {
   if (!url) return null;

   try {
      const parsed = new URL(url);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const markerIndex = parsed.pathname.indexOf(marker);

      if (markerIndex === -1) {
         return null;
      }

      return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
   } catch {
      return null;
   }
}

export async function uploadAvatarForCurrentUser(file: File): Promise<string> {
   const supabase = getSupabaseBrowserClient();
   const {
      data: { user },
      error: userError
   } = await supabase.auth.getUser();

   if (userError || !user) {
      throw userError ?? new Error('No authenticated user found');
   }

   const bucket = getAvatarBucketName();
   const extension = getFileExtension(file);
   const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
   const previousAvatarPath = extractStorageObjectPath(user.user_metadata?.avatar_url as string | undefined, bucket);

   const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: false,
   });

   if (uploadError) {
      throw new Error(uploadError.message || 'Failed to upload avatar');
   }

   const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
   const avatarUrl = data.publicUrl;

   if (!avatarUrl) {
      throw new Error('Failed to generate avatar URL');
   }

   if (previousAvatarPath) {
      void supabase.storage.from(bucket).remove([previousAvatarPath]);
   }

   return avatarUrl;
}
