/**
 * External links configuration
 * Centralized storage for all external URLs used in the application
 */

export const EXTERNAL_LINKS = {
   telegram: {
      bot: `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}`,
      channel: `https://t.me/${import.meta.env.VITE_TELEGRAM_CHANNEL_USERNAME}`
   },
   worldcoin: {
      main: 'https://worldcoin.org/',
      docs: 'https://docs.worldcoin.org/'
   },
   social: {
      twitter: 'https://twitter.com/begfi',
      discord: 'https://discord.gg/begfi'
   }
} as const;

export type ExternalLinkCategory = keyof typeof EXTERNAL_LINKS;
