import type { NavigateFunction as AppRouterInstance } from 'react-router-dom';

import { TOAST_CONFIGS } from '@/components/ToastSystem/config/toastConfig';
import type { ToastData } from '@/components/ToastSystem/types';
import { openSupportContacts, type SupportContactIssue } from '@/components/support/supportContacts';
import { openSupportChat } from '@/lib/support/liveChat';

const SUPPORT_ACTIONS = new Set(['open_support_chat', 'open_support_contacts', 'contact_support']);

/**
 * Whether tapping a toast button with this action would actually do something. Most configs ship a
 * "Try again?" (`retry_*`) button, but no caller passes the `retry` callback it needs, and a few
 * actions (`acknowledge`, `verify_worldid`, …) have no handler at all — so the button only closed
 * the toast. A borrower tapped one eight times in a row on a failing repayment. Hide those instead.
 */
export const isToastActionAvailable = (action: string | undefined, customData: ToastData = {}): boolean => {
   if (!action) return false;
   if (SUPPORT_ACTIONS.has(action)) return true;
   if (action.startsWith('retry_') && typeof customData.retry === 'function') return true;
   const configEntry = Object.values(TOAST_CONFIGS).find((config) => config.buttonAction === action);
   return Boolean(
      configEntry && (('route' in configEntry && configEntry.route) || ('externalAction' in configEntry && configEntry.externalAction))
   );
};

export const handleToastAction = (action: string, customData: ToastData, navigate: AppRouterInstance) => {
   if (action === 'open_support_chat') {
      openSupportChat(typeof customData.supportTopic === 'string' ? customData.supportTopic : undefined);
      return;
   }

   if (action === 'open_support_contacts') {
      openSupportContacts((customData.supportIssue as SupportContactIssue | undefined) ?? 'general');
      return;
   }

   if (action === 'contact_support') {
      navigate('/support');
      return;
   }

   const configEntry = Object.values(TOAST_CONFIGS).find((config) => config.buttonAction === action);

   if (configEntry && 'route' in configEntry && configEntry.route && navigate) {
      navigate(configEntry.route);
      return;
   }

   if (configEntry && 'externalAction' in configEntry && configEntry.externalAction && typeof configEntry.externalAction === 'string') {
      window.open(configEntry.externalAction, '_blank');
      return;
   }

   if (action.startsWith('retry_') && customData?.retry) {
      customData.retry();
      return;
   }

   console.log('Toast action:', action, customData);
};
