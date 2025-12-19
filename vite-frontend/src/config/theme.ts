/**
 * Theme configuration - Centralized color constants
 * Used across the application for consistent styling
 */

export const COLORS = {
   // Primary colors
   primary: '#1E56FF',
   primaryDark: '#2563EB',
   primaryLight: '#3B82F6',

   // Status colors
   success: '#166534',
   successLight: '#22C55E',
   successBg: '#D1FAE5',
   successBorder: '#A7F3D0',

   error: '#b91c1c',
   errorLight: '#EF4444',
   errorBg: '#FEE2E2',
   errorBorder: '#FECACA',

   warning: '#D97706',
   warningBg: '#FEF3C7',
   warningBorder: '#FDE68A',

   info: '#2563EB',
   infoBg: '#DBEAFE',
   infoBorder: '#BFDBFE',

   // Neutral colors
   neutral: '#6B7280',
   neutralDark: '#0B1033',
   neutralLight: '#E5E7EB',

   // Background colors
   bgPrimary: '#0B1120',
   bgSecondary: '#1F2937',
   bgTertiary: '#F3E8FF',

   // Text colors
   textPrimary: '#0B1033',
   textSecondary: '#6B7280',
   textLight: '#ffffff',

   // Special status colors
   purple: '#A78BFA',
   purpleBg: '#F3E8FF',
   purpleBorder: '#EDE9FE',

   // Network specific colors (for badges/cards)
   blue: '#2a56f4',
   blueLight: '#c9d5f9',
   blueMedium: '#b9c8f9',
   blueAlt: '#a7b9f9'
} as const;

/**
 * Common Tailwind class combinations for consistent styling
 */
export const THEME_CLASSES = {
   card: 'bg-white rounded-xl shadow-md',
   cardDark: 'bg-[#1F2937] rounded-xl',
   button: {
      primary: 'bg-[#1E56FF] text-white font-extrabold text-sm rounded-md py-3 px-5 transition-opacity hover:opacity-90',
      secondary: 'bg-white text-black border border-solid transition-colors hover:bg-gray-50',
      danger: 'bg-red-500 text-white transition-opacity hover:opacity-90',
      success: 'bg-green-600 text-white transition-opacity hover:opacity-90'
   },
   input: {
      default: 'px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none rounded-md border border-gray-300',
      filled: 'bg-[#e0e7ff] rounded px-2 py-1 text-[#3b82f6]'
   }
} as const;

export type ThemeColor = keyof typeof COLORS;
