# Chai Break — Women’s Day Campaign

Mobile-first campaign website with:

- Details page (name + phone)
- OTP verification (Firebase Phone Auth)
- Spin wheel (4 items, equal probability)
- Immediate redemption (stored in Firestore)
- Campaign auto-end: 8 Mar 2026 00:01 AM IST

## Local development

Install deps:

```bash
pnpm install
```

Start dev server:

```bash
pnpm dev
```

## Assets

Place these files in `public/`:

- `public/chai-break-logo.png`
- `public/womens-day.png`
- `public/header-bg.png`

## Firebase (can be configured later)

This app boots even without Firebase configured and will show a "Setup required" screen.

When ready:

1. Create a Firebase project
2. Enable Authentication -> Phone
3. Create Firestore database
4. Copy `.env.example` to `.env.local` and fill values:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Then restart `pnpm dev`.

## Deploy to Vercel

1. Push this folder to a Git repo
2. In Vercel: New Project -> Import the repo
3. Framework preset: Vite
4. Build command: `pnpm build`
5. Output directory: `dist`

When you later add Firebase:

- Add the same `VITE_FIREBASE_*` values as Vercel Environment Variables
- Add your Vercel domain to Firebase Authentication -> Authorized domains
