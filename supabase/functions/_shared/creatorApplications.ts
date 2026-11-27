import { type CreatorAi, reachLine, verdictEmoji } from './creatorGrade.ts';

// moodeng.app/creator applications (migration 20261128070000_creator_applications). The DB posts
// { creatorApp: { event, id, code? } } to referral-payout-telegram-notification:
//   code       → email the 6-digit code
//   submitted  → confirmation email, then (in the background) the AI read + team Telegram card with the score
//   grade      → AI read again from Admin (no email, no card)
//   approved   → email with their code + one-time moodeng.app/partner/TOKEN link
//   rejected   → "we can't approve it this time" email

export type CreatorApp = {
   id: string;
   app_number: string | null;
   full_name: string;
   phone: string;
   email: string;
   address: string;
   facebook_url: string | null;
   tiktok_url: string | null;
   youtube_url: string | null;
   instagram_url: string | null;
   prior_fintech: boolean;
   prior_fintech_details: string | null;
   conflict: boolean;
   conflict_details: string | null;
   pitch: string | null;
   referral_code: string | null;
   invite_token: string | null;
   video_path: string | null;
};

export type CreatorEmail = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstName = (full: string) => full.trim().split(/\s+/)[0] || 'there';

// Same look as the /creator page: purple Moodeng banner, white card, gold button, purple number box.
const shell = (badge: string, badgeBg: string, title: string, bodyHtml: string) => `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f6f5fb;font-family:Inter,Arial,sans-serif;color:#1d1636">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#7f86f6;background-image:linear-gradient(180deg,#7f86f6,#6b55f7);color:#ffffff">
<div style="font-size:20px;font-weight:900;font-style:italic;letter-spacing:-.5px">MOODENG <span style="font-weight:700;opacity:.85">Creators</span></div>
</td></tr>
<tr><td style="padding:26px 28px 8px">
<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${badgeBg};font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">${badge}</span>
<h1 style="font-size:28px;line-height:1.15;margin:14px 0 12px;font-style:italic;font-weight:900">${title}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#f6f5fb;font-size:12px;color:#7a7396">
<strong style="color:#1d1636">MOODENG</strong> · Creator Partners · <a href="https://moodeng.app/creator" style="color:#6b55f7">moodeng.app/creator</a>
</td></tr></table></td></tr></table></body></html>`;

const p = (html: string) => `<p style="font-size:16px;line-height:1.55;margin:0 0 14px">${html}</p>`;
const bigBox = (label: string, value: string) =>
   `<div style="margin:6px 0 18px;padding:14px 16px;border-radius:16px;background:#efecff">
<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a83a6">${label}</div>
<div style="font-size:26px;font-weight:900;letter-spacing:.12em;color:#6b55f7;margin-top:2px">${esc(value)}</div></div>`;
const button = (href: string, label: string) =>
   `<p style="margin:8px 0 18px"><a href="${esc(href)}" style="display:inline-block;padding:14px 26px;background:#ffbe1a;background-image:linear-gradient(180deg,#ffe27a,#ffbe1a);color:#4a2a00;border-radius:999px;font-weight:800;text-decoration:none">${label}</a></p>`;

export const creatorCodeEmail = (app: Pick<CreatorApp, 'full_name'>, code: string): CreatorEmail => ({
   subject: `${code} is your Moodeng creator code`,
   text: `Hi ${firstName(app.full_name)},\n\nYour code is ${code}. Type it on the page to send your application.\nIt works for 15 minutes.\n\nDidn't apply? You can ignore this email.\n\nMoodeng`,
   html: shell(
      'Email check',
      '#dcf7e6',
      'Your code',
      p(`Hi ${esc(firstName(app.full_name))}, type this code on the page to send your application.`) +
         bigBox('6-digit code', code) +
         p('It works for 15 minutes. Didn’t apply? You can ignore this email.')
   )
});

export const creatorSubmittedEmail = (app: Pick<CreatorApp, 'full_name' | 'app_number'>): CreatorEmail => {
   const num = app.app_number ?? '';
   return {
      subject: `We got your Moodeng creator application (${num})`,
      text: `Hi ${firstName(app.full_name)},\n\nThanks for applying to be a Moodeng creator partner. Your application number is ${num}.\n\nOur team will look at your profile and email you. You can check your status any time at https://moodeng.app/creator?track=${num}\n\nMoodeng`,
      html: shell(
         'Application received',
         '#efecff',
         'Thanks for applying!',
         p(`Hi ${esc(firstName(app.full_name))}, we got your creator profile. Our team will look at it and email you.`) +
            bigBox('Your application number', num) +
            button(`https://moodeng.app/creator?track=${encodeURIComponent(num)}`, 'Check my status →') +
            p('Keep this email. You need the number and this email address to check your status.')
      )
   };
};

export const creatorApprovedEmail = (
   app: Pick<CreatorApp, 'full_name' | 'app_number' | 'referral_code' | 'invite_token'>
): CreatorEmail => {
   const link = `https://moodeng.app/partner/${app.invite_token ?? ''}`;
   const code = app.referral_code ?? '';
   return {
      subject: `You're approved — welcome to Moodeng creators (${app.app_number ?? ''})`,
      text: `Hi ${firstName(app.full_name)},\n\nGood news: your creator application ${app.app_number ?? ''} is approved!\n\nYour code: ${code}\n\nSet up your partner account here (this link works once, only for you):\n${link}\n\nAfter that, your dashboard shows your friends and what you earn.\n\nMoodeng`,
      html: shell(
         'Approved',
         '#dcf7e6',
         'You’re in! 🎉',
         p(`Hi ${esc(firstName(app.full_name))}, your creator application <strong>${esc(app.app_number ?? '')}</strong> is approved.`) +
            bigBox('Your code', code) +
            button(link, 'Set up my partner account →') +
            p('This link works once, only for you. After you sign up, your dashboard shows your friends and what you earn.')
      )
   };
};

export const creatorRejectedEmail = (app: Pick<CreatorApp, 'full_name' | 'app_number'>): CreatorEmail => ({
   subject: `Update on your Moodeng creator application (${app.app_number ?? ''})`,
   text: `Hi ${firstName(app.full_name)},\n\nThank you for applying to be a Moodeng creator partner (${app.app_number ?? ''}).\n\nWe can't approve your application this time. Thank you for your interest, and good luck with your channels.\n\nMoodeng`,
   html: shell(
      'Application update',
      '#fde4e4',
      'Update on your application',
      p(
         `Hi ${esc(firstName(app.full_name))}, thank you for applying to be a Moodeng creator partner (<strong>${esc(app.app_number ?? '')}</strong>).`
      ) + p('We can’t approve your application this time. Thank you for your interest, and good luck with your channels.')
   )
});

const short = (s: string | null, max: number) => (s && s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Team Telegram card for a new (email-checked) application. Plain text. */
export const creatorTeamCard = (app: CreatorApp, ai: CreatorAi | null, aiError?: string | null): string => {
   const socials = [
      app.facebook_url ? `👤 Facebook: ${app.facebook_url}` : null,
      app.tiktok_url ? `🎵 TikTok: ${app.tiktok_url}` : null,
      app.youtube_url ? `▶️ YouTube: ${app.youtube_url}` : null,
      app.instagram_url ? `📸 Instagram: ${app.instagram_url}` : null
   ].filter(Boolean);
   const aiLines = ai
      ? [
           `${verdictEmoji(ai.verdict)} AI ${ai.score}/100 — ${ai.summary}`,
           ...ai.strengths.map((x) => `  👍 ${x}`),
           ...ai.flags.map((x) => `  ⚠️ ${x}`),
           reachLine(ai.reach),
           ai.video ? `🎥 Video: ${ai.video.said ?? (ai.video.on_camera === false ? 'nobody on camera' : 'watched')}` : '🎥 No video',
           ''
        ]
      : [`🤖 AI couldn't read this one${aiError ? ` (${short(aiError, 100)})` : ''}. Grade again in Admin.`, ''];
   return [
      `🎬 New creator application ${app.app_number ?? ''}`,
      `${app.full_name} · ${app.phone} · ${app.email}`,
      '',
      ...aiLines,
      ...(socials.length ? socials : ['(no social links)']),
      `Worked with a fintech app before: ${app.prior_fintech ? `YES${app.prior_fintech_details ? ` (${short(app.prior_fintech_details, 120)})` : ''}` : 'no'}`,
      `Conflict of interest: ${app.conflict ? `YES${app.conflict_details ? ` (${short(app.conflict_details, 120)})` : ''}` : 'no'}`,
      app.pitch ? `Why us: ${short(app.pitch, 400)}` : null,
      '',
      'Approve or reject: moodeng.app/admin/affiliates'
   ]
      .filter((l) => l !== null)
      .join('\n');
};
