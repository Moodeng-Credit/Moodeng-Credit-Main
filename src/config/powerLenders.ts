// Hand-picked "power lenders" get a gold ring around their avatar everywhere it
// appears, marking them as high-trust funders. Keyed by user id (public.users.id).
export const POWER_LENDER_IDS = new Set<string>([
   '6b1055bc-7b5d-452a-8184-54b3377e8865', // Jeramie Saito
]);

export function isPowerLender(userId?: string | null): boolean {
   return userId != null && POWER_LENDER_IDS.has(userId);
}
