import { useEffect, useRef } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import type { RootState } from '@/store/store';

const POST_LOGIN_RETURN_KEY = 'postLoginReturnPath';

/**
 * Only these internal path shapes are honored as post-login return targets. This keeps
 * the default /dashboard behavior intact for normal logins and prevents open-redirects.
 */
const ALLOWED_RETURN_PATTERNS: RegExp[] = [/^\/lend\/loan\/[^/]+\/?(\?.*)?$/, /^\/help\/[^/]+\/?(\?.*)?$/];

const isAllowedReturnPath = (path: string | null): path is string => {
   if (!path || !path.startsWith('/') || path.startsWith('//')) return false;
   return ALLOWED_RETURN_PATTERNS.some((pattern) => pattern.test(path));
};

/**
 * Lowest-risk post-login redirect for direct lender-loan links.
 *
 * When an unauthenticated user opens a lender loan page and is sent through the existing
 * (untouched) login flow, that page first stashes its path in sessionStorage. Once auth
 * completes, this hook redirects there exactly once and clears the key. If no key exists,
 * the app's normal /dashboard behavior is preserved. Mounted once at the app root.
 *
 * Isolated and easy to revert: delete this hook + its single call site + the sessionStorage
 * write in the lender page.
 */
export function usePostLoginReturn(): void {
   const navigate = useNavigate();
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthenticated = Boolean(userId && username);
   const handledRef = useRef(false);

   useEffect(() => {
      if (!isAuthenticated || handledRef.current) return;

      let target: string | null = null;
      try {
         target = window.sessionStorage.getItem(POST_LOGIN_RETURN_KEY);
      } catch {
         target = null;
      }
      if (!isAllowedReturnPath(target)) return;

      handledRef.current = true;
      try {
         window.sessionStorage.removeItem(POST_LOGIN_RETURN_KEY);
      } catch {
         /* ignore */
      }
      navigate(target, { replace: true });
   }, [isAuthenticated, navigate]);
}
