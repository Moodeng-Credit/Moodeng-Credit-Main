import type { TranslationKey } from '@/i18n';

export interface ActionButtonConfig {
   text: string;
   translationKey?: TranslationKey;
   bgColor: string;
   textColor: string;
   href?: string;
   isExternal?: boolean;
   width?: string;
}
