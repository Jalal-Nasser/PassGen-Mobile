# PassGen v1.0.19

Release date: 2026-03-05

## What's Fixed

- Fixed Microsoft Store/taskbar purple tile background by setting AppX `backgroundColor` to `transparent`.
- Updated Windows Store icon generation so `StoreLogo.png` is transparent (no hardcoded purple fill).
- Regenerated AppX logo assets used by Windows package.

## Stability

- Fixed local desktop startup crash by setting explicit `projectName` for `electron-store` instances.

## Packaging

- Version bumped to `1.0.19`.
- Built package target: `PassGen Secrets Vault 1.0.19.appx`.
