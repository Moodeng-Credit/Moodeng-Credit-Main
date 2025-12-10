# Vercel Deployment Implementation Plan

## Overview
This document outlines the steps required to deploy the Moodeng Credit application to Vercel. The application is a Next.js 15 project with Supabase backend integration, Web3 functionality, and various authentication providers.

## Prerequisites
- Vercel account with billing enabled (if using paid features)
- GitHub repository connected to Vercel
- Supabase project set up and configured
- All required environment variables prepared

## Environment Variables Setup

### Required Environment Variables in Vercel Dashboard

Set these in your Vercel project settings under "Environment Variables":

#### Supabase Configuration (REQUIRED)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

#### UI Configuration
```bash
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
NEXT_TELEMETRY_DISABLED=1
GENERATE_SOURCEMAP=false
CI=false
```

#### Google OAuth Configuration
```bash
GOOGLE_CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

#### Email Configuration (Gmail OAuth)
```bash
CLIENT_ID=your_google_client_id
EMAIL_USER=your_email@gmail.com
REFRESH_TOKEN=your_refresh_token
```

#### Telegram Bot Configuration
```bash
TELEGRAM_API_TOKEN=your_TELEGRAM_API_TOKEN
TELEGRAM_API_URL=https://api.telegram.org/bot{YOUR_BOT_TOKEN}/sendMessage
TELEGRAM_WEBHOOK_API=https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook
TELEGRAM_WEBHOOK_URL=https://your-vercel-domain.vercel.app/api/webhook
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
```

#### Web3 Configuration
```bash
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
NEXT_PUBLIC_ALCHEMY_ID=your_alchemy_id
```

#### World ID Configuration
```bash
NEXT_PUBLIC_WORLD_ID_APP_ID=app_staging_45afca29a686140c059e725b0d5bc6a4
WORLD_ID_API_KEY=your_world_id_api_key
NEXT_PUBLIC_WORLD_ID_ACTION_ID=verify
NEXT_PUBLIC_DEV_MODE=false
```

#### Legacy Database (if still needed during migration)
```bash
DATABASE_URL=your_legacy_database_url
DO_MIGRATE=false
```

## Code Changes Required

### 1. Update next.config.ts for Vercel Compatibility

The current `next.config.ts` has some webpack configurations that may not be necessary for Vercel. However, Vercel supports most Next.js features out of the box. The current config should work, but monitor for any build issues.

### 2. Environment Variable Handling

Ensure all environment variables are properly accessed in the code. The app already uses `process.env` correctly.

### 3. Build Optimization

The package.json already has proper build scripts:
- `build`: `NODE_ENV=production next build`
- `start`: `next start`

## Deployment Steps

### Step 1: Connect Repository to Vercel
1. Go to Vercel dashboard
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings:
   - Framework Preset: Next.js
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build` (should auto-detect)
   - Output Directory: `.next` (should auto-detect)

### Step 2: Configure Environment Variables
1. In Vercel project settings, go to "Environment Variables"
2. Add all required variables listed above
3. Set appropriate environments (Production, Preview, Development)

### Step 3: Configure Domains (Optional)
1. In project settings, go to "Domains"
2. Add custom domain if needed
3. Update `NEXT_PUBLIC_SITE_URL` accordingly

### Step 4: Deploy
1. Push changes to your main branch
2. Vercel will automatically trigger a deployment
3. Monitor build logs in Vercel dashboard

## Post-Deployment Configuration

### 1. Update Supabase CORS Settings
In your Supabase dashboard:
- Go to Authentication > URL Configuration
- Add your Vercel domain to "Site URL"
- Add `https://your-vercel-domain.vercel.app` to redirect URLs

### 2. Configure Telegram Webhook
If using Telegram integration:
- Update `TELEGRAM_WEBHOOK_URL` with your Vercel domain
- Ensure the webhook endpoint is properly configured

### 3. Test Authentication Flows
- Google OAuth
- Telegram authentication
- World ID verification
- Wallet connections

### 4. Verify Web3 Integration
- Test wallet connections
- Verify network configurations
- Check transaction flows

## Monitoring and Maintenance

### Build Logs
- Monitor Vercel build logs for any errors
- Check for deprecated dependencies or configurations

### Environment Variables
- Regularly rotate sensitive keys (Supabase keys, API keys)
- Update webhook URLs if domain changes

### Performance
- Use Vercel's analytics to monitor performance
- Consider Vercel Edge Functions for API routes if needed

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility (project requires >=22.0.0)
   - Verify all dependencies are installed
   - Check for TypeScript errors

2. **Environment Variables Not Loading**
   - Ensure variables are set in correct environment (Production/Preview)
   - Check variable names match exactly
   - Redeploy after adding new variables

3. **Supabase Connection Issues**
   - Verify Supabase URL and keys are correct
   - Check CORS settings in Supabase
   - Ensure Row Level Security is properly configured

4. **Web3 Integration Problems**
   - Verify WalletConnect Project ID
   - Check Alchemy API key
   - Test on different networks

### Vercel-Specific Considerations

- Vercel has a 5-minute build timeout for Hobby plan
- Serverless functions have execution time limits
- File system access is limited in serverless environment
- Use Vercel Edge Runtime for better performance if needed

## Security Considerations

- Never commit sensitive environment variables to Git
- Use Vercel's encrypted environment variables
- Regularly audit and rotate API keys
- Enable Vercel's security features (DDoS protection, etc.)

## Cost Optimization

- Monitor Vercel usage and costs
- Consider Vercel Pro plan for higher limits if needed
- Optimize bundle size to reduce bandwidth costs
- Use Vercel's caching features effectively

## Rollback Plan

- Keep previous deployment active until new one is verified
- Use Vercel's deployment history for quick rollbacks
- Have backup environment variables documented
- Test critical flows before marking deployment as production</content>
<parameter name="filePath">/Users/anthonytjuatja/Dev/business/Moodeng-Credit-Main/plan/VERCEL_IMPL.md