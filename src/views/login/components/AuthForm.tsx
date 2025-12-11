import { type ChangeEvent, type FormEvent, type JSX } from 'react';

import Link from 'next/link';

import FormInput from '@/views/login/components/FormInput';
import { Icons } from '@/views/login/components/Icons';

interface AuthFormProps {
   mode: 'signin' | 'signup';
   username: string;
   email: string;
   password: string;
   confirm: string;
   showUser: boolean;
   showEmail: boolean;
   showPass: boolean;
   showConfirm: boolean;
   showAccount: boolean;
   accountError?: string;
   onUsernameChange: (e: ChangeEvent<HTMLInputElement>) => void;
   onEmailChange: (e: ChangeEvent<HTMLInputElement>) => void;
   onPasswordChange: (e: ChangeEvent<HTMLInputElement>) => void;
   onConfirmChange: (e: ChangeEvent<HTMLInputElement>) => void;
   onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export default function AuthForm({
   mode,
   username,
   email,
   password,
   confirm,
   showUser,
   showEmail,
   showPass,
   showConfirm,
   showAccount,
   accountError,
   onUsernameChange,
   onEmailChange,
   onPasswordChange,
   onConfirmChange,
   onSubmit
}: AuthFormProps): JSX.Element {
   const isSignUp = mode === 'signup';
   const focusColor = isSignUp ? 'focus:ring-emerald-500' : 'focus:ring-blue-500';
   const buttonColor = isSignUp ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700';
   const buttonText = isSignUp ? 'Create Account' : 'Sign In';

   return (
      <form onSubmit={onSubmit} className="space-y-4">
         <div className="space-y-4">
            <FormInput
               type="text"
               placeholder={isSignUp ? 'Create a Username' : '@username'}
               value={username}
               onChange={onUsernameChange}
               error={isSignUp ? showUser : showAccount}
               icon={Icons.user}
               focusColor={focusColor}
            />
            {isSignUp && showUser ? <span className="text-red-500 text-sm">User already exists.</span> : null}

            {isSignUp ? (
               <>
                  <FormInput
                     type="email"
                     placeholder="Enter your Email"
                     value={email}
                     onChange={onEmailChange}
                     error={showEmail}
                     icon={Icons.email}
                     focusColor={focusColor}
                  />
                  {showEmail ? <span className="text-red-500 text-sm">Email already exists.</span> : null}
               </>
            ) : null}

            <FormInput
               type="password"
               placeholder={isSignUp ? 'Create your Password' : 'Enter your Password'}
               value={password}
               onChange={onPasswordChange}
               error={isSignUp ? showPass : showAccount}
               icon={Icons.lock}
               focusColor={focusColor}
            />
            {isSignUp && showPass ? (
               <span className="text-red-500 text-sm">
                  Password is weak, Password must be at least 6 characters long and can only include letters, numbers, and the symbols
                  !@#$%^&*()+=._-
               </span>
            ) : null}

            {isSignUp ? (
               <>
                  <FormInput
                     type="password"
                     placeholder="Confirm your Password"
                     value={confirm}
                     onChange={onConfirmChange}
                     error={showConfirm}
                     icon={Icons.lock}
                     focusColor={focusColor}
                  />
                  {showConfirm ? <span className="text-red-500 text-sm">Passwords do not match.</span> : null}
               </>
            ) : null}

            {!isSignUp && showAccount ? <span className="text-red-500 text-sm">Invalid credentials.</span> : null}

            {isSignUp && showAccount ? <span className="text-red-500 text-sm">{accountError || 'Sign Up Error. Please try again.'}</span> : null}

            {!isSignUp ? (
               <div className="flex items-center justify-between">
                  <label className="flex items-center">
                     <input type="checkbox" className="mr-2" />
                     <span className="text-sm text-gray-600">Remember me</span>
                  </label>
                  <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                     Forgot password?
                  </Link>
               </div>
            ) : null}
         </div>

         <button type="submit" className={`w-full ${buttonColor} text-white py-3 rounded-lg transition-colors font-medium`}>
            {buttonText}
         </button>
      </form>
   );
}
