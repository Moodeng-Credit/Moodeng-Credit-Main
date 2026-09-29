// Recognise a borrower whose Facebook reached our Page WITHOUT their code.
//
// Meta doesn't guarantee the m.me ref arrives: it only rides along if a first-time chatter taps
// "Get Started", and it "might not work for some Messenger for Android customers" (Meta's m.me docs).
// Aya (2026-09-29) tapped Verify at 14:22:25 and "Aya Albarracin" opened a chat with the Page at 14:22
// — the code was lost, but the timing and the name say who it is.
//
// So when SendPulse tells us a Facebook contact subscribed or wrote (sendpulse-events), we compare
// their Facebook name with every borrower who tapped "Verify via Messenger" in the last 30 minutes:
//   * exactly one strong match → confirm automatically (through sendpulse-messenger-verify, the same
//     path a code takes);
//   * anything less certain → ask the team on the KYC card ("Is this them?"), never guess.

export const MATCH_WINDOW_MS = 30 * 60 * 1000;
// A chat can land a moment before our code row's timestamp (clock skew, a fast phone).
const EARLY_SKEW_MS = 2 * 60 * 1000;

export type MatchStrength = 'strong' | 'weak' | 'none';

export type OpenAttempt = {
   code: string;
   user_id: string;
   created_at: string;
   // Every name we know for the borrower: display name, KYC full / first + last, email local part, username.
   names: Array<string | null | undefined>;
};

export type AutoMatchDecision = { kind: 'auto'; attempt: OpenAttempt } | { kind: 'suggest'; attempts: OpenAttempt[] } | { kind: 'none' };

// "Aya M. Albarracín" → ['aya', 'albarracin']; letters only, accents folded, 1-letter initials dropped.
export const nameTokens = (raw: string | null | undefined): string[] =>
   (raw ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]+/g, ' ')
      .split(' ')
      .filter((t) => t.length >= 2);

// Usernames look like "<email local part>-<6 hex>" and email local parts carry digits
// ("ayaalbaracin97") — strip both down to the letters a person would recognise as their name.
export const handleLetters = (raw: string | null | undefined): string =>
   (raw ?? '')
      .split('@')[0]
      .replace(/-[0-9a-f]{6}$/i, '')
      .toLowerCase()
      .replace(/[^a-z]+/g, '');

const levenshtein = (a: string, b: string): number => {
   if (a === b) return 0;
   let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
   for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
         cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
   }
   return prev[b.length];
};

// Short names must match exactly; longer ones forgive a slip or two ("Albaracin" vs "Albarracin").
const allowedEdits = (len: number) => (len <= 4 ? 0 : len <= 7 ? 1 : 2);
const similar = (a: string, b: string) => levenshtein(a, b) <= allowedEdits(Math.min(a.length, b.length));

export const nameMatchStrength = (facebookName: string | null | undefined, names: OpenAttempt['names']): MatchStrength => {
   const fb = nameTokens(facebookName);
   if (!fb.length) return 'none';
   const fbJoined = fb.join('');
   let weak = false;

   for (const name of names) {
      if (!name) continue;
      const tokens = nameTokens(name);
      const joined = [tokens.join(''), handleLetters(name)].filter((j) => j.length >= 8);

      // Two or more Facebook name parts each found in this name → strong.
      const hits = fb.filter((f) => f.length >= 3 && tokens.some((t) => similar(f, t))).length;
      if (fb.length >= 2 && hits >= 2) return 'strong';
      if (hits >= 1) weak = true;

      // Run-together handles ("ayaalbaracin97") against the whole Facebook name.
      for (const j of joined) {
         if (fbJoined.length >= 8 && (similar(fbJoined, j) || j.includes(fbJoined) || fbJoined.includes(j))) return 'strong';
         if (fb.some((f) => f.length >= 4 && j.startsWith(f))) weak = true;
      }
   }
   return weak ? 'weak' : 'none';
};

export const decideAutoMatch = (facebookName: string | null | undefined, eventAt: number, attempts: OpenAttempt[]): AutoMatchDecision => {
   const inWindow = attempts.filter((a) => {
      const started = Date.parse(a.created_at);
      return !Number.isNaN(started) && eventAt >= started - EARLY_SKEW_MS && eventAt - started <= MATCH_WINDOW_MS;
   });
   const scored = inWindow.map((attempt) => ({ attempt, strength: nameMatchStrength(facebookName, attempt.names) }));
   const strong = scored.filter((s) => s.strength === 'strong').map((s) => s.attempt);
   if (strong.length === 1) return { kind: 'auto', attempt: strong[0] };
   if (strong.length > 1) return { kind: 'suggest', attempts: strong };
   const weak = scored.filter((s) => s.strength === 'weak').map((s) => s.attempt);
   return weak.length ? { kind: 'suggest', attempts: weak } : { kind: 'none' };
};
