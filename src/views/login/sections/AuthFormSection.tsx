import { type FormEvent, type JSX, useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useDispatch } from 'react-redux';

import Loading from '@/components/Loading';
import TextWithLine from '@/components/ui/TextWithLine';

import {
   loginUser,
   loginWithGoogle,
   loginWithTelegram,
   registerUser,
   registerWithGoogle,
   registerWithTelegram
} from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import AuthCard from '@/views/login/components/AuthCard';
import AuthForm from '@/views/login/components/AuthForm';
import FormFooter from '@/views/login/components/FormFooter';
import FormToggle from '@/views/login/components/FormToggle';
import SocialButtons from '@/views/login/components/SocialButtons';

export default function AuthFormSection(): JSX.Element {
   const router = useRouter();
   const dispatch = useDispatch<AppDispatch>();
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
   const isWorldId = 'INACTIVE';

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

   const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
      setShowConfirm(false);
      e.preventDefault();
      clearShow();
      if (password !== confirm) {
         setShowConfirm(true);
      }
      if (username && isWorldId && password && email && password === confirm) {
         setIsLoading(true);
         const resultAction = await dispatch(registerUser({ username, isWorldId, password, email }));
         console.log(resultAction);
         if (registerUser.fulfilled.match(resultAction)) {
            clear();
            router.push('/dashboard');
         } else {
            const cdt = (resultAction.payload as Record<string, string>)?.message || resultAction.error?.message || 'Registration failed';
            console.log(cdt);
            if (cdt.includes('User')) setShowUser(true);
            if (cdt.includes('Email')) setShowEmail(true);
            if (cdt.includes('Password')) setShowPass(true);
         }
         setIsLoading(false);
      }
   };

   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      clearShow();
      if (username && password) {
         setIsLoading(true);
         const resultAction = await dispatch(loginUser({ username, password }));
         if (loginUser.fulfilled.match(resultAction)) {
            clear();
            router.push('/dashboard');
         } else {
            setShowAccount(true);
         }
         setIsLoading(false);
      }
   };

   const handleGoogleAuth = useCallback(
      async (credential: string) => {
         setIsLoading(true);
         clearShow();

         const action = isSignUp ? registerWithGoogle : loginWithGoogle;
         const resultAction = await dispatch(
            action({
               googleCredential: credential
            })
         );

         if (action.fulfilled.match(resultAction)) {
            clear();
            router.push('/dashboard');
         } else {
            const errorMsg = (resultAction.payload as Record<string, string>)?.message || 'Authentication failed';
            console.error('Google auth failed:', errorMsg);
            if (errorMsg.includes('not registered')) {
               setIsSignUp(true); // Switch to register mode
            } else {
               setShowAccount(true);
            }
         }
         setIsLoading(false);
      },
      [isSignUp, dispatch, router]
   );

   const handleTelegramAuth = useCallback(
      async (authData: Record<string, string>) => {
         setIsLoading(true);
         clearShow();

         const telegramAuthData = JSON.stringify(authData);
         const action = isSignUp ? registerWithTelegram : loginWithTelegram;
         const resultAction = await dispatch(
            action({
               telegramAuthData
            })
         );

         if (action.fulfilled.match(resultAction)) {
            clear();
            router.push('/dashboard');
         } else {
            const errorMsg = (resultAction.payload as Record<string, string>)?.message || 'Authentication failed';
            console.error('Telegram auth failed:', errorMsg);
            if (errorMsg.includes('not registered')) {
               setIsSignUp(true); // Switch to register mode
            } else {
               setShowAccount(true);
            }
         }
         setIsLoading(false);
      },
      [isSignUp, dispatch, router]
   );

   const handleOAuthError = () => {
      console.error('OAuth authentication failed');
      setShowAccount(true);
   };

   const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setUsername(e.target.value);
   }, []);

   const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
   }, []);

   const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
   }, []);

   const handleConfirmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
                     onOAuthError={handleOAuthError}
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
