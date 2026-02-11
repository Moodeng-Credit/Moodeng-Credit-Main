import { useSelector } from 'react-redux';

import { Avatar, AvatarFallback } from '@/components/shadcn/avatar';
import { Badge } from '@/components/shadcn/badge';
import { Button } from '@/components/shadcn/button';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import type { RootState } from '@/store/store';

export default function LenderBoardHeader() {
   const user = useSelector((state: RootState) => state.auth.user);
   const isVerified = user?.isWorldId === 'ACTIVE';

   const getFirstName = () => {
      if (!user?.username) return 'User';
      const parts = user.username.split(/[\s_-]/);
      return parts[0] || 'User';
   };

   const getInitials = () => {
      if (!user?.username) return 'U';
      const parts = user.username.split(/[\s_-]/).filter((part: string) => part.length > 0);
      if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
         return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      if (parts.length > 0 && parts[0].length >= 2) {
         return parts[0].substring(0, 2).toUpperCase();
      }
      return user.username.substring(0, Math.min(2, user.username.length)).toUpperCase() || 'U';
   };

   return (
      <div className="flex items-center justify-between gap-3 mb-6">
         <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-border">
               <AvatarFallback className="bg-gradient-to-br from-[#6d57ff] to-[#8b5cf6] text-white text-lg font-semibold">
                  {getInitials()}
               </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
               <h2 className="text-base font-medium text-foreground">Hello, {getFirstName()}</h2>
               <div className="flex items-center gap-2 flex-wrap">
                  {isVerified ? (
                     <Badge variant="success" className="gap-1">
                        <span className="size-1.5 rounded-full bg-current" />
                        Verified
                     </Badge>
                  ) : (
                     <>
                        <Badge
                           className="gap-1 border-0 shadow-none"
                           style={{ backgroundColor: '#FED7DA', color: '#B60413' }}
                        >
                           <span className="size-1.5 rounded-full bg-current" />
                           Not Verified
                        </Badge>
                        <WorldIDVerification>
                           {({ open }) => (
                              <Button
                                 variant="link"
                                 className="h-auto p-0 text-[#6d57ff] font-medium text-sm"
                                 onClick={open}
                              >
                                 Verify World ID &gt;
                              </Button>
                           )}
                        </WorldIDVerification>
                     </>
                  )}
               </div>
            </div>
         </div>
         <Button variant="outline" size="icon" className="rounded-full relative">
            <span className="size-2.5 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-background" />
            <svg
               className="size-5 text-muted-foreground"
               fill="none"
               stroke="currentColor"
               viewBox="0 0 24 24"
            >
               <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
               />
            </svg>
         </Button>
      </div>
   );
}
