## [2.1.5](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.1.4...v2.1.5) (2026-10-31)

### Continuous Integration

* push the release over SSH with a deploy key ([fa88e6b](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/fa88e6b2580f38635b6e82e4ea64cd6ce1b6e4a8))
* push the release to the SSH repository URL ([61f457a](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/61f457a1d5769ad0c57ebf6b96dd1476d68651c2))

## [2.1.4](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.1.3...v2.1.4) (2026-10-29)

### Bug Fixes

* list every commit type in the release notes ([068ee3d](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/068ee3d4df317ef3136fd061ab8a70f915537a47))

### Documentation

* list the commits behind each release that had an empty changelog entry ([edcef92](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/edcef92036b92da3481612b9b3feac0be5380967))

## [2.1.3](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.1.2...v2.1.3) (2026-10-06)

### Chores

* upgrade turbo to 2.11.5 and disable agentGuidance ([26d5ba0](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/26d5ba0a1113aa0155b8894d6d2ee0d9d06e7139))

## [2.1.2](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.1.1...v2.1.2) (2026-10-02)

### Documentation

* use one shared badge set in the readme ([bc5ebd1](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/bc5ebd123f4c47f1e6ff73b5fc4fcbcccaa91a3f))

## [2.1.1](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.1.0...v2.1.1) (2026-10-02)

### Documentation

* add live usage charts to the readme ([d9cd138](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/d9cd1382241341a1f02a41bcfa853377d562247b))

# [2.1.0](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.0.0...v2.1.0) (2026-09-15)


### Features

* add configurable and auto-detected indent to pretty-format ([e4f06bf](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/e4f06bf58716eff8bc5ed59370262ab52c957382))

# [2.0.0](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v1.1.0...v2.0.0) (2026-09-15)


* feat!: add pretty-format rule and make it configs.recommended's default layout ([73d43c1](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/73d43c1057b28cc1d3bcf594bc206c9132744e6f))


### BREAKING CHANGES

* configs.recommended now pretty-prints JSON by default
instead of leaving whitespace untouched. Use configs.contentOnly for
v1's old configs.recommended behaviour.

# [1.1.0](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v1.0.0...v1.1.0) (2026-09-15)


### Features

* add configs.recommendedJsonc for tsconfig.json/turbo.json-style files ([06e5744](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/06e5744abfb8032f5ef71c553f2953ff632ac0ac))

# 1.0.0 (2026-09-15)


### Features

* add number-format rule for RFC 8785 canonical number serialization ([35523f2](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/35523f283bb1a6dc58b1b24aedb8cd6baef092d5))
* add opt-in no-insignificant-whitespace rule for RFC 8785 section 3.2.1 ([55958a3](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/55958a3aaa3f22a328edc6b9c06d969231bdb795))
* add plugin entry point with a recommended config bundling sort-keys ([77d7d6d](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/77d7d6d0e90f27f039f19b261460be462d75af34))
* add string-escaping rule for RFC 8785 canonical string escaping ([5730bd5](https://github.com/ExaDev/eslint-plugin-json-canonical/commit/5730bd578d6cde8fa9b58cdc460f6d008b662d65))
