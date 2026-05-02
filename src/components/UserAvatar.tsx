import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';

const PLACEHOLDER_AVATAR = '/icons/avatar-placeholder.png';

export { PLACEHOLDER_AVATAR };

interface UserAvatarProps {
   /** Override the avatar URL (e.g. for other users). Falls back to current user's avatar. */
   src?: string;
   alt?: string;
   size?: number;
   className?: string;
   /** Custom click handler. Overrides the default navigate-to-account-settings behaviour. */
   onClick?: () => void;
   /**
    * Set to false to disable the default click-to-account-settings behaviour.
    * Useful when UserAvatar is already inside a clickable container.
    * Ignored when `src` is provided (other users' avatars are never clickable by default).
    */
   clickable?: boolean;
}

/**
 * Displays the user's profile picture with fallback to the placeholder hippo avatar.
 * Fetches from `auth.user.avatarUrl` by default. Pass `src` to override for other users.
 *
 * Clicking the current user's avatar (no `src` prop) navigates to /account/settings by default.
 * Pass `onClick` to override, or `clickable={false}` to opt out entirely.
 */
export default function UserAvatar({
   src,
   alt = 'Profile',
   size = 48,
   className = '',
   onClick,
   clickable = true,
}: UserAvatarProps) {
   const navigate = useNavigate();
   const userAvatarUrl = useSelector((state: RootState) => state.auth.user?.avatarUrl);
   const resolvedSrc = src ?? userAvatarUrl ?? PLACEHOLDER_AVATAR;

   // Only the current user's own avatar gets click behaviour (no explicit src override).
   const isCurrentUser = src === undefined;
   const handleClick = onClick ?? (isCurrentUser && clickable ? () => navigate('/account/settings') : undefined);

   const img = (
      <img
         src={resolvedSrc}
         alt={alt}
         className={`rounded-full object-cover shrink-0 ${className}`}
         style={{ width: size, height: size }}
         onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src !== window.location.origin + PLACEHOLDER_AVATAR) {
               target.src = PLACEHOLDER_AVATAR;
            }
         }}
      />
   );

   if (handleClick) {
      return (
         <button
            type="button"
            onClick={handleClick}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 shrink-0"
            aria-label="Go to Account Settings"
            style={{ width: size, height: size }}
         >
            {img}
         </button>
      );
   }

   return img;
}
