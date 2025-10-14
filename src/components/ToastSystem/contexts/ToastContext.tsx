'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useMemo, useReducer } from 'react';

import { TOAST_SETTINGS } from '@/components/ToastSystem/config/toastConfig';
import { type ToastPropsType } from '@/components/ToastSystem/types';

interface ToastState {
   toasts: ToastPropsType[];
}

interface ToastContextType {
   toasts: ToastPropsType[];
   addToast: (toastData: Omit<ToastPropsType, 'id'>) => void;
   removeToast: (toastId: number) => void;
   clearAllToasts: () => void;
   updateToast: (toastId: number, updates: Partial<ToastPropsType>) => void;
   autoRemoveToast: (toastId: number, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

type ToastAction =
   | { type: 'ADD_TOAST'; payload: Omit<ToastPropsType, 'id'> }
   | { type: 'REMOVE_TOAST'; payload: number }
   | { type: 'CLEAR_ALL_TOASTS' }
   | { type: 'UPDATE_TOAST'; payload: { id: number; updates: Partial<ToastPropsType> } };

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
   switch (action.type) {
      case 'ADD_TOAST':
         return {
            ...state,
            toasts: [...state.toasts, { ...action.payload, id: Date.now() + Math.random() }]
         };

      case 'REMOVE_TOAST':
         return {
            ...state,
            toasts: state.toasts.filter((toast) => toast.id !== action.payload)
         };

      case 'CLEAR_ALL_TOASTS':
         return {
            ...state,
            toasts: []
         };

      case 'UPDATE_TOAST':
         return {
            ...state,
            toasts: state.toasts.map((toast) => (toast.id === action.payload.id ? { ...toast, ...action.payload.updates } : toast))
         };

      default:
         return state;
   }
};

const initialState: ToastState = {
   toasts: []
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
   const [state, dispatch] = useReducer(toastReducer, initialState);

   const addToast = useCallback(
      (toastData: Omit<ToastPropsType, 'id'>) => {
         if (state.toasts.length >= TOAST_SETTINGS.MAX_TOASTS) {
            dispatch({ type: 'REMOVE_TOAST', payload: state.toasts[0].id });
         }

         dispatch({ type: 'ADD_TOAST', payload: toastData });
      },
      [state.toasts]
   );

   const removeToast = useCallback((toastId: number) => {
      dispatch({ type: 'REMOVE_TOAST', payload: toastId });
   }, []);

   const clearAllToasts = useCallback(() => {
      dispatch({ type: 'CLEAR_ALL_TOASTS' });
   }, []);

   const updateToast = useCallback((toastId: number, updates: Partial<ToastPropsType>) => {
      dispatch({ type: 'UPDATE_TOAST', payload: { id: toastId, updates } });
   }, []);

   const autoRemoveToast = useCallback(
      (toastId: number, duration?: number) => {
         const timeoutDuration = duration ?? TOAST_SETTINGS.DEFAULT_DURATION;
         setTimeout(() => {
            removeToast(toastId);
         }, timeoutDuration);
      },
      [removeToast]
   );

   const value: ToastContextType = useMemo(
      () => ({
         toasts: state.toasts,
         addToast,
         removeToast,
         clearAllToasts,
         updateToast,
         autoRemoveToast
      }),
      [state.toasts, addToast, removeToast, clearAllToasts, updateToast, autoRemoveToast]
   );

   return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export default ToastContext;
