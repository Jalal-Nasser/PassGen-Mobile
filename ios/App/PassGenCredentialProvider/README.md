# PassGen Credential Provider

Internal note:

- Password AutoFill support is required for PassGen Vault iOS releases.
- The extension advertises password and one-time-code capabilities through AuthenticationServices.
- TOTP visibility under iOS Settings > Passwords > Set Up Codes In depends on the iOS version and Apple-controlled settings UI. Do not bypass those restrictions.
- Shared App Group storage contains encrypted vault data and non-secret metadata only. Credentials are revealed only after Face ID or master password authentication.
- Appflow/App Store archives require a separate provisioning profile for `com.mdeploy.passgen.autofill` with App Groups and AutoFill Credential Provider enabled. Associated Domains is intentionally not enabled in entitlements because it is not required for Settings visibility and requires a matching webcredentials profile.
