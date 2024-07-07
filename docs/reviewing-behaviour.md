# Reviewing Vaultonomy Behaviour

This document contains advice for people reviewing Vaultonomy for security
reasons — to understand its behaviour and implications for security. It
describes how Vaultonomy works at a high level, how its architectural components
restrict privileged access to the user's Reddit account.

Also see the [Reviewing Vaultonomy Releases] page, which covers how to review
and verify the installable extension files.

- Reviewing Vaultonomy Behaviour (this document) explains how to verify that the
  intended behaviour of Vaultonomy is acceptable.
- [Reviewing Vaultonomy Releases] explains how to verify that the installed
  software does in fact exhibit the intended behaviour established here — i.e.
  the distributed release package accurately reflects the source code.

[Reviewing Vaultonomy Releases]: ./reviewing-releases.md

## Overview

Vaultonomy uses the [Manifest V3] browser extension API — the modern way to build
browser extensions. Manifest V3 extensions are sandboxed to prevent extension code
directly interacting with code running in web pages, or other extensions. And fine-grained
permission-based access to user data. Manifest V3 extensions are [not permitted to execute dynamically-sourced code](https://developer.chrome.com/docs/extensions/mv3/sandboxingEval/),
only code statically included in with browser extension.

[manifest v3]:
  https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/#feature-summary

## Vaultonomy's Architecture

Vaultonomy is comprised of 4 components:

- The User Interface (UI) — by default a side bar in the browser, but can be
  opened in a window or tab.
  - [`src/ui-entry.tsx`](../src/ui-entry.tsx)
  - `ui.js` in the built package
- The Background Service
  - [`src/background-entry.ts`](../src/background-entry.ts)
  - `background.js` in the built package
- Two Reddit content scripts

  _Browser extensions don't support injecting content scripts that are
  Javascript Modules, so we actually inject a small shim that imports these
  modules._

  - Reddit Interaction
    - [`src/reddit-entry.ts`](../src/reddit-entry.ts)
    - `reddit.js` in the built package
    - loaded via [`reddit-contentscript.js`](../public/reddit-contentscript.js)
  - User Interest Detector
    - [`src/reddit/ui/detect-user-interest.ts`](../src/reddit/ui/detect-user-interest.ts)
    - `reddit-detect-user-interest.js` in the built package
    - loaded via
      [`reddit-reddit-detect-user-interest-contentscript.js`](../public/reddit-detect-user-interest-contentscript.js)

Each of these correspond to the `build.lib.entry.*` properties in
[`vite.config.ts`](../vite.config.ts), which configures the build process.

Components run in isolated runtime environments that communicate via message
passing. There is a general principle that each component can be reviewed
independently, as it's not possible for one component to reach into another and
change its behaviour at runtime.

> However, bear in mind that components are Javascript Modules, which gives them
> the ability to import other modules dynamically at runtime. The implication is
> that a component (perhaps a malicious dependency) could import unexpected
> behaviour from elsewhere in the app. This should be easy to exclude however,
> as `import()` is a keyword that cannot be reassigned, so code cannot obfuscate
> `import()` calls.

### Reddit user data isolation

Vaultonomy isolates all interaction with Reddit to the two Reddit content
scripts. The Reddit Interaction component is responsible for all API calls to
Reddit, and also for fetching and holding authentication tokens for the
logged-in Reddit user.

The aim of this isolation is to limit the scope of what has access to the user's
credentials.

### Component communication

We use JSONRPC to communicate between components. The Web Extension APIs provide
persistent bi-directional message channels using the Port API. The messages it
passes are JSON, so layering JSONRPC on top to structure the requests and
responses fits quite naturally.

### Reddit Interaction component

All communication with the Reddit Interaction component is defined by the
JSONRPC server in
[reddit-interaction-server.ts](../src/reddit/reddit-interaction-server.ts). It
exposes distinct, pre-defined methods for each of the Reddit APIs the extension
uses. It does not allow for other APIs to be dynamically called based on request
parameters, so the scope of APIs that the rest of the extension can use is
fixed.

APIs the Interaction Server exposes (and uses internally) are read-only, apart
from the `RedditRegisterAddressWithAccount` method. This is the operation that
pairs an Ethereum wallet address with the user's Reddit account. This operation
can be undone by the user subsequently. The exception to this is if a user has a
Vault that they lack the seed phrase for. In this case, once the inaccessible
Vault is replaced, the user cannot re-pair it later, as they need access to the
seed phrase to sign a pairing message.

The read APIs only expose publicly-available information — the server drops
private data from the user's own profile before sending responses, as this data
is not needed by other components.

#### Secure auth token caching

To allow for immediate API requests on extension startup, we cache the user's
last auth token in extension storage. Normally this would make the credential
accessible to all components, but we encrypt the credential in such a way that
only the Reddit components can access it (in practice only the Interaction
component does).

The way this works is that there are two encryption keys. A data key encrypts
the credential. A wrapping key encrypts the data key. The encrypted data key is
stored in extension storage. The wrapping key is stored in Reddit web page
storage. The result of this arrangement is that only the Reddit components have
access to both keys and the data, so only they can decrypt the cached auth
token. See [src/reddit/private-cache](../src/reddit/private-cache/index.ts).

### User Interest Detector component

This component is the smallest of the lot. It's responsible for detecting when
the extension user is interested in another user, so that the UI can
automatically display the Vault details of the user of interest.

It does this by detecting when a link to a Reddit user is being hovered over
with the mouse. If the hover is long enough, it sends a message to the
Background Service to inform it of the user of interest.

### Background Service component

The Background is responsible for providing the UI with the data it needs to
work. [`BackgroundService`](../src/background/BackgroundService.ts) is the
central piece that defines all the sub-components of the BackgroundService.

The most important subcomponent in the Background is the JSONRPC server it
exposes
([`VaultonomyBackgroundServiceSession`](../src/background/VaultonomyBackgroundServiceSession.ts))
which proxies the methods exposed by the Reddit Interaction JSONRPC service, and
also provides some additional methods to access internal extension data, like
extension settings.

### UI component

The UI is a React app that gets data via (you guessed it) JSONRPC requests to
the Background Component. The only web extension APIs it uses are to establish
Port connections to the Background to send JSONRPC messages across, and session
storage to persist the UI state.

Because the UI isn't responsible for interacting with general web extension
APIs, we are able to run the UI in a separate web page when developing
Vaultonomy. This makes it possible to hot-reload the UI, making development
significantly more efficient and pleasant. It also has a slight secondary
benefit that the UI should not be using any privileged web extension APIs (other
than session storage), which makes it easier to review.

> Note that the separate web page UI is only enabled in the development builds
> of Vaultonomy. In development mode, the `BackgroundService` is
> [`DevModeBackgroundService`](../src/devserver/DevModeBackgroundService.ts),
> and it's not used in the production build, and the `externally_connectable`
> permission it requires to work is not in the production `manifest.json`.

### Extension permissions

The extension requests the following permissions, defined in
[manifest.json](../src/manifest.json). (Note that the manifest is partially
generated at build time in [`vite.config.ts`](../vite.config.ts)).

- `scripting` — Allows the extension to run JavaScript code with access to web
  pages it has host permissions for (the current tab when the action button is
  pressed, due to `activeTab`, and the `reddit.com` `host_permissions`).
- `sidePanel` — Allows the extension to load its UI in the browser side bar.
- `storage` — Allows the extension to save data in a private browser area only
  accessible to the extension itself.
- `contextMenus` — Allows the extension to add extra context menu items in the
  menu that shows after right-clicking on the Vaultonomy extension icon.
- `activeTab` — Gives temporary host permission to the currently active tab if
  the Vaultonomy extension icon is pressed.
- `host_permissions` — The extension lists host permission for www, new and old
  `.reddit.com`. These allow the extension to connect to any open Reddit tab,
  regardless of the active tab where the UI is opened.

Normally an extension would not need both `activeTab` and `host_permissions`.
The reason for both is that the extension allows users to disable persistent
host permissions in the browser's extension settings. With host permissions
removed, the extension relies on being activated with a Reddit tab in view,
using the `activeTab` permission for temporary access to this tab.

Security concious users may prefer this mode of operation, as it means the
extension has no passive access to tabs apart from when it's actively in use.

In either mode of operation the extension only injects its content script into
tabs that contain a Reddit web page. Two places where the extension dynamically
injects content scripts are found in
[`BackgroundService`](../src/background/BackgroundService.ts):

1. The constructor creates a
   `redditTabConnector(new DefaultRedditTabProvider())`

   - `redditTabConnector` contains the `browser.scripting.executeScript()` call,
     and `DefaultRedditTabProvider` is responsible for selecting accessible
     Reddit tabs.

2. The `injectUserInterestDetectionContentScriptInOpenRedditTabs()` method
   injects the User Interest Detector script after install.

### Summary

The strategy I suggest for reviewing Vaultonomy's behaviour is to focus
primarily on the two Reddit components with direct access to Reddit tabs. Verify
the APIs the Interaction component accesses and exposes are fixed and expected.

Secondarily, the Background Service, which uses web extension APIs to find and
connect to Reddit tabs, so it needs attention. It should be quite
straightforward to review the web extension APIs its using.

The UI is the largest part by code size, but luckily also the least privileged.
You should be able to establish that it's not accessing web extension APIs other
than to connect to the Background Service.

If you can satisfy yourself that there is indeed a constrained boundary between
the Reddit components and the rest, that the Background Service only interacts
with Reddit tabs via the Reddit components, and that the UI doesn't use
privileged web extension APIs, you can understand the overall scope of behaviour
the extension has.
