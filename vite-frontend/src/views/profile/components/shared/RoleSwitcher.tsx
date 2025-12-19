import { UserRole } from '@/views/profile/types';

interface RoleSwitcherProps {
   currentRole: UserRole;
   onRoleChange: (role: UserRole) => void;
}

export default function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
   const isLender = currentRole === UserRole.LENDER;

   return (
      <div className="flex justify-end space-x-2 mb-6">
         <button
            onClick={() => onRoleChange(UserRole.BORROWER)}
            className={`${!isLender ? 'bg-white text-[#2a56f4]' : 'bg-[#a7b9f9] text-white'} font-semibold rounded-md px-3 md:px-6 py-2 text-xs md:text-sm`}
            type="button"
         >
            Borrower
         </button>
         <button
            onClick={() => onRoleChange(UserRole.LENDER)}
            className={`${isLender ? 'bg-white text-[#2a56f4]' : 'bg-[#a7b9f9] text-white'} font-semibold rounded-md px-3 md:px-6 py-2 text-xs md:text-sm`}
            type="button"
         >
            Lender
         </button>
      </div>
   );
}
