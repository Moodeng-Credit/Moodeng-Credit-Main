import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import { Mail } from 'lucide-react';

import Loading from '@/components/Loading';
import {
   AuthFooter,
   AuthInputField,
   SignUpFormErrorAlert,
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

const LINK_PURPLE = '#8336F0';
const DOCS_URL = 'https://moodeng-credit.gitbook.io/moodeng-credit';

type SignUpErrorType = 'account_linked' | 'account_exist' | 'email_taken' | null;

function slugify(text: string): string {
   return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'user';
}

export default function SignUpPage() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const toast = useToast();
   const [showEmailForm, setShowEmailForm] = useState(false);
   const [fullName, setFullName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showPassWeak, setShowPassWeak] = useState(false);
   const [showConfirmMismatch, setShowConfirmMismatch] = useState(false);
   const [accountErrorType, setAccountErrorType] = useState<SignUpErrorType>(null);
   const isWorldId = WorldId.INACTIVE;

   const processAuthResult = (result: unknown) => {
      const data = result as {
         isExistingUser?: boolean;
         isNewUser?: boolean;
         user?: { userRole?: string };
         reason?: 'linked' | 'taken';
      };
      if (data?.isExistingUser) {
         setAccountErrorType(
            data.reason === 'taken' ? 'email_taken' : data.reason === 'linked' ? 'account_linked' : 'account_exist'
         );
         return;
      }
      if (data?.isNewUser) {
         navigate('/auth-success?type=verify');
         return;
      }
      if (data?.user) {
         navigate('/auth-success?type=created');
         return;
      }
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirm('');
      navigate('/auth-success?type=created');
   };

   const handleFormRegister = async () => {
      setIsLoading(true);
      setShowPassWeak(false);
      setShowConfirmMismatch(false);
      setAccountErrorType(null);
      try {
         const result = await dispatch(
            registerUser({
               username: fullName.trim() ? slugify(fullName) : email.split('@')[0],
               isWorldId,
               password,
               email
            })
         ).unwrap();
         processAuthResult(result);
      } catch (err) {
         handleRegisterError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
         setIsLoading(false);
      }
   };

   const handleGoogleAuth = async (credential: string) => {
      setIsLoading(true);
      setAccountErrorType(null);
      try {
         const result = await dispatch(registerWithGoogle({ googleCredential: credential })).unwrap();
         processAuthResult(result);
      } catch (err) {
         handleRegisterError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
         setIsLoading(false);
      }
   };

   const handleTelegramAuth = async (authData: Record<string, string>) => {
      setIsLoading(true);
      setAccountErrorType(null);
      try {
         const result = await dispatch(
            registerWithTelegram({ telegramAuthData: JSON.stringify(authData) })
         ).unwrap();
         processAuthResult(result);
      } catch (err) {
         handleRegisterError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
         setIsLoading(false);
      }
   };

   const handleRegisterError = (errorMsg: string) => {
      const lower = (errorMsg || '').toLowerCase();
      const isEmailError =
         lower.includes('email') || lower.includes('duplicate') || lower.includes('users_email_key');
      if (isEmailError) {
         setAccountErrorType(
            lower.includes('lock') ? 'email_taken' : lower.includes('linked') || lower.includes('google') ? 'account_linked' : 'account_exist'
         );
      } else {
         toast.showToastByConfig('register_error', { error: errorMsg });
      }
   };

   const handleOAuthError = () => {
      setAccountErrorType('account_linked');
   };

   const handleRegister = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setShowConfirmMismatch(false);
      setShowPassWeak(false);
      setAccountErrorType(null);

      if (password.length < 8) {
         setShowPassWeak(true);
         return;
      }
      if (password !== confirm) {
         setShowConfirmMismatch(true);
         return;
      }
      if (isWorldId && password && email) {
         handleFormRegister();
      }
   };

   const hasEmailError = !!accountErrorType;

   if (isLoading) {
      return <Loading />;
   }

   return (
      <div className="flex justify-center items-center min-h-screen py-6 sm:py-12 px-4">
         <div
            className="flex flex-col w-full max-w-[440px] min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-6rem)] items-center rounded-[20px] overflow-y-auto shrink-0"
            style={{
               // background: 'linear-gradient(180deg, #FBFAFD 0%, #FFFFFF 100%)',
               isolation: 'isolate'
            }}
         >
            <div className="flex flex-1 flex-col items-center justify-center w-full px-5 py-6 sm:py-10">
               <img
                  src="/auth-screen.png"
                  alt="Moodeng Mascot"
                  className="w-[110px] h-[96px] sm:w-[140px] sm:h-[120px] object-contain mb-5"
               />

               {!showEmailForm ? (
                  <>
                     <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] text-center mb-1">
                        Welcome to Moodeng Credit
                     </h1>
                     <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D] text-center mb-5 max-w-[400px]">
                        Request short-term loans, repay clearly, and build trust over time.
                     </p>
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
                  <div className="w-full max-w-[400px]">
                     <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] text-center mb-1">
                        Create your Moodeng Account
                     </h1>
                     <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D] text-center mb-6">
                        It takes just a few minutes to get started.
                     </p>

                     <form onSubmit={handleRegister} className="flex flex-col gap-5">
                        <AuthInputField
                           label="Full Name"
                           type="text"
                           placeholder="Enter your full name"
                           value={fullName}
                           onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                           icon={<Icons.user />}
                        />

                        <div className="space-y-2">
                           <AuthInputField
                              label="Email Address"
                              type="email"
                              placeholder="Enter your email address"
                              value={email}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                 setEmail(e.target.value);
                                 setAccountErrorType(null);
                              }}
                              error={hasEmailError}
                              errorMessage={
                                 accountErrorType === 'account_linked'
                                    ? 'Account Already Linked'
                                    : accountErrorType === 'account_exist'
                                      ? 'Account Already Exist'
                                      : accountErrorType === 'email_taken'
                                        ? 'Email Address Taken'
                                        : undefined
                              }
                              errorVariant={
                                 accountErrorType === 'account_linked' || accountErrorType === 'account_exist'
                                    ? 'amber'
                                    : 'red'
                              }
                              icon={<Icons.email />}
                           />
                           {accountErrorType === 'email_taken' && (
                              <SignUpFormErrorAlert type="email_taken" />
                           )}
                           {(accountErrorType === 'account_linked' || accountErrorType === 'account_exist') && (
                              <SignUpFormErrorAlert type={accountErrorType} />
                           )}
                        </div>

                        <div className="space-y-2">
                           <AuthInputField
                              label="Password"
                              type="password"
                              placeholder="Enter your password"
                              value={password}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                 setPassword(e.target.value);
                                 setShowPassWeak(false);
                                 setShowConfirmMismatch(false);
                              }}
                              error={showPassWeak || showConfirmMismatch}
                              errorMessage={
                                 showPassWeak
                                    ? 'Password too weak'
                                    : showConfirmMismatch
                                      ? 'Passwords do not match'
                                      : undefined
                              }
                              errorVariant={showConfirmMismatch ? 'red' : 'amber'}
                              icon={<Icons.lock />}
                              showEyeToggle
                           />
                           {showPassWeak && <SignUpFormErrorAlert type="password_too_weak" />}
                        </div>

                        <div className="space-y-2">
                           <AuthInputField
                              label="Confirm Password"
                              type="password"
                              placeholder="Confirm your password"
                              value={confirm}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                 setConfirm(e.target.value);
                                 setShowConfirmMismatch(false);
                              }}
                              error={showConfirmMismatch}
                              icon={<Icons.lock />}
                              showEyeToggle
                           />
                        </div>

                        <button
                           type="submit"
                           className="w-full h-14 rounded-2xl font-semibold text-[#FDFCFD] text-base tracking-[-0.02em] transition-opacity hover:opacity-95"
                           style={{ backgroundColor: '#6010D2' }}
                        >
                           Create An Account
                        </button>

                        <p className="text-center text-xs leading-[18px] text-[#4D4359] tracking-[-0.02em]">
                           By creating an account, you agree to our{' '}
                           <a
                              href={`${DOCS_URL}/terms`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold underline hover:opacity-80"
                              style={{ color: LINK_PURPLE }}
                           >
                              Terms and Privacy Policy
                           </a>
                        </p>
                     </form>

                     <p className="mt-6 text-center text-base text-[#4D4359] tracking-[-0.02em]">
                        Already have an account?{' '}
                        <Link
                           to="/login"
                           className="font-semibold hover:underline"
                           style={{ color: LINK_PURPLE }}
                        >
                           Log In
                        </Link>
                     </p>
                  </div>
               )}
            </div>

            <AuthFooter />
         </div>
      </div>
   );
}
