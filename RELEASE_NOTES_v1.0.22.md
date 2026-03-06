# PassGen v1.0.22

Release date: 2026-03-06

## What's Fixed

- Fixed Windows AppX taskbar icon rendering by generating the `Square44x44Logo.targetsize-*` and unplated icon variants Windows uses on taskbar/search surfaces.
- Restored the desktop Electron bridge and vault backend files required for AppX builds, fixing the `Vault backend is not available` error in storage and vault flows.
- Fixed the vault list layout regression so password rows render at normal height again instead of collapsing.

## UI

- Increased the default desktop window size for a cleaner vault layout.
- Refined the desktop container and vault card styling for better spacing and less clipping.

## Packaging

- Version bumped to `1.0.22`.
- Built package target: `PassGen Secrets Vault 1.0.22.appx`.
