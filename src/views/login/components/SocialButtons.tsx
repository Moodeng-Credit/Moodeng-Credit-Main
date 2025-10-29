import { type JSX } from 'react';

import GoogleAuthButton from '@/components/board/GoogleAuthButton';
import TelegramAuthButton from '@/components/board/TelegramAuthButton';

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
         <TelegramAuthButton onAuth={onTelegramAuth} buttonSize="large" />
      </div>
   );
}
