# Environment Variables Guide

## Quick Answer: What to put in `.env.local`

Create a file named `.env.local` in the project root with these variables:

### Minimum Required (to run the app)

```env
# Clerk Authentication - REQUIRED
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Supabase Database - REQUIRED
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Optional (for specific features)

```env
# OpenAI - For AI Code Generator
OPENAI_API_KEY=sk-your_openai_key_here

# Stripe - For subscription payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PREMIUM_PRICE_ID=price_xxxxx
STRIPE_EDUCATION_PRICE_ID=price_xxxxx

# Supabase Service Role - Only for webhooks
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Production URL - Only for production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Where to Get These Keys

### 1. Clerk (Authentication) - REQUIRED ✅

**Get keys from:** https://dashboard.clerk.com/last-active?path=api-keys

1. Sign up for free at https://clerk.com
2. Create a new application
3. Go to "API Keys" section
4. Copy both keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_`)

**Configure Google OAuth:**
1. In Clerk Dashboard → "Social Connections"
2. Enable Google
3. Follow Clerk's setup wizard for Google OAuth

**What breaks without it:** Login/signup won't work, app won't load

---

### 2. Supabase (Database) - REQUIRED ✅

**Get keys from:** https://app.supabase.com/project/_/settings/api

1. Sign up for free at https://supabase.com
2. Create a new project
3. Wait 2-3 minutes for setup to complete
4. Go to Settings → API
5. Copy both values:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon/public key)

**Set up database tables:**
```bash
# Run the SQL scripts in Supabase SQL Editor
# 1. supabase-schema.sql (projects table)
# 2. supabase-curriculum-schema.sql (courses, lessons)
# 3. supabase-educator-schema.sql (classrooms)
# 4. supabase-subscription-schema.sql (subscriptions)
```

**What breaks without it:** Projects won't save, curriculum won't load

---

### 3. OpenAI (AI Generator) - OPTIONAL 🤖

**Get key from:** https://platform.openai.com/api-keys

1. Sign up at https://platform.openai.com
2. Add payment method (required, but usage is cheap)
3. Go to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)
6. **⚠️ Save it immediately - you can't see it again!**

**Cost:**
- ~$0.01 per code generation (GPT-4o-mini)
- ~$0.005 per code explanation call (GPT-4o-mini)
- First-time users get $5 free credits
- Set billing limits to control costs

#### Cost & Billing

- **Estimated cost per call**: ~$0.01 for `/api/generate`, ~$0.005 for `/api/explain`
- **Per-student per day** (10 generates): ~$0.10
- **To set billing alerts**: OpenAI dashboard → Settings → Limits → set a monthly budget alert
- **To cap usage**: Set a "Hard limit" in the OpenAI dashboard; once exceeded, the API returns 429 errors (the app handles these gracefully with a user-friendly message)
- **Note**: A local/offline model option is a planned future enhancement

**What breaks without it:**
- AI Code Generator shows an info card (not a crash) explaining the setup steps
- Everything else works normally
- Students can still use Block Editor, Builder, Simulator, and Curriculum

---

### 4. Stripe (Payments) - OPTIONAL 💳

**Get keys from:** https://dashboard.stripe.com/test/apikeys

1. Sign up for free at https://stripe.com
2. Stay in **Test Mode** for development
3. Go to Developers → API Keys
4. Copy test keys:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_`)
   - `STRIPE_SECRET_KEY` (starts with `sk_test_`)

**Create subscription products:**
1. Go to Products → Add Product
2. Create two products:
   - **Premium** - $9.99/month
   - **Education** - $49.99/month
3. Copy the Price IDs (start with `price_`)

**Set up webhook (after deployment):**
1. Go to Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the webhook signing secret (starts with `whsec_`)

**What breaks without it:**
- Pricing page works but checkout fails
- Subscription management unavailable
- Free tier still accessible

---

## Complete `.env.local` Template

Copy this into your `.env.local` file and replace the placeholder values:

```env
# ==============================================================================
# REQUIRED - Must have these for app to work
# ==============================================================================

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_
CLERK_SECRET_KEY=sk_test_

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ==============================================================================
# OPTIONAL - Add these for additional features
# ==============================================================================

# OpenAI (for AI Code Generator)
# OPENAI_API_KEY=sk-

# Stripe (for payments)
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_
# STRIPE_SECRET_KEY=sk_test_
# STRIPE_WEBHOOK_SECRET=whsec_
# STRIPE_PREMIUM_PRICE_ID=price_
# STRIPE_EDUCATION_PRICE_ID=price_

# Supabase Service Role (for webhooks only)
# SUPABASE_SERVICE_ROLE_KEY=

# Production URL (for production only)
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Setup Checklist

### Phase 1: Get App Running (5 minutes)

- [ ] Create Clerk account and application
- [ ] Copy Clerk publishable key
- [ ] Copy Clerk secret key
- [ ] Create Supabase project
- [ ] Copy Supabase URL
- [ ] Copy Supabase anon key
- [ ] Create `.env.local` file in project root
- [ ] Add 4 required variables
- [ ] Run `pnpm dev`
- [ ] Test login at http://localhost:3000

### Phase 2: Set Up Database (10 minutes)

- [ ] Open Supabase SQL Editor
- [ ] Run `supabase-schema.sql` (projects)
- [ ] Run `supabase-curriculum-schema.sql` (courses)
- [ ] Run `supabase-educator-schema.sql` (classrooms)
- [ ] Run `supabase-subscription-schema.sql` (subscriptions)
- [ ] Test creating a project in `/dashboard`

### Phase 3: Enable AI Generator (5 minutes) - Optional

- [ ] Create OpenAI account
- [ ] Add payment method
- [ ] Generate API key
- [ ] Add `OPENAI_API_KEY` to `.env.local`
- [ ] Restart dev server
- [ ] Test AI generator at `/generator`

### Phase 4: Enable Payments (20 minutes) - Optional

- [ ] Create Stripe account (test mode)
- [ ] Copy publishable and secret keys
- [ ] Create Premium product ($9.99/month)
- [ ] Create Education product ($49.99/month)
- [ ] Copy both price IDs
- [ ] Add 4 Stripe variables to `.env.local`
- [ ] Restart dev server
- [ ] Test checkout at `/pricing`
- [ ] (After deployment) Set up webhook

---

## After Setup

### Restart the development server

```bash
# Stop the current server (Ctrl+C)
# Then restart
pnpm dev
```

Environment variables are loaded when the server starts, so you must restart after changes.

### Verify setup

1. **Check authentication**: Visit http://localhost:3000 and try to sign in
2. **Check database**: Create a project in `/dashboard`
3. **Check AI**: Try generating code in `/generator` (if OpenAI key added)
4. **Check payments**: Visit `/pricing` and click subscribe (if Stripe added)

### Common Issues

**"Missing publishableKey" error:**
- Make sure `.env.local` exists in project root (not in a subfolder)
- Verify variable names are exactly as shown (no typos)
- Restart dev server after adding variables

**"Supabase credentials required" error:**
- Check Supabase URL is complete (https://...)
- Verify anon key is copied correctly (very long string)
- Make sure variable names start with `NEXT_PUBLIC_`

**AI Generator shows "API key not configured":**
- OpenAI key is optional - this is expected without it
- Add `OPENAI_API_KEY` to enable the feature
- Restart server after adding

**Database queries fail:**
- Run the SQL schema files in Supabase SQL Editor
- Check Row Level Security (RLS) policies are created
- Verify user is authenticated (signed in)

---

## Security Best Practices

### ⚠️ DO NOT:
- Commit `.env.local` to git (it's gitignored by default)
- Share your `.env.local` file publicly
- Use production keys in development
- Expose `CLERK_SECRET_KEY` or `STRIPE_SECRET_KEY` to frontend
- Give `SUPABASE_SERVICE_ROLE_KEY` to students (it bypasses all security!)

### ✅ DO:
- Use test keys for development (`pk_test_`, `sk_test_`)
- Switch to live keys only in production
- Rotate keys if compromised
- Set up billing alerts in Stripe and OpenAI
- Use environment variables in Vercel/deployment platform (don't commit them)

---

## Deployment

When deploying to Vercel, Netlify, or other platforms:

1. **DO NOT** commit `.env.local` to your repository
2. **DO** add environment variables in your platform's dashboard:
   - Vercel: Settings → Environment Variables
   - Netlify: Site settings → Environment variables
   
3. **Use production keys** in production environment:
   - Clerk: Switch to production keys from Clerk dashboard
   - Supabase: Use production project (not the same as dev)
   - Stripe: Switch to live mode keys
   - OpenAI: Same key works for dev and prod

4. **Set up webhooks** after deployment:
   - Stripe webhook URL: `https://your-domain.com/api/stripe/webhook`
   - Update `STRIPE_WEBHOOK_SECRET` with production webhook secret

---

## Getting Help

If you're stuck on environment variable setup:

1. **Check the main setup guide**: See `SETUP.md` for detailed instructions
2. **Verify your keys**: 
   - Clerk keys start with `pk_` or `sk_`
   - Supabase URL starts with `https://`
   - OpenAI key starts with `sk-`
   - Stripe keys start with `pk_` or `sk_`
3. **Check the format**: No quotes needed around values, one per line
4. **Restart server**: Environment changes require restart
5. **Check console**: Browser console shows detailed error messages

---

**Last Updated**: 2025-12-28  
**Xylo Version**: 1.0.0 MVP


