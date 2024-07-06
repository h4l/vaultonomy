# Reviewing Vaultonomy Releases

This document contains advice for people reviewing Vaultonomy for security
reasons — to understand its behaviour and implications for security. It
describes how to check that the releases published by Vaultonomy on Google Web
Store and Firefox Add-ons are verifiably the result of building the source code
in this repository, and have not been tampered with.

This is aimed at staff of extension hosting platforms and anyone with an
interest in what they're installing.

## Table of contents

1. [Background](#background)
1. [Vaultonomy's release archives](#vaultonomys-release-archives)
1. [Verifying a signed `.crx` or `.xpi` archive against a release archive](#verifying-a-signed-crx-or-xpi-archive-against-a-release-archive)
1. [Building from source](#building-from-source)

## Background

The general workflow to take an extension from developer to user is:

1. Developer bundles the extension code and resources into a `.zip` release
   archive
2. Developer submits the release archive to an extension Marketplace, like
   Chrome Web Store and Firefox Add-ons. The developer also submits source code
   and build instructions required to re-create the release archive.
3. The Marketplace performs automated & manual checks on the release archive to
   detect problems.
4. If the checks are passed, the Marketplace creates a digital signature of the
   distribution archive's contents. They add metadata files (including the
   signature) to the archive, and publish the result as a `.crx` (Chrome) `.xpi`
   (Firefox) file on their Marketplace for users to install. (Browsers only
   allow users to install extensions that have been signed by their
   Marketplace.)

## Vaultonomy's release archives

Vaultonomy requires a build step to generate the `.zip` extension release
archives. The build has two separate modes for Chrome-based browsers and
Firefox, to account for differences between the browsers.

The release archives that Vaultonomy submits to Google Web Store and Firefox
Add-ons are built in using GitHub Actions (build servers run by GitHub). We use
[GitHub's attestation](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
feature to create verifiable proofs that Vaultonomy's release archives were
built on a GitHub-operated Actions runner using the build instructions committed
to the repo at the tag version.

The release archives are published for each release on the
[repository's Releases page](https://github.com/h4l/vaultonomy/releases).

## Verifying a signed `.crx` or `.xpi` archive against a release archive

The `.crx` or `.xpi` file you install from your browser's extension Marketplace
should contain the files from the release archive, except for extra metadata
added by the Marketplace. At a high level, the steps to verify this are:

1. Download the `.crx` / `.xpi` archive from your Marketplace

   <details>
   <summary>Expand details…</summary>

   Download the Firefox `.xpi` file from Firefox Add-ons by right-clicking &
   "Save Link As…" on the "Add to Firefox" button on Vaultonomy's Firefox
   Add-ons page.

   To download the Chrome `.crx` file, you need to use a 3rd party tool because
   Chrome Web Store does not show a download link on its website. There are
   several 3rd party websites and browser extensions that will allow you to
   download `.crx` files for an extension. Search the web for "download chrome
   extension crx" or similar.

   </details>

2. Download the release archive for the same version number from the Vaultonomy
   GitHub releases page

    <details>
    <summary>Expand details…</summary>

   1. Go to https://github.com/h4l/vaultonomy/releases
   2. Search for the version number matching the version you're verifying
   3. Download the release archive from the release page. The release archives
      are named like:
      - `vaultonomy_chrome_v0.0.1.zip`
      - `vaultonomy_firefox_v0.0.1.zip`

   </details>

3. Verify GitHub's attestation that it built the release archive on its servers

   <details>
   <summary>Expand details…</summary>

   Vaultonomy uses [GitHub artefact attestations] to allow end-users to verify
   that a `.zip` release archive was built on GitHub's servers in a transparent
   way.

   1. Install GitHub CLI: https://cli.github.com/
   2. Use the `gh attestation verify` command to check the release archive you
      downloaded in step 2:

   ```console
   $ gh attestation verify vaultonomy_firefox_v0.0.1-citest.9.zip --repo h4l/vaultonomy
   Loaded digest sha256:1efb5d8e48f2df6e0270acd2a5377c0f31f5c8b16c7d836cc323ab990d5d7674 for file://vaultonomy_firefox_v0.0.1-citest.9.zip
   Loaded 1 attestation from GitHub API
   ✓ Verification succeeded!

   sha256:1efb5d8e48f2df6e0270acd2a5377c0f31f5c8b16c7d836cc323ab990d5d7674 was attested by:
   REPO            PREDICATE_TYPE                  WORKFLOW
   h4l/vaultonomy  https://slsa.dev/provenance/v1  .github/workflows/ci.yml@refs/tags/v0.0.1-citest.9
   ```

   If you'd like more in-depth details of the build, add `--format json` to the
   command. The output will contain details such as the exact git commit hash
   the build was made from, and a link to the GitHub Actions run logs.

   </details>

[GitHub artefact attestations]:
  https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds

4. Compare the files inside each archive to check they are identical

   <details>
   <summary>Expand details…</summary>

   In a typical UNIX command-line environment, you can use `unzip` and `diff`
   tools to compare the files:

   ```console
   # extract the marketplace's archive into the marketplace-files sub-directory
   $ unzip -d marketplace-files vaultonomy.crx
   ...

   # extract the release (source) archive into the release-files sub-directory
   $ unzip -d release-files vaultonomy_chrome_vX.Y.Z.zip
   ...

   # Compare the files in each directory
   $ diff -r release-files marketplace-files
   ...
   ```

   The output of `diff` will show any differences between the two directories.
   No output means no difference, so files that match will not be mentioned (use
   the `-s` option to list identical files).

   - For Chrome `.crx` files, you should expect the output to be as follows:

     ```console
     $ diff --recursive release-files marketplace-files
     Only in marketplace-files: _metadata
     diff --color=auto --recursive release-files/manifest.json marketplace-files/manifest.json
     1a2,3
     > "update_url": "https://clients2.google.com/service/update2/crx",
     >
     ```

     Chrome Web Store adds a `_metadata` directory, and also modifies
     `manifest.json` to add an `"update_url"` property at the top. It makes no
     other changes.

   - For Firefox `.xpi` files, you should expect the output to be as follows:

     ```console
     $ diff --recursive release-files marketplace-files
     Only in marketplace-files: META-INF
     ```

     Firefox Add-ons adds the META-INF directory, which contains several files.
     It makes no other changes.

   If you're using Windows, there are graphical applications that can compare
   directories of files or zip archives to each other. For example,
   [WinMerge](https://github.com/winmerge/winmerge). You may need to rename the
   `.crx` / `.xpi` files to use the `.zip` extension.

   </details>

## Building from source

Vaultonomy's release archives are built using docker. Building in a docker
container makes it easy to reproduce the builds without needing to manually
install and configure dependencies. However the core build step can run on your
own computer if you prefer.

You'll need a recent version of the Docker command-line tool installed, with
docker buildx.

### Building from a source tarball/zip or git clone

If you have a source tarball/zip you need to build from, extract it. Otherwise
clone Vaultonomy's git repository and check out the tag you wish to build.

From the root directory, run the following command (omit one of the `package-`
targets if you only need one platform):

```console
$ docker buildx bake package-firefox package-chrome
```

The build outputs are:

```console
$ tree dist/packages/
dist/packages/
├── chrome-production
│   └── vaultonomy_chrome-production.zip
└── firefox-production
    └── vaultonomy_firefox-production.zip
```

These are the `.zip` release archives that get submitted to Marketplaces for
review.

> Note: This uses the [`docker-bake.hcl`](../docker-bake.hcl) file, and builds
> the `package-firefox` and `package-chrome` targets. You can run with `--print`
> to see a dry-run description of what `bake` will do. The
> [`Dockerfile`](../Dockerfile) contains the build instructions.

> Note: The `.zip` filenames do not contain a version number in this example,
> because the build only gives numbers to builds that explicitly opt-in. You can
> set environment variables to get files with version numbers. This will not
> affect the files within the release archive — the version in `manifest.json`
> is set from the `package.json` version.
>
> - `GITHUB_REF_TYPE=tag`
> - `GITHUB_REF_NAME=vX.Y.Z`

> Note: The build takes steps to make it bit-for-bit reproducible, following
> advice from https://reproducible-builds.org. I've not yet conducted enough
> builds to be confident that it's consistency reproducible, but I've been able
> to reproduce CI builds locally bit-for-bit. The main source of potential
> differences is the version of the nodejs runtime used to perform the build, as
> it's currently using the latest 22.X.X version. However, run-time and
> build-time dependencies in package.json are pinned exactly.

### Building without docker

To build locally, install nodejs (we use version 22 currently).

```console
# Install npm dependencies
$ npm install

# To build for chrome:
$ npm run build

# To build for Firefox:
$ VAULTONOMY_BROWSER=firefox npm run build
```

This will create files under `dist/chrome/` or `dist/firefox/` respectively. The
files are not bundled into a release `.zip` archive, but should be the same as
the release archive files.
