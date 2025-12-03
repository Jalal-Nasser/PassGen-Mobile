PassGen Autofill (Chrome MV3)

- Load this folder as an unpacked extension in Chrome/Edge.
- After unlocking the PassGen vault, get the session token from the desktop app (to be added in UI) and paste it into the options page.
- The extension will attempt to detect login forms and fill the first matching credential for the current domain.

Security notes:
- Bridge server only listens on 127.0.0.1:17865.
- Requires session token; returns names first, and only returns secrets when explicitly requested.
- Future: add per-site approval, token rotation, and UI picker for multiple entries.
