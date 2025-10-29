'use client';

import { type FormEvent, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useDispatch } from 'react-redux';

import GoogleAuthButton from '@/components/board/GoogleAuthButton';
import TelegramAuthButton from '@/components/board/TelegramAuthButton';
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

export default function Log() {
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
   const [showLog, setShowLog] = useState(true);
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
            /* alert(resultAction.payload.message); */
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
            /* alert(resultAction.payload.message); */
         }
         setIsLoading(false);
      }
   };

   const handleGoogleAuth = async (credential: string) => {
      setIsLoading(true);
      clearShow();

      const action = showLog ? registerWithGoogle : loginWithGoogle;
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
            setShowLog(true); // Switch to register mode
         } else {
            setShowAccount(true);
         }
      }
      setIsLoading(false);
   };

   const handleTelegramAuth = async (authData: Record<string, string>) => {
      setIsLoading(true);
      clearShow();

      const telegramAuthData = JSON.stringify(authData);
      const action = showLog ? registerWithTelegram : loginWithTelegram;
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
            setShowLog(true); // Switch to register mode
         } else {
            setShowAccount(true);
         }
      }
      setIsLoading(false);
   };

   const handleOAuthError = () => {
      console.error('OAuth authentication failed');
      setShowAccount(true);
   };

   return (
      <div className="min-h-screen bg-zinc-100 flex flex-col md:flex-row justify-center items-center px-6 py-12 gap-8">
         {isLoading ? (
            <Loading />
         ) : showLog ? (
            <div className="w-full bg-white max-w-md border rounded-2xl shadow p-6 space-y-4">
               <h2 className="text-xl font-semibold text-center text-blue-600">Welcome to Moodeng Credit</h2>

               <GoogleAuthButton onSuccess={handleGoogleAuth} onError={handleOAuthError} text="signup_with" />

               <TelegramAuthButton onAuth={handleTelegramAuth} buttonSize="large" />

               <TextWithLine text="OR CONTINUE WITH EMAIL" textColour="text-gray-400" lineColour="bg-gray-400" />

               <form onSubmit={handleRegister} className="space-y-4">
                  <input
                     required
                     type="text"
                     placeholder="@username"
                     className={`w-full border px-3 py-2 rounded-md ${showUser ? 'border-rose-500' : 'border-gray-400'}`}
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                  />
                  {showUser ? <span className="text-rose-600 text-sm">User already exists.</span> : null}

                  <div className="flex">
                     <input
                        required
                        type="email"
                        placeholder="your_email@moodeng.com"
                        className={`w-full border px-3 py-2 rounded-md ${showEmail ? 'border-rose-500' : 'border-gray-400'}`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                     />
                  </div>
                  {showEmail ? <span className="text-rose-600 text-sm">Email already exists.</span> : null}

                  <input
                     required
                     type="password"
                     placeholder="Password"
                     className={`w-full border px-3 py-2 rounded-md ${showPass ? 'border-rose-500' : 'border-gray-400'}`}
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                  />
                  {showPass ? (
                     <span className="text-rose-600 text-sm">
                        Password is weak, Password must be at least 6 characters long and can only include letters, numbers, and the symbols
                        !@#$%^&*()+=._-
                     </span>
                  ) : null}

                  <input
                     required
                     type="password"
                     placeholder="Confirm Password"
                     className={`w-full border px-3 py-2 rounded-md ${showConfirm ? 'border-rose-500' : 'border-gray-400'}`}
                     value={confirm}
                     onChange={(e) => setConfirm(e.target.value)}
                  />
                  {showConfirm ? <span className="text-rose-600 text-sm">Passwords do not match.</span> : null}

                  <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                     Register
                  </button>
               </form>

               <p className="text-center text-sm text-gray-400">
                  Already have an account?{' '}
                  <a onClick={() => setShowLog(!showLog)} href="#login" className="text-blue-600 font-semibold hover:underline">
                     Log In Here
                  </a>
               </p>

               <p className="text-center text-sm text-gray-400">Terms × Privacy × Docs</p>
            </div>
         ) : (
            <div className="w-full bg-white max-w-md border rounded-2xl shadow p-6 space-y-5">
               <h2 className="text-xl font-semibold text-center text-blue-600">Welcome back! We're glad to see you again.</h2>

               <GoogleAuthButton onSuccess={handleGoogleAuth} onError={handleOAuthError} text="signin_with" />

               <TelegramAuthButton onAuth={handleTelegramAuth} buttonSize="large" />

               <form onSubmit={handleLogin} className="space-y-5">
                  <div className="flex items-center gap-2 text-gray-400 text-sm justify-center">
                     <hr className="w-1/4 border" />
                     <span>OR</span>
                     <hr className="w-1/4 border" />
                  </div>

                  <TextWithLine text="OR CONTINUE WITH EMAIL" textColour="text-gray-400" lineColour="bg-gray-400" />

                  <input
                     required
                     type="text"
                     placeholder="@username"
                     className={`w-full border px-3 py-2 rounded-md ${showAccount ? 'border-rose-500' : 'border-gray-400'}`}
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                  />
                  {showAccount ? <span className="text-rose-600 text-sm">Invalid credentials.</span> : null}

                  <input
                     required
                     type="password"
                     placeholder="Password"
                     className={`w-full border px-3 py-2 rounded-md ${showAccount ? 'border-rose-500' : 'border-gray-400'}`}
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                  />
                  {showAccount ? <span className="text-rose-600 text-sm">Invalid credentials.</span> : null}

                  <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                     Login
                  </button>
               </form>

               <p className="text-center text-sm text-gray-400">
                  Dont have an account?{' '}
                  <a onClick={() => setShowLog(!showLog)} href="#register" className="text-blue-600 font-semibold hover:underline">
                     Sign Up Here
                  </a>
               </p>

               <p className="text-center text-sm text-gray-400">Terms × Privacy × Docs</p>
            </div>
         )}
      </div>
   );
}
