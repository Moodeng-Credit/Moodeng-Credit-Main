export type ToastSuccessType =
   | 'profile_updated'
   | 'funding_success'
   | 'repayment_success'
   | 'verification_success'
   | 'user_update_success'
   | 'loan_created'
   | 'loan_edit_success'
   | 'loan_update_success'
   | 'loan_delete_success'
   | 'points_earned'
   | 'worldid_verified'
   | 'password_reset_sent'
   | null;

export type ToastErrorType =
   | 'transaction_error'
   | 'insufficient_funds'
   | 'funding_error'
   | 'network_error'
   | 'register_error'
   | 'email_exists'
   | 'login_error'
   | 'user_update_error'
   | 'verification_failed'
   | 'server_error'
   | 'loan_error'
   | 'loan_edit_error'
   | 'loan_update_error'
   | 'loan_delete_error'
   | 'worldid_required'
   | 'worldid_already_used'
   | 'network_required'
   | 'invalid_amount'
   | 'amount_exceeds_limit'
   | 'loan_limit_reached'
   | 'profile_updated'
   | 'user_update_success'
   | 'user_update_error'
   | 'session_expired'
   | 'unauthorized'
   | 'password_weak'
   | 'self_lending_not_allowed'
   | 'wallet_missing';

export interface ToastConfig {
   success: ToastSuccessType;
   error: ToastErrorType;
}
export const TOAST_TYPES = {
   SUCCESS: 'success', // Green
   INFO: 'info', // Blue/Purple/Teal
   ERROR: 'error', // Pink/Red
   WARNING: 'warning' // Grey
} as const;

// Types for toast functionality
export type ToastType = (typeof TOAST_TYPES)[keyof typeof TOAST_TYPES];
export type ToastConfigKey = Exclude<ToastSuccessType | ToastErrorType, null>;

export interface ToastData {
   points?: number;
   error?: string;
   retry?: () => void;
   [key: string]: unknown;
}

export interface ToastOverrides {
   duration?: number;
   autoClose?: boolean;
   [key: string]: unknown;
}

export interface ToastPropsType {
   id: number;
   toastType: ToastType;
   title: string;
   message: string | ((data: number | string) => string);
   buttonText?: string;
   buttonAction?: string;
   customData?: ToastData;
   customIcon?: string;
   emoji?: string;
   duration?: number;
   autoClose?: boolean;
}

export type ShowToast = (
   toastType: ToastType,
   title: string,
   message: string | ((data: number | string) => string),
   buttonText?: string,
   buttonAction?: string,
   customData?: ToastData,
   customIcon?: string,
   emoji?: string,
   duration?: number,
   autoClose?: boolean
) => void;

export interface ToastConfigItem {
   toastType: ToastType;
   title: string;
   message: string | ((data: number | string) => string);
   buttonText?: string;
   buttonAction?: string;
   customIcon?: string;
   route?: string;
   externalAction?: string;
}
