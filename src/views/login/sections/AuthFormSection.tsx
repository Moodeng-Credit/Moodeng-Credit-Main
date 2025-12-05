import { type ChangeEvent, type FormEvent, type JSX, useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import Loading from '@/components/Loading';
import TextWithLine from '@/components/ui/TextWithLine';

import {
   useLogin,
   useLoginWithGoogle,
   useLoginWithTelegram,
   useRegister,
   useRegisterWithGoogle,
   useRegisterWithTelegram
} from '@/hooks/api';

import { WorldId } from '@/types/authTypes';
import AuthCard from '@/views/login/components/AuthCard';
import AuthForm from '@/views/login/components/AuthForm';
import FormFooter from '@/views/login/components/FormFooter';
import FormToggle from '@/views/login/components/FormToggle';
import SocialButtons from '@/views/login/components/SocialButtons';

export default function AuthFormSection(): JSX.Element {
   const router = useRouter();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [username, setUsername] = useState('');
   const [showUser, setShowUser] = useState(false);
   const [showPass, setShowPass] = useState(false);
   const [showEmail, setShowEmail] = useState(false);
   const [showConfirm, setShowConfirm] = useState(false);
   const [showAccount, setShowAccount] = useState(false);
   const [isSignUp, setIsSignUp] = useState(true);
   const isWorldId = WorldId.INACTIVE;

   const login = useLogin();
   const loginWithGoogle = useLoginWithGoogle();
   const loginWithTelegram = useLoginWithTelegram();
   const register = useRegister();
   const registerWithGoogle = useRegisterWithGoogle();
   const registerWithTelegram = useRegisterWithTelegram();

   const isLoading =
      login.isPending ||
      loginWithGoogle.isPending ||
      loginWithTelegram.isPending ||
      register.isPending ||
      registerWithGoogle.isPending ||
      registerWithTelegram.isPending;

   const clear = useCallback(() => {
      setEmail('');
      setPassword('');
      setConfirm('');
      setUsername('');
   }, []);

   const clearShow = useCallback(() => {
      setShowUser(false);
      setShowPass(false);
      setShowEmail(false);
      setShowConfirm(false);
      setShowAccount(false);
   }, []);

   const handleSuccess = useCallback(() => {
      clear();
      router.push('/dashboard');
   }, [clear, router]);

   const handleRegisterError = (error: Error) => {
      const errorMsg = error.message || 'Registration failed';
      console.log(errorMsg);
      if (errorMsg.includes('User')) setShowUser(true);
      if (errorMsg.includes('Email')) setShowEmail(true);
      if (errorMsg.includes('Password')) setShowPass(true);
   };

   const handleOAuthError = useCallback((error: Error, authType: string) => {
      const errorMsg = error.message || 'Authentication failed';
      console.error(`${authType} auth failed:`, errorMsg);
      if (errorMsg.includes('not registered')) {
         setIsSignUp(true);
      } else {
         setShowAccount(true);
      }
   }, []);

   const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
      setShowConfirm(false);
      e.preventDefault();
      clearShow();

      if (password !== confirm) {
         setShowConfirm(true);
         return;
      }

      if (username && isWorldId && password && email && password === confirm) {
         register.mutate(
            { username, isWorldId, password, email },
            {
               onSuccess: handleSuccess,
               onError: handleRegisterError
            }
         );
      }
   };

   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      clearShow();

      if (username && password) {
         login.mutate(
            { username, password },
            {
               onSuccess: handleSuccess,
               onError: () => setShowAccount(true)
            }
         );
      }
   };

   const handleGoogleAuth = useCallback(
      (credential: string) => {
         clearShow();
         const mutation = isSignUp ? registerWithGoogle : loginWithGoogle;
         mutation.mutate(
            { googleCredential: credential },
            {
               onSuccess: handleSuccess,
               onError: (error) => handleOAuthError(error, 'Google')
            }
         );
      },
      [isSignUp, registerWithGoogle, loginWithGoogle, handleSuccess, clearShow, handleOAuthError]
   );

   const handleTelegramAuth = useCallback(
      (authData: Record<string, string>) => {
         clearShow();
         const telegramAuthData = JSON.stringify(authData);
         const mutation = isSignUp ? registerWithTelegram : loginWithTelegram;
         mutation.mutate(
            { telegramAuthData },
            {
               onSuccess: handleSuccess,
               onError: (error) => handleOAuthError(error, 'Telegram')
            }
         );
      },
      [isSignUp, registerWithTelegram, loginWithTelegram, handleSuccess, clearShow, handleOAuthError]
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
