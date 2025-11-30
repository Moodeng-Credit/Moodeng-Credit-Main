# Railway Deployment Setup Guide

## ✅ Migration Setup Complete

Your Prisma migrations are now ready to run on Railway!

## 📋 What's Been Set Up

1. **Migration Files**: Created in `prisma/migrations/20241129000000_init/`
2. **Package.json Scripts**: Updated with Prisma commands
3. **Schema**: Updated with DATABASE_URL environment variable

## 🚀 Railway Configuration

### Required Environment Variables

Make sure these are set in your Railway project:

```bash
DATABASE_URL=<your-railway-postgres-url>
NODE_ENV=production
JWT_SECRET=<your-secret>
# ... other env vars from env.example
```

### Build & Deploy Commands

Railway should use these commands:

**Build Command:**
```bash
npm install && npx prisma generate && npm run build
```

**Start Command:**
```bash
npx prisma migrate deploy && npm start
```

### Alternative: Using Railway's Service Settings

If Railway has a separate migration command field:

**Install Command:**
```bash
npm install
```

**Build Command:**
```bash
npx prisma generate && npm run build
```

**Deploy Command / Start Command:**
```bash
npx prisma migrate deploy && npm start
```

## 📝 Important Notes

1. **`prisma migrate deploy`** runs pending migrations in production (non-interactive)
2. **`prisma generate`** creates the Prisma Client (needed before build)
3. The migrations will automatically create your database tables on first deploy

## 🔍 Verification

After deploying to Railway, check the logs for:
```
✓ Prisma Migrate applied 1 migration(s)
  20241129000000_init
```

## 🛠️ Manual Migration Commands

If you need to run migrations manually on Railway:

```bash
# SSH into Railway container (if available) or use Railway CLI
railway run npx prisma migrate deploy
```

## 📦 Package.json Scripts Available

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Deploy migrations (production)
- `npm run prisma:migrate:dev` - Create new migrations (local only)
- `npm run prisma:studio` - Open Prisma Studio

## 🔄 Future Schema Changes

When you update your schema:

1. Create a new migration manually or with a local database
2. Commit the new migration file
3. Push to Railway
4. Railway will auto-run `prisma migrate deploy` on the new deployment

## ⚠️ Troubleshooting

If migrations don't run:
1. Check DATABASE_URL is set correctly in Railway
2. Verify build logs show `prisma migrate deploy` running
3. Make sure `prisma` and `@prisma/client` are in dependencies (not devDependencies)

Current setup has them in devDependencies - consider moving to dependencies for production:
```bash
npm install --save @prisma/client prisma
```

