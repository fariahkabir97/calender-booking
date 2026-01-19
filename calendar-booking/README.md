# CalBook - Calendar Booking System

A full-featured calendar availability and booking system built with Next.js, Prisma, and Google Calendar API. Similar to Calendly, this application allows you to connect multiple Google Calendars, compute composite availability, and let external users book meetings with you.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CALBOOK ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Booker     │     │    Admin     │     │   Google     │                │
│  │  (Public)    │     │  Dashboard   │     │  Calendar    │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │                    Next.js App Router                    │               │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │               │
│  │  │  Booking    │  │    Admin    │  │    API      │     │               │
│  │  │   Pages     │  │    Pages    │  │   Routes    │     │               │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │               │
│  └─────────────────────────────────────────────────────────┘               │
│                              │                                              │
│         ┌────────────────────┼────────────────────┐                        │
│         ▼                    ▼                    ▼                        │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│  │ Availability │     │   Booking   │     │   Google    │                  │
│  │  Algorithm   │     │   Service   │     │  Calendar   │                  │
│  │              │     │             │     │   Service   │                  │
│  └──────┬───────┘     └──────┬──────┘     └──────┬──────┘                  │
│         │                    │                   │                          │
│         └─────────┬──────────┴───────────────────┘                         │
│                   ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │              PostgreSQL Database (Prisma)                │               │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐       │               │
│  │  │ Users  │ │Calendars│ │EventTypes│ │Bookings │       │               │
│  │  └────────┘ └────────┘ └──────────┘ └─────────┘       │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-Calendar Support**: Connect multiple Google accounts and calendars
- **Composite Availability**: Availability calculated across ALL selected calendars
- **Smart Scheduling**: Working hours, buffers, minimum notice, scheduling windows
- **Double-Booking Prevention**: Database-level constraints + idempotency keys
- **Google Meet Integration**: Auto-generate meeting links
- **Email Notifications**: Confirmation emails with ICS attachments
- **Timezone Handling**: Full DST-aware timezone support
- **Rate Limiting**: Protection against abuse on public endpoints

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **Calendar API**: Google Calendar API
- **Email**: Resend
- **UI**: Tailwind CSS + Radix UI

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Google Cloud Console account
- Resend account (for emails)

### 1. Clone and Install

```bash
cd calendar-booking
npm install
```

### 2. Set Up Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Calendar API
   - Google People API (optional, for user info)

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://your-domain.com` (production)
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (NextAuth)
     - `http://localhost:3000/api/google/callback` (Calendar OAuth)
     - `https://your-domain.com/api/auth/callback/google` (production)
     - `https://your-domain.com/api/google/callback` (production)

5. Configure OAuth Consent Screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Fill in app information
   - Add scopes:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.freebusy`
     - `openid`
     - `email`
     - `profile`
   - Add test users during development

### 3. Set Up Resend

1. Create account at [Resend](https://resend.com)
2. Add and verify your domain
3. Create an API key

### 4. Configure Environment Variables

Copy `.env` and update with your values:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/calendar_booking"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth (for admin login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Google Calendar API (same as above or separate)
GOOGLE_CALENDAR_CLIENT_ID="your-google-client-id"
GOOGLE_CALENDAR_CLIENT_SECRET="your-google-client-secret"

# Token Encryption (generate with: openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY="your-64-char-hex-string"

# Email (Resend)
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="Calendar Booking <bookings@yourdomain.com>"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 5. Set Up Database

```bash
# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### 6. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

## Database Schema

### Core Models

- **User**: Admin users who manage calendars and event types
- **ConnectedAccount**: OAuth tokens for Google Calendar access (encrypted)
- **Calendar**: Google calendars synced from connected accounts
- **EventType**: Booking link configurations (duration, buffers, working hours)
- **Booking**: Individual booking records with attendee info

### Key Relationships

```
User
├── ConnectedAccount[] (Google accounts)
│   └── Calendar[] (calendars from each account)
├── EventType[] (booking links)
│   └── EventTypeCalendar[] (which calendars to use)
└── Booking[] (all bookings)
```

## API Routes

### Public Endpoints

- `GET /api/availability` - Get available slots for an event type
- `POST /api/bookings` - Create a new booking
- `GET /api/bookings/[uid]` - Get booking details
- `DELETE /api/bookings/[uid]` - Cancel a booking

### Admin Endpoints (Authenticated)

- `GET/POST /api/calendars` - List/update calendar selection
- `PUT /api/calendars` - Sync calendars from Google
- `GET/POST /api/event-types` - List/create event types
- `GET/PUT/DELETE /api/event-types/[id]` - Manage event type
- `GET /api/bookings` - List bookings

### OAuth Endpoints

- `GET /api/google/connect` - Initiate Google Calendar OAuth
- `GET /api/google/callback` - OAuth callback handler

## Availability Algorithm

1. **Generate Candidate Slots**:
   - For each day in the requested range
   - Within working hours for that day of week
   - At configured slot intervals

2. **Fetch Busy Times**:
   - Query Google Calendar FreeBusy API for all selected calendars
   - Include existing bookings from database

3. **Filter Available Slots**:
   - Remove slots that overlap with busy times
   - Apply buffers before/after
   - Check minimum notice requirement
   - Check scheduling window

4. **Merge Busy Blocks**:
   - Combine overlapping busy blocks for efficiency
   - A slot is only available if FREE on ALL calendars

## Anti-Double-Booking Strategy

1. **Database Constraints**:
   - Unique index on `[userId, startTime, endTime, eventTypeId]`
   - First-write-wins semantics

2. **Idempotency Keys**:
   - Each booking request can include an idempotency key
   - Duplicate requests return the same booking

3. **Server-Side Validation**:
   - Re-check availability before creating booking
   - Transaction-based creation

## Testing

```bash
# Run tests
npm test

# Run tests once
npm run test:run
```

Tests cover:
- Availability algorithm (slot generation, busy block merging)
- Booking validation and double-booking prevention
- Timezone handling

## Deployment

### Vercel

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

### Database Options

- **Vercel Postgres**: Built-in PostgreSQL
- **Supabase**: Free tier available
- **PlanetScale**: MySQL-compatible
- **Railway**: Easy PostgreSQL hosting

## Edge Cases Handled

- **DST Transitions**: Uses date-fns-tz for proper timezone handling
- **All-Day Events**: Treated as busy (configurable)
- **Recurring Events**: FreeBusy API handles expansion
- **Token Refresh**: Automatic token refresh with error handling
- **Rate Limiting**: In-memory rate limiter (use Redis in production)
- **Calendar Permission Changes**: Graceful handling of revoked access

## Security Considerations

- OAuth tokens encrypted at rest (AES-256-GCM)
- CSRF protection via NextAuth
- Rate limiting on public endpoints
- Bookers never see event details, only availability
- Secure secret management via environment variables

## Project Structure

```
calendar-booking/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── admin/             # Admin dashboard pages
│   │   ├── api/               # API routes
│   │   ├── book/              # Public booking pages
│   │   ├── booking/           # Booking management pages
│   │   ├── login/             # Authentication page
│   │   └── page.tsx           # Landing page
│   ├── components/
│   │   ├── booking/           # Booking-specific components
│   │   └── ui/                # Reusable UI components
│   ├── lib/
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── availability.ts    # Availability algorithm
│   │   ├── email.ts           # Email service
│   │   ├── encryption.ts      # Token encryption
│   │   ├── google-calendar.ts # Google Calendar API
│   │   ├── prisma.ts          # Prisma client
│   │   ├── rate-limit.ts      # Rate limiting
│   │   ├── utils.ts           # Utility functions
│   │   └── validations.ts     # Zod schemas
│   ├── types/
│   │   └── index.ts           # Type definitions
│   └── __tests__/             # Test files
├── .env                       # Environment variables
└── README.md
```

## License

MIT
