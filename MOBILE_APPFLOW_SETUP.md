# PassGen Mobile Appflow Runtime Config

This mobile app does **not** read desktop `.env` values for iOS runtime features.

## Appflow Environment Group

Create an Appflow environment group named `mobile-production` and set:

- `IOS_SUPABASE_URL=https://msapggfdkgugctycrbqi.supabase.co`
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
