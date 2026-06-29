import { type JSX } from 'react';

import GoogleAuthButton from '@/components/GoogleAuthButton';
import LineLoginButton from '@/components/LineLoginButton';
import TelegramIconTile from '@/components/auth/TelegramIconTile';

interface SocialButtonsProps {
   onGoogleAuth: (credential: string) => void;
   onTelegramAuth: (authData: Record<string, string>) => void;
   onOAuthError: () => void;
   isSignUp: boolean;
}

export default function SocialButtons({ onGoogleAuth, onTelegramAuth, onOAuthError, isSignUp }: SocialButtonsProps): JSX.Element {
   const googleText = isSignUp ? 'signup_with' : 'signin_with';

   return (
      <div className="space-y-3">
         <GoogleAuthButton onSuccess={onGoogleAuth} onError={onOAuthError} text={googleText} />
         {/* Secondary providers as small logo-square tiles in a centered row (Polymarket-style) */}
         <div className="flex items-center justify-center gap-3">
            <TelegramIconTile onAuth={onTelegramAuth} />
            <LineLoginButton isSignUp={isSignUp} iconOnly />
         </div>
      </div>
   );
}
