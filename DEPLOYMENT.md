# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables
Ensure all required environment variables are set:
- `SHOPIFY_API_KEY` - From Partners Dashboard
- `SHOPIFY_API_SECRET` - From Partners Dashboard
- `SCOPES` - Comma-separated scopes (already in shopify.app.toml)
- `OPENAI_API_KEY` - For AI color matching
- `NODE_ENV=production`
- `DATABASE_URL` - If using external database (optional)

### 2. Update shopify.app.toml
Update these fields with your production URLs:
```toml
application_url = "https://your-production-domain.com"
redirect_urls = [ "https://your-production-domain.com/api/auth" ]
```

### 3. Hosting Options

#### Option A: Railway (Recommended - Easy Setup)
1. Sign up at [railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repo
4. Add environment variables
5. Deploy automatically

#### Option B: Heroku
1. Create Heroku app
2. Set up PostgreSQL (if needed)
3. Configure environment variables
4. Deploy via Git

#### Option C: Fly.io
1. Install Fly CLI
2. Run `fly launch`
3. Configure environment variables
4. Deploy

#### Option D: Render
1. Create new Web Service
2. Connect GitHub repo
3. Set environment variables
4. Deploy

### 4. Database Setup
For production, consider migrating from SQLite to:
- **PostgreSQL** (recommended)
- **MySQL**
- **MongoDB**

Update session storage in `web/index.js` if needed.

### 5. Build Frontend
```bash
cd web/frontend/
SHOPIFY_API_KEY=your_key npm run build
```

### 6. Update Partners Dashboard
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Navigate to your app
3. Update App URL to production URL
4. Update redirect URLs
5. Test installation flow

## Deployment Steps

### Step 1: Choose Hosting Provider
Select one of the options above (Railway recommended for simplicity).

### Step 2: Set Environment Variables
Set all required environment variables in your hosting provider's dashboard.

### Step 3: Update shopify.app.toml
Replace `https://example.com` with your production domain.

### Step 4: Deploy
Push to your main branch (if using auto-deploy) or deploy manually.

### Step 5: Test Production Installation
1. Install app on a test store
2. Test all features
3. Verify billing works
4. Check error handling

## Post-Deployment

### 1. Monitor Logs
Set up logging and monitoring:
- Error tracking (Sentry, LogRocket)
- Performance monitoring
- Uptime monitoring

### 2. SSL Certificate
Ensure your hosting provider provides SSL (HTTPS). Most providers do this automatically.

### 3. Domain Setup
Configure your custom domain if needed.

## App Store Submission Checklist

Before submitting to Shopify App Store:

- [ ] Privacy Policy (PRIVACY.md) - ✅ Created
- [ ] Terms of Service (TERMS.md) - ✅ Created
- [ ] App description (500 characters max)
- [ ] App screenshots (at least 3)
- [ ] App icon (512x512px PNG)
- [ ] Support email
- [ ] Support URL (optional)
- [ ] Marketing URL (optional)
- [ ] All features tested
- [ ] Billing tested
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Accessibility checked

## App Store Listing Requirements

### App Description
Write a compelling description highlighting:
- AI-powered variant creation
- Natural language processing
- Color matching with images
- Bulk operations
- CSV import/export

### Screenshots
Prepare screenshots showing:
1. Main dashboard/variant creator
2. AI prompt interface
3. Image color matching
4. Variant management
5. Pricing plans

### App Icon
Create a 512x512px PNG icon that represents your app.

## Support

For deployment issues:
- Check hosting provider documentation
- Review Shopify deployment docs: https://shopify.dev/docs/apps/deployment/web
- Check Shopify Partner community forums












