# PassGen v1.0.5 — Release Notes

## Highlights
- **Passkey (Biometric) Authentication**: Unlock vault with Windows Hello, Face ID, Touch ID, or fingerprint.
- **Vault Export/Import (Premium)**: Backup and restore encrypted vault to move passwords between devices.
- **Premium Gating**: Export, Import, and CSV export reserved for Premium subscribers.
- **Improved Auth UX**: Clear distinction between first-time setup and returning logins.
- **Clickable Premium Link**: Footer link now opens upgrade modal directly.

## Changes

### New Features
- **Passkey Registration** (Optional):
  - In vault → Actions → "Setup Passkey"
  - Register your device's biometric authenticator
  - Stored securely in local storage (encrypted credential ID)

- **Passkey Unlock**:
  - Auth screen shows "Unlock with Passkey" button if one is registered
  - Uses WebAuthn API (W3C standard)
  - Falls back to master password if passkey fails or device unsupported

- **Vault Export/Import (Premium)**:
  - Actions dropdown: "Export Vault Backup" and "Import Vault Backup"
  - Export saves encrypted vault as JSON for backup/migration
  - Import restores vault from a backup file
  - Requires master password to decrypt after import

### UI/UX Improvements
- Footer: "Upgrade to Premium" is now clickable (opens modal)
- Auth screen: Dynamic text ("Set Master Password" on first setup, "Enter Master Password" on return)
- Vault Actions: New "Setup Passkey" option for easy biometric registration

### Vault Gating
- Free users: Can see Export/Import buttons but upgrading removes the gate
- Premium users: Full access to backup/restore and CSV export

### Platform Support
- **Windows**: Windows Hello (PIN, Face, Fingerprint)
- **macOS**: Touch ID
- **Linux**: Available if system supports WebAuthn (e.g., via FIDO2 devices)

## How to Use

### Setup Passkey
1. Unlock your vault with master password
2. Actions → "Setup Passkey"
3. Authenticate with biometric when prompted
4. Next login: use "Unlock with Passkey" button

### Export Vault (Premium)
1. Unlock vault
2. Actions → "Export Vault Backup"
3. Choose save location (e.g., `passgen-vault-20251209.json`)
4. Backup is encrypted; master password required to import

### Import Vault (Premium)
1. On new device or after reset: Actions → "Import Vault Backup"
2. Select the backup JSON file
3. Enter your master password to decrypt and unlock

## Security Notes
- Passkey credential ID is stored locally; public key never leaves your device
- Master password is still required for encryption/decryption
- Vault exports are encrypted with your master password
- Passkey is optional; master password always works as fallback
- All data stays on-device unless you configure cloud storage

## Version
- App version: `1.0.5`
- Passkey standard: WebAuthn (W3C)
- Minimum Electron: 28.3.3

## What's Fixed from v1.0.4
- Update checker now correctly fetches from main PassGen repo (no false 1.0.2 prompts)
- Footer links are functional (Check for Updates, Upgrade to Premium)
- Auth screen clarity: "Set" vs "Enter" master password based on context
- Master password gating: vault locked if wrong password with existing data

## Known Limitations
- Passkey registration per-device (not synced to cloud)
- Browser extension (beta) still in development; per-site allowlist coming soon
- Cloud sync (Google Drive, S3) coming in future release

## Upgrade from v1.0.4
- **Non-destructive**: All existing passwords and settings preserved
- **Passkey optional**: Skip setup if not needed
- **Master password unchanged**: No re-authentication required
