import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
   const { theme, toggle } = useTheme();

   return (
      <button
         onClick={toggle}
         aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
         className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE] dark:bg-[#1E1530] dark:text-[#C084FC] dark:shadow-[0_8px_24px_rgba(0,0,0,0.3)] dark:hover:bg-[#2A1D40]"
      >
         {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
   );
}
