# PassGen Mobile - Secure Password Vault & Generator

<p align="center">
  <img src="assets/screenshots/7.jpg" width="24%" alt="PassGen Vault Login" />
  <img src="assets/screenshots/6.jpg" width="24%" alt="Secure Generator" />
  <img src="assets/screenshots/1.jpg" width="24%" alt="Settings - Subscription" />
  <img src="assets/screenshots/3.jpg" width="24%" alt="Settings - Cloud Backup" />
  <img src="assets/screenshots/2.jpg" width="24%" alt="Generator Properties" />
  <img src="assets/screenshots/4.jpg" width="24%" alt="Generator Properties Detailed" />
  <img src="assets/screenshots/5.jpg" width="24%" alt="Add Vault Entity" />
</p>

## What the Project Is About
**PassGen** is a secure password generator and vault application natively bridging to mobile devices. It provides users with the ability to generate secure passwords and store them in an encrypted vault. The application features premium subscription tiers (to unlock unlimited entries and cloud sync) and supports personal vault management securely. 

For the mobile version specifically, the application operates entirely offline-first, using local device storage for the encrypted vault. **For cloud synchronization and database backups across devices, it relies directly on Google Drive (for Android) and iCloud (for iOS)**, instead of an external backend database.

## Platforms & Technology Stack
The project heavily utilizes a modern cross-platform mobile web stack:
- **Ionic Appflow**: Used for Continuous Integration and Continuous Deployment (CI/CD) specifically for automating iOS and Android native builds in the cloud.
- **Capacitor 8**: The native runtime used to bridge the Web application into native iOS and Android apps.
- **React & Vite**: The core frontend framework and bundler powering the web UI.
- **Google Drive APIs & iCloud**: Used as the primary cloud database and synchronization layers for the mobile applications (Android and iOS).
- **Supabase**: The backend-as-a-service providing Authentication (Google, Apple).
- **RevenueCat**: Used to manage mobile In-App Purchases (IAP) and subscriptions across the Apple App Store and Google Play Store.

## Features & Capabilities

### 🔐 Secure Password Generation
- Create highly secure, randomized passwords on the go.
- Full control over password length, uppercase/lowercase letters, numbers, and special symbols.

### 🗄️ Encrypted Local Vault
- Store all your passwords securely directly on your device.
- Offline-first architecture ensures your vault is accessible anywhere, anytime without requiring a connection.
- Biometric authentication (Face ID / Touch ID) support for quick and secure access.

### ☁️ Seamless Cloud Synchronization (CLOUD Plan)
- Securely backup and sync your encrypted vault across all your devices.
- Uses your personal **Google Drive** (Android) or **iCloud** (iOS) account—meaning your raw data never touches our servers.

### 💎 Flexible Premium Plans
- **Free Plan**: Manage up to 4 passwords securely for free.
- **PRO Plan**: Unlocks unlimited password entries for local storage.
- **CLOUD Plan**: Unlocks unlimited entries AND seamless cloud synchronization features.
