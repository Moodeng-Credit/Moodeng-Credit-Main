/// <reference types="vite/client" />

interface ImportMetaEnv {
   readonly VITE_SUPABASE_URL: string;
   readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
   readonly VITE_SITE_URL: string;
   readonly VITE_REDIRECT_URL: string;
   readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
   readonly VITE_ALCHEMY_ID: string;
   readonly VITE_ALLOWED_CHAIN_NAME: string;
   readonly VITE_WORLD_ID_APP_ID: string;
   readonly VITE_WORLD_ID_ACTION_ID: string;
   readonly VITE_GOOGLE_CLIENT_ID: string;
   readonly VITE_TELEGRAM_BOT_USERNAME: string;
   readonly VITE_DEV_MODE: string;
}

interface ImportMeta {
   readonly env: ImportMetaEnv;
}
