import { type ChangeEvent, type FormEvent, type JSX, useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import type { AsyncThunkAction } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';

import Loading from '@/components/Loading';
import TextWithLine from '@/components/ui/TextWithLine';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import {
   loginUser,
   loginWithGoogle,
   loginWithTelegram,
   registerUser,
   registerWithGoogle,
   registerWithTelegram
} from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { WorldId } from '@/types/authTypes';
import AuthCard from '@/views/login/components/AuthCard';
import AuthForm from '@/views/login/components/AuthForm';
import FormFooter from '@/views/login/components/FormFooter';
import FormToggle from '@/views/login/components/FormToggle';
import SocialButtons from '@/views/login/components/SocialButtons';

type AuthActionThunk =
   | typeof loginUser
   | typeof registerUser
   | typeof loginWithGoogle
   | typeof loginWithTelegram
   | typeof registerWithGoogle
   | typeof registerWithTelegram;

type AuthPayload =
   | { username: string; password: string }
   | { username: string; isWorldId: string; password: string; email: string }
   | { googleCredential: string }
   | { telegramAuthData: string };

export default function AuthFormSection(): JSX.Element {
   const router = useRouter();
   const dispatch = useDispatch<AppDispatch>();
   const toast = useToast();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [username, setUsername] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showUser, setShowUser] = useState(false);
   const [showPass, setShowPass] = useState(false);
   const [showEmail, setShowEmail] = useState(false);
   const [showConfirm, setShowConfirm] = useState(false);
   const [showAccount, setShowAccount] = useState(false);
   const [isSignUp, setIsSignUp] = useState(true);
   const isWorldId = WorldId.INACTIVE;

   const clear = () => {
      setEmail('');
      setPassword('');
      setConfirm('');
      setUsername('');
   };

   const clearShow = () => {
      setShowUser(false);
      setShowPass(false);
      setShowEmail(false);
      setShowConfirm(false);
      setShowAccount(false);
   };

   const handleAuthAction = useCallback(
      async (action: AuthActionThunk, payload: AuthPayload, errorHandler?: (errorMsg: string) => void) => {
         setIsLoading(true);
         clearShow();

         const resultAction = await dispatch(action(payload as never) as AsyncThunkAction<unknown, unknown, Record<string, unknown>>);

         if (action.fulfilled.match(resultAction)) {
            clear();
            router.push('/dashboard');
         } else {
            // When a thunk rejects, the error is in action.error, not action.payload
            const errorMsg =
               (resultAction.payload as Record<string, string>)?.message ||
               (resultAction as any)?.error?.message ||
               ('Authentication failed' as string);

            if (errorHandler) {
               errorHandler(errorMsg);
            } else {
               setShowAccount(true);
            }
         }
         setIsLoading(false);
      },
      [dispatch, router]
   );

   const handleRegisterError = (errorMsg: string) => {
      console.log(errorMsg);
      if (errorMsg.includes('User')) setShowUser(true);
      if (errorMsg.includes('Email')) setShowEmail(true);
      if (errorMsg.includes('Password')) setShowPass(true);
   };

   const handleLoginError = (errorMsg: string) => {
      console.log('handleLoginError called with:', errorMsg);
      // Check if this is an email verification error from Supabase
      // Supabase returns error_not_confirmed code - our thunk transforms it to a friendly message
      const isEmailError = errorMsg.toLowerCase().includes('verify') || errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('confirm');
      console.log('Is email error?', isEmailError);
      
      if (isEmailError) {
         console.log('Showing email verification toast');
         toast.showToastByConfig('login_error', { error: errorMsg });
      } else {
         console.log('Showing account error inline');
         setShowAccount(true);
      }
   };

   const handleOAuthError = (errorMsg: string, authType: string) => {
      console.error(`${authType} auth failed:`, errorMsg);
      if (errorMsg.includes('not registered')) {
         setIsSignUp(true); // Switch to register mode
      } else {
         setShowAccount(true);
      }
   };

   const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
      setShowConfirm(false);
      e.preventDefault();
      clearShow();

      if (password !== confirm) {
         setShowConfirm(true);
         return;
      }

      if (username && isWorldId && password && email && password === confirm) {
         await handleAuthAction(registerUser, { username, isWorldId, password, email }, handleRegisterError);
      }
   };

   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      clearShow();

      if (username && password) {
         await handleAuthAction(loginUser, { username, password }, handleLoginError);
      }
   };

   const handleGoogleAuth = useCallback(
      async (credential: string) => {
         const action = isSignUp ? registerWithGoogle : loginWithGoogle;
         await handleAuthAction(action, { googleCredential: credential }, (errorMsg) => handleOAuthError(errorMsg, 'Google'));
      },
      [isSignUp, handleAuthAction]
   );

   const handleTelegramAuth = useCallback(
      async (authData: Record<string, string>) => {
         const telegramAuthData = JSON.stringify(authData);
         const action = isSignUp ? registerWithTelegram : loginWithTelegram;
         await handleAuthAction(action, { telegramAuthData }, (errorMsg) => handleOAuthError(errorMsg, 'Telegram'));
      },
      [isSignUp, handleAuthAction]
   );

   const handleOAuthErrorFallback = () => {
      console.error('OAuth authentication failed');
      setShowAccount(true);
   };

   const handleUsernameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      setUsername(e.target.value);
   }, []);

   const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
   }, []);

   const handlePasswordChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
   }, []);

   const handleConfirmChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      setConfirm(e.target.value);
   }, []);

   return (
      <div
         className="flex overflow-hidden flex-col items-center px-6 py-12 w-full min-h-screen max-md:px-4 bg-gray-100"
         style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
         }}
      >
         {isLoading ? (
            <Loading />
         ) : (
            <div className="flex justify-center items-center w-full">
               <AuthCard
                  title="Moodeng Credit"
                  isSignUp={isSignUp}
                  headerColor={isSignUp ? 'bg-emerald-500' : 'bg-blue-600'}
                  mascotPosition={isSignUp ? 'left' : 'right'}
               >
                  <SocialButtons
                     onGoogleAuth={handleGoogleAuth}
                     onTelegramAuth={handleTelegramAuth}
                     onOAuthError={handleOAuthErrorFallback}
                     isSignUp={isSignUp}
                  />

                  <TextWithLine text="OR CONTINUE WITH EMAIL" textColour="text-gray-400" lineColour="bg-gray-400" />

                  <FormToggle isSignUp={isSignUp} onToggle={setIsSignUp} />

                  <AuthForm
                     mode={isSignUp ? 'signup' : 'signin'}
                     username={username}
                     email={email}
                     password={password}
                     confirm={confirm}
                     showUser={showUser}
                     showEmail={showEmail}
                     showPass={showPass}
                     showConfirm={showConfirm}
                     showAccount={showAccount}
                     onUsernameChange={handleUsernameChange}
                     onEmailChange={handleEmailChange}
                     onPasswordChange={handlePasswordChange}
                     onConfirmChange={handleConfirmChange}
                     onSubmit={isSignUp ? handleRegister : handleLogin}
                  />

                  <FormFooter isSignUp={isSignUp} />
               </AuthCard>
            </div>
         )}
      </div>
   );
}
