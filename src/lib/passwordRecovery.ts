export const PASSWORD_RECOVERY_SESSION_KEY = 'moodeng_password_recovery_ready';

const READY_VALUE = '1';

const getStorage = (): Storage | null => {
   if (typeof window === 'undefined') return null;
   return window.sessionStorage;
};

export const markPasswordRecoveryReady = () => {
   getStorage()?.setItem(PASSWORD_RECOVERY_SESSION_KEY, READY_VALUE);
};

export const clearPasswordRecoveryReady = () => {
   getStorage()?.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
};

export const isPasswordRecoveryReady = () => {
   return getStorage()?.getItem(PASSWORD_RECOVERY_SESSION_KEY) === READY_VALUE;
};
