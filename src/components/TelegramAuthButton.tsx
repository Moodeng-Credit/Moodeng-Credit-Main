

import { useEffect, useRef, useState } from 'react';

interface TelegramAuthButtonProps {
   onAuth: (authData: Record<string, string>) => void;
   buttonSize?: 'large' | 'medium' | 'small';
   /** Hide loading state when embedding in custom-styled buttons */
   hideLoading?: boolean;
}

declare global {
   interface Window {
      TelegramLoginWidget?: {
         dataOnauth?: (user: Record<string, string>) => void;
      };
   }
}

export default function TelegramAuthButton({
   onAuth,
   buttonSize = 'large',
   hideLoading = false
}: TelegramAuthButtonProps) {
   const containerRef = useRef<HTMLDivElement>(null);
   const rawBotUsername = "moodengnewbranchbot";
   const botUsername = rawBotUsername?.trim().replace(/^@/, '');
   const onAuthRef = useRef(onAuth);
   const [isLoading, setIsLoading] = useState(true);
   const debugTag = '[TelegramAuthButton]';

   useEffect(() => {
      onAuthRef.current = onAuth;
   });

   useEffect(() => {
      console.debug(`${debugTag} init`, {
         rawBotUsername,
         normalizedBotUsername: botUsername,
         buttonSize,
         hideLoading
      });

      if (!botUsername) {
         console.error(`${debugTag} bot username not configured`, {
            rawBotUsername,
            normalizedBotUsername: botUsername
         });
         setIsLoading(false);
         return;
      }

      const existingScript = document.getElementById('telegram-login-script');
      if (existingScript) {
         console.debug(`${debugTag} removing existing script before re-mount`);
         existingScript.remove();
      }

      (window as unknown as Record<string, unknown>).onTelegramAuth = (user: Record<string, string>) => {
         console.debug(`${debugTag} onTelegramAuth callback fired`, user);
         onAuthRef.current(user);
      };

      const script = document.createElement('script');
      script.id = 'telegram-login-script';
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', buttonSize);
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      console.debug(`${debugTag} script configured`, {
         src: script.src,
         telegramLoginAttr: script.getAttribute('data-telegram-login'),
         sizeAttr: script.getAttribute('data-size'),
         origin: window.location.origin
      });

      // Mark as loaded once the script finishes loading
      script.onload = () => {
         console.debug(`${debugTag} script loaded`);
         // Small delay to ensure widget renders completely
         setTimeout(() => {
            const hasIframe = !!containerRef.current?.querySelector('iframe');
            if (!hasIframe) {
               console.error(`${debugTag} widget iframe not found after script load`, {
                  html: containerRef.current?.innerHTML ?? '',
                  childElementCount: containerRef.current?.childElementCount ?? 0,
                  origin: window.location.origin
               });
            } else {
               console.debug(`${debugTag} widget iframe rendered successfully`);
            }
            setIsLoading(false);
         }, 100);
      };

      script.onerror = () => {
         console.error(`${debugTag} failed to load Telegram widget script`, {
            src: script.src,
            origin: window.location.origin
         });
         setIsLoading(false);
      };

      if (containerRef.current) {
         containerRef.current.innerHTML = '';
         containerRef.current.appendChild(script);
         console.debug(`${debugTag} script appended to container`, {
            childElementCount: containerRef.current.childElementCount
         });
      } else {
         console.error(`${debugTag} containerRef is null, cannot append widget script`);
      }

      return () => {
         console.debug(`${debugTag} cleanup`);
         const win = window as unknown as Record<string, unknown>;
         if (win.onTelegramAuth) {
            delete win.onTelegramAuth;
         }
      };
   }, [buttonSize, botUsername]);

   if (!botUsername) {
      console.debug(`${debugTag} returning null because bot username missing`);
      return null;
   }

   return (
      <div>
         {!hideLoading && isLoading && (
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
            className="flex justify-center min-w-0 min-h-0"
            style={{ display: hideLoading || !isLoading ? 'flex' : 'none' }}
         />
      </div>
   );
}
