// Pure helpers for the free round-robin booking service, split out so they're unit-testable
// without the network/edge-runtime. The edge function reads each host's open slots from the
// Cal.com API and uses these to present ONE combined, anonymous "Moodeng team" time list and to
// decide which host to book — no paid Teams round-robin, no host shown to the borrower.

// Union of every host's available start times: unique, sorted ascending. Slots are ISO strings
// with an offset (e.g. 2026-09-22T19:00:00.000+07:00); we de-dupe by the actual instant so two
// hosts free at the same moment collapse to one entry regardless of string formatting.
export const mergeSlots = (perHost: string[][]): string[] => {
   const byInstant = new Map<number, string>();
   for (const slots of perHost) {
      for (const s of slots) {
         const t = Date.parse(s);
         if (!Number.isNaN(t) && !byInstant.has(t)) byInstant.set(t, s);
      }
   }
   return [...byInstant.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
};

// Which hosts have `start` open, compared by instant (not string) so a re-fetch's formatting can't
// cause a false miss.
export const hostsFreeAt = (start: string, perHost: Record<string, string[]>): string[] => {
   const t = Date.parse(start);
   return Object.entries(perHost)
      .filter(([, slots]) => slots.some((s) => Date.parse(s) === t))
      .map(([id]) => id);
};

// Deterministic pick from the free hosts, seeded by borrower + slot so the spread is even across
// borrowers but stable for a given borrower/slot (no flip-flop on retry). Returns the hosts in the
// order to try — preferred first, then the rest as fallbacks if the first booking races and loses.
export const orderHostsToTry = (freeHosts: string[], seed: string): string[] => {
   if (freeHosts.length <= 1) return [...freeHosts];
   let hash = 0;
   for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
   const start = hash % freeHosts.length;
   return freeHosts.map((_, i) => freeHosts[(start + i) % freeHosts.length]);
};
