# PassGen User Guide

This guide covers how to use the PassGen desktop app and the Developer tools tab.

## Quick Start

1) Launch PassGen and complete the onboarding steps.
2) Choose your storage provider (Local by default).
3) Create your master password.
4) Start saving passwords or generating new ones.

## Using the Vault

- Add a new entry: Vault -> Add New -> fill name, username, password, URL, notes -> Save.
- Edit an entry: open the entry -> Edit -> Save.
- Search: use the search bar to filter by name or URL.
- Export/Import: Actions menu (available on Premium plans).

## Password Generator

- Generator tab: pick length and character types.
- Click Generate, then Copy to clipboard.

## Premium and License Keys

PassGen uses license keys for premium plans.

1) Open Upgrade (from the Upgrade button or Actions -> Premium Access).
2) Copy your Install ID.
3) Click Pick a Plan to open the payment page.
4) After payment, you will receive a license key by email.
5) Paste the license key in Step 2 and click Redeem Key.

If the license is active, Premium features are unlocked immediately.

## Storage Providers

- Local Storage (default): vault stored on your device.
- Google Drive (Cloud plan): requires sign-in with Google to connect.
- S3-Compatible (BYOS plan): requires your bucket credentials.
- Supabase Storage (BYOS plan): requires project URL, bucket, and anon key.

Open Configure Storage to select a provider and connect it.

## Passkey (Windows Hello)

Use Settings -> Setup Passkey to enable biometric unlock (Windows Hello).

## Settings

- Language: English/Arabic.
- Minimize to tray: keep PassGen running in the tray.
- Reset App: clears local data and restarts the wizard.

## Developer Tools (Developer Tab)

The Developer tab includes a local secret generator.

### Generate a Secret

1) Open the Developer tab.
2) Choose a preset (JWT/HMAC, API key, Webhook secret, Encryption key).
3) Click Generate.
4) Copy the output you need (Base64URL, Hex, or .env pair).

### Inject to Project .env

1) Click Select Project and choose your project folder.
2) Set the .env key name (for example, API_SECRET).
3) Click Inject to .env.

Notes:
- Secrets are generated locally.
- No secrets are sent to any server.
- Free plan has a daily generation limit and limited output formats.

## Troubleshooting

- "Not signed in" for cloud storage: sign in with Google in Configure Storage.
- License not working: make sure you entered the key exactly as provided.
- No email received: check spam folder or contact support.
- Passkey not available: requires Windows Hello and a secure app context.
