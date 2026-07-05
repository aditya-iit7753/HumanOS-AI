# HumanOS AI

HumanOS AI is a full-stack personal AI operating system for life, study, career, documents, goals, agents, memory, and productivity. It includes a Next.js 15 frontend, FastAPI backend, PostgreSQL persistence, Clerk authentication, OpenAI integration, Qdrant vector search, Docker local development, and deployment configuration for Vercel and Railway.

## Stack

- Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn-style UI primitives
- FastAPI, SQLAlchemy 2, Pydantic, Alembic-ready schema
- PostgreSQL for app data
- Qdrant for long-term memory and document embeddings
- OpenAI for chat, agents, memory extraction, planning, research, study, career, and document intelligence
- Clerk for hosted authentication
- Stripe for checkout, subscriptions, billing portal, webhooks, and plan enforcement
- Docker Compose for one-command local startup
- Vercel frontend configuration and Railway backend configuration

## Product Modules

- SaaS landing page and pricing UI
- Clerk signup, login, logout, protected routes, profile sync
- Main dashboard with live summaries
- AI Chat with streaming responses and conversation history
- Long-term memory with Qdrant retrieval and editable memories
- Tasks with priorities, due dates, goal links, completion, and AI suggestions
- Goals with milestones, roadmap generation, progress tracking, and task conversion
- Career Copilot with resume builder, ATS scoring, skill gap analysis, role recommendations, interviews, projects, and roadmap generation
- Document Copilot for PDF, DOCX, and TXT upload, extraction, summary, Q&A, notes, action items, and Qdrant embeddings
- AI Daily Planner with time-blocked schedules, morning plan, evening review, and productivity score
- Agents: Career, Study, Research, Productivity, and Document agents with saved outputs
- Settings with profile, AI preferences, memory toggle, theme, billing portal, data export, local account deletion, and development API key configuration

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker Desktop, recommended for local PostgreSQL and Qdrant
- Clerk application
- OpenAI API key for real AI responses

## Environment Setup

Copy the example files:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Set these values for local development:

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# apps/api/.env
DATABASE_URL=postgresql+psycopg://humanos:humanos_dev_password@localhost:5432/humanos
OPENAI_API_KEY=sk-...
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-clerk-domain.clerk.accounts.dev
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=humanos_memories
QDRANT_DOCUMENT_COLLECTION=humanos_documents
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
```

## One-Command Local Startup

The full local stack runs with Docker Compose:

```bash
docker compose up --build
```

This starts four services:

- `frontend`: Next.js on http://localhost:3000
- `backend`: FastAPI on http://localhost:8000
- `postgres`: PostgreSQL + pgvector on `localhost:5432`
- `qdrant`: vector search on http://localhost:6333

Equivalent npm shortcut from the repo root:

```bash
npm run dev
```

Stop the stack:

```bash
docker compose down
```

## Local Development Without Docker

Install frontend dependencies:

```bash
cd apps/web
npm install
npm run dev
```

Install backend dependencies:

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

From the repository root, the same commands are available as scripts:

```bash
npm run web:install
npm run web:dev
npm run api:install
npm run api:dev
```

For non-Docker backend development, run PostgreSQL and Qdrant locally first. Use these local URLs in `apps/api/.env`:

```bash
DATABASE_URL=postgresql+psycopg://humanos:humanos_dev_password@localhost:5432/humanos
QDRANT_URL=http://localhost:6333
```


## Useful Commands

```bash
# Frontend
cd apps/web
npm run typecheck
npm run build

# Backend
cd ../..
python -m compileall apps/api/app apps/api/alembic

# Docker config validation
docker compose config --quiet
```

## Database

The backend creates missing tables and compatibility columns at startup for local development. The initial SQL and Alembic-style schema live in:

- `infra/postgres/schema.sql`
- `infra/postgres/init.sql`
- `apps/api/alembic/versions/0001_initial_humanos_schema.py`

Core tables include users, settings, conversations, messages, memories, tasks, goals, milestones, documents, job matches, resume versions, agents, daily plans, and career profiles.

## Clerk Authentication Flow

1. User signs up or signs in through Clerk.
2. Next.js middleware protects `/dashboard`, `/chat`, `/memory`, `/tasks`, `/goals`, `/career`, `/documents`, `/planner`, `/agents`, `/settings`, and `/profile`.
3. `AuthSync` sends the Clerk session token to `POST /auth/clerk/sync`.
4. FastAPI verifies the token through Clerk JWKS and upserts the local PostgreSQL user.
5. Frontend API calls pass the Clerk bearer token to protected backend endpoints.

## Payments and Subscription Enforcement

HumanOS AI includes Stripe subscription plumbing:

- Pricing buttons create Stripe Checkout sessions through `POST /billing/checkout`.
- Stripe webhooks update the local `subscriptions` table through `POST /billing/webhook`.
- Settings includes a billing portal action through `POST /billing/portal`.
- Backend limits are enforced for chat messages, memories, document uploads, agents, and Career Copilot access.

Plans and enforced limits:

| Plan | Chat | Memory | Documents | Agents | Career Copilot |
| --- | --- | --- | --- | --- | --- |
| Free | 50 messages | 25 memories | 3 uploads | Study + Research | Basic only |
| Pro | 1,000 messages | 500 memories | 50 uploads | All standard agents | Full access |
| Premium | Unlimited fair use | Unlimited | 250 uploads | All agents | Advanced access |
| Enterprise | Custom | Custom | Custom | Custom | Custom |

Required backend Stripe variables:

```bash
APP_URL=https://your-vercel-domain.vercel.app
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

Stripe webhook events to enable:

```bash
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

## OpenAI and Qdrant

- OpenAI powers chat, agents, memory extraction, study plans, research briefs, productivity analysis, career tools, document summaries, and embeddings.
- Qdrant stores memory vectors and document chunk embeddings.
- If `OPENAI_API_KEY` is not configured, backend AI helpers return deterministic local fallback responses so the UI remains testable.

## Deployment

HumanOS AI is split into deployable services:

- Frontend: Vercel, serving `apps/web`
- Backend: Railway, serving `apps/api`
- Database: Railway PostgreSQL
- Vector DB: Qdrant Cloud, or a separate Railway Docker service from `infra/qdrant`

### Production Build Commands

Frontend on Vercel:

```bash
cd apps/web
npm ci
npm run build
```

Backend on Railway:

```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Local production-style frontend container:

```bash
docker compose up -d frontend
```

### Vercel Frontend

Recommended setup:

1. Import the repository into Vercel.
2. Either keep the project root at the repository root and use `vercel.json`, or set the root directory to `apps/web` and use `apps/web/vercel.json`.
3. Set these Vercel environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_TELEMETRY_DISABLED=1
```

Vercel build settings if entered manually:

```bash
Install Command: cd apps/web && npm ci
Build Command: cd apps/web && npm run build
Output Directory: apps/web/.next
```

If the Vercel project root is `apps/web`, use:

```bash
Install Command: npm ci
Build Command: npm run build
Output Directory: .next
```

### Railway Backend

Recommended setup:

1. Create a Railway project.
2. Add a PostgreSQL service.
3. Add a backend service from this repository.
4. Use `railway.json` from the repository root, or `apps/api/railway.json` if the service root is `apps/api`.
5. Set these Railway backend variables:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
OPENAI_API_KEY=sk-...
JWT_SECRET=generate-a-long-random-secret
CORS_ORIGINS=https://your-vercel-domain.vercel.app
CORS_ORIGIN_REGEX=https://.*\\.vercel\\.app
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-clerk-domain.clerk.accounts.dev
CLERK_JWT_AUDIENCE=
QDRANT_URL=https://your-qdrant-endpoint
QDRANT_API_KEY=your-qdrant-api-key-if-required
QDRANT_COLLECTION=humanos_memories
QDRANT_DOCUMENT_COLLECTION=humanos_documents
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
```

Railway backend start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Health check path:

```bash
/health
```

### Railway PostgreSQL

Use Railway's PostgreSQL plugin and pass its `DATABASE_URL` into the backend service. The backend creates missing tables and compatibility columns at startup.

For Railway PostgreSQL, the URL usually starts with `postgresql://`. SQLAlchemy with psycopg accepts this, but `postgresql+psycopg://` is also supported. If needed, convert only the scheme:

```bash
postgresql+psycopg://USER:PASSWORD@HOST:PORT/DB
```

### Qdrant

Option A, recommended: Qdrant Cloud

```bash
QDRANT_URL=https://your-cluster-url
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_COLLECTION=humanos_memories
QDRANT_DOCUMENT_COLLECTION=humanos_documents
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
```

Option B: Railway Docker service

1. Create a separate Railway service from this repository.
2. Use `infra/qdrant/railway.json` or set the Dockerfile path to `infra/qdrant/Dockerfile`.
3. Expose port `6333`.
4. Set the backend `QDRANT_URL` to the Railway Qdrant service URL.

### Clerk Production URLs

In the Clerk dashboard, configure these URLs:

```bash
Application home URL: https://your-vercel-domain.vercel.app
Sign-in URL: https://your-vercel-domain.vercel.app/sign-in
Sign-up URL: https://your-vercel-domain.vercel.app/sign-up
After sign-in URL: https://your-vercel-domain.vercel.app/dashboard
After sign-up URL: https://your-vercel-domain.vercel.app/dashboard
Allowed redirect origins: https://your-vercel-domain.vercel.app, http://localhost:3000
```

Backend Clerk token verification needs:

```bash
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-clerk-domain.clerk.accounts.dev
```

For Clerk production instances, use the live Clerk domain shown in your Clerk dashboard.

### CORS

For one production frontend domain, use:

```bash
CORS_ORIGINS=https://your-vercel-domain.vercel.app
CORS_ORIGIN_REGEX=
```

For Vercel preview deployments, also set:

```bash
CORS_ORIGIN_REGEX=https://.*\\.vercel\\.app
```

Keep local origins only in local development:

```bash
CORS_ORIGINS=http://localhost:3000,http://0.0.0.0:3000
```

### Environment Variable Reference

Frontend variables:

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Production recommended | Public frontend URL, for docs and auth configuration. |
| `NEXT_PUBLIC_API_URL` | Yes | Public Railway backend URL. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key. |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key used by Clerk server helpers. |
| `NEXT_TELEMETRY_DISABLED` | No | Set to `1` to disable Next telemetry. |

Backend variables:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Railway PostgreSQL connection string. |
| `OPENAI_API_KEY` | Production recommended | Enables real AI responses and embeddings. |
| `JWT_SECRET` | Yes | Long random secret for legacy/local JWT auth. |
| `CORS_ORIGINS` | Yes | Comma-separated allowed frontend origins. |
| `CORS_ORIGIN_REGEX` | No | Regex for preview origins, for example Vercel previews. |
| `CLERK_JWKS_URL` | Yes | Clerk JWKS endpoint for backend token verification. |
| `CLERK_ISSUER` | Yes | Clerk issuer URL. |
| `CLERK_JWT_AUDIENCE` | No | Only set if your Clerk JWT template uses an audience. |
| `QDRANT_URL` | Yes | Qdrant Cloud or Railway Qdrant URL. |
| `QDRANT_API_KEY` | No | Required for Qdrant Cloud/private Qdrant. |
| `QDRANT_COLLECTION` | Yes | Memory vector collection name. |
| `QDRANT_DOCUMENT_COLLECTION` | Yes | Document vector collection name. |
| `APP_URL` | Yes | Public frontend URL used for checkout success/cancel and billing portal return URLs. |
| `STRIPE_SECRET_KEY` | Yes for payments | Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | Yes for payments | Stripe webhook signing secret. |
| `STRIPE_PRICE_PRO` | Yes for Pro checkout | Stripe recurring price ID for Pro. |
| `STRIPE_PRICE_PREMIUM` | Yes for Premium checkout | Stripe recurring price ID for Premium. |
| `STRIPE_PRICE_ENTERPRISE` | Optional | Stripe price ID if Enterprise uses checkout instead of sales contact. |
## Security Notes

- Do not commit real `.env` secrets.
- Settings API masks stored development API keys when returning them to the frontend.
- Production API keys should be configured as deployment environment variables, not entered into the UI.
- `/settings/account` deletes the local HumanOS user and cascaded app data. Clerk account deletion should be handled from Clerk user profile controls.

## Troubleshooting

- If authenticated API calls fail, verify Clerk issuer/JWKS values and that frontend `NEXT_PUBLIC_API_URL` points to the FastAPI server.
- If memory or document search is empty, verify Qdrant is running and `OPENAI_API_KEY` is configured for embeddings.
- If `npm run typecheck` reports missing `.next/types`, run `npm run build` once, then rerun typecheck.
- If Docker ports are busy, stop existing services on ports `3000`, `8000`, `5432`, or `6333`, or adjust `docker-compose.yml`.
- If Docker says `dockerDesktopLinuxEngine` cannot be found on Windows, start Docker Desktop and wait until the Linux engine is running, then rerun `docker compose up --build`.

## Commercial Sale Readiness

HumanOS AI now includes buyer-facing sales assets in `sales-kit/` and generated PDFs in `output/pdf/`.

Before selling or launching publicly, replace all test/demo credentials with buyer-owned production accounts for OpenAI, Clerk, PostgreSQL, Qdrant, Vercel, Railway, payment provider, domain, and branding. Review `/privacy`, `/terms`, `/refund`, and `/security` with qualified legal counsel before accepting real customers.

Recommended buyer handover: live demo, source repository transfer, environment variable setup, database/vector database provisioning, payment webhook setup, acceptance tests, and 3-7 days of setup support.
