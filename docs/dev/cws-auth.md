# Chrome Web Store authentication for CI

Google Web Store provides an API that can publish new extension versions. We use
this API to publish extension versions from CI.

- API Tutorial: https://developer.chrome.com/docs/webstore/using-api
- API Reference: https://developer.chrome.com/docs/webstore/api

We authenticate API requests in CI using OAuth 2.0, with the same workflow a web
app uses to act on behalf of a user when they are offline.

- There's a project in https://console.cloud.google.com/ with the Chrome Web
  Store API enabled
- We have an Oauth 2.0 Client for Vaultonomy GitHub Actions
  - The client authorises redirects to
    https://developers.google.com/oauthplayground so that we can use it to
    initiate an auth exchange (seeing as we don't actually have a web interface
    that will do it)
- In CI, we use the Client ID, Client Secret and Refresh Token to obtain a
  short-lived Access Token. The Access Token is a Bearer token which is sent
  with our API requests.

## How-to

### Create Refresh Token

- Go to https://developers.google.com/oauthplayground/
- In settings (cog icon), select "Use your own OAuth credentials" and enter the
  Vaultonomy OAuth 2.0 Client ID and Secret
- In the Select & authorize APIs section, enter the scope for Chrome Web Store
  read & write: `https://www.googleapis.com/auth/chromewebstore`
- Proceed to authorize access to the Google Account that publishes Vaultonomy
  - e.g. the normal Google login screen to grant the Vaultonomy app access to
    Google Web Store on behalf of the Google Account
- Exchange the Authorisation Code for a Refresh Token (and Access Token)
- Store the Refresh Token (along with Client ID and Client Secret) as secrets in
  the Vaultonomy GitHub repo's Environment for the Google Web Store

### Revoke Refresh Token

To revoke and disable the Refresh Token used in CI runs:

- Go to https://myaccount.google.com/
- Find the connected third-party apps/services list
- Find the Vaultonomy app (corresponding to the console.cloud.google.com
  project)
- Revoke it's access
