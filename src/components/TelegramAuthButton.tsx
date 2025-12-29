

import { useEffect, useRef, useState } from 'react';

interface TelegramAuthButtonProps {
   onAuth: (authData: Record<string, string>) => void;
   buttonSize?: 'large' | 'medium' | 'small';
}

declare global {
   interface Window {
      TelegramLoginWidget?: {
         dataOnauth?: (user: Record<string, string>) => void;
      };
   }
}

export default function TelegramAuthButton({ onAuth, buttonSize = 'large' }: TelegramAuthButtonProps) {
   const containerRef = useRef<HTMLDivElement>(null);
   const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
   const onAuthRef = useRef(onAuth);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      onAuthRef.current = onAuth;
   });

   useEffect(() => {
      if (!botUsername) {
         console.error('Telegram bot username not configured');
         setIsLoading(false);
         return;
      }

      const existingScript = document.getElementById('telegram-login-script');
      if (existingScript) {
         existingScript.remove();
      }

      (window as unknown as Record<string, unknown>).onTelegramAuth = (user: Record<string, string>) => {
         onAuthRef.current(user);
      };

      const script = document.createElement('script');
      script.id = 'telegram-login-script';
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', buttonSize);
      script.setAttribute('data-onauth', 'onTelegramAuth');
      script.setAttribute('data-request-access', 'write');

      // Mark as loaded once the script finishes loading
      script.onload = () => {
         // Small delay to ensure widget renders completely
         setTimeout(() => {
            setIsLoading(false);
         }, 100);
      };

      script.onerror = () => {
         console.error('Failed to load Telegram widget script');
         setIsLoading(false);
      };

      if (containerRef.current) {
         containerRef.current.innerHTML = '';
         containerRef.current.appendChild(script);
      }

      return () => {
         const win = window as unknown as Record<string, unknown>;
         if (win.onTelegramAuth) {
            delete win.onTelegramAuth;
         }
      };
   }, [buttonSize, botUsername]);

   if (!botUsername) {
      return null;
   }

   return (
      <div>
         {isLoading && (
            <div className="flex justify-center py-4">
               <div className="flex flex-col items-center gap-3 w-full px-4">
                  {/* Animated loading bar skeleton */}
                  <div className="w-full max-w-xs h-12 bg-gradient-to-r from-blue-200 to-blue-300 rounded-xl overflow-hidden shadow-sm">
                     <div
                        className="h-full w-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 bg-[length:200%_100%]"
                        style={{
                           animation: 'shimmer 2s infinite'
                        }}
                     />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Loading Telegram...</p>
               </div>
               <style>{`
                  @keyframes shimmer {
                     0% {
                        background-position: -200% 0;
                        opacity: 0.7;
                     }
                     50% {
                        opacity: 1;
                     }
                     100% {
                        background-position: 200% 0;
                        opacity: 0.7;
                     }
                  }
               `}</style>
            </div>
         )}
         <div
            ref={containerRef}
            className="flex justify-center"
            style={{
               visibility: isLoading ? 'hidden' : 'visible',
               height: isLoading ? '0' : 'auto',
               overflow: 'hidden'
            }}
         />
      </div>
   );
}
