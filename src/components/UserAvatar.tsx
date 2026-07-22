import { useMemo } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { DEFAULT_AVATAR_BACKGROUND } from '@/config/avatarBackgrounds';
import { isPowerLender } from '@/config/powerLenders';
import type { RootState } from '@/store/store';
import { getAvatarRingRewardId, getTrustPointRewardProgress } from '@/views/dashboard/trustPointRewards';
import { useTrustPointTotal } from '@/views/dashboard/useTrustPointTotal';
import { useTrustRewardOwnership } from '@/views/dashboard/useTrustRewardOwnership';

const PLACEHOLDER_AVATAR = '/icons/avatar-placeholder.png';

export { PLACEHOLDER_AVATAR };

interface UserAvatarProps {
   /** Override the avatar URL (e.g. for other users). Falls back to current user's avatar. */
   src?: string;
   /** Id of the user this avatar belongs to. Lets other users' avatars show status rings (e.g. power lender). */
   userId?: string;
   alt?: string;
   size?: number;
   className?: string;
   backgroundColor?: string;
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
 * Clicking the current user's avatar (no `src` prop) opens avatar editing by default.
 * Pass `onClick` to override, or `clickable={false}` to opt out entirely.
 */
export default function UserAvatar({
   src,
   userId,
   alt = 'Profile',
   size = 48,
   className = '',
   backgroundColor,
   onClick,
   clickable = true,
}: UserAvatarProps) {
   const navigate = useNavigate();
   const location = useLocation();
   const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
   const userAvatarUrl = useSelector((state: RootState) => state.auth.user?.avatarUrl);
   const userAvatarBackground = useSelector((state: RootState) => state.auth.user?.avatarBackground);
   // An explicit userId identifies whose avatar this is; otherwise a missing src means "the current user".
   const isCurrentUser = userId != null ? userId === currentUserId : src === undefined;
   const resolvedSrc = src ?? (isCurrentUser ? userAvatarUrl : undefined) ?? PLACEHOLDER_AVATAR;
   const resolvedBackground = backgroundColor ?? (isCurrentUser ? userAvatarBackground : undefined) ?? DEFAULT_AVATAR_BACKGROUND;
   const avatarEditPath = () => {
      const params = new URLSearchParams(location.search);
      params.set('edit', 'avatar');
      return `/account/settings?${params.toString()}`;
   };
   const handleClick = onClick ?? (isCurrentUser && clickable ? () => navigate(avatarEditPath()) : undefined);
   const { pointsTotal } = useTrustPointTotal({
      userId: currentUserId,
      fallbackPoints: 0,
      enabled: isCurrentUser
   });
   const fallbackRewardIds = useMemo(
      () =>
         getTrustPointRewardProgress(pointsTotal).rewards
            .filter((reward) => reward.status === 'unlocked')
            .map((reward) => reward.id),
      [pointsTotal]
   );
   const { unlockedRewardIds } = useTrustRewardOwnership({
      userId: currentUserId,
      fallbackRewardIds,
      enabled: isCurrentUser
   });
   // A power lender always gets the gold ring, whether it's their own avatar or shown to others.
   // Power lenders additionally get diamond studs set across the crown of the gold ring — a
   // distinct top tier above the plain gold ring borrowers can earn at 120 Trust Points.
   const resolvedUserId = userId ?? (isCurrentUser ? currentUserId : undefined);
   const powerLender = isPowerLender(resolvedUserId);
   const avatarRingRewardId = powerLender
      ? 'gold-avatar-ring'
      : isCurrentUser
        ? getAvatarRingRewardId(unlockedRewardIds)
        : null;
   const ringPadding = avatarRingRewardId ? Math.max(2, Math.round(size * 0.07)) : 0;
   const imageSize = avatarRingRewardId ? size - ringPadding * 2 : size;

   const img = (
      <img
         src={resolvedSrc}
         alt={alt}
         className={`rounded-full object-cover shrink-0 ${className}`}
         style={{ width: imageSize, height: imageSize, backgroundColor: resolvedBackground }}
         onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src !== window.location.origin + PLACEHOLDER_AVATAR) {
               target.src = PLACEHOLDER_AVATAR;
            }
         }}
      />
   );
   // Diamond studs set across the crown of a power lender's gold ring (3 gems, ~top arc).
   const diamondStuds = powerLender
      ? (() => {
           const gemSize = Math.max(5, Math.round(size * 0.16));
           const bandRadius = size / 2 - ringPadding / 2;
           return [-130, -90, -50].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x = size / 2 + bandRadius * Math.cos(rad);
              const y = size / 2 + bandRadius * Math.sin(rad);
              return (
                 <span
                    key={deg}
                    aria-hidden="true"
                    className="absolute rounded-[2px] border-[0.5px] border-white/85"
                    style={{
                       width: gemSize,
                       height: gemSize,
                       left: x - gemSize / 2,
                       top: y - gemSize / 2,
                       transform: 'rotate(45deg)',
                       background: 'linear-gradient(135deg,#ffffff 0%,#dff3ff 35%,#8fd4ff 60%,#5cb6ff 100%)',
                       boxShadow: '0 0 4px rgba(150,220,255,0.9),0 1px 2px rgba(0,0,0,0.25)'
                    }}
                 />
              );
           });
        })()
      : null;

   const content = avatarRingRewardId ? (
      <span
         className={`relative flex shrink-0 items-center justify-center rounded-full ${
            avatarRingRewardId === 'gold-avatar-ring'
               ? 'bg-[conic-gradient(from_145deg,#f6d365,#fff3b0,#b97916,#fff0a3,#f6d365)] shadow-[0_4px_12px_rgba(183,121,22,0.22)]'
               : 'bg-[conic-gradient(from_145deg,#f8fafc,#a8afbf,#ffffff,#7f879a,#f8fafc)] shadow-[0_4px_12px_rgba(89,99,120,0.18)]'
         }`}
         style={{ width: size, height: size, padding: ringPadding }}
      >
         {img}
         {diamondStuds}
      </span>
   ) : (
      img
   );

   if (handleClick) {
      return (
         <button
            type="button"
            onClick={handleClick}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 shrink-0"
            aria-label="Edit profile photo"
            style={{ width: size, height: size }}
         >
            {content}
         </button>
      );
   }

   return content;
}
