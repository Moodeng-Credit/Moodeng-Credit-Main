import { useEffect, useRef, useState } from 'react';

interface TelegramAuthButtonProps {
   onAuth?: (authData: Record<string, string>) => void;
   /**
    * When true, uses data-auth-url redirect mode instead of the popup-based
    * data-onauth callback. Required on iOS Safari where cross-origin iframe
    * popups are blocked and land on about:blank.
    */
   useRedirect?: boolean;
   buttonSize?: 'large' | 'medium' | 'small';
   /** Hide loading state when embedding in custom-styled buttons */
   hideLoading?: boolean;
   requestWriteAccess?: boolean;
   /**
    * Render the raw widget at its natural size (no full-width clamp / overflow
    * clip) so a parent can position it freely — e.g. centered + scaled inside a
    * compact icon tile. Without this the widget is clamped to the parent width,
    * which makes Telegram reflow the "large" button into a tall, mostly-unclickable
    * column whose login link falls outside the visible tile.
    */
   fitContent?: boolean;
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
   useRedirect = false,
   buttonSize = 'large',
   hideLoading = false,
   requestWriteAccess = false,
   fitContent = false
}: TelegramAuthButtonProps) {
   const containerRef = useRef<HTMLDivElement>(null);
   const widgetIdRef = useRef(`telegram_auth_${Math.random().toString(36).slice(2)}`);
   const rawBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? 'moodengnewbranchbot';
   const botUsername = rawBotUsername?.trim().replace(/^@/, '');
   const onAuthRef = useRef(onAuth);
   const [isLoading, setIsLoading] = useState(true);
   const debugTag = '[TelegramAuthButton]';

   useEffect(() => {
      onAuthRef.current = onAuth;
   });

   // Warm up the telegram-login edge function as soon as the button mounts so
   // the Deno cold-start (~30-60 s) has already happened by the time the user
   // finishes Telegram auth and the callback page needs to call it.
   useEffect(() => {
      if (!useRedirect) return;
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
      if (!supabaseUrl) return;
      fetch(`${supabaseUrl}/functions/v1/telegram-login`, { method: 'OPTIONS' }).catch(() => {});
   }, [useRedirect]);

   useEffect(() => {
      console.debug(`${debugTag} init`, {
         rawBotUsername,
         normalizedBotUsername: botUsername,
         buttonSize,
         hideLoading,
         requestWriteAccess,
         useRedirect,
      });

      if (!botUsername) {
         console.error(`${debugTag} bot username not configured`, {
            rawBotUsername,
            normalizedBotUsername: botUsername
         });
         setIsLoading(false);
         return;
      }

      const widgetId = widgetIdRef.current;
      const callbackName = `${widgetId}_callback`;
      const scriptId = `${widgetId}_script`;

      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', buttonSize);

      if (useRedirect) {
         // Redirect mode: Telegram sends a postMessage to the parent frame which
         // then navigates to the callback URL. This avoids the popup that iOS
         // Safari blocks when triggered from a cross-origin iframe (about:blank bug).
         const callbackUrl = `${window.location.origin}/auth/telegram/callback`;
         script.setAttribute('data-auth-url', callbackUrl);
      } else {
         (window as unknown as Record<string, unknown>)[callbackName] = (user: Record<string, string>) => {
            console.debug(`${debugTag} callback fired`, user);
            onAuthRef.current?.(user);
         };
         script.setAttribute('data-onauth', `${callbackName}(user)`);
      }

      if (requestWriteAccess) {
         script.setAttribute('data-request-access', 'write');
      }
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
         if (!useRedirect) {
            const win = window as unknown as Record<string, unknown>;
            if (win[callbackName]) {
               delete win[callbackName];
            }
         }
      };
   }, [buttonSize, botUsername, hideLoading, rawBotUsername, requestWriteAccess, useRedirect]);

   if (!botUsername) {
      console.debug(`${debugTag} returning null because bot username missing`);
      return null;
   }

   return (
      <div className={fitContent ? 'inline-block' : 'w-full min-w-0'}>
         {!hideLoading && isLoading ? (
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
                  <p className="text-sm font-medium text-white">Loading Telegram...</p>
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
         ) : null}
         <div
            ref={containerRef}
            className={fitContent ? 'justify-center' : 'flex w-full min-w-0 min-h-0 justify-center overflow-hidden [&>iframe]:max-w-full'}
            style={{ display: hideLoading || !isLoading ? (fitContent ? 'inline-flex' : 'flex') : 'none' }}
         />
      </div>
   );
}
