// Public TikTok numbers through Apify's clockworks/tiktok-profile-scraper (token: DB vault APIFY_TOKEN).
// Since about Nov 2026 the run on our free plan "succeeds" but puts no video rows in its dataset
// (so run-sync-get-dataset-items returns []). The profile itself (followers, likes, video count) is still
// saved in the run's key-value store under AUTHOR_PROFILE_CACHE. So: start the run, wait, read the video
// rows if there are any, and always read the profile record. Used by the creator AI read and the weekly
// social recap.

const APIFY = 'https://api.apify.com/v2';

export type TikTokProfile = {
   handle: string;
   nickname: string | null;
   followers: number | null;
   likes: number | null;
   videos: number | null;
   verified: boolean;
   private: boolean;
};

export type TikTokVideo = {
   created: number;
   text: string;
   views: number;
   likes: number;
   comments: number;
   shares: number;
   saves: number;
   link: string;
};

export type TikTokScrape = { profile: TikTokProfile | null; videos: TikTokVideo[] };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null);

/** AUTHOR_PROFILE_CACHE is { "<handle>": { fans, heart, video, verified, privateAccount, nickName, … } }. */
export function profileFromCache(cache: unknown, handle: string): TikTokProfile | null {
   if (!cache || typeof cache !== 'object') return null;
   const entries = Object.entries(cache as Record<string, unknown>);
   const hit = entries.find(([k]) => k.toLowerCase() === handle.toLowerCase()) ?? (entries.length === 1 ? entries[0] : undefined);
   const p = hit?.[1] as Record<string, unknown> | undefined;
   if (!p || typeof p !== 'object') return null;
   return {
      handle: typeof p.name === 'string' && p.name ? p.name : handle,
      nickname: typeof p.nickName === 'string' ? p.nickName : null,
      followers: num(p.fans),
      likes: num(p.heart),
      videos: num(p.video),
      verified: p.verified === true,
      private: p.privateAccount === true
   };
}

// deno-lint-ignore no-explicit-any
export function videoFromItem(v: any): TikTokVideo {
   return {
      created: Date.parse(v?.createTimeISO),
      text: String(v?.text ?? '')
         .replace(/\s+/g, ' ')
         .trim(),
      views: Number(v?.playCount ?? 0) || 0,
      likes: Number(v?.diggCount ?? 0) || 0,
      comments: Number(v?.commentCount ?? 0) || 0,
      shares: Number(v?.shareCount ?? 0) || 0,
      saves: Number(v?.collectCount ?? 0) || 0,
      link: String(v?.webVideoUrl ?? '')
   };
}

const get = async (url: string, token: string, timeoutMs = 20_000) => {
   const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) });
   if (!res.ok) throw new Error(`apify ${res.status}`);
   return res.json();
};

/** Runs the scraper for one handle and returns the profile (+ video rows when Apify gives them). */
export async function scrapeTikTok(
   token: string,
   handle: string,
   opts: { videos?: number; waitSeconds?: number } = {}
): Promise<TikTokScrape> {
   const wait = Math.min(opts.waitSeconds ?? 60, 60);
   const startRes = await fetch(`${APIFY}/acts/clockworks~tiktok-profile-scraper/runs?waitForFinish=${wait}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
         profiles: [handle],
         resultsPerPage: opts.videos ?? 8,
         shouldDownloadVideos: false,
         shouldDownloadCovers: false
      }),
      signal: AbortSignal.timeout((wait + 10) * 1000)
   });
   if (!startRes.ok) throw new Error(`apify ${startRes.status}`);
   let run = (
      (await startRes.json()) as { data?: { id?: string; status?: string; defaultDatasetId?: string; defaultKeyValueStoreId?: string } }
   ).data;
   if (!run?.id) throw new Error('apify: no run');
   if (run.status === 'RUNNING' || run.status === 'READY') {
      run = ((await get(`${APIFY}/actor-runs/${run.id}?waitForFinish=30`, token, 40_000)) as { data?: typeof run }).data ?? run;
   }
   if (run.status !== 'SUCCEEDED') throw new Error(`apify run ${run.status ?? 'unknown'}`);

   const [items, cache] = await Promise.all([
      run.defaultDatasetId ? get(`${APIFY}/datasets/${run.defaultDatasetId}/items?clean=true`, token).catch(() => []) : Promise.resolve([]),
      run.defaultKeyValueStoreId
         ? get(`${APIFY}/key-value-stores/${run.defaultKeyValueStoreId}/records/AUTHOR_PROFILE_CACHE`, token).catch(() => null)
         : Promise.resolve(null)
   ]);
   // deno-lint-ignore no-explicit-any
   const rows = (Array.isArray(items) ? items : []).filter((v: any) => v && !v.error);
   const videos = rows.map(videoFromItem);
   let profile = profileFromCache(cache, handle);
   // Older runs put the author on every video row instead.
   const author = rows[0]?.authorMeta;
   if (!profile && author) {
      profile = {
         handle: author.name ?? handle,
         nickname: author.nickName ?? null,
         followers: num(author.fans),
         likes: num(author.heart),
         videos: num(author.video),
         verified: author.verified === true,
         private: author.privateAccount === true
      };
   }
   if (!profile && !videos.length) throw new Error('apify: profile not found (wrong handle or private?)');
   return { profile, videos };
}
