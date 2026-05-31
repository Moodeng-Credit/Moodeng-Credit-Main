export const LOAN_REQUEST_DELETE_LIMIT = 2;
export const LOAN_REQUEST_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LOAN_REQUEST_REPOST_COOLDOWN_MS = 30 * 60 * 1000;

export interface LoanRequestRepostStatus {
   deleteCount24h: number;
   cooldownUntil: string | null;
   canCreate: boolean;
}

export const getLoanRequestRepostStatusFromDeletedAt = (deletedAtValues: string[], now = new Date()): LoanRequestRepostStatus => {
   const recentDeletedAt = deletedAtValues
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()) && now.getTime() - date.getTime() < LOAN_REQUEST_DELETE_WINDOW_MS)
      .sort((a, b) => b.getTime() - a.getTime());

   const latestDeletedAt = recentDeletedAt[0];
   const isCoolingDown =
      recentDeletedAt.length >= LOAN_REQUEST_DELETE_LIMIT &&
      latestDeletedAt &&
      now.getTime() - latestDeletedAt.getTime() < LOAN_REQUEST_REPOST_COOLDOWN_MS;

   return {
      deleteCount24h: recentDeletedAt.length,
      cooldownUntil: isCoolingDown ? new Date(latestDeletedAt.getTime() + LOAN_REQUEST_REPOST_COOLDOWN_MS).toISOString() : null,
      canCreate: !isCoolingDown
   };
};

export const getLoanRequestCooldownMinutes = (cooldownUntil: string | null, now = new Date()) => {
   if (!cooldownUntil) return 0;

   const cooldownTime = new Date(cooldownUntil).getTime();
   if (Number.isNaN(cooldownTime)) return 0;

   return Math.max(Math.ceil((cooldownTime - now.getTime()) / 60000), 0);
};

export const getLoanRequestCooldownMessage = (status: Pick<LoanRequestRepostStatus, 'cooldownUntil'>, now = new Date()) => {
   const minutes = getLoanRequestCooldownMinutes(status.cooldownUntil, now);
   const baseMessage = `You deleted ${LOAN_REQUEST_DELETE_LIMIT} loan requests in the last 24 hours, so new requests are paused`;

   if (minutes <= 1) {
      return `${baseMessage}. You can make another loan request in about 1 minute.`;
   }

   return `${baseMessage}. You can make another loan request in about ${minutes} minutes.`;
};
