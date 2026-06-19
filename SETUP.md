# Xylo Robotics Platform - Complete MVP Setup Guide

This guide will help you set up the complete Xylo MVP with all features:
- 2.5D Robot Simulator
- Drag-and-Drop Robot Builder
- Visual Block Programming + Python
- AI Code Generation
- Curriculum & Learning System
- Educator Dashboard
- Gamification & Challenges
- Premium Subscription Tiers

## Prerequisites

- Node.js 18+ installed
- pnpm package manager
- A Clerk account (free tier works)
- A Supabase account (free tier works)
- An OpenAI API key (optional - for AI Generator)
- A Stripe account (optional - for payments)

## Step 1: Environment Variables

Create a `.env.local` file in the project root:

```env
# Clerk Authentication (REQUIRED)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase Database (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For webhooks

# OpenAI API (OPTIONAL - for AI Code Generator)
OPENAI_API_KEY=sk-your-openai-key-here

# App URL (for production)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Step 2: Clerk Setup (Authentication)

### 2.1 Create Clerk Account & Application

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Choose "Google" as a sign-in method

### 2.2 Get Your Clerk Keys

1. In Clerk Dashboard → API Keys
2. Copy `Publishable key` → paste as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. Copy `Secret key` → paste as `CLERK_SECRET_KEY`

### 2.3 Configure Sign-in/Sign-up URLs

In Clerk Dashboard → Paths:
- Sign-in path: `/sign-in`
- Sign-up path: `/sign-up`
- After sign-in URL: `/learn`
- After sign-up URL: `/learn`

## Step 3: Supabase Setup (Database)

### 3.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for provisioning (2-3 minutes)

### 3.2 Run All Database Schemas

Go to **SQL Editor** in Supabase and run these files in order:

1. **`supabase-schema.sql`** - Core projects table
2. **`supabase-curriculum-schema.sql`** - Courses, lessons, achievements
3. **`supabase-educator-schema.sql`** - Classrooms, enrollments
4. **`supabase-subscription-schema.sql`** - Subscription management

### 3.3 Get Your Credentials

1. Go to **Settings > API** in Supabase Dashboard
2. Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (for webhooks)

## Step 4: Stripe Setup (Optional - Subscriptions)

### 4.1 Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Get API keys from Dashboard → Developers → API keys

### 4.2 Create Products & Prices

In Stripe Dashboard → Products:

1. Create "Premium" product:
   - Price: $9.99/month recurring
   - Copy price ID → `STRIPE_PREMIUM_PRICE_ID`

2. Create "Education" product:
   - Price: $49.99/month recurring
   - Copy price ID → `STRIPE_EDUCATION_PRICE_ID`

### 4.3 Set Up Webhook

1. Go to Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

## Step 5: OpenAI Setup (Optional)

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add to `.env.local` as `OPENAI_API_KEY`

## Step 6: Run the App

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Features Overview

### 1. Robot Simulator (`/simulator`)
- 2.5D physics simulation with Matter.js
- Multiple arenas: Open, Obstacle Course, Maze, Line Following
- Keyboard (WASD) and button controls
- Real-time sensor readings
- Code execution engine for running programs

### 2. Robot Builder (`/builder`)
- Drag-and-drop component library
- Chassis, motors, sensors, arms
- Component properties editor
- Save/export robot designs
- Test in simulator

### 3. Block Editor (`/playground`)
- Visual drag-and-drop Blockly programming
- Dual code view: Arduino C++ & Python
- Custom robotics blocks:
  - Movement (forward, backward, turn)
  - Motors (speed, direction)
  - Sensors (distance, line, color)
  - Timing and logic
- Real-time code generation
- Save projects

### 4. AI Code Generator (`/generator`)
- Natural language to Arduino code
- Streaming GPT-4o-mini responses
- Code enhancement from blocks

### 5. Arduino Flasher (`/flasher`)
- Code editor with syntax highlighting
- Copy to clipboard
- Arduino Web Editor integration
- Web Serial terminal for debugging

### 6. Curriculum System (`/learn`)
- Structured courses by difficulty
- Modules and lessons
- Interactive content
- Video, text, and hands-on activities
- Progress tracking

### 7. Student Profile (`/profile`)
- Learning progress dashboard
- Points and XP tracking
- Achievement badges
- Streak tracking
- Course completion stats

### 8. Educator Dashboard (`/educator`)
- Classroom creation
- Unique join codes for students
- Student roster management
- Progress analytics
- Assignment tracking

### 9. Challenges (`/challenges`)
- Skill-based challenges
- Difficulty levels
- Time trials
- Leaderboard
- Points rewards

### 10. Pricing & Subscriptions (`/pricing`)
- Free, Premium, Education tiers
- Stripe integration
- Feature gating
- Monthly/annual billing

---

## Page Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/learn` | Course catalog |
| `/learn/[courseId]` | Course detail |
| `/learn/[courseId]/lesson/[lessonId]` | Lesson viewer |
| `/builder` | Robot builder |
| `/simulator` | Robot simulator |
| `/playground` | Block editor |
| `/generator` | AI code generator |
| `/flasher` | Arduino flasher |
| `/challenges` | Challenges & leaderboard |
| `/profile` | Student profile |
| `/educator` | Educator dashboard |
| `/educator/[classroomId]` | Classroom detail |
| `/dashboard` | Project dashboard |
| `/pricing` | Pricing page |
| `/sign-in` | Sign in |
| `/sign-up` | Sign up |

---

## Hardware Configuration

Default pin configuration for the Xylo robot:

| Component | Pin(s) |
|-----------|--------|
| Left Motor Enable (PWM) | 5 |
| Left Motor IN1 | 4 |
| Left Motor IN2 | 3 |
| Right Motor Enable (PWM) | 6 |
| Right Motor IN1 | 7 |
| Right Motor IN2 | 8 |
| Ultrasonic TRIG | 9 |
| Ultrasonic ECHO | 10 |
| Line Sensor Left | A0 |
| Line Sensor Center | A1 |
| Line Sensor Right | A2 |
| Serial Baud Rate | 9600 |

To change pin assignments, edit `lib/robot-config/pin-config.ts` (`DEFAULT_PIN_CONFIG`). All generators (Blockly, AI) and the simulator will automatically pick up the change.

---

## Browser Requirements

| Feature | Supported Browsers |
|---------|-------------------|
| All features (simulator, builder, curriculum) | Any modern browser |
| Flash to Arduino + Serial Monitor | Chrome 89+, Edge 89+, Opera 76+ |
| Not supported for hardware | Safari, Firefox (Web Serial API unavailable) |

Note: Safari and Firefox users can still generate code, use the simulator, and copy code to paste into Arduino IDE manually.

---

## Seeding Curriculum Content

After running all database migrations, seed the "Introduction to Robotics" course:

```bash
npx tsx scripts/seed-curriculum.ts
```

**Requirements:**
- `NEXT_PUBLIC_SUPABASE_URL` must be set
- `SUPABASE_SERVICE_ROLE_KEY` must be set (the anon key does not have write access)

The script is **idempotent** — running it twice will not create duplicate courses.

After seeding:
- Navigate to `/learn` → the "Introduction to Robotics" course card appears with 4 modules
- Click any lesson → text content, quizzes, and activity links all render

**To add more courses:** see `docs/curriculum-content-model.md` for the content block schema, then add entries to `scripts/seed-curriculum.ts` or insert directly in Supabase.

---

## Troubleshooting

### "Clerk not configured" error
- Ensure `.env.local` exists with valid Clerk keys
- Restart the dev server after adding keys

### "Supabase not configured" error
- Verify Supabase URL and anon key are correct
- Make sure all schema SQL files have been run

### Sign-in not working
- Check Clerk keys are correct
- Verify Google is enabled in Clerk Dashboard
- Check redirect URLs in Clerk Dashboard → Paths

### Simulator not loading
- Check browser console for errors
- Ensure Matter.js is installed: `pnpm add matter-js`

### Stripe payments not working
- Verify all Stripe keys are set
- Check webhook endpoint is accessible
- Ensure products and prices are created in Stripe

---

## Production Deployment

### Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

### Environment Variables for Production

Required:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Optional:
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`
- `STRIPE_EDUCATION_PRICE_ID`
- `SUPABASE_SERVICE_ROLE_KEY`

### Post-Deployment

1. Update Clerk allowed domains
2. Update Stripe webhook URL
3. Test all features

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI + shadcn/ui
- **Animation**: Framer Motion
- **Auth**: Clerk
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
- **Payments**: Stripe
- **Visual Programming**: Blockly
- **Physics**: Matter.js
- **Package Manager**: pnpm

---

Built with ❤️ for robotics education.
