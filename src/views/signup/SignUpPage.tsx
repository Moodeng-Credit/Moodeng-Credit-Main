import { type ChangeEvent, type FormEvent, useState } from 'react';

import { Mail } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AuthFooter, AuthInputField, DividerWithText, SignUpFormErrorAlert, SocialAuthButtons, SocialButton } from '@/components/auth';
import Loading from '@/components/Loading';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { buildEmailConfirmationPath } from '@/lib/authPaths';
import { registerUser, registerWithGoogle, registerWithTelegram } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { WorldId } from '@/types/authTypes';
import { Icons } from '@/views/login/components/Icons';
import '@/views/signup/styles/signup.css';

const LINK_PURPLE = '#8336F0';

type SignUpErrorType = 'account_linked' | 'account_exist' | 'email_taken' | null;

function slugify(text: string): string {
   return (
      text
         .trim()
         .toLowerCase()
         .replace(/\s+/g, '-')
         .replace(/[^a-z0-9-]/g, '')
         .replace(/-+/g, '-')
         .replace(/^-|-$/g, '') || 'user'
   );
}

// dispatch(...).unwrap() throws Redux Toolkit's SerializedError, a plain object
// (not an Error instance) that still carries the original `message` string. An
// `instanceof Error` check misses it entirely, so every rejected thunk fell back
// to the generic 'Authentication failed' regardless of the real failure reason.
function getErrorMessage(err: unknown, fallback: string): string {
   if (err instanceof Error) return err.message;
   if (typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string') {
      const message = (err as { message: string }).message;
      if (message) return message;
   }
   return fallback;
}

export default function SignUpPage() {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const dispatch = useDispatch<AppDispatch>();
   const toast = useToast();
   const initialEmail = searchParams.get('email')?.trim() ?? '';
   const [showEmailForm, setShowEmailForm] = useState(!!initialEmail);
   const [username, setUsername] = useState('');
   const [email, setEmail] = useState(initialEmail);
   const [password, setPassword] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showPassWeak, setShowPassWeak] = useState(false);
   const [accountErrorType, setAccountErrorType] = useState<SignUpErrorType>(null);
   const isWorldId = WorldId.INACTIVE;

   const navigateToEmailConfirmation = (nextEmail: string) => {
      navigate(buildEmailConfirmationPath(nextEmail));
   };

   const processAuthResult = (result: unknown) => {
      const data = result as {
         isExistingUser?: boolean;
         loggedIn?: boolean;
         isNewUser?: boolean;
         needsEmailVerification?: boolean;
         user?: { id?: string; userRole?: string | null };
         reason?: 'linked' | 'taken' | 'existing';
      };
      // Implicit login: existing account, correct password → sign them straight in.
      if (data?.loggedIn && data.user) {
         toast.showToast(TOAST_TYPES.INFO, 'Account already exists', 'Logging you in…');
         navigate(data.user.userRole ? '/dashboard' : '/onboarding/role');
         return;
      }
      if (data?.isExistingUser) {
         setAccountErrorType(data.reason === 'taken' ? 'email_taken' : data.reason === 'linked' ? 'account_linked' : 'account_exist');
         return;
      }
      if (data?.isNewUser) {
         if (data.needsEmailVerification) {
            navigateToEmailConfirmation(email);
            return;
         }
         if (data.user?.id) {
            navigate(data.user.userRole ? '/dashboard' : '/auth-success?type=created');
            return;
         }
         navigateToEmailConfirmation(email);
         return;
      }
      if (data?.user) {
         navigate(data.user.userRole ? '/dashboard' : '/auth-success?type=created');
         return;
      }
      setUsername('');
      setEmail('');
      setPassword('');
      navigate('/auth-success?type=created');
   };

   const handleFormRegister = async () => {
      setIsLoading(true);
      setShowPassWeak(false);
      setAccountErrorType(null);
      try {
         const result = await dispatch(
            registerUser({
               username: username.trim() ? slugify(username) : email.split('@')[0],
               isWorldId,
               password,
               email
            })
         ).unwrap();
         processAuthResult(result);
      } catch (err) {
         handleRegisterError(getErrorMessage(err, 'Authentication failed'));
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
         handleRegisterError(getErrorMessage(err, 'Authentication failed'));
      } finally {
         setIsLoading(false);
      }
   };

   const handleTelegramAuth = async (authData: Record<string, string>) => {
      setIsLoading(true);
      setAccountErrorType(null);
      try {
         const result = await dispatch(registerWithTelegram({ telegramAuthData: JSON.stringify(authData) })).unwrap();
         processAuthResult(result);
      } catch (err) {
         handleRegisterError(getErrorMessage(err, 'Authentication failed'));
      } finally {
         setIsLoading(false);
      }
   };

   const handleRegisterError = (errorMsg: string) => {
      const lower = (errorMsg || '').toLowerCase();
      const isEmailError =
         lower.includes('email') || lower.includes('duplicate') || lower.includes('users_email_key') || lower.includes('already registered');
      if (isEmailError) {
         setAccountErrorType(
            lower.includes('lock')
               ? 'email_taken'
               : lower.includes('linked') || lower.includes('google')
                 ? 'account_linked'
                 : 'account_exist'
         );
         return;
      }

      // "Failed to fetch" / "Load failed" are raw browser fetch errors — meaningless
      // to a user. Show something actionable instead of echoing them verbatim.
      const isNetworkError = lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('network');
      toast.showToastByConfig('register_error', {
         error: isNetworkError ? 'Could not reach the server. Check your connection and try again.' : errorMsg
      });
   };

   const handleOAuthError = () => {
      setAccountErrorType('account_linked');
   };

   const handleRegister = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setShowPassWeak(false);
      setAccountErrorType(null);

      if (password.length < 8) {
         setShowPassWeak(true);
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
                        icon={<Mail className="w-5 h-5 text-[#250650] dark:text-[#F8F4FF]" />}
                        text="Sign Up with Email"
                        variant="outline"
                        onClick={() => setShowEmailForm(true)}
                        className="mb-4 border-[#B5ACBE]"
                     />
                     <p className="text-center text-base text-[#4D4359] tracking-[-0.02em]">
                        Already have an account?{' '}
                        <Link to="/sign-in" className="font-semibold hover:underline" style={{ color: LINK_PURPLE }}>
                           Log In
                        </Link>
                     </p>
                     <Link
                        to="/request-board?tour=1"
                        className="text-center text-base font-semibold tracking-[-0.02em] text-[#8336F0] hover:underline"
                     >
                        Take a tour first
                     </Link>
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
                           label="Username"
                           type="text"
                           placeholder="Choose a username"
                           value={username}
                           onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                           icon={<Icons.user />}
                           autoComplete="username"
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
                                    ? 'Already linked'
                                    : accountErrorType === 'account_exist'
                                      ? 'Already registered'
                                      : accountErrorType === 'email_taken'
                                        ? 'Email address taken'
                                        : undefined
                              }
                              errorVariant={accountErrorType === 'account_linked' || accountErrorType === 'account_exist' ? 'amber' : 'red'}
                              icon={<Icons.email />}
                              autoComplete="email"
                           />
                           {accountErrorType === 'email_taken' && <SignUpFormErrorAlert type="email_taken" />}
                           {(accountErrorType === 'account_linked' || accountErrorType === 'account_exist') && (
                              <SignUpFormErrorAlert type={accountErrorType} email={email} />
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
                              }}
                              error={showPassWeak}
                              errorMessage={showPassWeak ? 'Password too weak' : undefined}
                              errorVariant="amber"
                              icon={<Icons.lock />}
                              showEyeToggle
                              autoComplete="new-password"
                           />
                           {showPassWeak && <SignUpFormErrorAlert type="password_too_weak" />}
                        </div>

                        <button
                           type="submit"
                           className="w-full h-14 rounded-2xl font-semibold text-[#FDFCFD] text-base tracking-[-0.02em] transition-opacity hover:opacity-95"
                           style={{ backgroundColor: '#6010D2' }}
                        >
                           Create An Account
                        </button>
                     </form>

                     <p className="mt-6 text-center text-base text-[#4D4359] tracking-[-0.02em]">
                        Already have an account?{' '}
                        <Link to="/sign-in" className="font-semibold hover:underline" style={{ color: LINK_PURPLE }}>
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
