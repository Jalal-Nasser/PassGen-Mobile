Project Summary & Implementation Log
What the Project Is About
PassGen is a secure password generator and vault application. It provides users with the ability to generate secure passwords and store them in an encrypted vault. The application features premium subscription tiers (to unlock unlimited entries and cloud sync) and supports user authentication to manage personal vaults securely. It is designed as a cross-platform application (Web, iOS, and Android).

Platforms & Technology Stack
The project heavily utilizes a modern cross-platform mobile web stack:

Ionic Appflow: Used for Continuous Integration and Continuous Deployment (CI/CD) specifically for automating iOS and Android native builds in the cloud.
Capacitor 8: The native runtime used to bridge the Web application into native iOS and Android apps.
React & Vite: The core frontend framework and bundler powering the web UI.
Supabase: The backend-as-a-service providing the PostgreSQL database, Authentication (Google, Apple), and Row Level Security.
RevenueCat: Used to manage mobile In-App Purchases (IAP) and subscriptions across the Apple App Store and Google Play Store.
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