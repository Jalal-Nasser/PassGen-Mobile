# PassGen Mobile Appflow Runtime Config

This mobile app is local-first. It does not require Supabase or Google auth runtime values.

## Appflow Environment Group

Create an Appflow environment group named `mobile-production` and set:

- `IOS_REVENUECAT_API_KEY=<appl_...>`
- `IOS_DRIVE_APP_FOLDER=PassGenVault`

## Appflow Native Config Mapping

Map these values into `Info.plist`:

- `PassGenRevenueCatAPIKey`
- `PassGenDriveAppFolder`

## Required iOS Capabilities

- iCloud Documents (CloudDocuments)
- Associated app entitlement file: `ios/App/App/App.entitlements`

## RevenueCat Configuration

To unlock paid plans in the native iOS app, configure RevenueCat with:

1. **Products**:
   - `passgen_pro_monthly`
   - `passgen_cloud_monthly`

2. **Offerings**:
   - Identifier: `default`
   - Include both App Store subscription products in this offering

3. **Restore Purchases**:
   - Keep restore available in the app so previously purchased subscriptions can be recovered on reinstall or a new device.

## Mobile Product Surface

- No account creation
- No Apple/Google sign-in
- No Supabase runtime dependency
- Local encrypted vault
- RevenueCat for App Store subscriptions
- iCloud backup/sync on CLOUD plan
