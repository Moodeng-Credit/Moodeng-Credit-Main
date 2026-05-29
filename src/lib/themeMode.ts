export const THEME_MODE_STORAGE_KEY = 'moodeng-theme-mode';

export type ThemeMode = 'light' | 'dark';

export function getStoredThemeMode(): ThemeMode {
   if (typeof window === 'undefined') return 'light';

   const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
   return storedMode === 'dark' ? 'dark' : 'light';
}

export function applyThemeMode(mode: ThemeMode) {
   if (typeof document === 'undefined') return;

   const root = document.documentElement;
   root.classList.toggle('dark', mode === 'dark');
   root.dataset.theme = mode;
   root.style.colorScheme = mode;
}

export function persistThemeMode(mode: ThemeMode) {
   if (typeof window === 'undefined') return;

   window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
}
