

import { ERROR_MESSAGES } from '@/constants/errorMessages';

interface ErrorBoundaryProps {
   errorMessage?: string;
   onReset: () => void;
}

export default function ErrorBoundary({ errorMessage, onReset }: ErrorBoundaryProps) {
   return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
         <div className="max-w-md w-full mx-4">
            <div className="bg-white rounded-lg shadow-xl p-8">
               <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                     />
                  </svg>
               </div>

               <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">{ERROR_MESSAGES.TITLE}</h1>

               <p className="text-center text-gray-600 mb-6">{ERROR_MESSAGES.DESCRIPTION}</p>

               {errorMessage ? (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                     <p className="text-sm text-gray-700 font-mono break-words">{errorMessage}</p>
                  </div>
               ) : null}

               <div className="flex flex-col gap-3">
                  <button
                     onClick={onReset}
                     className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                     type="button"
                  >
                     {ERROR_MESSAGES.PRIMARY_BUTTON}
                  </button>

                  <button
                     onClick={() => (window.location.href = '/dashboard')}
                     className="w-full bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                     type="button"
                  >
                     {ERROR_MESSAGES.SECONDARY_BUTTON}
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
}
