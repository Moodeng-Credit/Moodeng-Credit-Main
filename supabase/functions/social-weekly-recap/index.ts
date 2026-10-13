// Weekly social recap for the team: how the Facebook Page and its posts (our posters) did last week,
// and how many people came to moodeng.app from Facebook / TikTok and signed up. Posted Monday morning
// to the Telegram team group (Alerts Moodeng HQ, telegram_bot_settings.team_group_chat_id) and Discord
// #social-media (DISCORD_SOCIAL_WEBHOOK_URL), ending with a short to-do for Emma (tag links, CTA, poster QRs).
//
// Facebook: FACEBOOK_PAGE_TOKEN (a Page token for FACEBOOK_PAGE_ID that doesn't expire, made from
// George's login on the Moodeng Messaging app, 2026-10-14) — read-only use. Metrics Meta still returns
// for a Page token: Page views / engagements / Page visits / new follows (period=week), and per post
// views, unique viewers, clicks, reactions. Comments, shares and live stats need extra app review.
// TikTok (@moodeng.credit): Apify's clockworks/tiktok-profile-scraper (~$0.003 per video, free plan);
// the token is in the DB vault (APIFY_TOKEN) and the cron passes it in the body as apifyToken.
// Site visits: PostHog page views referred from Facebook / TikTok (POSTHOG_PERSONAL_API_KEY).
//
// pg_cron social-weekly-recap: Mondays 09:00 Manila (01:00 UTC), retried hourly to noon; posts once a
// week (telegram_bot_settings.social_recap_week). Body: {} · { dryRun: true } (returns the text) ·
// { force: true } (posts again this week). Internal callers only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { isInternalRequest } from '../_shared/internalAuth.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const DAY_MS = 86_400_000;
const WEEK_KEY = 'social_recap_week';
const POSTHOG_HOST = (Deno.env.get('POSTHOG_HOST') ?? 'https://us.posthog.com').replace(/\/$/, '');
const POSTHOG_PROJECT_ID = Deno.env.get('POSTHOG_PROJECT_ID') ?? '492261';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const manilaDate = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString('en-US');
const change = (now: number, before: number) => {
   if (!before) return now ? ' (new)' : '';
   const pct = Math.round(((now - before) / before) * 100);
   return ` (${pct >= 0 ? '+' : ''}${pct}% vs last week)`;
};

const graph = async (path: string, token: string) => {
   const res = await fetch(`${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(20_000) });
   const body = await res.json().catch(() => ({}));
   if (!res.ok || body?.error) throw new Error(body?.error?.message ?? `Graph ${res.status}`);
   return body;
};

type PostStat = { created: string; text: string; link: string | null; kind: string; views: number; reach: number; clicks: number; reactions: number };

const facebookWeek = async (pageId: string, token: string, endMs: number) => {
   const since = Math.floor((endMs - 15 * DAY_MS) / 1000);
   const until = Math.floor(endMs / 1000);
   const page = await graph(
      `${pageId}/insights?metric=page_media_view,page_post_engagements,page_views_total,page_daily_follows_unique&period=week&since=${since}&until=${until}`,
      token
   );
   // period=week values are rolling 7-day totals ending each day: take the last one, and the one a week earlier.
   const weekly: Record<string, { now: number; before: number }> = {};
   for (const metric of page.data ?? []) {
      const values = (metric.values ?? []) as Array<{ value: number }>;
      weekly[metric.name] = { now: Number(values.at(-1)?.value ?? 0), before: Number(values.at(-8)?.value ?? 0) };
   }
   const follows = await graph(`${pageId}?fields=followers_count,fan_count`, token).catch(() => ({}));

   const posts = await graph(
      `${pageId}/posts?fields=id,created_time,message,permalink_url,status_type&since=${Math.floor((endMs - 7 * DAY_MS) / 1000)}&until=${until}&limit=50`,
      token
   );
   const stats: PostStat[] = [];
   for (const p of posts.data ?? []) {
      const ins = await graph(`${p.id}/insights?metric=post_media_view,post_total_media_view_unique,post_clicks,post_reactions_by_type_total`, token).catch(() => ({ data: [] }));
      const val = (name: string) => (ins.data ?? []).find((m: { name: string }) => m.name === name)?.values?.[0]?.value;
      const reactions = val('post_reactions_by_type_total');
      stats.push({
         created: String(p.created_time ?? '').slice(0, 10),
         text: String(p.message ?? '').replace(/\s+/g, ' ').trim(),
         link: p.permalink_url ?? null,
         kind: String(p.status_type ?? '').includes('video') ? 'video' : 'photo',
         views: Number(val('post_media_view') ?? 0),
         reach: Number(val('post_total_media_view_unique') ?? 0),
         clicks: Number(val('post_clicks') ?? 0),
         reactions: reactions && typeof reactions === 'object' ? Object.values(reactions as Record<string, number>).reduce((t, v) => t + Number(v), 0) : 0
      });
   }
   return { weekly, followers: Number((follows as { followers_count?: number }).followers_count ?? 0), posts: stats };
};

// moodeng.app visitors arriving from Facebook / TikTok last week, and how many of them have an account.
const siteVisits = async (apiKey: string) => {
   const query = {
      kind: 'HogQLQuery',
      query: `select multiIf(properties.$referring_domain ilike '%facebook%' or properties.$referring_domain ilike '%fb.%' or properties.$referring_domain ilike '%messenger%', 'facebook', properties.$referring_domain ilike '%tiktok%', 'tiktok', 'other') as src, uniq(person_id) as visitors, uniqIf(person_id, person.properties.email is not null) as with_account from events where event = '$pageview' and timestamp > now() - interval 7 day and properties.$referring_domain not in ('moodeng.app', '$direct', '') group by src`
   };
   const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(30_000)
   });
   if (!res.ok) throw new Error(`PostHog ${res.status}`);
   const body = await res.json();
   const out: Record<string, { visitors: number; withAccount: number }> = {};
   for (const [src, visitors, withAccount] of (body.results ?? []) as Array<[string, number, number]>) out[src] = { visitors, withAccount };
   return out;
};

const TIKTOK_HANDLE = 'moodeng.credit';

type TikTokVideo = { created: number; text: string; views: number; likes: number; comments: number; shares: number; saves: number; link: string };

/** The account's latest videos with their lifetime stats, plus follower count (public data via Apify). */
const tiktokVideos = async (apifyToken: string) => {
   const res = await fetch(`https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?timeout=120`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apifyToken}` },
      body: JSON.stringify({ profiles: [TIKTOK_HANDLE], resultsPerPage: 20, shouldDownloadVideos: false, shouldDownloadCovers: false }),
      signal: AbortSignal.timeout(150_000)
   });
   if (!res.ok) throw new Error(`Apify ${res.status}`);
   const items = (await res.json()) as any[];
   if (items[0]?.error) throw new Error(items[0].error);
   const videos: TikTokVideo[] = items.map((v) => ({
      created: Date.parse(v.createTimeISO),
      text: String(v.text ?? '').replace(/\s+/g, ' ').trim(),
      views: v.playCount ?? 0,
      likes: v.diggCount ?? 0,
      comments: v.commentCount ?? 0,
      shares: v.shareCount ?? 0,
      saves: v.collectCount ?? 0,
      link: v.webVideoUrl ?? ''
   }));
   return { videos, followers: items[0]?.authorMeta?.fans as number | undefined };
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   if (!(await isInternalRequest(supabase, req))) return json({ error: 'Unauthorized' }, 401);
   const { dryRun = false, force = false, apifyToken = Deno.env.get('APIFY_TOKEN') } = await req.json().catch(() => ({}));

   const now = Date.now();
   const weekLabel = `${manilaDate(now - 7 * DAY_MS)} – ${manilaDate(now - DAY_MS)}`;
   const lines = [`📣 Weekly social recap · ${weekLabel}`];
   const problems: string[] = [];
   // What the 💡 takeaways compare: views per platform, visits each sent to the site, best post per platform.
   const stat: { fbViews?: number; ttViews?: number; visits?: Record<string, { visitors: number }>; ttTop?: { text: string; views: number; likes: number; comments: number } } = {};

   const pageId = Deno.env.get('FACEBOOK_PAGE_ID');
   const token = Deno.env.get('FACEBOOK_PAGE_TOKEN');
   if (pageId && token) {
      try {
         const fb = await facebookWeek(pageId, token, now);
         const w = (name: string) => fb.weekly[name] ?? { now: 0, before: 0 };
         lines.push(
            '',
            '📘 Facebook Page',
            `Views ${fmt(w('page_media_view').now)}${change(w('page_media_view').now, w('page_media_view').before)}`,
            `Engagements ${fmt(w('page_post_engagements').now)}${change(w('page_post_engagements').now, w('page_post_engagements').before)}`,
            `Page visits ${fmt(w('page_views_total').now)}${change(w('page_views_total').now, w('page_views_total').before)}`,
            `New followers ${fmt(w('page_daily_follows_unique').now)}${fb.followers ? ` · ${fmt(fb.followers)} total` : ''}`
         );
         if (fb.posts.length) {
            const totals = fb.posts.reduce((t, p) => ({ views: t.views + p.views, clicks: t.clicks + p.clicks, reactions: t.reactions + p.reactions }), { views: 0, clicks: 0, reactions: 0 });
            stat.fbViews = totals.views;
            lines.push('', `🖼 ${fb.posts.length} posts: ${fmt(totals.views)} views · ${fmt(totals.reactions)} reactions · ${fmt(totals.clicks)} clicks`);
            const top = [...fb.posts].sort((a, b) => b.views - a.views).slice(0, 3);
            top.forEach((p, i) => {
               const title = p.text ? `${p.text.slice(0, 60)}${p.text.length > 60 ? '…' : ''}` : `(${p.kind})`;
               lines.push(`${['🥇', '🥈', '🥉'][i]} ${p.created} ${title}`, `   ${fmt(p.views)} views · ${fmt(p.reach)} people · ${p.reactions} reactions · ${p.clicks} clicks${p.link ? `\n   ${p.link}` : ''}`);
            });
         } else {
            lines.push('', '🖼 No Facebook posts this week.');
         }
      } catch (err) {
         problems.push(`Facebook: ${err instanceof Error ? err.message : err}`);
      }
   } else {
      problems.push('Facebook: FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN not set');
   }

   if (apifyToken) {
      try {
         const tt = await tiktokVideos(apifyToken);
         const week = tt.videos.filter((v) => v.created >= now - 7 * DAY_MS);
         const sum = (k: 'views' | 'likes' | 'comments' | 'shares') => week.reduce((t, v) => t + v[k], 0);
         stat.ttViews = sum('views');
         const best = [...week].sort((a, b) => b.views - a.views)[0];
         if (best) stat.ttTop = best;
         lines.push('', `🎵 TikTok @${TIKTOK_HANDLE}${tt.followers != null ? ` · ${fmt(tt.followers)} followers` : ''}`);
         if (week.length) {
            lines.push(`${week.length} videos: ${fmt(sum('views'))} views · ${fmt(sum('likes'))} likes · ${fmt(sum('comments'))} comments · ${fmt(sum('shares'))} shares`);
            [...week]
               .sort((a, b) => b.views - a.views)
               .slice(0, 3)
               .forEach((v, i) => {
                  const title = v.text ? `${v.text.slice(0, 60)}${v.text.length > 60 ? '…' : ''}` : '(video)';
                  lines.push(`${['🥇', '🥈', '🥉'][i]} ${manilaDate(v.created)} ${title}`, `   ${fmt(v.views)} views · ${v.likes} likes · ${v.comments} comments · ${v.shares} shares\n   ${v.link}`);
               });
         } else {
            lines.push('No TikTok videos this week.');
         }
      } catch (err) {
         problems.push(`TikTok: ${err instanceof Error ? err.message : err}`);
      }
   } else {
      problems.push('TikTok: APIFY_TOKEN not set');
   }

   const posthogKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
   if (posthogKey) {
      try {
         const visits = await siteVisits(posthogKey);
         stat.visits = visits;
         const line = (label: string, key: string) => {
            const v = visits[key];
            return v ? `${label}: ${fmt(v.visitors)} visitors · ${fmt(v.withAccount)} have an account` : `${label}: none`;
         };
         lines.push('', '🌐 moodeng.app visits', line('From Facebook', 'facebook'), line('From TikTok', 'tiktok'));
      } catch (err) {
         problems.push(`PostHog: ${err instanceof Error ? err.message : err}`);
      }
   }

   const since = new Date(now - 7 * DAY_MS).toISOString();
   const [{ count: signups }, { count: funded }] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('loans').select('id', { count: 'exact', head: true }).eq('loan_status', 'Lent').eq('is_test', false).gte('funded_at', since)
   ]);
   lines.push('', `🦛 Moodeng: ${fmt(signups ?? 0)} new sign-ups · ${fmt(funded ?? 0)} loans funded`);

   // New sign-ups by where they came from (users.signup_source from ?src= links; else the referring site).
   const { data: sources } = await supabase.from('users').select('signup_source, signup_referrer').gte('created_at', since);
   const bySource = new Map<string, number>();
   for (const u of (sources ?? []) as Array<{ signup_source: string | null; signup_referrer: string | null }>) {
      const ref = u.signup_referrer ?? '';
      const label =
         u.signup_source ??
         (/facebook|fb\.|messenger/.test(ref) ? 'facebook (untagged)' : /tiktok/.test(ref) ? 'tiktok (untagged)' : ref ? `${ref} (untagged)` : 'unknown');
      bySource.set(label, (bySource.get(label) ?? 0) + 1);
   }
   if (bySource.size) {
      lines.push('🧭 Sign-ups by source:');
      [...bySource.entries()]
         .sort((a, b) => b[1] - a[1])
         .forEach(([label, n]) => lines.push(`   ${label}: ${n}`));
   }

   // 💡 Plain-language takeaways from the numbers above (simple rules, no AI).
   const tips: string[] = [];
   const fbV = stat.fbViews ?? 0;
   const ttV = stat.ttViews ?? 0;
   if (stat.fbViews != null && stat.ttViews != null && fbV + ttV > 0) {
      const [hi, lo, hiN, loN] = ttV >= fbV ? ['TikTok', 'Facebook', ttV, fbV] : ['Facebook', 'TikTok', fbV, ttV];
      tips.push(loN > 0 && hiN / loN >= 1.5 ? `${hi} got ${(hiN / loN).toFixed(1)}× the views of ${lo} (${fmt(hiN)} vs ${fmt(loN)}).` : `${hi} ${fmt(hiN)} views vs ${lo} ${fmt(loN)}.`);
   }
   if (stat.visits) {
      const site = (k: string) => stat.visits?.[k]?.visitors ?? 0;
      for (const [name, key, views, tag] of [['TikTok', 'tiktok', ttV, 'tt-bio'], ['Facebook', 'facebook', fbV, 'fb-…']] as const) {
         if (views >= 100 && site(key) === 0) tips.push(`${name} had ${fmt(views)} views but sent nobody to moodeng.app: put a tagged link in the bio/caption (moodeng.app/?src=${tag}).`);
         else if (views >= 100 && site(key) > 0) tips.push(`${name} sent ${fmt(site(key))} site visitors (${((site(key) / views) * 100).toFixed(1)}% of views).`);
      }
   }
   if (stat.ttTop && stat.ttTop.comments + stat.ttTop.likes > 0) {
      const t = stat.ttTop.text.slice(0, 40);
      tips.push(`Best TikTok: "${t}${stat.ttTop.text.length > 40 ? '…' : ''}" (${fmt(stat.ttTop.views)} views). Make more like it.`);
   }
   const unknown = (bySource.get('unknown') ?? 0) + [...bySource.entries()].filter(([k]) => k.endsWith('(untagged)')).reduce((t, [, n]) => t + n, 0);
   if (signups && unknown / signups >= 0.5) tips.push(`${unknown} of ${signups} sign-ups had no ?src tag, so we can't tell which post brought them. Tag every link.`);
   if (tips.length) lines.push('', '💡 Takeaways', ...tips.map((t) => `• ${t}`));

   // The weekly to-do for whoever posts (Emma), so every post and poster can be counted next week.
   lines.push(
      '',
      '✅ For Emma, this week:',
      '1. Tag every link you post: moodeng.app/?src=fb-TOPIC-DATE (e.g. ?src=fb-bonds-oct20). TikTok bio/links: ?src=tt-…',
      '2. End each post with a clear "Apply at moodeng.app" (with the tagged link).',
      '3. Printed posters: one QR per poster/location, e.g. moodeng.app/?src=poster-qc-mall, so we see which spot works.'
   );
   if (problems.length) lines.push('', `⚠️ ${problems.join(' · ')}`);
   const text = lines.join('\n');

   if (dryRun) return json({ text });

   const weekId = manilaDate(now - ((new Date(now + 8 * 3_600_000).getUTCDay() + 6) % 7) * DAY_MS); // Monday of this week
   if (!force) {
      const { data: posted } = await supabase.from('telegram_bot_settings').select('value').eq('key', WEEK_KEY).maybeSingle();
      if (posted?.value === weekId) return json({ message: 'Already posted this week.' });
   }
   // The social media group (social_group_chat_id, set with /chatid there) if there is one, else the team group.
   const { data: chats } = await supabase.from('telegram_bot_settings').select('key, value').in('key', ['social_group_chat_id', 'team_group_chat_id']);
   const setting = (k: string) => (chats ?? []).find((c: any) => c.key === k)?.value as string | undefined;
   const chatId = setting('social_group_chat_id') ?? setting('team_group_chat_id') ?? Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
   const telegramOk = chatId
      ? await sendTelegramMessage(chatId, text)
           .then(() => true)
           .catch((err) => (console.error('social-weekly-recap: Telegram failed', err instanceof Error ? err.message : err), false))
      : false;
   const discordOk = await postDiscord(
      { embeds: [{ title: '📣 Weekly social recap', description: text.slice(0, 4000), color: 0x1877f2, timestamp: new Date(now).toISOString() }] },
      // #social-media; falls back to the team channel.
      { prefer: ['DISCORD_SOCIAL_WEBHOOK_URL'] }
   );
   if (telegramOk || discordOk) {
      await supabase
         .from('telegram_bot_settings')
         .upsert({ key: WEEK_KEY, value: weekId, description: 'Monday (Manila) of the last week the social recap was posted.' }, { onConflict: 'key' });
   }
   return json({ posted: { telegram: telegramOk, discord: discordOk } });
});
