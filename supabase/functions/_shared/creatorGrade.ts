// AI read of a moodeng.app/creator application (Emma/George 2026-11-27: "use AI to filter").
// Gemini watches the "why Moodeng" clip and reads the form; Apify adds real TikTok reach (followers, views)
// so the score isn't just the creator's own words. Two reads, averaged. Advice only: the team decides.
import { withToday } from './aiToday.ts';
import { geminiTokens, logAiUsage } from './aiUsage.ts';
import type { CreatorApp } from './creatorApplications.ts';
import { GEMINI_MODEL } from './geminiModel.ts';

const API = 'https://generativelanguage.googleapis.com';

export type TikTokReach = {
   handle: string;
   followers: number | null;
   likes: number | null;
   videos: number | null;
   verified: boolean;
   recent_videos: number;
   avg_views: number | null;
   last_post_days: number | null;
};

export type CreatorAi = {
   score: number; // 0–100
   verdict: 'yes' | 'maybe' | 'no';
   summary: string;
   strengths: string[];
   flags: string[];
   video: { watched: boolean; on_camera: boolean | null; said: string | null } | null;
   reach: TikTokReach | null;
   reads: number;
   model: string;
   error?: string;
};

/** "https://www.tiktok.com/@some.one?lang=en" → "some.one"; a bare "@some.one" works too. */
export const tiktokHandle = (url: string | null | undefined): string | null => {
   const m = (url ?? '').trim().match(/(?:^|tiktok\.com\/)@([A-Za-z0-9._]{2,24})/);
   return m ? m[1] : null;
};

export async function tiktokReach(apifyToken: string, handle: string, now = Date.now()): Promise<TikTokReach> {
   const res = await fetch(`https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?timeout=80`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apifyToken}` },
      body: JSON.stringify({ profiles: [handle], resultsPerPage: 8, shouldDownloadVideos: false, shouldDownloadCovers: false }),
      signal: AbortSignal.timeout(85_000)
   });
   if (!res.ok) throw new Error(`apify ${res.status}`);
   // deno-lint-ignore no-explicit-any
   const items = (await res.json()) as any[];
   if (!Array.isArray(items) || !items.length || items[0]?.error) throw new Error(items?.[0]?.error ?? 'apify: no profile');
   const author = items[0]?.authorMeta ?? {};
   const views = items.map((v) => Number(v.playCount)).filter((n) => Number.isFinite(n));
   const newest = Math.max(...items.map((v) => Date.parse(v.createTimeISO)).filter((n) => Number.isFinite(n)));
   return {
      handle,
      followers: Number.isFinite(Number(author.fans)) ? Number(author.fans) : null,
      likes: Number.isFinite(Number(author.heart)) ? Number(author.heart) : null,
      videos: Number.isFinite(Number(author.video)) ? Number(author.video) : null,
      verified: author.verified === true,
      recent_videos: items.length,
      avg_views: views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : null,
      last_post_days: Number.isFinite(newest) ? Math.max(0, Math.round((now - newest) / 86_400_000)) : null
   };
}

/** Gemini Files API (clips are too big to send inline): upload, wait until it's processed, return its uri. */
async function uploadVideo(key: string, bytes: Uint8Array, mime: string): Promise<string> {
   const start = await fetch(`${API}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
         'x-goog-api-key': key,
         'X-Goog-Upload-Protocol': 'resumable',
         'X-Goog-Upload-Command': 'start',
         'X-Goog-Upload-Header-Content-Length': String(bytes.length),
         'X-Goog-Upload-Header-Content-Type': mime,
         'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: { display_name: 'creator-why' } })
   });
   const uploadUrl = start.headers.get('x-goog-upload-url');
   if (!start.ok || !uploadUrl) throw new Error(`gemini upload start ${start.status}`);
   const done = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Length': String(bytes.length) },
      body: bytes
   });
   if (!done.ok) throw new Error(`gemini upload ${done.status}`);
   let file = ((await done.json()) as { file?: { name?: string; uri?: string; state?: string } }).file ?? {};
   for (let i = 0; i < 20 && file.state === 'PROCESSING' && file.name; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`${API}/v1beta/${file.name}`, { headers: { 'x-goog-api-key': key } });
      if (res.ok) file = (await res.json()) as typeof file;
   }
   if (file.state !== 'ACTIVE' || !file.uri) throw new Error(`gemini video not ready (${file.state ?? 'unknown'})`);
   return file.uri;
}

/** Gemini's names for phone formats (iPhone .mov comes in as video/quicktime). */
export const geminiVideoMime = (mime: string | null | undefined) => {
   const m = (mime ?? '').toLowerCase();
   if (m === 'video/quicktime') return 'video/mov';
   if (m === 'video/x-m4v') return 'video/mp4';
   return m.startsWith('video/') ? m : 'video/mp4';
};

export const CREATOR_SYSTEM = `You screen applicants for Moodeng Credit's creator partner program.
Moodeng is a small, honest microloan app (moodeng.app) for Filipino (and some Indonesian) gig and low-income workers:
small USDC loans (~$20–60) that build a credit level when repaid on time. Partners post about Moodeng and earn a small
fee (about $5) for each friend we fund. We want partners whose followers are real people who could use and REPAY a small
loan, and who will explain it honestly.

Good partner: real, active audience (ideally Philippines), posts regularly, people actually watch (views vs followers),
content about money/work/family/daily life/side hustles fits well; speaks clearly and warmly on camera; a real, specific
reason to work with us; would be careful and honest about loans.
Red flags: fake or bought followers (many followers but tiny views), no channels or dead channels, gambling/"easy money"/
crypto-pump content, promises like "free money" or "guaranteed approval", currently promoting another lending app,
copy-pasted or ChatGPT-sounding pitch with nothing personal, video with nobody on camera, wrong person, rude or careless.
Small creators are fine (even 1–5k followers) if the audience is real and engaged. Don't punish poor English.

You get the form as JSON, TikTok numbers if we could read them (null = unknown, not zero), and maybe a video.
Reply ONLY with JSON:
{"score": 0-100, "verdict": "yes"|"maybe"|"no", "summary": "one plain sentence for the team",
 "strengths": ["short", ...], "flags": ["short", ...],
 "video": {"watched": true|false, "on_camera": true|false|null, "said": "1-2 sentence gist of what they said, or null"}}
verdict yes ≥ 70, maybe 45–69, no < 45. Keep each strength/flag under 12 words. Max 4 of each.`;

type RawRead = { score?: unknown; verdict?: unknown; summary?: unknown; strengths?: unknown; flags?: unknown; video?: unknown };

const strList = (v: unknown) =>
   (Array.isArray(v) ? v : [])
      .map((x) => (typeof x === 'string' ? x.trim().slice(0, 120) : ''))
      .filter(Boolean)
      .slice(0, 4);

export const verdictFor = (score: number): CreatorAi['verdict'] => (score >= 70 ? 'yes' : score >= 45 ? 'maybe' : 'no');

/** Average the reads; text from the first good read, flags merged. */
export function combineCreatorReads(reads: RawRead[], reach: TikTokReach | null, hadVideo: boolean): CreatorAi {
   const scores = reads.map((r) => Number(r.score)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
   const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
   const first = reads.find((r) => typeof r.summary === 'string') ?? reads[0] ?? {};
   const flags = Array.from(new Set(reads.flatMap((r) => strList(r.flags)))).slice(0, 5);
   const rawVideo = (first.video && typeof first.video === 'object' ? first.video : {}) as Record<string, unknown>;
   return {
      score,
      verdict: verdictFor(score),
      summary: typeof first.summary === 'string' ? first.summary.trim().slice(0, 300) : '',
      strengths: strList(first.strengths),
      flags,
      video: hadVideo
         ? {
              watched: rawVideo.watched !== false,
              on_camera: typeof rawVideo.on_camera === 'boolean' ? rawVideo.on_camera : null,
              said: typeof rawVideo.said === 'string' ? rawVideo.said.trim().slice(0, 400) : null
           }
         : null,
      reach,
      reads: scores.length,
      model: GEMINI_MODEL
   };
}

export const creatorFormForAi = (app: CreatorApp, reach: TikTokReach | null, hasVideo: boolean) => ({
   name: app.full_name,
   address: app.address,
   channels: {
      facebook: app.facebook_url,
      tiktok: app.tiktok_url,
      youtube: app.youtube_url,
      instagram: app.instagram_url
   },
   tiktok_numbers: reach,
   worked_with_fintech_before: app.prior_fintech,
   fintech_details: app.prior_fintech_details,
   possible_conflict_with_another_money_app: app.conflict,
   conflict_details: app.conflict_details,
   why_pick_me: app.pitch,
   video: hasVideo ? 'attached below' : 'none sent'
});

async function readOnce(key: string, parts: unknown[]): Promise<RawRead> {
   const res = await fetch(`${API}/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(75_000),
      body: JSON.stringify({
         systemInstruction: { parts: [{ text: withToday(CREATOR_SYSTEM) }] },
         contents: [{ role: 'user', parts }],
         generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingLevel: 'low' }
         }
      })
   });
   if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
   const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
   logAiUsage('creator_grade', GEMINI_MODEL, geminiTokens(json));
   const text = (json.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
   return JSON.parse(text || '{}') as RawRead;
}

/** Full grade. Reach / video problems don't stop it (the AI just gets less); no Gemini read at all throws. */
export async function gradeCreator(input: {
   app: CreatorApp;
   geminiKey: string;
   apifyToken: string | null;
   video: { bytes: Uint8Array; mime: string } | null;
}): Promise<CreatorAi> {
   const notes: string[] = [];
   const handle = tiktokHandle(input.app.tiktok_url);
   const [reachResult, videoResult] = await Promise.allSettled([
      handle && input.apifyToken ? tiktokReach(input.apifyToken, handle) : Promise.resolve(null),
      input.video ? uploadVideo(input.geminiKey, input.video.bytes, geminiVideoMime(input.video.mime)) : Promise.resolve(null)
   ]);
   const reach = reachResult.status === 'fulfilled' ? reachResult.value : null;
   if (reachResult.status === 'rejected')
      notes.push(`TikTok numbers: ${String(reachResult.reason?.message ?? reachResult.reason).slice(0, 80)}`);
   const videoUri = videoResult.status === 'fulfilled' ? videoResult.value : null;
   if (videoResult.status === 'rejected') notes.push(`video: ${String(videoResult.reason?.message ?? videoResult.reason).slice(0, 80)}`);

   const parts: unknown[] = [{ text: JSON.stringify(creatorFormForAi(input.app, reach, Boolean(videoUri))) }];
   if (videoUri && input.video) {
      parts.push({ text: 'Their "why Moodeng" video:' });
      parts.push({ fileData: { mimeType: geminiVideoMime(input.video.mime), fileUri: videoUri } });
   }
   const settled = await Promise.allSettled([readOnce(input.geminiKey, parts), readOnce(input.geminiKey, parts)]);
   const reads = settled.filter((r): r is PromiseFulfilledResult<RawRead> => r.status === 'fulfilled').map((r) => r.value);
   if (!reads.length) {
      const why = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
      throw why instanceof Error ? why : new Error('gemini: no read came back');
   }
   const ai = combineCreatorReads(reads, reach, Boolean(videoUri));
   if (notes.length) ai.error = notes.join(' · ');
   return ai;
}

const n = (v: number | null) =>
   v === null ? '?' : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

/** One line for cards: "TikTok @x: 12.3k followers · ~4.1k views/video · last post 2d ago". */
export const reachLine = (r: TikTokReach | null) =>
   r
      ? `TikTok @${r.handle}: ${n(r.followers)} followers · ~${n(r.avg_views)} views/video${r.last_post_days !== null ? ` · last post ${r.last_post_days}d ago` : ''}${r.verified ? ' · ✔️ verified' : ''}`
      : null;

export const verdictEmoji = (v: CreatorAi['verdict']) => (v === 'yes' ? '🟢' : v === 'maybe' ? '🟡' : '🔴');
