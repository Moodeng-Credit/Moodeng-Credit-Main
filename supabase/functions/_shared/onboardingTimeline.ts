// The onboarding block in the team alerts (new borrower / call booked / Facebook connected): how they
// signed up, which notification channels they have, and each step with the time it took since the
// step before. Data comes from public.onboarding_timeline (our own timestamps, not PostHog).

export type OnboardingTimeline = {
   method: string | null;
   phone: string | null;
   channels: string[] | null;
   steps: { step: string; at: string }[];
};

// deno-lint-ignore no-explicit-any
type Svc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: unknown }> };

export const loadOnboardingTimeline = async (svc: Svc, userId: string): Promise<OnboardingTimeline | null> => {
   try {
      const { data, error } = await svc.rpc('onboarding_timeline', { p_user_id: userId });
      if (error || !data) return null;
      return data as OnboardingTimeline;
   } catch (err) {
      console.error('onboardingTimeline: load failed', err instanceof Error ? err.message : err);
      return null;
   }
};

export const formatGap = (ms: number): string => {
   const s = Math.max(0, Math.round(ms / 1000));
   if (s < 60) return `${s}s`;
   const m = Math.round(s / 60);
   if (m < 60) return `${m} min`;
   const h = Math.floor(m / 60);
   if (h < 48) return `${h}h ${m % 60}m`;
   return `${Math.round(h / 24)} days`;
};

const bkkTime = (iso: string) =>
   new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// "Signed up with: Phone code (+639…)" + "Notifications: Messenger, WhatsApp" — the two facts the team
// kept asking about.
export const signupLines = (t: OnboardingTimeline | null): string[] => {
   if (!t) return [];
   const phone = t.phone ? ` (+${t.phone.replace(/^\+/, '')})` : '';
   return [
      `Signed up with: ${t.method ?? 'unknown'}${phone}`,
      `Notifications on: ${t.channels?.length ? t.channels.join(', ') : 'none yet'}`
   ];
};

export const timelineLines = (t: OnboardingTimeline | null): string[] => {
   if (!t?.steps.length) return [];
   const first = Date.parse(t.steps[0].at);
   const lines = t.steps.map((s, i) =>
      i === 0 ? `• ${s.step} — ${bkkTime(s.at)} Bangkok` : `• ${s.step} — +${formatGap(Date.parse(s.at) - Date.parse(t.steps[i - 1].at))}`
   );
   const total = Date.parse(t.steps[t.steps.length - 1].at) - first;
   return ['Onboarding:', ...lines, t.steps.length > 1 ? `Total so far: ${formatGap(total)}` : null].filter(Boolean) as string[];
};
