# Blink

Blink is a small, mobile-first, text-only private messaging app.

## Included features

- Account creation with only a username and 4–8 digit PIN
- Login with username and PIN
- Username search
- One-to-one text messaging
- Incoming messages are marked as seen when their conversation is opened
- Seen messages expire 24 hours later
- Accounts are deleted after one year without activity
- Installable PWA for phones and desktops
- Responsive mobile and desktop interface
- Secure HTTP-only session cookie
- Hashed PINs using bcrypt

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Vercel Cron

## Run locally

1. Install Node.js 20 or newer.
2. Open the project in VS Code.
3. Install dependencies:

```bash
npm install
```

4. Copy the environment file:

```bash
cp .env.example .env
```

5. Add a PostgreSQL connection string. Neon and Supabase both work.
6. Generate strong secrets:

```bash
openssl rand -base64 32
```

Use separate generated values for `AUTH_SECRET` and `CRON_SECRET`.

7. Create the database tables:

```bash
npm run db:push
```

8. Start development:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy to GitHub and Vercel

1. Create a new empty GitHub repository.
2. From this project folder run:

```bash
git init
git add .
git commit -m "Initial Blink app"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

3. Import the GitHub repository into Vercel.
4. Add these environment variables in Vercel:

- `DATABASE_URL`
- `AUTH_SECRET`
- `CRON_SECRET`

5. Before the first deployment, run `npm run db:push` locally with the production database URL, or use a Prisma migration workflow.
6. Deploy. The included `vercel.json` runs cleanup once each day.

## Message deletion behavior

A received message is marked as seen when the recipient opens that conversation. At that moment, `expiresAt` is set to 24 hours later. The daily cleanup route permanently deletes expired message rows from the active database.

Database providers may retain backups according to their own backup policy. Review and configure your provider's retention settings before making strict privacy claims.

## Before a public launch

This is intentionally a small project. For a public service with many users, add distributed rate limiting, abuse reporting, account recovery rules, monitoring, database migrations, and automated tests.
