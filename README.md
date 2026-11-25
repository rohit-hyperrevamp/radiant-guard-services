# Radiant Portal

HR, payroll, attendance, invoicing, CRM and recruitment portal for Radiant Guard Services.

**Live app**: https://radiant.hyperrevamp.com

## Stack

- TanStack Start (React 19, SSR) built with Vite, deployed on **Vercel** (Nitro `vercel` preset)
- **Supabase** (project `yimpxawqoarprhtxapie`) for database, auth and storage
- Capacitor iOS/Android shells that load the hosted app (`capacitor.config.ts`)

## Deployment

Pushing to `main` on GitHub deploys to Production on Vercel automatically; other branches get Preview deployments.

Secrets (Supabase service role, MSG91, Gemini, Resend, Firebase, APNs) live in
Vercel → Project → Settings → Environment Variables. Never commit `.env` files.

## Development

Requires Node.js and [Bun](https://bun.sh) (Vercel installs with Bun and `bun.lock`).

```sh
bun install
bun run dev      # http://localhost:8080
bun run build
```

Server-only features (OTP, push, sheet reading, privileged lookups) need the same
environment variables as Vercel in your shell, e.g.
`vercel env pull .env.local && set -a && source .env.local && set +a` before `bun run dev`.
