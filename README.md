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
- Web Push notifications with automatic subscription repair and a built-in test alert
- Custom short “blink” sound while the app is open
- Installable PWA with a Settings installation control, iOS instructions and responsive phone/desktop layouts
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

Blink treats notifications as enabled by default, but browsers still require one explicit permission tap.

1. Log in to Blink.
2. Use the automatic notification setup card, or open **Settings → Notifications**.
3. Tap **Turn on notifications** and allow the browser prompt.
4. Use **Test alert** in Settings to verify the device subscription.
5. On iOS/iPadOS, install Blink from Safari first, open the Home Screen app, then enable notifications.

After permission is granted, Blink automatically recreates missing subscriptions, repairs subscriptions after a VAPID-key deployment change, reattaches the device after login, retries after reconnecting to the internet, and handles `pushsubscriptionchange` in the service worker.

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

Blink uses a responsive mobile-first layout and a web app manifest with `display: standalone`. The login form is placed first on small screens, the page scrolls on short devices and landscape screens, form controls use 16px text to avoid iOS zoom, and dialogs scroll within the visible phone height.

Open **Settings → Install Blink** to install it. On supported Android and desktop browsers, Blink opens the browser installation prompt. On iPhone or iPad, the same Settings card shows the Safari → Share → Add to Home Screen steps. The installed app opens at `/chat` and redirects to login only when there is no valid session.

## Persistent login

Blink stores the login in a secure HTTP-only cookie for up to 400 days and refreshes it whenever an authenticated user opens the app. Closing the browser, closing the installed PWA, restarting the phone, or installing an update does not sign the user out. The user is signed out only when they choose **Sign out**, clear the browser/app data, the cookie is removed by the operating system/browser, or the account is deleted after one year of inactivity.

## Notification delivery behavior

- When Blink is open and focused, the receiver gets an in-app notification banner and the custom `blink.wav` sound.
- When Blink is in the background or closed, the service worker shows a system push notification with the device's enabled notification sound and vibration.
- Push messages are retained by the push service for up to 24 hours when a subscribed device is temporarily offline.
- The app's default preference is notifications on. Browser permission still requires one user tap.
- Granted subscriptions are checked and repaired when Blink opens, becomes visible, reconnects to the internet, or receives a new service-worker controller.
- A `pushsubscriptionchange` handler attempts background renewal, and the foreground app provides a second repair path.
- Settings includes **Test alert** so users can verify delivery without waiting for another account.
- Signing out detaches that device from the account so it does not keep receiving the previous user's messages. Logging in again reattaches an existing browser subscription.


## Replying and deleting messages

On a phone, swipe a message to the right until the reply icon completes, then type and send. A reply preview appears above the composer and inside the new message. A small reply button is also available for mouse and keyboard users.

A user can delete only a message they personally sent. Deleting it removes the message from the database for every participant. Replies to a deleted message remain, but their quoted preview is removed.

## Appearance

Open **Settings → Appearance** to select Light or Dark. The choice is stored in the browser or installed PWA on that device and remains after closing the app.

## Theme and reliability notes

The interface uses semantic color tokens rather than recoloring dark-mode utility classes. Light mode includes dedicated high-contrast text, muted text, accent, group, warning and destructive colors. The login screen also includes a theme toggle, and an existing authenticated session opens `/chat` instead of showing the login form again.

API routes return JSON for handled database and request errors so the client does not try to parse plain server error pages. Leaving a group also removes that user's obsolete read receipts and typing state so old records do not delay message expiry.


## Input focus and small-screen fixes

Text fields no longer use the bright green focus outline. They keep a neutral high-contrast border, preserve keyboard accessibility on buttons, and normalize browser autofill colors. The public login page no longer uses `overflow: hidden`, so it cannot clip the form on short phones.

## PWA cache reliability

`sw.js` and the manifest are served with revalidation headers. The service worker caches only static app assets, never authenticated pages or API responses. This prevents an old login/chat page from being served after a deployment.

## Narrow-phone and notification-icon fix

This revision prevents the public landing-page copy from widening beyond the phone viewport, including on devices that enlarge text. It also adds `public/icons/notification-badge.png`, a transparent monochrome Blink glyph used as the Android notification badge. Android may tint this small status icon according to the system theme; the full-color Blink icon remains the large notification icon.

## Persistent-session Android PWA fix

This release changes the login cookie from `SameSite=Strict` to a rolling, secure `SameSite=Lax` cookie. Installed Android PWAs can be launched by the operating system as an external top-level navigation; a Strict cookie may be omitted on that first request, which previously made Blink appear signed out after it was removed from Recents.

The cookie now lasts for one year and is renewed whenever an authenticated user opens Blink. A client-side recovery check also upgrades valid cookies created by older Blink releases without asking the user to log in again. Removing Blink from Recents, closing the PWA, restarting the phone, or switching apps does not call the logout route.
