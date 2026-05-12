#!/usr/bin/env bash
set -euo pipefail

archive_path="${1:-}"
if [[ -z "$archive_path" ]]; then
  echo "Usage: $0 path/to/App.xcarchive" >&2
  exit 2
fi

app_path="$archive_path/Products/Applications/App.app"
extension_path="$app_path/PlugIns/PassGenCredentialProvider.appex"

require_path() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    echo "Missing expected signed product: $path" >&2
    exit 1
  fi
}

dump_entitlements() {
  local path="$1"
  /usr/bin/codesign -d --entitlements :- "$path" 2>/dev/null
}

require_entitlement() {
  local path="$1"
  local key="$2"
  if ! dump_entitlements "$path" | /usr/bin/grep -Fq "<key>$key</key>"; then
    echo "Missing entitlement '$key' in $path" >&2
    exit 1
  fi
}

require_value() {
  local path="$1"
  local value="$2"
  if ! dump_entitlements "$path" | /usr/bin/grep -Fq "$value"; then
    echo "Missing entitlement value '$value' in $path" >&2
    exit 1
  fi
}

require_path "$app_path"
require_path "$extension_path"

require_entitlement "$app_path" "com.apple.developer.authentication-services.autofill-credential-provider"
require_entitlement "$app_path" "com.apple.security.application-groups"
require_entitlement "$app_path" "com.apple.developer.associated-domains"
require_value "$app_path" "group.com.mdeploy.passgen"
require_value "$app_path" "webcredentials:mdeploy.dev"

require_entitlement "$extension_path" "com.apple.developer.authentication-services.autofill-credential-provider"
require_entitlement "$extension_path" "com.apple.security.application-groups"
require_entitlement "$extension_path" "com.apple.developer.associated-domains"
require_value "$extension_path" "group.com.mdeploy.passgen"
require_value "$extension_path" "webcredentials:mdeploy.dev"

echo "iOS archive entitlements verified."
