export const Icons = {
   user: ({ className = 'h-5 w-5 text-gray-400' }: { className?: string }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
         />
      </svg>
   ),
   email: ({ className = 'h-5 w-5 text-gray-400' }: { className?: string }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
         />
      </svg>
   ),
   lock: ({ className = 'h-5 w-5 text-gray-400' }: { className?: string }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
         />
      </svg>
   )
};
