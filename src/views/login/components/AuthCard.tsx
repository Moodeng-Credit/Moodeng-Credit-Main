import { type JSX, type ReactNode } from 'react';



interface AuthCardProps {
   title: string;
   isSignUp: boolean;
   headerColor: string;
   mascotPosition: 'left' | 'right';
   children: ReactNode;
}

export default function AuthCard({ title, isSignUp, headerColor, mascotPosition, children }: AuthCardProps): JSX.Element {
   const subtitle = 'Create your account to get started with moodeng.';

   return (
      <div className="w-full max-w-md mx-auto">
         <div className={`flex -mb-4 p-0 ${mascotPosition === 'left' ? 'justify-start' : 'justify-end'}`}>
            <div className="w-20 h-20 z-10">
               <img
                  src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/63818c0d2e2c11f8d3d69636d4fb34a5c246fd06e7e66b3cd3116ca7901b3ba5?apiKey=e485b3dc4b924975b4554885e21242bb"
                  alt="Moodeng Mascot"
                  width={80}
                  height={80}
                  className="w-full h-full object-contain drop-shadow-lg"
               />
            </div>
         </div>
         <div className="bg-white rounded-2xl shadow-lg relative">
            {/* Header */}
            <div className={`${headerColor} text-white px-4 py-2 rounded-t-2xl`}>
               <h2 className="text-2xl font-bold text-center">{title}</h2>
            </div>

            {/* Content Area */}
            <div className="p-8 space-y-6">
               {/* Intro Text */}
               <p className="text-gray-600 text-center text-sm">{subtitle}</p>

               {children}
            </div>
         </div>
      </div>
   );
}
