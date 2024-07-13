#!/usr/bin/env bash
set -euo pipefail

usage='Submit a Vaultonomy GitHub Release to Chrome Web Store

Usage:
  cws-submit.sh <tag>
'

# Text to append to the manifest.json#name before publishing (used to rename
# pre-releases to distinguish from releases).
CWS_NAME_SUFFIX=${CWS_NAME_SUFFIX:-}
# ID of the extension in Chrome Web Store
CWS_ITEM_ID=${CWS_ITEM_ID:?}
# If set, publish to this publishTarget after uploading. Can be 'default' or
# 'trustedTesters'.
CWS_PUBLISH_TARGET=${CWS_PUBLISH_TARGET:-}
CWS_BASE=https://www.googleapis.com
__scripts=$(dirname "$(readlink -f "${BASH_SOURCE[0]:?}")")

item_id=$(jq -ner 'env.CWS_ITEM_ID | @uri') # URL-encode the ID

function err_exit() {
  echo "Error:" "$@" >&2
  exit "${status:-1}"
}

function log_info() {
  echo "Info:" "$@" >&2
}

if [[ $# != 1 || ! $1 ]]; then
  err_exit $'Invalid arguments\n\n' "${usage:?}"
fi

if [[ "${CWS_PUBLISH_TARGET?}" && ! "${CWS_PUBLISH_TARGET:?}" =~ ^(default|trustedTesters)$ ]]; then
  err_exit "CWS_PUBLISH_TARGET can be '', 'default' or 'trustedTesters', got: ${CWS_PUBLISH_TARGET@Q}"
fi

tag=${1:?}
dir=$(mktemp -d)

release_json=$(gh release view "${tag:?}" --json isDraft,isPrerelease,assets)

if jq <<<"${release_json:?}" -e '.isDraft' > /dev/null; then
  err_exit "GitHub Release ${tag:?} is draft"
fi

# Chrome won't install extensions hosted outside the Chrome Web Store, so unlike
# Firefox Add-ons, we don't download and self-host the pre-release versions.
# Instead we have a separate "unstable" item published, which we publish all
# versions to (pre-release and stable). We only publish stable releases to the
# main item. This way we can test pre-releases using the unstable version
# without disturbing the stable version.

release_archive_name="vaultonomy_chrome_${tag:?}.zip"
release_asset_json=$(
  release_archive_name=${release_archive_name:?} jq <<<"${release_json:?}" -e \
    'first(.assets[] | select(.name == env.release_archive_name))'
)
release_archive_url=$(jq <<<"${release_asset_json:?}" -er '.url')
release_archive_file="${dir:?}/${release_archive_name:?}"

log_info "Downloading GitHub release archive..."
curl -fsSL -o "${release_archive_file:?}" "${release_archive_url:?}"

# Validate the authenticity of the release archive by ensuring it was built in CI
log_info "Verifying release archive attestation..."
gh attestation verify "${release_archive_file:?}" \
  --repo h4l/vaultonomy \
  --signer-workflow "h4l/vaultonomy/.github/workflows/ci.yml@refs/tags/${tag:?}" \
  >&2

manifest_json=$(unzip -qc "${release_archive_file:?}" manifest.json)
manifest_version=$(jq <<<"${manifest_json:?}" -er .version)
[[ $manifest_version =~ ^[0-9.]+$ ]] || err_exit "invalid manifest version: ${manifest_version@Q}"

cws_auth_headers=$("${__scripts:?}/cws-auth.sh")
version_detail_json=$(
  curl -H @- <<<"${cws_auth_headers:?}" --retry 3 -fsS \
    "${CWS_BASE:?}/chromewebstore/v1.1/items/${item_id:?}?projection=DRAFT"
)
# The version string is empty when no draft is published (e.g a new item)
cws_version=$(jq <<<"${version_detail_json:?}" -er '.crxVersion')

# Check if this version is newer than the version already on CWS. This script is
# intended to be idempotent, so having already published is not an error.
if manifest_version=${manifest_version:?} cws_version=${cws_version?} jq -ne '
    def digits(version): version | split(".") | map(tonumber);
    digits(env.manifest_version) <= digits(env.cws_version)'; then
  log_info "Up-to-date: Tag version ${tag:?} (${manifest_json:?}) is <= Chrome Web Store version ${cws_version@Q}"
  return 0
fi

if [[ ${CWS_NAME_SUFFIX:-} ]]; then
  manifest_name=$(jq <<<"${manifest_json:?}" -er '.name')
  new_name="${manifest_name:?}${CWS_NAME_SUFFIX:?}"

  log_info "CWS_NAME_SUFFIX is set: Re-writing manifest.json#name to ${new_name@Q}"

  new_name=${new_name:?} jq <<<"${manifest_json:?}" '.name = env.new_name' > "${dir:?}/manifest.json"
  touch -d @0 "${dir:?}/manifest.json"

  ( cd "${dir:?}" && zip "${release_archive_file:?}" manifest.json)
fi

log_info "Uploading release archive..."

upload_resp=$(
  curl -H @- <<<"${cws_auth_headers:?}" --retry 3 -fsS -X PUT \
    -T "${release_archive_file:?}" \
    "${CWS_BASE:?}/upload/chromewebstore/v1.1/items/${item_id:?}?uploadType=media"
) || {
  status=2 err_exit "Failed to upload release archive:"$'\n' "${upload_resp?}"
}

if [[ "${CWS_PUBLISH_TARGET?}" ]]; then
  log_info "Publishing item to ${CWS_PUBLISH_TARGET@Q}"

  publish_resp=$(
    curl -H @- <<<"${cws_auth_headers:?}" -fsS -X POST \
      "${CWS_BASE:?}/chromewebstore/v1.1/items/${item_id:?}/publish?publishTarget=${CWS_PUBLISH_TARGET:?}"
  ) || {
    status=3 err_exit "Failed to publish item:"$'\n' "${publish_resp?}"
  }
fi
