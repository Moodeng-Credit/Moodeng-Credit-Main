import { type JSX } from 'react';

interface FormFooterProps {
   isSignUp: boolean;
}

export default function FormFooter({ isSignUp }: FormFooterProps): JSX.Element {
   const text = isSignUp
      ? 'By creating an account, you agree to our Terms and Privacy Policy'
      : 'By signing in you agree to our Terms and Privacy Policy';

   return (
      <div className="text-center space-y-2">
         <p className="text-xs text-gray-500">{text}</p>
         <div className="flex justify-center gap-4 text-xs text-gray-400">
            <a href="https://moodeng-credit.gitbook.io/moodeng-credit" className="hover:text-gray-600">
               Privacy
            </a>
            <a href="https://moodeng-credit.gitbook.io/moodeng-credit" className="hover:text-gray-600">
               Terms
            </a>
            <a href="https://moodeng-credit.gitbook.io/moodeng-credit" className="hover:text-gray-600">
               Docs
            </a>
         </div>
      </div>
   );
}
