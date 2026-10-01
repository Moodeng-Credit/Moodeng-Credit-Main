// Pure helpers for zoom-webhook: Zoom's signature scheme and event classification. Split out so
// they're unit-testable without the network.

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const hmacSha256Hex = async (secret: string, message: string): Promise<string> => {
   const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
};

// Zoom signs "v0:{x-zm-request-timestamp}:{raw body}" with the app's Secret Token and sends
// "v0={hex}" in x-zm-signature. Requests older than 5 minutes are refused (replay).
export const verifyZoomSignature = async (
   secret: string,
   timestamp: string | null,
   rawBody: string,
   signature: string | null,
   nowMs: number
): Promise<boolean> => {
   if (!secret || !timestamp || !signature) return false;
   const ts = Number(timestamp);
   if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false;
   const expected = `v0=${await hmacSha256Hex(secret, `v0:${timestamp}:${rawBody}`)}`;
   if (expected.length !== signature.length) return false;
   let diff = 0;
   for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
   return diff === 0;
};

export type ZoomEvent =
   | { kind: 'validation'; plainToken: string }
   | { kind: 'arrived' | 'joined' | 'left'; meetingId: string; isHost: boolean; at: string; name: string; email: string }
   | { kind: 'ignore' };

// Waiting room / waiting for the host → they're here but not in yet. In the meeting (directly, via
// join-before-host, or admitted from the waiting room) → joined. Leaving → left.
const ARRIVED = new Set(['meeting.participant_joined_waiting_room', 'meeting.participant_jbh_waiting']);
const JOINED = new Set(['meeting.participant_joined', 'meeting.participant_jbh_joined', 'meeting.participant_admitted']);
const LEFT = new Set(['meeting.participant_left']);

type ZoomBody = {
   event?: string;
   event_ts?: number;
   payload?: {
      plainToken?: string;
      object?: {
         id?: string | number;
         host_id?: string;
         participant?: {
            id?: string;
            user_name?: string;
            join_time?: string;
            leave_time?: string;
            date_time?: string;
            email?: string;
         };
      };
   };
};

export const classifyZoomEvent = (body: ZoomBody): ZoomEvent => {
   const event = body?.event ?? '';
   if (event === 'endpoint.url_validation') {
      const plainToken = body.payload?.plainToken;
      return plainToken ? { kind: 'validation', plainToken } : { kind: 'ignore' };
   }
   const kind = ARRIVED.has(event) ? 'arrived' : JOINED.has(event) ? 'joined' : LEFT.has(event) ? 'left' : null;
   const object = body.payload?.object;
   const participant = object?.participant;
   if (!kind || object?.id === undefined || object?.id === null || !participant) return { kind: 'ignore' };
   const at =
      participant.join_time ||
      participant.leave_time ||
      participant.date_time ||
      new Date(typeof body.event_ts === 'number' ? body.event_ts : Date.now()).toISOString();
   return {
      kind,
      meetingId: String(object.id),
      // A signed-in participant's `id` is their Zoom user id — equal to host_id for the host.
      isHost: Boolean(participant.id && object.host_id && participant.id === object.host_id),
      at: Number.isNaN(Date.parse(at)) ? new Date().toISOString() : new Date(Date.parse(at)).toISOString(),
      name: participant.user_name ?? '',
      email: participant.email ?? ''
   };
};

// Who a non-host participant is. Zoom only tells us the host apart, so on the shared team account the
// other teammate and any AI note-taker joining also looked like "the borrower is here" (kryshia,
// 2026-10-01: George, Emma and two note-taker bots joined, she never did — and the false sighting
// also marked her as attended, hiding the no-show).
//   * bot      — a note-taker/recorder; ignored.
//   * team     — a Moodeng teammate; ignored.
//   * borrower — clearly the borrower; counts.
//   * unknown  — can't tell (a phone default like "iPhone", a nickname, or a bare first name the
//                borrower shares with a host). The host gets a "maybe" alert and the automatic
//                no-show is held off, so a human decides; it never sets joined/left times.
// Order matters: a real borrower must never be dropped as a bot (review 2026-10-01: "Harry Potter",
// "Krispin", "Bot Santos" were), and a teammate must never pass as a borrower who shares their first
// name ("George Jimmy").
export type ParticipantKind = 'bot' | 'team' | 'borrower' | 'unknown';

// Unmistakable note-taker names, checked before anything else.
const STRONG_BOT = /(note[\s-]?taker|otter\.ai|fireflies|read\.ai|\bread ai\b|tl;?dv|ai companion|meeting notes|tactiq)/i;
// Product names that are also words in people's names: whole words only, and only once the name has
// failed to match the borrower.
const BRAND_BOT =
   /\b(bot|otter|fathom|gong|chorus|grain|avoma|meetgeek|krisp|sembly|bluedot|supernormal|notta|bubbles|circleback|granola|airgram|noota|leexi|claap|laxis|rewatch|recorder)\b/i;
const TEAM_FIRST_NAMES = ['george', 'emma'];

const words = (value: string | null | undefined) =>
   (value ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3);

export const classifyParticipant = (
   participant: { name: string; email: string },
   borrower: { display_name?: string | null; username?: string | null; email?: string | null }
): ParticipantKind => {
   const name = participant.name.trim();
   const email = participant.email.trim().toLowerCase();
   if (borrower.email && email && email === borrower.email.toLowerCase()) return 'borrower';
   if (STRONG_BOT.test(name)) return 'bot';
   if (email.endsWith('@moodeng.app') || /moodeng/i.test(name)) return 'team';

   const borrowerWords = new Set([
      ...words(borrower.display_name),
      ...words(borrower.username),
      ...words((borrower.email ?? '').split('@')[0])
   ]);
   const nameWords = words(name);

   // Starts with a host's first name: a teammate, unless another word ties it to this borrower.
   if (nameWords[0] && TEAM_FIRST_NAMES.includes(nameWords[0])) {
      const otherWords = nameWords.filter((w) => !TEAM_FIRST_NAMES.includes(w));
      if (otherWords.some((w) => borrowerWords.has(w))) return 'borrower';
      if (borrowerWords.has(nameWords[0]) && otherWords.length === 0) return 'unknown';
      return 'team';
   }
   if (nameWords.some((w) => borrowerWords.has(w))) return 'borrower';
   if (BRAND_BOT.test(name)) return 'bot';
   return 'unknown';
};

// Several bookings can share one meeting id (a host's personal room link) — pick the booking whose
// start is closest to the event, within a sane window around it.
export const pickBooking = <T extends { video_call_starts_at: string | null }>(rows: T[], atMs: number): T | null => {
   let best: T | null = null;
   let bestGap = Infinity;
   for (const row of rows) {
      const start = row.video_call_starts_at ? Date.parse(row.video_call_starts_at) : NaN;
      if (Number.isNaN(start)) continue;
      const gap = Math.abs(start - atMs);
      if (gap <= 3 * 60 * 60 * 1000 && gap < bestGap) {
         best = row;
         bestGap = gap;
      }
   }
   return best;
};
