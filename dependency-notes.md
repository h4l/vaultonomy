# Dependency Notes

This file documents known issues with our dependencies, such as deps that can't
be upgraded to the current latest version.

## `@metamask/providers`

Can't upgrade 16 to 17 until https://github.com/MetaMask/providers/pull/340 is
fixed. (Release is incorrectly bundled, causing JSON file import fail.)

## `prettier-2:prettier@^2`

jest needs v2 of prettier until jest 30 is released:

- https://github.com/jestjs/jest/issues/14305
- See workaround in `jest-config.js` setting `prettierPath` to `prettier-2`.
