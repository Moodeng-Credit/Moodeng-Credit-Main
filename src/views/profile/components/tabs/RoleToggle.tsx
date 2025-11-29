import type { RoleType } from '@/views/profile/components/tabs/types';

interface RoleToggleProps {
   activeRole: RoleType;
   onRoleChange: (role: RoleType) => void;
}

const RoleToggle = ({ activeRole, onRoleChange }: RoleToggleProps) => {
   const roles: RoleType[] = ['borrower', 'lender'];

   return (
      <div className="flex rounded-md overflow-hidden text-sm font-extrabold select-none shadow-sm">
         {roles.map((role) => (
            <button
               key={role}
               onClick={() => onRoleChange(role)}
               className={`px-6 py-2 ${role === 'borrower' ? 'rounded-tl-md rounded-bl-md' : 'rounded-tr-md rounded-br-md'} transition ${
                  activeRole === role
                     ? role === 'borrower'
                        ? 'bg-[#2563eb] text-white'
                        : 'bg-[#b9c6f9] text-white'
                     : 'bg-white text-[#2563eb] border border-[#e5e7eb]'
               }`}
               type="button"
            >
               {role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
         ))}
      </div>
   );
};

export default RoleToggle;
