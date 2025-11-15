# PassGen — How It Works

This document explains how premium activation works and how to issue licenses (activation codes) to customers.

## Activation Overview
- Premium is unlocked by verifying an activation code derived from three values:
  - `installId` (generated per installation)
  - `userEmail` (entered by the customer)
  - `SELLER_SECRET` (your private seller secret)
- The code is the first 10 characters (uppercase) of the SHA-256 hash of `installId|email|secret`.
- Verification happens entirely on the customer’s device — zero‑knowledge: secrets and decrypted data never leave the device.

## One‑Time Seller Setup
1. Choose a strong `SELLER_SECRET` and keep it private (never commit publicly).
2. Optionally configure SMTP so the app can send you activation requests automatically:
   - `SELLER_EMAIL`, `ZOHO_USER`, `ZOHO_PASS`, `ZOHO_HOST`, `ZOHO_PORT` (465 or 587), `ZOHO_SECURE=true|false`
3. For local testing only, you can set these in `start-dev.bat`. For production, store secrets outside source control.

## Generating an Activation Code
Use the provided script: `scripts/generate-activation.js`.

- Option A — flags only (no env needed):
```powershell
node scripts/generate-activation.js --secret "YOUR_SELLER_SECRET" --installId "USER_INSTALL_ID" --email "user@example.com"
```

- Option B — env + npm script:
```powershell
$env:SELLER_SECRET="YOUR_SELLER_SECRET"
$env:INSTALL_ID="USER_INSTALL_ID"
$env:EMAIL="user@example.com"
npm run gen:activation
```

- Option C — using .env file (local only):
1) Create `.env` with `SELLER_SECRET=...`
2) Run:
```powershell
node scripts/generate-activation.js --installId "USER_INSTALL_ID" --email "user@example.com"
```

The script prints the activation code to send to the user.

## Issuing Flow (End‑to‑End)
1. Customer completes payment (PayPal/QR).
2. In-app they click "Request Activation" → you receive a message with `installId` and `email` (SMTP or mailto fallback).
3. Verify payment.
4. Generate the code using the exact `installId` and `email` they provided.
5. Email the code to the customer (template below).

## Email Reply Template
Subject: PassGen Premium Activation Code

Body:
```
Thanks for your payment.

Install ID: <paste installId>
Email:      <paste email>
Activation Code: <PASTE_CODE>

How to activate:
1) Open PassGen → Upgrade
2) Enter the same email as above
3) Paste the activation code and click Activate
```

## Troubleshooting
- "Invalid code": Usually email or installId mismatch. Ask the user to copy/paste both again (trim spaces; email must match exactly).
- New device/reinstall: `installId` changes. Generate a new code for the new `installId` (decide policy for transfers).
- No request email: If SMTP isn’t configured, app opens a mailto link. You can still issue manually—just collect `installId` and `email`.

## Best Practices
- Keep `SELLER_SECRET` private and off public repos.
- Track activations (installId, email, date, payment id, code) in a private spreadsheet or tool.
- Secret rotation: If you must rotate, generate future codes with the new secret. Optionally ship an app update that accepts both old and new secrets.

## Optional Automation (Later)
- Minimal local HTML tool that computes the code in-browser (secret entered locally, no server).
- Serverless endpoint that validates a PayPal webhook and returns a code (secret stays server‑side).
- GitHub Actions macro that comments a code when an issue is labeled “paid” (reads secret from repo secrets).

## File/Script References
- Generator script: `scripts/generate-activation.js`
- App verifier: `src/services/configStore.ts` (`verifyActivationCode`)
- SMTP handler (optional): `electron/main.ts` (`payment:requestActivation` IPC)

If you’d like, I can add a dual‑secret verification to smooth secret rotation, or build a tiny GUI license issuer that never leaves your machine.