import { JSX } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icons } from '@/views/login/components/Icons';
import AuthCard from '@/views/login/components/AuthCard';

export default function AuthSuccessPage(): JSX.Element {
   const [searchParams] = useSearchParams();
   const type = searchParams.get('type');
   
   const isLinkFlow = type === 'link';

   return (
      <div
         className="flex overflow-hidden flex-col items-center px-6 py-12 w-full min-h-screen max-md:px-4 bg-gray-100"
         style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
         }}
      >
         <div className="flex justify-center items-center w-full max-w-md">
            <AuthCard
               title="Check Your Email"
               isSignUp={false}
               headerColor="bg-emerald-500"
               mascotPosition="right"
            >
               <div className="flex flex-col items-center text-center space-y-6 py-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                     <Icons.email className="w-10 h-10" />
                  </div>
                  
                  <div className="space-y-2">
                     <h2 className="text-2xl font-bold text-gray-800">
                        {isLinkFlow ? 'Link Your Account' : 'Verify Your Email'}
                     </h2>
                     <p className="text-gray-600 leading-relaxed">
                        {isLinkFlow 
                           ? "An account with this email already exists (likely via Google). We've sent a password reset link to your email. Please use it to set a password and link your email login."
                           : "We've sent a verification link to your email address. Please check your inbox and follow the instructions to complete your registration."
                        }
                     </p>
                  </div>

                  <div className="w-full pt-4">
                     <Link
                        to="/login#login"
                        className="flex justify-center items-center px-6 py-3 w-full text-white font-bold bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
                     >
                        Back to Login
                     </Link>
                  </div>

                  <p className="text-sm text-gray-400">
                     Didn't receive the email? Check your spam folder or try again.
                  </p>
               </div>
            </AuthCard>
         </div>
      </div>
   );
}
