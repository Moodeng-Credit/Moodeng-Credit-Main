

import type {
   ShowToast,
   ToastPropsType as Toast,
   ToastConfigItem,
   ToastConfigKey,
   ToastData,
   ToastOverrides
} from '@/components/ToastSystem/types';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

// Re-export types for backward compatibility
export { TOAST_TYPES };
export type { ShowToast, Toast, ToastConfigKey, ToastData, ToastOverrides };

export const TOAST_SETTINGS = {
   DEFAULT_DURATION: 5000,
   MAX_TOASTS: 5,
   POSITION: 'bottom-right'
} as const;

export const TOAST_VARIANTS = {
   success: {
      icon: '/comment-check.svg',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      textColor: 'text-green-700'
   },
   info: {
      icon: 'fas fa-fingerprint',
      iconBg: 'bg-blue-200',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-700'
   },
   error: {
      icon: '/comment-xmark.svg',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-500',
      textColor: 'text-pink-500'
   },
   warning: {
      icon: 'fas fa-wifi',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      textColor: 'text-yellow-700'
   }
} as const;

export const TOAST_CONFIGS: Record<string, ToastConfigItem> = {
   funding_success: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Thank You!',
      message: 'Funding Successful!',
      buttonText: 'Review Funding Details',
      buttonAction: 'review_funding',
      route: '/dashboard'
   },

   repayment_success: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Thank You!',
      message: 'Repayment Successful!',
      buttonText: 'Review Repayment Details',
      buttonAction: 'review_repayment',
      route: '/dashboard'
   },

   verification_success: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Verification Successful!',
      message: 'Congratulations for Verifying.',
      buttonText: 'Continue Loan Request',
      buttonAction: 'continue_loan_request',
      route: '/dashboard'
   },

   loan_created: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Loan Request Created!',
      message: 'Your request is now live for lenders to review.',
      buttonText: 'View Active Loans',
      buttonAction: 'view_active_loans',
      route: '/dashboard'
   },

   funding_error: {
      toastType: TOAST_TYPES.ERROR,
      title: "It's awkward 😅",
      message: 'We were unable to process payment for your funding.',
      buttonText: 'Try Again?',
      buttonAction: 'retry_funding'
   },

   network_error: {
      toastType: TOAST_TYPES.WARNING,
      title: 'Network Error!',
      message: 'Please check your Internet Connection',
      buttonText: 'Try Again?',
      buttonAction: 'retry_network'
   },

   points_earned: {
      toastType: TOAST_TYPES.INFO,
      title: 'You Earned IOU Points!',
      message: (points: number | string) => `You've received ${points} IOU Points!`,
      buttonText: 'Check IOU Points Balance',
      buttonAction: 'check_points_balance',
      customIcon: 'fas fa-coins',
      route: '/dashboard'
   },

   insufficient_funds: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Insufficient Funds',
      message: 'Transaction declined due to insufficient funds.',
      buttonText: 'Change Funding Source',
      buttonAction: 'change_funding_source',
      route: '/dashboard'
   },

   transaction_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Transaction Error',
      message: 'An error occurred during the transaction. Please try again.',
      buttonText: 'Try again?',
      buttonAction: 'retry_transaction'
   },

   verification_failed: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Verification Failed!',
      message: 'Account verification failed. Please try again.',
      buttonText: 'Try Again?',
      buttonAction: 'retry_verification',
      customIcon: 'fas fa-lock'
   },

   server_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Server Error!',
      message: 'An error occurred on the server. Please try again later.',
      buttonText: 'Try Again?',
      buttonAction: 'retry_action'
   },

   loan_error: {
      toastType: TOAST_TYPES.ERROR,
      title: "It's awkward 😅",
      message: 'We were unable to process your loan request.',
      buttonText: 'Try Again?',
      buttonAction: 'retry_loan_request'
   },

   login_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Login Failed',
      message: (error: string | number) => error.toString() || 'Unable to log in. Please try again.',
      buttonText: 'Try Again',
      buttonAction: 'retry_login'
   },

   register_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Registration Failed',
      message: (error: string | number) => error.toString() || 'Unable to register. Please try again.',
      buttonText: 'Try Again',
      buttonAction: 'retry_register'
   },

   email_exists: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Email Already Registered',
      message: () => 'An account already exists with this email. Please sign in or reset your password if you forgot it.',
      buttonText: 'Sign In',
      buttonAction: 'go_to_signin',
      route: '/login'
   },
   password_weak: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Weak Password',
      message: (error: string | number) => error.toString() || 'Password does not meet strength requirements.',
      buttonText: 'OK',
      buttonAction: 'acknowledge'
   },

   worldid_required: {
      toastType: TOAST_TYPES.ERROR,
      title: 'WorldId Verification Required',
      message: 'Please verify your WorldId ID to create a loan request.',
      buttonText: 'Verify Now',
      buttonAction: 'verify_worldid'
   },

   worldid_verified: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'World ID Verified!',
      message: 'Your World ID has been successfully verified.',
      buttonText: 'OK',
      buttonAction: 'acknowledge'
   },

   password_reset_sent: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Reset Link Sent',
      message: 'A password reset link has been sent to your email.',
      buttonText: 'OK',
      buttonAction: 'acknowledge'
   },

   network_required: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Network Selection Required',
      message: 'Please select a network and coin type.',
      buttonText: 'OK',
      buttonAction: 'acknowledge'
   },

   invalid_amount: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Invalid Amount',
      message: 'Please enter a valid loan amount greater than 0.',
      buttonText: 'OK',
      buttonAction: 'acknowledge'
   },

   amount_exceeds_limit: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Amount Exceeds Limit',
      message: 'The loan amount exceeds your credit score limit.',
      buttonText: 'View Credit Score',
      buttonAction: 'view_credit_score'
   },

   loan_limit_reached: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Loan Limit Reached',
      message: 'You have reached your maximum number of active loans.',
      buttonText: 'View Profile',
      buttonAction: 'view_profile',
      route: '/profile'
   },

   profile_updated: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Profile Updated!',
      message: 'Your profile has been updated successfully.',
      buttonText: 'View Profile',
      buttonAction: 'view_profile',
      route: '/profile'
   },

   user_update_success: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Update Successful!',
      message: 'User information updated successfully.',
      buttonText: 'Continue',
      buttonAction: 'continue',
      route: '/profile'
   },

   user_update_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Update Failed',
      message: (error: string | number) => error.toString() || 'Failed to update user information.',
      buttonText: 'Try Again',
      buttonAction: 'retry_update'
   },

   loan_update_success: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Loan Updated!',
      message: 'Loan has been updated successfully.',
      buttonText: 'View Loans',
      buttonAction: 'view_loans',
      route: '/dashboard'
   },

   loan_update_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Update Failed',
      message: (error: string | number) => error.toString() || 'Failed to update loan.',
      buttonText: 'Try Again',
      buttonAction: 'retry_loan_update'
   },

   loan_edit_success: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Loan Edited!',
      message: 'Loan has been edited successfully.',
      buttonText: 'View Loans',
      buttonAction: 'view_loans',
      route: '/dashboard'
   },

   loan_edit_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Edit Failed',
      message: (error: string | number) => error.toString() || 'Failed to edit loan.',
      buttonText: 'Try Again',
      buttonAction: 'retry_loan_edit'
   },

   loan_delete_success: {
      toastType: TOAST_TYPES.SUCCESS,
      title: 'Loan Deleted!',
      message: 'Loan has been deleted successfully.',
      buttonText: 'View Loans',
      buttonAction: 'view_loans',
      route: '/dashboard'
   },

   loan_delete_error: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Delete Failed',
      message: (error: string | number) => error.toString() || 'Failed to delete loan.',
      buttonText: 'Try Again',
      buttonAction: 'retry_loan_delete'
   },

   session_expired: {
      toastType: TOAST_TYPES.WARNING,
      title: 'Session Expired',
      message: 'Your session has expired. Please log in again.',
      buttonText: 'Log In',
      buttonAction: 'go_to_login',
      route: '/login',
      customIcon: 'fas fa-clock'
   },

   unauthorized: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Unauthorised',
      message: 'You are not authorized. Please log in.',
      buttonText: 'Log In',
      buttonAction: 'go_to_login',
      route: '/login'
   },

   worldid_already_used: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Verification Failed',
      message: 'This World ID verification has failed. Please contact support.',
      buttonText: 'Contact Support',
      buttonAction: 'contact_support',
      customIcon: 'fas fa-exclamation-triangle'
   },

   wallet_missing: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Wallet Not Connected',
      message: 'Please connect your wallet to continue.'
   },

   self_lending_not_allowed: {
      toastType: TOAST_TYPES.ERROR,
      title: 'Cannot Lend to Yourself',
      message: 'You cannot lend to your own loan request. Please lend to other users.',
      buttonText: 'View Other Loans',
      buttonAction: 'view_other_loans',
      route: '/dashboard'
   }
} as const;
