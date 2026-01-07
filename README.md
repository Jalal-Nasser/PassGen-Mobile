# PassGen - Password Generator & Vault Desktop App

A secure and user-friendly desktop application for generating strong passwords and storing them encrypted in the cloud.

## Features

### Password Generator
- 🔐 Generate secure random passwords
- 📏 Customizable password length (4-64 characters)
- ✅ Choose character types:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Special symbols (!@#$...)
- 📋 One-click copy to clipboard

### Password Vault
- 🗄️ Store passwords securely
- 🔒 AES-256 encryption with your master password
- ☁️ Multiple cloud storage options:
  - **Local Storage** - Keep passwords on your device
  - **Google Drive** - Sync with your Google Drive account (Premium)
  - **AWS S3** - Store in Amazon S3 buckets (Premium)
  - **DigitalOcean Spaces** - Use DigitalOcean's object storage (Premium)
- 🔍 Search and organize your passwords
- 📝 Store additional info: username, URL, notes
- 🔐 Master password protection

### Free vs Premium
- **Free**: Store up to 4 passwords locally
- **Premium** ($3.99/month):
  - Unlimited password storage
  - Cloud sync (Google Drive, AWS S3, DigitalOcean Spaces)
  - Automatic backups
  - Priority support

<img width="815" height="664" alt="image" src="https://github.com/user-attachments/assets/dbb20dd9-5371-4c81-b0e4-02a62200b47f" />

## Activation Dashboard

For developers/sellers managing premium activations:

### Setup
1. Install dependencies: `npm install`
2. Set up Supabase database using the schema in `supabase-schema.sql`
3. Configure environment variables in `.env`

### Running the Dashboard
```bash
npm run dashboard
```
Then open http://localhost:3001 in your browser.

**Note:** Make sure you have express and resend installed:
```bash
npm install express resend
```

### Features
- 📊 View activation request statistics
- 📋 Manage pending activation requests
- ✅ Generate and send activation codes
- 📧 Automated email notifications
- 🔍 Track payment methods and revenue

### License Keys (One-time)
To sell pre-generated keys (for online stores), use:
```bash
npm run gen:license-keys -- --count 20 --plan cloud --termDays 180
```
- Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to insert hashes into Supabase.
- Keys are stored **hashed** only; keep the printed keys safe for distribution.

### Database Schema
The dashboard uses Supabase with the following tables:
- `activation_requests` - Stores user activation requests
- `dashboard_stats` - Aggregated statistics view

### Security
- 🛡️ All activation codes are cryptographically generated
- 🔐 Uses HMAC-SHA256 with seller secret
- 📧 Emails sent via Resend API
- 🚫 No user data stored permanently
### Security
- 🛡️ All passwords encrypted with AES-256
- 🔑 Your master password never leaves your device
- 🔒 Zero-knowledge architecture
- 🚫 No telemetry or data collection

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool

## Download

Get the latest Windows installer from the public downloads repo:

https://github.com/Jalal-Nasser/PassGen-Releases/releases

## System Requirements

### End Users (Desktop App)
- OS: Windows 10/11 (x64). macOS 11+ / Ubuntu 20.04+ if you build your own installer.
- CPU: 64-bit dual-core or better
- RAM: 4 GB minimum (8 GB recommended)
- Storage: 300 MB free (plus space for vault and backups)
- Display: 1280×720 or higher
- Internet: required for activation, cloud sync, and updates (local vault works offline after setup)

### Passkey / Windows Hello (Optional)
- Windows Hello enabled (PIN or biometric)
- Secure origin (packaged app or dev running on localhost)

## Browser Extension (Beta)
- Folder: `extension/`
- Load as unpacked in Chrome/Edge (enable Developer Mode), then paste the session token from the Vault footer into the extension options.
- After pairing, the extension detects login forms and autofills the first matching credential by domain.
- Security: The desktop app serves a loopback-only bridge on `127.0.0.1:17865` and requires a session token; secrets are returned only on explicit fill.

## Getting Started

### Quick Start (New Users)

**PassGen uses a zero-knowledge architecture - no traditional sign-up required!**

Instead of creating an account:
1. Launch the app → Complete onboarding
2. Choose storage (Local/Google Drive/S3/DigitalOcean)
3. Create a master password
4. Start using immediately!

👉 **[Complete Setup Guide](./SETUP_GUIDE.md)** - Step-by-step instructions for first-time users

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Cloud Storage Setup (Optional - Premium Only)

#### Google Drive
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials (Desktop app)
5. Copy Client ID and Client Secret

#### AWS S3
1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Create an S3 bucket
3. Create IAM user with S3 access
4. Generate access keys

#### DigitalOcean Spaces
1. Go to [DigitalOcean Cloud](https://cloud.digitalocean.com/)
2. Create a Space
3. Generate Spaces access keys from API settings

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

Run the app in development mode:
```bash
npm run electron:dev
```

This will start the Vite dev server and launch the Electron app with hot-reload enabled.

### Building

Build the app for production:
```bash
npm run electron:build
```

The built application will be available in the `release` folder.

## Updates
- Automatic: The app periodically checks GitHub Releases and shows a notification when a newer version is available.
- Manual: Use Help → Check for Updates to run a check immediately.

## Usage

### First Time Setup
1. Launch the application
2. Complete the onboarding wizard
3. Choose your storage provider (Local, or upgrade for cloud storage)
4. Set a strong master password
5. Start generating and storing passwords!

### Generating Passwords
1. Switch to "Generator" mode
2. Adjust the password length using the slider
3. Select which character types to include
4. Click "Generate Password"
5. Click the copy button to copy to clipboard

### Managing Passwords
1. Switch to "Vault" mode
2. Click "Add Password" to save a new entry
3. Fill in the details (name, username, password, URL, notes)
4. Use "Generate" button to create a secure password
5. Search your passwords using the search bar
6. Click copy buttons to copy username or password

### Upgrading to Premium
1. Click "Upgrade to Premium" in the vault
2. Complete PayPal payment ($3.99/month)
3. Request activation code via email
4. Enter activation code to unlock premium features
<img width="877" height="663" alt="image" src="https://github.com/user-attachments/assets/a1483bd4-50ff-48dd-992b-8be894878a64" />
<img width="759" height="531" alt="image" src="https://github.com/user-attachments/assets/13d12a58-a763-4918-b6d5-fba9552e0036" />
<img width="562" height="498" alt="image" src="https://github.com/user-attachments/assets/50e8092f-b006-4918-80f4-c1582666d8de" />


## Project Structure

```
PassGen/
├── electron/              # Electron main process files
│   ├── main.ts           # Main process entry point
│   └── preload.ts        # Preload script
├── src/                  # React application
│   ├── components/       # React components
│   │   ├── SplashScreen.tsx    # Animated splash screen
│   │   ├── Onboarding.tsx      # User onboarding wizard
│   │   ├── StorageSetup.tsx    # Cloud storage configuration
│   │   ├── PasswordVault.tsx   # Password management UI
│   │   ├── UpgradeModal.tsx    # Premium upgrade flow
│   │   └── *.css               # Component styles
│   ├── services/         # Business logic
│   │   ├── encryption.ts       # AES encryption service
│   │   ├── googleDrive.ts      # Google Drive integration
│   │   ├── s3Storage.ts        # S3/Spaces integration
│   │   ├── storageManager.ts   # Storage orchestration
│   │   └── configStore.ts      # Local configuration & activation
│   ├── App.tsx           # Main App component
│   ├── App.css           # App styles
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styles
├── scripts/
│   └── generate-activation.js  # Activation code generator
├── dist/                 # Vite build output
├── dist-electron/        # Electron build output
└── release/              # Packaged applications
```

## Security Notes

- **Master Password**: Choose a strong master password. This encrypts all your stored passwords.
- **Never Forget**: Your master password cannot be recovered. Store it safely.
- **Cloud Credentials**: Your cloud storage credentials are stored locally and encrypted.
- **End-to-End Encryption**: Passwords are encrypted before being sent to cloud storage.
- **Local-First**: Even with cloud storage, all encryption happens on your device.
- **Activation Security**: Premium activation uses install ID + email + seller secret for secure verification.

## License

MIT

