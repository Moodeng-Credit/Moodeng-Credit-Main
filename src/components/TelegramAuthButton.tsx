'use client';

import { useEffect, useRef } from 'react';

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
   const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

   useEffect(() => {
      if (!botUsername) {
         console.error('Telegram bot username not configured');
         return;
      }

      // Clean up any existing script
      const existingScript = document.getElementById('telegram-login-script');
      if (existingScript) {
         existingScript.remove();
      }

      // Create callback function
      (window as unknown as Record<string, unknown>).onTelegramAuth = (user: Record<string, string>) => {
         onAuth(user);
      };

      // Create and append the Telegram widget script - matching the exact working pattern
      const script = document.createElement('script');
      script.id = 'telegram-login-script';
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', buttonSize);
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');

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
   }, [buttonSize, onAuth, botUsername]);

   if (!botUsername) {
      return null;
   }

   return <div ref={containerRef} className="flex justify-center" />;
}
