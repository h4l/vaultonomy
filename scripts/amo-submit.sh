#!/usr/bin/env bash
set -euo pipefail

usage='Submit a Vaultonomy GitHub Release to Firefox Add-ons

Usage:
  amo-submit.sh <tag>
'

AMO_BASE_URL=https://addons.mozilla.org
__scripts=$(dirname "$(readlink -f "${BASH_SOURCE[0]:?}")")

function err_exit() {
  echo "Error:" "$@" >&2
  exit "${status:-1}"
}

function log_info() {
  echo "Info:" "$@" >&2
}

if [[ $# != 1 || ! $1 ]]; then
  err_exit $'Error: Invalid arguments\n\n' "${usage:?}"
fi

tag=${1:?}

dir=$(mktemp -d)

release_json=$(gh release view "${tag:?}" --json assets,tarballUrl)

release_asset_json=$(
  jq <<<"${release_json:?}" -e \
    'first(.assets[] | select(.name | test("^vaultonomy_firefox_.*\\.zip$")))'
)
release_archive_name=$(jq <<<"${release_asset_json:?}" -er '.name')
release_archive_url=$(jq <<<"${release_asset_json:?}" -er '.url')
release_archive_file="${dir:?}/${release_archive_name:?}"
source_tarball_url=$(jq <<<"${release_json:?}" -er '.tarballUrl')
source_tarball_file="${dir:?}/vaultonomy_${tag:?}.tar.gz"

log_info "Downloading GitHub release archive and source tarball..."
curl -#Lf --remove-on-error -o "${source_tarball_file:?}" "${source_tarball_url:?}" \
  -o "${release_archive_file:?}" "${release_archive_url:?}"

# Validate the authenticity of the release archive by ensuring it was built in CI
log_info "Verifying release archive attestation..."
gh attestation verify "${release_archive_file:?}" \
  --repo h4l/vaultonomy \
  --signer-workflow "h4l/vaultonomy/.github/workflows/ci.yml@refs/tags/${tag:?}" \
  >&2

manifest_json=$(unzip -qc "${release_archive_file:?}" manifest.json)
manifest_version=$(jq <<<"${manifest_json:?}" -er .version)
[[ $manifest_version =~ ^[0-9.]+$ ]] || err_exit "invalid manifest version: ${manifest_version@Q}"

# Check if the version already exists
log_info "Checking if release version already exists in AMO..."
version_detail_json_file="${dir:?}/version.json"
version_status=$(
  curl -# -o "${version_detail_json_file:?}" -w "%{http_code}" \
    -H @<("${__scripts:?}/amo-auth.sh") \
    "${AMO_BASE_URL:?}/api/v5/addons/addon/vaultonomy/versions/${manifest_version:?}/"
)

if [[ $version_status == 200 ]]; then
  log_info "Version ${manifest_version} (${tag:?}) already exists in AMO"
  version_detail_json=$(<"${version_detail_json_file:?}")
elif [[ $version_status != 404 ]]; then
  err_exit "Unable to determine if version exists in AMO: Unexpected HTTP status: ${version_status?}"
else # Version not yet created
  # create version
  log_info "Version ${manifest_version:?} (${tag:?}) does not yet exist in AMO"

  log_info "Uploading release archive for validation"
  upload_detail_json=$(
    curl -# -f -H @<("${__scripts:?}/amo-auth.sh") \
      -F "upload=@${release_archive_file:?}" -F "channel=unlisted" \
      "${AMO_BASE_URL:?}/api/v5/addons/upload/"
  )
  upload_uuid=$(jq <<<"${upload_detail_json:?}" -er .uuid)
  upload_uuid=${upload_uuid//\/}  # remove any / (should be no-op)

  log_info "Waiting for upload to be validated..."
  # Try for ~10 minutes max — normally only takes 10-20 seconds
  for (( i = 0; ; i++ )) {
    if (( i >= 120 )); then
      err_exit "Timed out waiting for uploaded .zip to be validated."
    fi

    if jq <<<"${upload_detail_json:?}" -er '.processed' > /dev/null; then
      if ! jq <<<"${upload_detail_json:?}" -er '.valid' > /dev/null; then
        err_exit "Release archive failed validation after upload:", $'\n' "${upload_detail_json:?}"
      fi
      break
    fi

    sleep 5

    upload_detail_json=$(
      curl -# -f --retry 3 -H @<("${__scripts:?}/amo-auth.sh") \
      "${AMO_BASE_URL:?}/api/v5/addons/upload/${upload_uuid:?}/"
    )
  }

  log_info "Creating version ${manifest_version:?} from validated release archive"
  version_detail_json=$(
    curl -# -f -H @<("${__scripts:?}/amo-auth.sh") \
      -F "upload=${upload_uuid:?}" \
      -F "source=@${source_tarball_file:?}" -F license=MIT \
      "${AMO_BASE_URL:?}/api/v5/addons/addon/vaultonomy/versions/"
  )
fi

log_info "Waiting for upload to be approved & signed..."
for (( i = 0; ; i++ )) {
  if (( i >= 120 )); then
    err_exit "Timed out waiting for upload version to be approved & signed."
  fi

  # Status is initially "unreviewed" and becomes "public" when the zip is signed
  if jq <<<"${version_detail_json:?}" -e '.file.status == "public"' > /dev/null
  then break; fi

  sleep 5

  version_detail_json=$(
    curl -# -f --retry 3 -H @<("${__scripts:?}/amo-auth.sh") \
      "${AMO_BASE_URL:?}/api/v5/addons/addon/vaultonomy/versions/${manifest_version:?}"
  )
}

signed_xpi_url=$(jq <<<"${version_detail_json:?}" -er '.file.url')
signed_xpi_file="${dir:?}/vaultonomy_firefox_${tag:?}.xpi"
# We have to send credentials to to the download URL so it seems prudent to
# ensure the URL is on the AMO server. (This URL is not under the /api path.)
[[ ${signed_xpi_url:?} == "${AMO_BASE_URL:?}"/*.xpi ]] \
  || err_exit "Signed .xpi download URL is not under ${AMO_BASE_URL@Q}: ${signed_xpi_url@Q}"

log_info "Downloading signed release package:" "${signed_xpi_url:?}"
curl -# -f --retry 3 -H @<("${__scripts:?}/amo-auth.sh") \
  -o "${signed_xpi_file:?}" "${signed_xpi_url:?}"

# The path to the downloaded, signed .xpi is the only output on stdout
echo "AMO_SIGNED_XPI_FILE=${signed_xpi_file:?}"

# TODO: handle listed as well as unlisted
#  - detect unlisted from tag structure
