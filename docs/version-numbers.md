# Extension Version Numbers

A note on how Vaultonomy version numbers work.

Versions in package.json must follow these rules:

- Release versions:
  - 3 component semver, with an EVEN patch (final) digit
  - e.g: `1.2.4`
- Pre-release versions:
  - 3 component semver, with an ODD patch (final) digit
  - A pre-release identifier, like beta.1 alpha.2 rc.4
  - e.g: `1.2.3-beta.1`

We use the version from package.json to generate the `version` and
`version_name` extension manifest.json fields. This requires some transformation
to mediate between semver versions and web extension manifest.json version
requirements.

Extension manifest.json `version` property must be a strict `1.2.3` or
`1.2.3.4`, whereas our semver versions are `1.2.4` or `1.2.3-beta.5`.

We map either of these version types onto the 3 or 4 component extension
versions by using the pre-release number as the 4th component. This ensures that
pre-release versions cannot conflict with release versions, as when preparing to
release 1.2.4, the pre-release versions will be 1.2.3-beta.5, thus 1.2.3.5, i.e.
before 1.2.4.

The `version_name` manifest field is the full package.json version.
