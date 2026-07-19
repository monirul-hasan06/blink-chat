# Blink

Blink is a small, mobile-first, text-only private messaging app.

## Important first deployment fix

The database schema must exist before account creation can work. This version includes an initial Prisma migration and runs it during the Vercel build.

### Required Vercel environment variables

Create a Neon project, open **Connect**, and copy both connection strings:

- `DATABASE_URL`: pooled URL; its hostname contains `-pooler`
- `DIRECT_URL`: direct URL; its hostname does not contain `-pooler`
- `AUTH_SECRET`: first random 64-character hexadecimal value
- `CRON_SECRET`: second, different random 64-character hexadecimal value

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add all four variables in Vercel for Production, Preview, and Development. Do not include quotation marks in the Vercel form. Redeploy after adding or changing variables.

The build command is:

```bash
prisma generate && prisma migrate deploy && next build
```

The initial migration creates the `User` and `Message` tables automatically.

### Verify the deployed database

After deployment, open:

```text
https://YOUR-DOMAIN.vercel.app/api/health
```

A correct setup returns:

```json
{"ok":true,"database":"connected","schema":"ready"}
```

If `schema` is `missing`, inspect the Vercel build log for `prisma migrate deploy`. If the endpoint returns status 503, recheck the Neon URLs and redeploy.

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

## Local setup

1. Install Node.js 22.
2. Copy `.env.example` to `.env`.
3. Fill all four values.
4. Install dependencies:

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

5. Generate Prisma Client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

6. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy to GitHub and Vercel

```bash
git init
git add .
git commit -m "Initial Blink app"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Import the repository into Vercel, add the four environment variables, and deploy. The included `vercel.json` uses a clean npm installation and runs cleanup once each day.

## Message deletion behavior

A received message is marked as seen when the recipient opens that conversation. At that moment, `expiresAt` is set to 24 hours later. The daily cleanup route permanently deletes expired message rows from the active database.

Database providers may retain backups according to their own backup policy.
