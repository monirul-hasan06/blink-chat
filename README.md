# Blink

Blink is a mobile-first, text-only private messaging PWA built with Next.js, TypeScript, Prisma and PostgreSQL.

## Features

- Username and 4–8 digit PIN signup/login
- One-to-one text messaging
- Light and dark themes saved per device
- Swipe right on any message to reply with a quoted preview
- Delete an individual message you sent for everyone
- Seen messages deleted 24 hours later
- Delete an entire direct chat for both users
- Block/unblock users; either direction disables direct messages
- Create groups, invite users, accept or decline invites, and leave groups
- Group owner can clear group history, remove members and permanently delete the group
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

The migrations create the direct-message, group, invitation, block, presence, typing and push-subscription tables, then add reply references for direct and group messages.

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


## Mobile app behavior

Blink uses a responsive mobile-first layout and a web app manifest with `display: standalone`. After deployment over HTTPS, supported browsers can install it on a phone and launch it from the home screen without the normal browser chrome. Android browsers usually show an install prompt; on iPhone or iPad use Safari → Share → Add to Home Screen. Push notifications still require the user to allow notification permission, and iOS requires the installed Home Screen app.

## Persistent login

Blink stores the login in a secure HTTP-only cookie for up to 400 days and refreshes it whenever an authenticated user opens the app. Closing the browser, closing the installed PWA, restarting the phone, or installing an update does not sign the user out. The user is signed out only when they choose **Sign out**, clear the browser/app data, the cookie is removed by the operating system/browser, or the account is deleted after one year of inactivity.

## Notification delivery behavior

- When Blink is open and focused, the receiver gets an in-app notification banner and the custom `blink.wav` sound.
- When Blink is in the background or closed, the service worker shows a system push notification with the device's enabled notification sound and vibration.
- Push messages are retained by the push service for up to 24 hours when a subscribed device is temporarily offline.
- Each user must tap the bell and grant permission once on each device.
- Signing out detaches that device from the account so it does not keep receiving the previous user's messages. Logging in again automatically reattaches an existing browser subscription.


## Replying and deleting messages

On a phone, swipe a message to the right until the reply icon completes, then type and send. A reply preview appears above the composer and inside the new message. A small reply button is also available for mouse and keyboard users.

A user can delete only a message they personally sent. Deleting it removes the message from the database for every participant. Replies to a deleted message remain, but their quoted preview is removed.

## Appearance

Open **Settings → Appearance** to select Light or Dark. The choice is stored in the browser or installed PWA on that device and remains after closing the app.
