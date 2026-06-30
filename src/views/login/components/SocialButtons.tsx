import { type JSX, useState } from 'react';

import GoogleAuthButton from '@/components/GoogleAuthButton';
import LineLoginButton from '@/components/LineLoginButton';
import LastUsedBadge from '@/components/auth/LastUsedBadge';
import TelegramLoginTile from '@/components/auth/TelegramLoginTile';

import { getLastUsedAuth } from '@/lib/lastUsedAuth';

interface SocialButtonsProps {
   onGoogleAuth: (credential: string) => void;
   onTelegramAuth: (authData: Record<string, string>) => void;
   onOAuthError: () => void;
   isSignUp: boolean;
}

export default function SocialButtons({ onGoogleAuth, onOAuthError, isSignUp }: SocialButtonsProps): JSX.Element {
   const googleText = isSignUp ? 'signup_with' : 'signin_with';
   const [lastUsed] = useState(getLastUsedAuth);

   return (
      <div className="space-y-3">
         <div className="relative w-full">
            <GoogleAuthButton onSuccess={onGoogleAuth} onError={onOAuthError} text={googleText} />
            {lastUsed === 'google' && <LastUsedBadge className="-top-2 right-3" />}
         </div>
         {/* Secondary providers as small logo-square tiles, left-aligned under the Google button */}
         <div className="flex items-center justify-start gap-3">
            <div className="relative">
               <TelegramLoginTile />
               {lastUsed === 'telegram' && <LastUsedBadge size="sm" className="-top-2 left-1/2 -translate-x-1/2" />}
            </div>
            <div className="relative">
               <LineLoginButton isSignUp={isSignUp} iconOnly />
               {lastUsed === 'line' && <LastUsedBadge size="sm" className="-top-2 left-1/2 -translate-x-1/2" />}
            </div>
         </div>
      </div>
   );
}
