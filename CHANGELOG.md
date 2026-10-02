## [2.1.2](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.1.1...v2.1.2) (2026-10-02)

## [2.1.1](https://github.com/ExaDev/eslint-plugin-json-canonical/compare/v2.1.0...v2.1.1) (2026-10-02)

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
