#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.argv[2] || process.env.SUPABASE_PROJECT_REF;
const appUrl = process.env.MOODENG_APP_URL || 'https://dashboard.moodeng.app';
const dryRun = process.argv.includes('--dry-run');
const previewDirFlagIndex = process.argv.indexOf('--preview-dir');
const previewDir = previewDirFlagIndex >= 0 ? process.argv[previewDirFlagIndex + 1] : '';

if (!projectRef) {
   console.error('Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/update-supabase-auth-email-templates.mjs <project-ref>');
   process.exit(1);
}

const lockHippoUrl = `${appUrl}/hippos/hippo-friendly-lock.png`;
const envelopeHippoUrl = `${appUrl}/hippos/hippo-purple-envelope-email.png`;
const supportUrl = `${appUrl}/support/faq`;

function buildEmailTemplate({
   imageUrl,
   imageAlt,
   eyebrow,
   title,
   body,
   cta,
   footer,
   href = '{{ .ConfirmationURL }}'
}) {
   return `
<div style="margin:0;padding:0;background:#f7f3ff;font-family:Arial,Helvetica,sans-serif;color:#09012f;">
  <style>
    @media only screen and (max-width:480px) {
      .moodeng-email-shell { padding:24px 10px !important; }
      .moodeng-email-card { padding:28px 18px !important; border-radius:22px !important; }
      .moodeng-email-title { font-size:28px !important; line-height:33px !important; }
      .moodeng-email-cta { display:block !important; min-width:0 !important; }
    }
  </style>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;background:#f7f3ff;">
    <tr>
      <td align="center" class="moodeng-email-shell" style="padding:32px 18px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border-collapse:collapse;table-layout:fixed;">
          <tr>
            <td style="padding:0 0 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <tr>
                  <td style="font-size:22px;line-height:28px;font-weight:800;color:#09012f;">
                    Moodeng Credit
                  </td>
                  <td align="right" style="font-size:13px;line-height:18px;font-weight:700;color:#8336f0;">
                    Account email
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="moodeng-email-card" style="background:#ffffff;border:1px solid #eadfff;border-radius:24px;padding:34px 28px;box-shadow:0 18px 48px rgba(9,1,47,0.08);">
              <table role="presentation" align="center" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:196px;margin:0 auto 24px;border-collapse:separate;table-layout:fixed;">
                <tr>
                  <td align="center">
                    <img src="${imageUrl}" alt="${imageAlt}" width="196" style="display:block;width:100%;max-width:196px;height:auto;margin:0 auto;border:1px solid #dcc7ff;border-radius:28px;" />
                  </td>
                </tr>
              </table>
              <div style="margin:0 0 10px;text-align:center;font-size:12px;line-height:16px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#8336f0;">
                ${eyebrow}
              </div>
              <h1 class="moodeng-email-title" style="margin:0 0 14px;text-align:center;font-size:32px;line-height:37px;font-weight:800;color:#09012f;">
                ${title}
              </h1>
              <p style="margin:0 auto 26px;max-width:430px;text-align:center;font-size:16px;line-height:25px;font-weight:500;color:#6f6280;">
                ${body}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <tr>
                  <td align="center">
                    <a href="${href}" class="moodeng-email-cta" style="display:inline-block;min-width:220px;border-radius:16px;background:#6414db;color:#ffffff;text-align:center;text-decoration:none;font-size:16px;line-height:20px;font-weight:800;padding:16px 22px;">
                      ${cta}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:26px 0 0;font-size:13px;line-height:20px;font-weight:600;color:#8d819a;">
                ${footer}
              </p>
              <p style="margin:10px 0 0;font-size:13px;line-height:20px;font-weight:600;color:#8d819a;">
                If the email is hard to find later, check spam or promotions and mark Moodeng as safe.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 8px 0;font-size:12px;line-height:18px;color:#9a8fa8;">
              Need help? Visit <a href="${supportUrl}" style="color:#6414db;text-decoration:underline;">Moodeng Support</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`.trim();
}

const authTemplateConfig = {
   mailer_subjects_confirmation: 'Confirm your Moodeng account',
   mailer_templates_confirmation_content: buildEmailTemplate({
      imageUrl: envelopeHippoUrl,
      imageAlt: 'Moodeng holding an envelope',
      eyebrow: 'Welcome to Moodeng',
      title: 'Confirm your email',
      body: 'Confirm this email so you can continue setting up your Moodeng account.',
      cta: 'Confirm Email',
      footer: 'If you did not create a Moodeng account, you can ignore this email.'
   }),
   mailer_subjects_recovery: 'Reset your Moodeng password',
   mailer_templates_recovery_content: buildEmailTemplate({
      imageUrl: lockHippoUrl,
      imageAlt: 'Moodeng holding a lock',
      eyebrow: 'Account access',
      title: 'Reset your password',
      body: 'We received a request to reset your Moodeng password. Use the secure link below to choose a new one.',
      cta: 'Reset Password',
      footer: 'If you did not request this, you can ignore this email. Your password will stay the same.'
   }),
   mailer_subjects_email_change: 'Confirm your Moodeng email change',
   mailer_templates_email_change_content: buildEmailTemplate({
      imageUrl: lockHippoUrl,
      imageAlt: 'Moodeng account security',
      eyebrow: 'Email security',
      title: 'Confirm your new email',
      body: 'Confirm this email address to finish changing the email on your Moodeng account.',
      cta: 'Confirm Email Change',
      footer: 'If you did not request this email change, keep your current email and contact support.'
   }),
   mailer_subjects_reauthentication: 'Confirm your Moodeng session',
   mailer_templates_reauthentication_content: buildEmailTemplate({
      imageUrl: lockHippoUrl,
      imageAlt: 'Moodeng account security',
      eyebrow: 'Security check',
      title: 'Confirm it is you',
      body: 'Use this secure link to confirm your session and continue with your Moodeng account.',
      cta: 'Confirm Session',
      footer: 'If you did not request this, you can ignore this email.'
   })
};

if (dryRun) {
   console.log(JSON.stringify(authTemplateConfig, null, 2));
   process.exit(0);
}

if (previewDir) {
   await mkdir(previewDir, { recursive: true });

   const previews = [
      {
         file: 'confirm-email.html',
         label: 'Confirm Email',
         subject: authTemplateConfig.mailer_subjects_confirmation,
         html: authTemplateConfig.mailer_templates_confirmation_content
      },
      {
         file: 'reset-password.html',
         label: 'Reset Password',
         subject: authTemplateConfig.mailer_subjects_recovery,
         html: authTemplateConfig.mailer_templates_recovery_content
      },
      {
         file: 'email-change.html',
         label: 'Email Change',
         subject: authTemplateConfig.mailer_subjects_email_change,
         html: authTemplateConfig.mailer_templates_email_change_content
      },
      {
         file: 'reauthentication.html',
         label: 'Reauthentication',
         subject: authTemplateConfig.mailer_subjects_reauthentication,
         html: authTemplateConfig.mailer_templates_reauthentication_content
      }
   ];

   await Promise.all(
      previews.map((preview) =>
         writeFile(
            join(previewDir, preview.file),
            `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${preview.label} - Moodeng Email Preview</title>
</head>
<body style="margin:0;">
  ${preview.html}
</body>
</html>`
         )
      )
   );

   await writeFile(
      join(previewDir, 'index.html'),
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Moodeng Auth Email Previews</title>
  <style>
    body { margin: 0; background: #f7f3ff; color: #09012f; font-family: Arial, Helvetica, sans-serif; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 18px 44px; }
    h1 { margin: 0 0 8px; font-size: 32px; line-height: 1.1; }
    p { margin: 0 0 24px; color: #6f6280; font-weight: 600; line-height: 1.5; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
    nav a { border: 1px solid #dccaef; border-radius: 999px; padding: 10px 14px; color: #6414db; background: #fff; text-decoration: none; font-weight: 800; }
    section { margin: 0 0 28px; border-radius: 24px; border: 1px solid #e5d9f5; background: #fff; overflow: hidden; box-shadow: 0 18px 48px rgba(9,1,47,0.08); }
    header { padding: 16px 18px; border-bottom: 1px solid #eee7f7; font-weight: 800; }
    header span { display: block; margin-top: 4px; color: #6f6280; font-size: 13px; font-weight: 700; }
    iframe { width: 100%; height: 760px; border: 0; background: #f7f3ff; }
    @media (max-width: 640px) {
      main { padding: 22px 10px 34px; }
      h1 { font-size: 26px; }
      iframe { height: 720px; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Moodeng Auth Email Previews</h1>
    <p>These are local previews of the Supabase Auth email templates. The real links are inserted by Supabase.</p>
    <nav>
      ${previews.map((preview) => `<a href="#${preview.file}">${preview.label}</a>`).join('\n      ')}
    </nav>
    ${previews
       .map(
          (preview) => `<section id="${preview.file}">
      <header>${preview.label}<span>Subject: ${preview.subject}</span></header>
      <iframe title="${preview.label}" src="./${preview.file}"></iframe>
    </section>`
       )
       .join('\n    ')}
  </main>
</body>
</html>`
   );

   console.log(`Wrote Moodeng Auth email previews to ${previewDir}.`);
   process.exit(0);
}

if (!accessToken || !accessToken.startsWith('sbp_')) {
   console.error('Set SUPABASE_ACCESS_TOKEN to a Supabase personal access token that starts with sbp_.');
   process.exit(1);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
   method: 'PATCH',
   headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
   },
   body: JSON.stringify(authTemplateConfig)
});

const body = await response.text();

if (!response.ok) {
   console.error(`Failed to update Moodeng Auth email templates for ${projectRef}.`);
   console.error(`${response.status} ${response.statusText}`);
   console.error(body);
   process.exit(1);
}

console.log(`Updated Moodeng Auth email templates for ${projectRef}.`);
