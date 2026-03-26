# Still Here

**ADHD Body-Doubling PWA** — Virtual co-working sessions for people with ADHD. Focus together, stay accountable, and get things done with body doubling.

## What is Body Doubling?

Body doubling is an ADHD productivity strategy where you work alongside another person. Their presence helps you stay focused and on-task, even if you're working on completely different things. Still Here brings this into the digital world.

## Architecture

This is a **pnpm monorepo** with three packages:

```
still-here/
├── apps/
│   ├── web/          # Next.js 15 frontend (TypeScript, Tailwind CSS)
│   └── api/          # Express backend (TypeScript, Prisma, PostgreSQL)
├── packages/
│   └── shared/       # Shared types, constants, and validators
├── pnpm-workspace.yaml
└── package.json
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand |
| Backend | Express, TypeScript, Prisma ORM, PostgreSQL |
| Real-time | WebSocket (ws) for live chat and session updates |
| Auth | JWT with httpOnly cookies + Bearer tokens |
| Validation | Zod (API), shared validators (client + server) |
| PWA | Web App Manifest for installability |

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **PostgreSQL** >= 14

### Installation

```bash
# Clone the repository
git clone https://github.com/dkennedy1984/still-here.git
cd still-here

# Install dependencies
pnpm install
```

### Environment Setup

```bash
# API environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your database URL and JWT secret

# Web environment
cp apps/web/.env.example apps/web/.env.local
```

### Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (development)
pnpm db:push

# Or run migrations (production)
pnpm db:migrate
```

### Development

```bash
# Start both frontend and API in parallel
pnpm dev

# Or start individually
pnpm dev:web   # Next.js on http://localhost:3000
pnpm dev:api   # Express on http://localhost:4000
```

### Build

```bash
pnpm build
```

## API Endpoints

### Auth
- `POST /api/v1/auth/register` — Create account
- `POST /api/v1/auth/login` — Sign in
- `POST /api/v1/auth/logout` — Sign out
- `GET  /api/v1/auth/me` — Get current user

### Sessions
- `GET  /api/v1/sessions` — List public sessions (paginated, filterable by tag/status)
- `GET  /api/v1/sessions/:id` — Get session details
- `POST /api/v1/sessions` — Create session (auth required)
- `POST /api/v1/sessions/:id/join` — Join session (auth required)
- `POST /api/v1/sessions/:id/leave` — Leave session (auth required)
- `POST /api/v1/sessions/:id/check-in` — Submit mood/energy check-in (auth required)

### Users
- `GET    /api/v1/users/:id/profile` — Get user profile
- `GET    /api/v1/users/me/stats` — Get your focus stats (auth required)
- `PATCH  /api/v1/users/me` — Update your profile (auth required)

### WebSocket

Connect to `ws://localhost:4000/ws?token=YOUR_JWT`

**Client Events:**
- `join_session` — Join a session room
- `leave_session` — Leave a session room
- `send_message` — Send chat message
- `update_task` — Update your current task
- `toggle_focus` — Toggle focus mode
- `send_encouragement` — Send encouragement to another participant

**Server Events:**
- `session_update` — Session state changed
- `participant_joined` / `participant_left` — Participant changes
- `participant_update` — Task or status update
- `chat_message` — New chat message
- `encouragement` — Encouragement received
- `focus_block_start` / `focus_block_end` — Focus timer events

## Features

- **Browse & Join Sessions** — Find public co-working sessions with tag filters
- **Create Sessions** — Host your own with custom focus/break durations
- **Real-time Chat** — Lightweight chat without video/audio
- **Encouragement System** — Send "you've got this" nudges to others
- **Mood Check-ins** — Track your energy and intentions
- **Focus Stats** — See your streaks and total focus time
- **PWA Ready** — Installable on mobile and desktop

## Project Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm clean` | Remove all node_modules and build artifacts |

## License

MIT
