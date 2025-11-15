'use client';

import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

interface GoogleAuthButtonProps {
   onSuccess: (credential: string) => void;
   onError: () => void;
   text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export default function GoogleAuthButton({ onSuccess, onError, text = 'continue_with' }: GoogleAuthButtonProps) {
   const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

   if (!clientId) {
      console.error('Google Client ID not configured');
      return null;
   }

   return (
      <GoogleOAuthProvider clientId={clientId}>
         <div className="w-full flex justify-center">
            <GoogleLogin
               onSuccess={(credentialResponse) => {
                  if (credentialResponse.credential) {
                     onSuccess(credentialResponse.credential);
                  } else {
                     onError();
                  }
               }}
               onError={onError}
               text={text}
               size="large"
               width="100%"
               theme="outline"
               shape="rectangular"
            />
         </div>
      </GoogleOAuthProvider>
   );
}
