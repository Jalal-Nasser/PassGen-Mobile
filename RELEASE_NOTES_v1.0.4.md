# PassGen v1.0.4 — Release Notes

## Highlights
- Browser extension bridge (beta): Local loopback server enables autofill from the desktop app.
- Session token UI: Vault footer shows a copyable token to pair the extension.
- Master password gating: App now verifies the stored hash and rejects incorrect passwords.

## Changes
- Electron main
  - Added loopback bridge on `127.0.0.1:17865` with endpoints:
    - `GET /health` → `{ ok: true }`
    - `GET /credentials?domain=example.com` → returns candidate entry names (no secrets)
    - `POST /fill { id }` → returns `{ username, password }` when unlocked
  - Session token generation on vault unlock; cleared on lock/reset.
  - Update checker current version set to `1.0.4`.
- Preload
  - Exposed `electronAPI.getSessionToken()`, `vaultUnlocked()`, `vaultLocked()` to the renderer.
- Renderer
  - Vault footer shows the current session token with a copy button.
  - Exposed helpers for bridge queries: `window.__passgen_listEntries()` and `window.__passgen_getEntryById(id)`.
  - Master password verification stores a hash on first setup; requires matching hash on subsequent logins.
- Extension scaffold (Chrome/Edge MV3)
  - `extension/manifest.json`, `background.js`, `content.js`, `options.html`, `README.md`.
  - Detects login forms, lists candidates by domain, and fills the first match.

## How to Use the Extension (Beta)
1. Unlock the vault in PassGen and copy the session token from the footer.
2. In Chrome/Edge, go to `chrome://extensions` → Enable Developer Mode → Load unpacked → select `extension/`.
3. Open the extension’s options and paste the token. Save.
4. Visit a login page. The extension will attempt to fill the first matching credential.

## Notes
- Security: Bridge listens only on `127.0.0.1` and requires a session token. Secrets are only returned on explicit requests.
- Known limitations: No popup picker yet; fills the first match. Per-site allowlist and multi-entry selection are planned.

## Fixes
- Clipboard reliability improvements retained.
- Vault repair tool remains available under the vault actions.

## Version
- App version: `1.0.4`
