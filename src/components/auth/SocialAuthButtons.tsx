import { useState } from 'react';

import TelegramAuthButton from '@/components/TelegramAuthButton';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface SocialAuthButtonsProps {
   isSignUp: boolean;
   onGoogleSuccess?: (credential: string) => void;
   onGoogleError?: () => void;
   onTelegramAuth: (authData: Record<string, string>) => void;
}

const btnBase =
   'w-full flex flex-row justify-center items-center gap-2.5 px-5 py-4 h-[56px] min-h-[56px] rounded-xl transition-opacity hover:opacity-95 cursor-pointer';

const GoogleLogo = () => (
   <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
   </svg>
);

export function SocialAuthButtons({
   isSignUp,
   onTelegramAuth
}: SocialAuthButtonsProps) {
   const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
   const botUsername = 'moodengnewbranchbot';
   const [isGoogleLoading, setIsGoogleLoading] = useState(false);

   const googleLabel = isSignUp ? 'Sign Up with Google' : 'Sign In with Google';

   const handleGoogleClick = async () => {
      if (isGoogleLoading) return;
      setIsGoogleLoading(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
               redirectTo: `${window.location.origin}/auth/confirm`,
            },
         });
         if (error) {
            console.error('[SocialAuthButtons] Google OAuth error:', error.message);
            setIsGoogleLoading(false);
         }
         // If successful, the browser redirects — no need to reset loading state
      } catch (err) {
         console.error('[SocialAuthButtons] Google OAuth exception:', err);
         setIsGoogleLoading(false);
      }
   };

   return (
      <div className="flex flex-col gap-4 w-full max-w-[400px]">
         {/* Google: uses Supabase OAuth redirect flow */}
         {clientId && (
            <button
               type="button"
               onClick={handleGoogleClick}
               disabled={isGoogleLoading}
               className={`${btnBase} bg-[#FDFCFD] border border-[#B5ACBE] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] ${
                  isGoogleLoading ? 'opacity-60 cursor-not-allowed' : ''
               }`}
            >
               <GoogleLogo />
               <span
                  className="text-base font-medium tracking-[-0.02em] text-[#141218]"
                  style={{ fontFamily: 'SF Pro Display, sans-serif' }}
               >
                  {isGoogleLoading ? 'Redirecting...' : googleLabel}
               </span>
            </button>
         )}

         {/* Telegram: show the real Telegram widget directly */}
         {botUsername && (
            <div className="w-full flex justify-center rounded-xl bg-[#1A8DFF] p-2 shadow-[0px_2px_4px_rgba(27,28,29,0.04)]">
               <TelegramAuthButton onAuth={onTelegramAuth} buttonSize="large" />
            </div>
         )}
      </div>
   );
}
