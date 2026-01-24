# Password Vault & Developer Secret Manager for Windows

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

### Plans
- **Free**: Store up to 4 passwords locally
- **Pro**: Unlimited local storage + Developer tools
- **Cloud**: Google Drive sync + encrypted cloud restore
- **Power (BYOS)**: S3-compatible + Supabase storage

<img width="815" height="664" alt="image" src="https://github.com/user-attachments/assets/dbb20dd9-5371-4c81-b0e4-02a62200b47f" />
<img width="885" height="721" alt="Screenshot 2026-01-10 103201" src="https://github.com/user-attachments/assets/cefea863-35c0-449b-bb90-f886b339b4a1" />

### Security
- 🛡️ All passwords encrypted with AES-256
- 🔑 Your master password never leaves your device
- 🔒 Zero-knowledge architecture
- 🚫 No telemetry or data collection

## Download

Get PassGen Secrets Vault from the Microsoft Store:

[![Get it from Microsoft](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/store/detail/9n5c328ctl7d)

## User Guide

See the full usage guide, including the Developer tools tab:
https://github.com/mDeploys/PassGen/blob/main/USER_GUIDE.md

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
1. Click "Upgrade" or "Premium Access" in the app
2. Copy your Install ID and open the payment page
3. After payment, you receive a license key by email
4. Enter the license key to unlock premium features
<img width="877" height="663" alt="image" src="https://github.com/user-attachments/assets/a1483bd4-50ff-48dd-992b-8be894878a64" />
<img width="759" height="531" alt="image" src="https://github.com/user-attachments/assets/13d12a58-a763-4918-b6d5-fba9552e0036" />
<img width="562" height="498" alt="image" src="https://github.com/user-attachments/assets/50e8092f-b006-4918-80f4-c1582666d8de" />


## Security Notes

- **Master Password**: Choose a strong master password. This encrypts all your stored passwords.
- **Never Forget**: Your master password cannot be recovered. Store it safely.
- **Cloud Credentials**: Your cloud storage credentials are stored locally and encrypted.
- **End-to-End Encryption**: Passwords are encrypted before being sent to cloud storage.
- **Local-First**: Even with cloud storage, all encryption happens on your device.
- **Activation Security**: Premium activation uses install ID + email + seller secret for secure verification.

## License

MIT



