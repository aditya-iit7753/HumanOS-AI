# HumanOS AI Sellable SaaS Launch Checklist

Use this before selling, transferring, or launching HumanOS AI publicly.

## Buyer-ready status

- Frontend: Next.js 15, TypeScript, Tailwind, responsive SaaS UI, legal pages, pricing page, protected app routes.
- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL, Qdrant, OpenAI integration, billing foundation, Clerk auth verification.
- Deployment: Vercel frontend, Railway backend, Railway PostgreSQL, Qdrant Cloud or Railway Qdrant, Docker Compose local setup.
- Sales assets: pitch deck, proposal PDF, handover PDF, feature list PDF, demo script, live demo URL.

## Replace before public buyer/customer launch

- OpenAI production API key and billing.
- Clerk production instance, publishable key, secret key, issuer, JWKS URL, and redirect URLs.
- Railway/Vercel production environment variables.
- PostgreSQL production database and backup policy.
- Qdrant production cluster and API key.
- Payment provider keys, products, prices, webhooks, tax settings, and billing portal.
- Domain, logo, support email, company name, legal address, and brand copy.
- Privacy Policy, Terms, Refund Policy, Security Overview, and any regional compliance language.

## Acceptance tests

- Landing page loads on desktop and mobile.
- Signup, login, logout, protected redirect, and profile page work.
- Dashboard loads after auth and syncs user profile to PostgreSQL.
- AI chat returns a real OpenAI answer and saves conversations/messages.
- Memory extraction/retrieval works or degrades gracefully if Qdrant/OpenAI embeddings are unavailable.
- Tasks, goals, planner, career copilot, document copilot, and agents save data.
- Pricing checkout starts for paid plans after payment provider keys are configured.
- Webhook updates the local subscription table after a successful subscription.
- CORS allows the final production frontend domain and blocks unknown origins.

## Recommended sale terms

- Sell the codebase and deployment handover, not your personal API accounts.
- Collect 30%-50% advance before private repository transfer.
- Include 3-7 days of setup support, then quote extra work separately.
- Use a written agreement covering ownership/license, payment, support, confidentiality, and exclusions.
