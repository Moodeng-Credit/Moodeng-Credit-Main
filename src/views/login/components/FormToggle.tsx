import { type JSX } from 'react';

interface FormToggleProps {
   isSignUp: boolean;
   onToggle: (isSignUp: boolean) => void;
}

export default function FormToggle({ isSignUp, onToggle }: FormToggleProps): JSX.Element {
   return (
      <div className="flex bg-gray-100 rounded-lg p-1">
         <button
            onClick={() => onToggle(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
               isSignUp ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:text-gray-800'
            }`}
         >
            Sign Up
         </button>
         <button
            onClick={() => onToggle(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
               !isSignUp ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-800'
            }`}
         >
            Sign In
         </button>
      </div>
   );
}
