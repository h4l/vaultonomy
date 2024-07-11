#!/usr/bin/env bash
# Create a JWT for the Firefox Add-ons API.
# https://mozilla.github.io/addons-server/topics/api/auth.html#access-credentials
#
# Set API credentials in environment variables:
#   AMO_JWT_ISSUER
#   AMO_JWT_SECRET
# Script dependencies: apt-get install jwt
set -euo pipefail

now=$(date +%s)
expiry=$(($now + 300))

claim=$(
  issuer=${AMO_JWT_ISSUER:?} nonce=$(uuid) expiry=${expiry:?} now=${now:?} \
  jq -cn '{
    "iss": env.issuer,
    "jti": env.nonce,
    "iat": env.now | tonumber,
    "exp": env.expiry | tonumber
  }'
)

# The head cmd strips trailing newline added by <<<.
token=$(
  jwt -alg HS256 -sign <(echo "${claim:?}") \
    -key <(head -c -1 <<<"${AMO_JWT_SECRET:?}")
)

echo "Authorization: JWT ${token:?}"
