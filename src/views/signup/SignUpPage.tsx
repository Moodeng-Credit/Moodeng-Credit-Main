import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import { Mail } from 'lucide-react';

import Loading from '@/components/Loading';
import {
   AuthFooter,
   AuthInputField,
   SocialAuthButtons,
   SocialButton,
   DividerWithText
} from '@/components/auth';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { Icons } from '@/views/login/components/Icons';
import {
   registerUser,
   registerWithGoogle,
   registerWithTelegram
} from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { WorldId } from '@/types/authTypes';
import '@/views/signup/styles/signup.css';

const MASCOT_URL =
   'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/63818c0d2e2c11f8d3d69636d4fb34a5c246fd06e7e66b3cd3116ca7901b3ba5?apiKey=e485b3dc4b924975b4554885e21242bb';

const LINK_PURPLE = '#8336F0';

export default function SignUpPage() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const toast = useToast();
   const [showEmailForm, setShowEmailForm] = useState(false);
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showPass, setShowPass] = useState(false);
   const [showConfirm, setShowConfirm] = useState(false);
   const [showAccount, setShowAccount] = useState(false);
   const [accountError, setAccountError] = useState('');
   const isWorldId = WorldId.INACTIVE;

   const handleAuthAction = async (
      action: typeof registerUser | typeof registerWithGoogle | typeof registerWithTelegram,
      payload: unknown
   ) => {
      setIsLoading(true);
      setShowPass(false);
      setShowConfirm(false);
      setShowAccount(false);
      setAccountError('');

      try {
         const result = await dispatch(action(payload as never)).unwrap();
         const data = result as { isExistingUser?: boolean; isNewUser?: boolean };
         if (data?.isExistingUser) {
            navigate('/auth-success?type=link');
            return;
         }
         if (data?.isNewUser) {
            navigate('/auth-success?type=verify');
            return;
         }
         setEmail('');
         setPassword('');
         setConfirm('');
         navigate('/dashboard');
      } catch (err) {
         const errMsg = err instanceof Error ? err.message : 'Authentication failed';
         handleRegisterError(errMsg);
      } finally {
         setIsLoading(false);
      }
   };

   const handleRegisterError = (errorMsg: string) => {
      const lower = (errorMsg || '').toLowerCase();
      const isEmailError =
         lower.includes('email') || lower.includes('duplicate') || lower.includes('users_email_key');
      if (isEmailError) {
         toast.showToastByConfig('email_exists');
         setAccountError(
            'An account already exists with this email. Please sign in or reset your password.'
         );
      } else {
         toast.showToastByConfig('register_error', { error: errorMsg });
         setAccountError('Registration failed. Please check your information and try again.');
      }
      setShowAccount(true);
   };

   const handleOAuthError = () => {
      setShowAccount(true);
   };

   const handleRegister = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setShowConfirm(false);
      setShowPass(false);
      if (password.length < 6) {
         setShowPass(true);
         return;
      }
      if (password !== confirm) {
         setShowConfirm(true);
         return;
      }
      if (isWorldId && password && email) {
         handleAuthAction(registerUser, { username: email, isWorldId, password, email });
      }
   };

   const handleGoogleAuth = (credential: string) => {
      handleAuthAction(registerWithGoogle, { googleCredential: credential });
   };

   const handleTelegramAuth = (authData: Record<string, string>) => {
      handleAuthAction(registerWithTelegram, { telegramAuthData: JSON.stringify(authData) });
   };

   if (isLoading) {
      return <Loading />;
   }

   return (
      <div className="flex justify-center items-center min-h-screen py-6 sm:py-12 px-4">
         <div
            className="flex flex-col w-full max-w-[440px] min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-6rem)] items-center rounded-[20px] overflow-y-auto shrink-0"
            style={{
               background: 'linear-gradient(180deg, #FBFAFD 0%, #FFFFFF 100%)',
               isolation: 'isolate'
            }}
         >
            <div className="flex flex-1 flex-col items-center justify-center w-full px-5 py-6 sm:py-10">
               {/* Mascot - 228x200 per Sign Up design */}
               <img
                  src='/auth-screen.png'
                  alt="Moodeng Mascot"
                  className="w-[140px] h-[120px] sm:w-[228px] sm:h-[200px] object-contain mb-5"
               />
               <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] text-center mb-1">
                  Welcome to Moodeng Credit
               </h1>
               <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D] text-center mb-5 max-w-[400px]">
                  Request short-term loans, repay clearly, and build trust over time.
               </p>

               {/* Social auth buttons */}
               {!showEmailForm ? (
                  <>
                     <SocialAuthButtons
                        isSignUp
                        onGoogleSuccess={handleGoogleAuth}
                        onGoogleError={handleOAuthError}
                        onTelegramAuth={handleTelegramAuth}
                     />

                     <DividerWithText text="OR" lineColor="#9285A0" textColor="#877897" className="my-6" />

                     <SocialButton
                        icon={<Mail className="w-5 h-5 text-[#250650]" />}
                        text="Sign Up with Email"
                        variant="outline"
                        onClick={() => setShowEmailForm(true)}
                        className="mb-4 border-[#B5ACBE]"
                     />

                     <p className="text-center text-base text-[#4D4359] tracking-[-0.02em]">
                        Already have an account?{' '}
                        <Link
                           to="/login"
                           className="font-semibold hover:underline"
                           style={{ color: LINK_PURPLE }}
                        >
                           Log In
                        </Link>
                     </p>
                  </>
               ) : (
                  <form onSubmit={handleRegister} className="w-full max-w-[400px] space-y-5">
                     <AuthInputField
                        label="Email Address"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        error={showAccount}
                        icon={<Icons.email />}
                     />
                     {showAccount && (
                        <span className="text-red-500 text-sm">{accountError || 'Sign up failed.'}</span>
                     )}
                     <AuthInputField
                        label="Password"
                        type="password"
                        placeholder="Create your password"
                        value={password}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        error={showPass}
                        icon={<Icons.lock />}
                        showEyeToggle
                     />
                     {showPass && (
                        <span className="text-red-500 text-sm">
                           Password must be at least 6 characters.
                        </span>
                     )}
                     <AuthInputField
                        label="Confirm Password"
                        type="password"
                        placeholder="Confirm your password"
                        value={confirm}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                        error={showConfirm}
                        icon={<Icons.lock />}
                     />
                     {showConfirm && (
                        <span className="text-red-500 text-sm">Passwords do not match.</span>
                     )}
                     <button
                        type="submit"
                        className="w-full h-14 rounded-2xl font-semibold text-[#FDFCFD] text-base tracking-[-0.02em] transition-opacity hover:opacity-95"
                        style={{ backgroundColor: '#6010D2' }}
                     >
                        Create Account
                     </button>
                     <button
                        type="button"
                        onClick={() => setShowEmailForm(false)}
                        className="w-full text-sm text-neutral-500 hover:text-neutral-700"
                     >
                        ← Back to other options
                     </button>
                  </form>
               )}
            </div>

            <AuthFooter />
         </div>
      </div>
   );
}
