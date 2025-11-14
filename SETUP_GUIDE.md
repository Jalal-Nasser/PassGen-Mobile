# PassGen - Complete Setup & Sign-Up Guide

## 🚀 Getting Started (First Time Users)

PassGen is a **desktop application** with a zero-knowledge architecture, meaning there's no traditional "account" or "sign-up" with email/password to a server. Instead, you create a **local vault** secured by your **master password**.

### Sign-Up Process Explained

**PassGen doesn't require traditional sign-up because:**
- ✅ No servers to create accounts on
- ✅ No email verification needed
- ✅ No usernames or profiles
- ✅ Complete privacy - we never see your data
- ✅ You control where data is stored (local or your own cloud)

**Instead, you "sign up" by:**
1. Choosing your storage method
2. Creating a master password
3. Starting to use the app immediately

---

## 📋 Step-by-Step First-Time Setup

### Step 1: Launch the App

When you first open PassGen, you'll see a **3-step onboarding tutorial** that explains:
- How the app works
- Security features
- Setup tips

Click through the onboarding screens to learn about the app.

### Step 2: Choose Your Storage Provider

After onboarding, you'll configure where your encrypted passwords will be stored:

#### Option A: Local Storage (Easiest - No Setup Required)
**Best for:**
- Getting started quickly
- Single device usage
- Maximum privacy (data never leaves your device)

**Setup:**
1. Select "Local Storage" radio button
2. Click "Continue"
3. Done! No credentials needed

#### Option B: Google Drive
**Best for:**
- Syncing across multiple devices
- Easy cloud backup
- Free storage (15GB)

**Setup Required:**
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "PassGen")
3. Enable "Google Drive API"
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Choose "Desktop app" as application type
6. Copy the **Client ID** and **Client Secret**
7. In PassGen, select "Google Drive"
8. Paste your Client ID and Client Secret
9. Click "Continue"

**First-time Google Authorization:**
- You'll be prompted to authorize PassGen to access your Drive
- Grant permission (read/write access to files it creates)
- Complete the OAuth flow

#### Option C: AWS S3
**Best for:**
- Enterprise users
- AWS ecosystem integration
- Full control over storage location

**Setup Required:**
1. Visit [AWS Console](https://console.aws.amazon.com/)
2. Create an S3 bucket (e.g., "my-passgen-vault")
3. Go to IAM → Users → Create new user
4. Attach policy: `AmazonS3FullAccess` (or create custom policy)
5. Generate access keys
6. Copy **Access Key ID** and **Secret Access Key**
7. In PassGen, select "AWS S3"
8. Enter:
   - Access Key ID
   - Secret Access Key
   - Region (e.g., us-east-1)
   - Bucket name
9. Click "Continue"

#### Option D: DigitalOcean Spaces
**Best for:**
- DigitalOcean users
- Simple S3-compatible storage
- Predictable pricing

**Setup Required:**
1. Visit [DigitalOcean Cloud](https://cloud.digitalocean.com/)
2. Go to Spaces → Create Space
3. Choose a region and name
4. Go to API → Spaces Keys → Generate New Key
5. Copy **Access Key** and **Secret Key**
6. In PassGen, select "DigitalOcean Spaces"
7. Enter:
   - Access Key
   - Secret Key
   - Region (select from dropdown)
   - Space name
8. Click "Continue"

### Step 3: Create Your Master Password

This is the **most important step**!

**Your master password:**
- ✅ Encrypts ALL your stored passwords with AES-256
- ✅ Is NEVER sent to the cloud or stored anywhere
- ✅ Cannot be recovered if forgotten
- ✅ Should be strong but memorable

**Best Practices:**

**✅ Good Master Passwords:**
```
Coffee&Sunrise@2025!Today
MyDog$Loves#Pizza2025
BlueOcean!Meets*Sky@NYC
```

**❌ Bad Master Passwords:**
```
password123
12345678
qwerty
myname
```

**Requirements:**
- Minimum 8 characters (recommended: 12-16+)
- Mix of uppercase, lowercase, numbers, symbols
- Memorable to YOU (but not easy to guess)

**Tips:**
- Use a passphrase with special characters
- Include a year or number that's meaningful to you
- Consider writing it down and storing it safely initially
- Test typing it a few times before confirming

### Step 4: Start Using PassGen!

Once you've set up storage and created your master password:

1. **You're now "signed up"** - the app is ready to use
2. You'll see the Vault interface
3. Switch between "Vault" and "Generator" modes
4. Start generating and saving passwords

---

## 🔄 Returning Users (Already Set Up)

### How to Log In

1. Launch PassGen
2. You'll skip the onboarding (only shown once)
3. Enter your **master password**
4. Click "Unlock Vault"
5. Access all your stored passwords

**Forgot Your Master Password?**
- Unfortunately, it **cannot be recovered**
- This is by design for security
- You'll need to start fresh with a new vault
- Consider backing up your master password securely

---

## 🛠️ Advanced Setup Options

### Switching Storage Providers

To change from Local to Cloud (or vice versa):

1. Currently, this requires manual migration
2. Export your passwords from the current provider
3. Reconfigure with new storage provider
4. Re-import your passwords

*(Future update will add automatic migration)*

### Multiple Devices Setup

**For Google Drive/S3/DigitalOcean users:**
1. Install PassGen on second device
2. Choose the SAME storage provider
3. Enter the SAME cloud credentials
4. Use the SAME master password
5. Your passwords will sync automatically

**For Local Storage users:**
- Local storage is device-specific
- Consider switching to cloud storage for multi-device access

### Backup Recommendations

**Best Practice: 3-2-1 Backup Rule**
1. **3 copies** of your data
2. **2 different storage types** (e.g., Local + Cloud)
3. **1 offsite** backup (cloud storage)

**How to backup:**
- Use cloud storage as your primary
- Keep a second encrypted backup locally
- Periodically export your vault

---

## 🔐 Security FAQ

**Q: Is my master password stored anywhere?**
A: No. It only exists in your memory and temporarily in RAM when unlocking.

**Q: Can you recover my master password if I forget it?**
A: No. Zero-knowledge means we literally cannot access it.

**Q: Are my passwords safe in the cloud?**
A: Yes. They're encrypted with AES-256 BEFORE being uploaded. The cloud only sees encrypted gibberish.

**Q: What if someone hacks my Google Drive/S3?**
A: They'd only get encrypted files. Without your master password, they're useless.

**Q: Can PassGen employees see my passwords?**
A: No. This is a desktop app with zero-knowledge architecture. We never see your data.

---

## ✅ Quick Start Checklist

For absolute beginners:

- [ ] Download and install PassGen
- [ ] Complete the onboarding tutorial
- [ ] Choose "Local Storage" (easiest)
- [ ] Create a strong master password (write it down!)
- [ ] Generate your first password
- [ ] Save a test entry in the vault
- [ ] Practice unlocking the vault
- [ ] (Optional) Set up cloud storage later

---

## 🆘 Troubleshooting

**"Cannot configure storage"**
- Check your internet connection
- Verify cloud credentials are correct
- Ensure cloud service is accessible

**"Wrong master password"**
- Master password is case-sensitive
- Check Caps Lock is off
- Try typing it in a text editor first to verify

**"Failed to sync"**
- Check internet connection
- Verify cloud service is online
- Check API credentials haven't expired

**"App won't start"**
- Try restarting the app
- Check system requirements
- Reinstall if necessary

---

## � Premium Activation & Email Setup

PassGen offers a Free plan (store up to 4 passwords) and a Premium plan ($3.99/month). Premium unlocks larger vaults and cloud storage providers. After payment, activation requires a code.

### How activation works
- In the app, open the Upgrade/Premium panel and enter your email.
- Click "Request Activation". The app sends an email to the seller to verify your payment.
- You'll receive an activation code from the seller. Enter it in the app to unlock Premium.

### SMTP configuration (seller email)
To enable the in-app email (instead of opening your mail client), set these environment variables.

Variables:
- SELLER_EMAIL – where activation requests are sent
- ZOHO_USER – SMTP username (e.g., ZeptoMail API user)
- ZOHO_PASS – SMTP password or API key
- ZOHO_HOST – SMTP host (e.g., smtp.zeptomail.com)
- ZOHO_PORT – 465 (SSL) or 587 (STARTTLS)
- ZOHO_SECURE – true for 465, false for 587

### Windows (development)
Use the provided `start-dev.bat` which already sets example values:

1. Open `start-dev.bat` and edit the values at the top:
   - SELLER_EMAIL, ZOHO_USER, ZOHO_PASS, ZOHO_HOST, ZOHO_PORT, ZOHO_SECURE
2. Double-click `start-dev.bat` to launch Vite and Electron with these variables.

Alternatively, create a `.env` file in the project root using `.env.example` as a template. The app will load it automatically during development.

### Production builds
Environment variables in packaged apps come from the OS at runtime.

Options:
- Set system/user environment variables in Windows (Control Panel → System → Advanced → Environment Variables).
- Or ship a `.env` next to the executable and ensure the variables are present in the process environment when launching the app.

Notes:
- If SMTP isn't configured, the app will open your default mail client via `mailto:` as a fallback.
- Port/secure: 465 → secure=true (SSL); 587 → secure=false (STARTTLS).

### Seller: Generate an activation code
Use the provided helper script. You need two inputs from the request email: the Install/Request ID and the user's email address. You also need the seller secret (must match the app's secret used for verification).

1) Via npm script:

```powershell
cd "c:\Users\jnass\PassGen"
npm run gen:activation -- --install <INSTALL_ID> --email <USER_EMAIL> --secret <YOUR_SECRET>
```

2) Or set the secret via environment variable:

```powershell
$env:SELLER_SECRET="YOUR_SECRET"
npm run gen:activation -- --install <INSTALL_ID> --email <USER_EMAIL>
```

Output will show: `Activation Code: ABCDEF1234`

Important:
- The secret used here must match the app’s verification secret. By default, the app falls back to `PG-SEC-2025`. For stronger security, set a custom secret for your builds and keep it private.
- The Install/Request ID equals the user's device Install ID (it appears in the activation request email body and subject).

## �📞 Need Help?

**Getting Cloud Credentials:**
- Google Drive: https://console.cloud.google.com/
- AWS S3: https://console.aws.amazon.com/
- DigitalOcean: https://cloud.digitalocean.com/

**Documentation:**
- Read `README.md` for features overview
- Read `CLOUD_STORAGE_GUIDE.md` for technical details

---

**Remember:** You're not creating an account on our servers. You're creating a personal, encrypted vault that only YOU can access. That's the beauty of zero-knowledge architecture! 🔒
