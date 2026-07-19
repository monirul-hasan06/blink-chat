# Blink

Blink is a mobile-first, text-only private messaging PWA built with Next.js, TypeScript, Prisma and PostgreSQL.

## Features

- Username and 4–8 digit PIN signup/login
- One-to-one text messaging
- Seen messages deleted 24 hours later
- Delete an entire direct chat for both users
- Block/unblock users; either direction disables direct messages
- Create groups, invite users, accept or decline invites, and leave groups
- Group owner can clear group history
- Online/offline status, last seen and typing indicators
- Web Push notifications
- Custom short “blink” sound while the app is open
- Installable PWA with responsive phone and desktop layouts
- Account deletion with an “Are you sure?” confirmation
- Automatic deletion after one year of inactivity

## Important notification limitation

Web browsers do not provide a standard way for a PWA to select a custom sound for a background system notification. Blink plays `public/sounds/blink.wav` while the app is open and focused. When the app is closed or in the background, the phone or browser uses its normal notification sound.

On iPhone and iPad, install Blink on the Home Screen before enabling push notifications.

## Required environment variables

Create a Neon PostgreSQL project and add these values locally in `.env` and in Vercel Project Settings → Environment Variables:

```env
DATABASE_URL="pooled Neon URL containing -pooler"
DIRECT_URL="direct Neon URL without -pooler"
AUTH_SECRET="first random secret"
CRON_SECRET="second different random secret"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="VAPID public key"
VAPID_PRIVATE_KEY="VAPID private key"
VAPID_SUBJECT="mailto:your-email@example.com"
```

Generate `AUTH_SECRET` and `CRON_SECRET` separately:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate the VAPID pair once:

```bash
npx web-push generate-vapid-keys --json
```

Keep the VAPID private key private. Do not regenerate the pair after users subscribe unless you expect them to enable notifications again.

## Local setup

Use Node.js 22 and npm 10.

```bash
cp .env.example .env
npm ci --ignore-scripts --no-audit --no-fund
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`.

## Vercel deployment

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Add all seven environment variables for Production, Preview and Development.
4. Deploy.

The included build command runs:

```bash
prisma generate && prisma migrate deploy && next build
```

The migration creates the direct-message, group, invitation, block, presence, typing and push-subscription tables.

After deployment, verify:

```text
https://YOUR-DOMAIN.vercel.app/api/health
```

Expected response:

```json
{
  "ok": true,
  "database": "connected",
  "schema": "ready",
  "notificationsConfigured": true
}
```

If `notificationsConfigured` is false, recheck the three VAPID variables and redeploy.

## PWA notification setup for users

1. Log in to Blink.
2. Tap the bell icon.
3. Allow notifications.
4. On iOS/iPadOS, add Blink to the Home Screen first, open the installed app, then tap the bell.

## Message expiry

Direct messages are marked seen when the receiver opens the conversation, then get an expiry time 24 hours later.

Group messages create one receipt for every other member. After all receipt holders have opened the group, the message gets an expiry time 24 hours later.

The Vercel cron route permanently removes expired direct and group messages once per day. Database-provider backups may retain older copies according to the provider’s own backup policy.

## Notes about real-time status

Blink stays Vercel-friendly by using short polling rather than a dedicated WebSocket server:

- Open conversations refresh about every 2.5 seconds.
- Conversation/group lists refresh about every 5 seconds.
- Presence heartbeats run about every 20 seconds.
- Typing status expires automatically after six seconds.
