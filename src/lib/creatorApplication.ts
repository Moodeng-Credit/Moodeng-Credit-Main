// moodeng.app/creator — creators apply to be Moodeng affiliates (migration 20261128070000_creator_applications).
// Form → emailed 6-digit code → application number. Admin → Affiliates approves (one-time /partner link by
// email) or rejects. Status check needs the number + the email.
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface CreatorApplicationForm {
   full_name: string;
   address: string;
   phone: string;
   email: string;
   facebook_url: string;
   tiktok_url: string;
   youtube_url: string;
   instagram_url: string;
   prior_fintech: boolean;
   prior_fintech_details: string;
   conflict: boolean;
   conflict_details: string;
   pitch: string;
   consent: boolean;
}

export const EMPTY_CREATOR_FORM: CreatorApplicationForm = {
   full_name: '',
   address: '',
   phone: '',
   email: '',
   facebook_url: '',
   tiktok_url: '',
   youtube_url: '',
   instagram_url: '',
   prior_fintech: false,
   prior_fintech_details: '',
   conflict: false,
   conflict_details: '',
   pitch: '',
   consent: false
};

export type CreatorFormErrors = Partial<Record<'full_name' | 'address' | 'phone' | 'email' | 'socials' | 'consent', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreatorForm(f: CreatorApplicationForm): CreatorFormErrors {
   const e: CreatorFormErrors = {};
   if (f.full_name.trim().length < 2) e.full_name = 'Type your full name.';
   if (f.address.trim().length < 5) e.address = 'Type your full address.';
   if (f.phone.replace(/\D/g, '').length < 7) e.phone = 'Type a phone number we can call.';
   if (!EMAIL_RE.test(f.email.trim())) e.email = 'Type a real email. We send your code there.';
   if (![f.facebook_url, f.tiktok_url, f.youtube_url, f.instagram_url].some((s) => s.trim()))
      e.socials = 'Add at least one page or channel so we can see your content.';
   if (!f.consent) e.consent = 'Tick this box to apply.';
   return e;
}

export function creatorErrorMessage(message: string | undefined): string {
   if (message?.includes('creator_already_applied'))
      return 'This email already has an application. Check your inbox for your number, then tap Check status.';
   if (message?.includes('creator_too_many')) return 'Too many tries. Please wait an hour and try again.';
   if (message?.includes('creator_wait')) return 'Wait a minute before asking for a new code.';
   if (message?.includes('creator_code_expired')) return 'That code is too old. Tap “Send a new code”.';
   if (message?.includes('creator_bad_email')) return 'Type a real email. We send your code there.';
   if (message?.includes('creator_video_missing')) return 'Your video didn’t send. You can still apply without it.';
   if (message?.includes('creator_not_found')) return 'We can’t find this application. Please fill in the form again.';
   return 'Something went wrong. Please try again.';
}

export async function startCreatorApplication(f: CreatorApplicationForm): Promise<string> {
   const { data, error } = await getSupabaseBrowserClient().rpc('creator_apply_start', { p: { ...f, email: f.email.trim() } });
   if (error) throw error;
   return data as string;
}

// ── Why-video (optional, Emma 2026-11-27) ──────────────────────────────────────────────────────────────
export const CREATOR_VIDEO_MAX_BYTES = 45 * 1024 * 1024; // = the creator-videos bucket limit
export const CREATOR_VIDEO_MAX_SECONDS = 90;

const VIDEO_EXT: Record<string, string> = {
   'video/mp4': 'mp4',
   'video/quicktime': 'mov',
   'video/webm': 'webm',
   'video/3gpp': '3gp',
   'video/x-m4v': 'm4v',
   'video/mpeg': 'mpeg'
};

/** Problem with a picked clip, or null. Duration null = the browser couldn't tell (allowed). */
export function creatorVideoProblem(file: { type: string; size: number }, seconds: number | null): string | null {
   if (file.type && !VIDEO_EXT[file.type]) return 'Pick a video file (MP4 or MOV).';
   if (file.size > CREATOR_VIDEO_MAX_BYTES) return 'This video is too big. Record a shorter one (under 1 minute).';
   if (seconds !== null && seconds > CREATOR_VIDEO_MAX_SECONDS) return 'Keep it under 1 minute, please.';
   return null;
}

/** Length in seconds, or null if the browser can't read it. */
export function readVideoSeconds(file: File): Promise<number | null> {
   return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      const done = (s: number | null) => {
         URL.revokeObjectURL(url);
         resolve(s);
      };
      const timer = window.setTimeout(() => done(null), 8000);
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
         window.clearTimeout(timer);
         done(Number.isFinite(v.duration) ? v.duration : null);
      };
      v.onerror = () => {
         window.clearTimeout(timer);
         done(null);
      };
      v.src = url;
   });
}

/** Uploads into creator-videos/<id>/ and attaches it. One retry. */
export async function uploadCreatorVideo(id: string, file: File): Promise<void> {
   const type = VIDEO_EXT[file.type] ? file.type : 'video/mp4';
   const path = `${id}/why-${crypto.randomUUID()}.${VIDEO_EXT[type]}`;
   const storage = getSupabaseBrowserClient().storage.from('creator-videos');
   let { error } = await storage.upload(path, file, { contentType: type, upsert: false });
   if (error) ({ error } = await storage.upload(path, file, { contentType: type, upsert: false }));
   if (error) throw error;
   const { error: attachError } = await getSupabaseBrowserClient().rpc('creator_apply_attach_video', { p_id: id, p_path: path });
   if (attachError) throw attachError;
}

export async function resendCreatorCode(id: string): Promise<void> {
   const { error } = await getSupabaseBrowserClient().rpc('creator_apply_resend', { p_id: id });
   if (error) throw error;
}

/** The application number, or null when the code is wrong. */
export async function verifyCreatorCode(id: string, code: string): Promise<string | null> {
   const { data, error } = await getSupabaseBrowserClient().rpc('creator_apply_verify', { p_id: id, p_code: code.trim() });
   if (error) throw error;
   return (data as string | null) ?? null;
}

export interface CreatorStatus {
   appNumber: string;
   status: 'pending' | 'approved' | 'rejected';
   firstName: string;
   submittedAt: string | null;
   partnerLink: string | null;
   code: string | null;
}

export async function fetchCreatorStatus(appNumber: string, email: string): Promise<CreatorStatus | null> {
   const { data, error } = await getSupabaseBrowserClient().rpc('creator_application_status', {
      p_number: appNumber.trim().toUpperCase(),
      p_email: email.trim()
   });
   if (error) throw error;
   if (!data) return null;
   const r = data as Record<string, unknown>;
   return {
      appNumber: String(r.app_number ?? ''),
      status: (r.status as CreatorStatus['status']) ?? 'pending',
      firstName: String(r.first_name ?? ''),
      submittedAt: typeof r.submitted_at === 'string' ? r.submitted_at : null,
      partnerLink: typeof r.partner_link === 'string' ? r.partner_link : null,
      code: typeof r.code === 'string' ? r.code : null
   };
}

// ── Admin ──────────────────────────────────────────────────────────────────────────────────────────────
export interface AdminCreatorApplication {
   id: string;
   app_number: string;
   full_name: string;
   address: string;
   phone: string;
   email: string;
   facebook_url: string | null;
   tiktok_url: string | null;
   youtube_url: string | null;
   instagram_url: string | null;
   prior_fintech: boolean;
   prior_fintech_details: string | null;
   conflict: boolean;
   conflict_details: string | null;
   pitch: string | null;
   status: 'pending' | 'approved' | 'rejected';
   referral_code: string | null;
   invite_token: string | null;
   verified_at: string | null;
   decided_at: string | null;
   video_path: string | null;
   ai_score: number | null;
   ai_verdict: 'yes' | 'maybe' | 'no' | null;
   graded_at: string | null;
   ai: CreatorAi | { error: string } | null;
}

export interface CreatorAi {
   score: number;
   verdict: 'yes' | 'maybe' | 'no';
   summary: string;
   strengths: string[];
   flags: string[];
   video: { watched: boolean; on_camera: boolean | null; said: string | null } | null;
   reach: {
      handle: string;
      followers: number | null;
      avg_views: number | null;
      last_post_days: number | null;
      verified: boolean;
   } | null;
   error?: string;
}

export async function regradeCreatorApplication(id: string): Promise<void> {
   const { error } = await getSupabaseBrowserClient().rpc('admin_regrade_creator_application', { p_id: id });
   if (error) throw error;
}

/** Admin playback link for the why-video (10 minutes). */
export async function creatorVideoUrl(path: string): Promise<string | null> {
   const { data } = await getSupabaseBrowserClient().storage.from('creator-videos').createSignedUrl(path, 600);
   return data?.signedUrl ?? null;
}

export async function fetchAdminCreatorApplications(): Promise<AdminCreatorApplication[]> {
   const { data, error } = await getSupabaseBrowserClient().rpc('admin_creator_applications');
   if (error) throw error;
   return (data as AdminCreatorApplication[] | null) ?? [];
}

export async function decideCreatorApplication(
   id: string,
   decision: 'approved' | 'rejected',
   code?: string
): Promise<{ partner_link: string | null }> {
   const { data, error } = await getSupabaseBrowserClient().rpc('admin_decide_creator_application', {
      p_id: id,
      p_decision: decision,
      p_code: code ?? null
   });
   if (error) throw error;
   return (data as { partner_link: string | null }) ?? { partner_link: null };
}

/** A starting code from their name: "Maya Santos" → MAYA, padded/trimmed to fit 3–20 letters. */
export function suggestCreatorCode(fullName: string): string {
   const first = fullName.trim().split(/\s+/)[0] ?? '';
   const clean = first.toUpperCase().replace(/[^A-Z0-9]/g, '');
   return clean.length >= 3 ? clean.slice(0, 20) : `${clean}MOO`.slice(0, 20);
}

/** Only http(s) links are clickable in admin (applicants type these). Bare "tiktok.com/@x" gets https://. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
   const v = (raw ?? '').trim();
   if (!v) return null;
   try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
   } catch {
      return null;
   }
}
