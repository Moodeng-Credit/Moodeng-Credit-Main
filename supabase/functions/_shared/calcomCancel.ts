// Cancel a Cal.com booking with the host's own key (the same keys calcom-round-robin books with).
export const cancelCalBooking = async (host: string | null, uid: string, reason: string): Promise<boolean> => {
   const apiKey = host ? Deno.env.get(`CALCOM_API_KEY_${host.toUpperCase()}`) : '';
   if (!apiKey) return false;
   try {
      const res = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}/cancel`, {
         method: 'POST',
         headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' },
         body: JSON.stringify({ cancellationReason: reason })
      });
      return res.ok;
   } catch (err) {
      console.error('calcomCancel: cal cancel failed', err instanceof Error ? err.message : err);
      return false;
   }
};
