import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';

const PLACEHOLDER_AVATAR =
   'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Chiaroscuro_lighting_illuminates_a_Chibi-style_SVG_logo_a_gray_and_light_pink_hippo__joyfully_jumping__thumbs_up__holding_a_gold_Japanese_Mon_coin.__Hayao_Miyazaki_inspired__deep_teal_hues__warm_candl-uvt0ZI3fogcgqDR4Y2gCSRZfq8QmtX.png';

export { PLACEHOLDER_AVATAR };

interface UserAvatarProps {
   /** Override the avatar URL (e.g. for other users). Falls back to current user's avatar. */
   src?: string;
   alt?: string;
   size?: number;
   className?: string;
}

/**
 * Displays the user's profile picture with fallback to the placeholder hippo avatar.
 * Fetches from `auth.user.avatarUrl` by default. Pass `src` to override for other users.
 */
export default function UserAvatar({ src, alt = 'Profile', size = 48, className = '' }: UserAvatarProps) {
   const userAvatarUrl = useSelector((state: RootState) => state.auth.user?.avatarUrl);
   const resolvedSrc = src ?? userAvatarUrl ?? PLACEHOLDER_AVATAR;

   return (
      <img
         src={resolvedSrc}
         alt={alt}
         className={`rounded-full object-cover shrink-0 ${className}`}
         style={{ width: size, height: size }}
         onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src !== PLACEHOLDER_AVATAR) {
               img.src = PLACEHOLDER_AVATAR;
            }
         }}
      />
   );
}
