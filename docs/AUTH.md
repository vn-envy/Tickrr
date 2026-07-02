# Auth + per-user watchlist sync (Firebase)

Tickrr's sign-in is **Google Auth via Firebase**, with each user's watchlist synced to a per-user
**Firestore** doc (`users/{uid}.favorites`). It's **graceful**: with no config the app runs in
local mode (watchlist on-device, no sign-in button) — exactly as it does today. Add the config
below and it lights up.

## One-time setup (~5 min)

Everything is on the **same project** you already deployed (`tickrr-20260701-17076`).

### 1. Enable Firebase + Google sign-in
1. Open **[console.firebase.google.com](https://console.firebase.google.com)** → **Add project** →
   **select your existing GCP project** `tickrr-20260701-17076` (don't create a new one).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain** →
   `tickrr-web-qqocdd33ra-uc.a.run.app` (and `localhost` is already allowed for dev).

### 2. Create a Web App to get the config
1. Firebase console → **Project settings (gear) → General → Your apps → Web (`</>`)** → register
   an app (nickname "Tickrr web").
2. Copy the `firebaseConfig` values — you need `apiKey`, `authDomain`, `projectId`, `appId`,
   `messagingSenderId`.

### 3. Firestore security rules (client access)
Firestore → **Rules** → publish:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each user owns their watchlist doc.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Growth drafts are written by the server (Admin SDK, bypasses rules). Deny client access.
    match /growth_drafts/{doc} { allow read, write: if false; }
  }
}
```
(The server's growth engine uses the Admin SDK via the service account, which bypasses these
rules — so this only governs browser access.)

### 4. Deploy with the config
The Firebase web keys are **build-time** (`VITE_*`) and are **not secret** (they're public client
config). Redeploy the web service with them set:
```bash
gcloud run deploy tickrr-web --source web --region us-central1 --project tickrr-20260701-17076 \
  --update-env-vars "VITE_FIREBASE_API_KEY=AIza...,VITE_FIREBASE_AUTH_DOMAIN=tickrr-20260701-17076.firebaseapp.com,VITE_FIREBASE_PROJECT_ID=tickrr-20260701-17076,VITE_FIREBASE_APP_ID=1:....:web:....,VITE_FIREBASE_MESSAGING_SENDER_ID=..."
```
(Or push a commit — CI/CD will build with these env vars once they're set on the service.)

## Result
A **Sign in** button appears in the header. Signed-in users get their **watchlist synced across
devices** (Firestore), and **My Space** shows "Synced · {name}". Signed-out users keep the local
on-device watchlist. Sign-in is also the natural hook for future per-user alerts on saved markets.
