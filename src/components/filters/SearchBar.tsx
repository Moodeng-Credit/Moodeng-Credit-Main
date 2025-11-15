import { type ChangeEvent } from 'react';

interface SearchBarProps {
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   className?: string;
}

export default function SearchBar({ value, onChange, placeholder = 'Search...', className = '' }: SearchBarProps) {
   return (
      <div className={`flex-1 min-w-[180px] max-w-xs ${className}`}>
         <input
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            className="w-full border border-gray-300 rounded-full px-4 py-1 text-xs md:text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
            placeholder={placeholder}
            type="search"
         />
      </div>
   );
}
