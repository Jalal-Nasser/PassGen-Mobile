# PassGen Mobile Appflow Runtime Config

This mobile app does **not** read desktop `.env` values for iOS runtime features.

## Appflow Environment Group

Create an Appflow environment group named `mobile-production` and set:

```markdown
- `IOS_SUPABASE_URL=https://fnnwyxadidptaziqvfvy.supabase.co`
```
- `IOS_SUPABASE_ANON_KEY=<Supabase anon key for msapggfdkgugctycrbqi>`
- `IOS_REVENUECAT_API_KEY=<appl_...>`
- `IOS_GOOGLE_IOS_CLIENT_ID=<iOS OAuth client id>`
- `IOS_GOOGLE_REVERSED_CLIENT_ID=<reversed iOS OAuth client id>`
- `IOS_GOOGLE_SERVER_CLIENT_ID=<Google web client id>`
- `IOS_DRIVE_APP_FOLDER=PassGenVault`

## Appflow Native Config Mapping

Map these values into `Info.plist`:

- `PassGenSupabaseURL`
- `PassGenSupabaseAnonKey`
- `PassGenRevenueCatAPIKey`
- `PassGenGoogleIOSClientID`
- `PassGenGoogleReversedClientID`
- `PassGenGoogleServerClientID`
- `PassGenDriveAppFolder`

## Required iOS Capabilities

- Sign In with Apple
- iCloud Documents (CloudDocuments)
- Associated app entitlement file: `ios/App/App/App.entitlements`

## RevenueCat Configuration (Dashboard Setup)

To ensure the native mobile app correctly unlocks Premium features, the RevenueCat dashboard must be configured with the following exact identifiers mapping to your Apple App Store Connect setup:

1. **Entitlements** (Access Levels):
   - `pro` (For the PRO Plan)
   - `cloud` (For the CLOUD Plan)

2. **Products** (App Store SKUs):
   - `passgen_pro_monthly` (Attach this to the `pro` entitlement)
   - `passgen_cloud_monthly` (Attach this to the `cloud` entitlement)

3. **Offerings** (Paywall Grouping):
   - Identifier: `default`
   - Create two packages inside this offering: `pro_package` (containing the Pro product) and `cloud_package` (containing the Cloud product).

*Note: The iOS App-Specific API Key (`appl_...`) generated from RevenueCat is injected during the cloud build via the `IOS_REVENUECAT_API_KEY` Appflow variable.*
