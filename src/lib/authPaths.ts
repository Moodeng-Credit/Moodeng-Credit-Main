export function buildEmailConfirmationPath(email?: string): string {
   const trimmedEmail = email?.trim();
   return `/auth-success?type=verify${trimmedEmail ? `&email=${encodeURIComponent(trimmedEmail)}` : ''}`;
}
