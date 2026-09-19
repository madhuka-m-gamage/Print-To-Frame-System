<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/66900443-b6c9-4743-892c-f50b58bf8595

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. For outbound email (enrollment invites, password resets, etc.), also set `SMTP_USER`
   (the sending mailbox, e.g. `info@print2frame.xyz`) and `SMTP_APP_PASSWORD` (a Gmail
   [App Password](https://myaccount.google.com/apppasswords) for that mailbox — not the
   account's normal login password) in `.env.local`. In production these are set as
   Vercel environment variables instead.
4. For admin actions that create or reset a user's Firebase Auth password (enroll
   member, admin password reset), also set `FIREBASE_SERVICE_ACCOUNT_JSON` — the full
   JSON key for a Firebase service account with Auth Admin privileges, as a single-line
   string — in `.env.local`. This is required even in dev, since these actions modify
   real Firebase Auth accounts; there's no way to fake that locally.
5. Run the app:
   `npm run dev`

## Testing

- `npm test` — Vitest unit tests for pure logic (email templates, RBAC permission shape). No setup needed.
- `npm run test:rules` — integration tests against a real local Firebase Emulator, proving `firestore.rules` actually enforces what it claims to (e.g. that a non-admin can't grant themselves Admin via a direct Firestore write). Requires Java (for the emulator) but no real Firebase project or credentials — `firebase-tools` and the emulator config are already checked in.
- `npm run test:all` — both, in sequence.
