# eslint-plugin-json-canonical

[![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white)](https://github.com/ExaDev/eslint-plugin-json-canonical) [![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/eslint-plugin-json-canonical) [![CI](https://img.shields.io/github/actions/workflow/status/ExaDev/eslint-plugin-json-canonical/ci.yml?branch=main)](https://github.com/ExaDev/eslint-plugin-json-canonical/actions)

> An ESLint plugin for [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (the JSON Canonicalization Scheme), built on [`@eslint/json`](https://github.com/eslint/json).

## Why

RFC 8785 defines a byte-for-byte canonical serialization of JSON: member ordering (§3.2.3), number formatting (§3.2.2.3), string escaping (§3.2.2.2), and whitespace (§3.2.1). This plugin enforces those facets as ESLint rules, autofixable, so a JSON file can be checked and corrected the same way any other source file is.

Member ordering (plain UTF-16 code-unit comparison) is exactly `@eslint/json`'s own built-in `json/sort-keys` rule configured correctly -- no separate rule for it exists here. `number-format` and `string-escaping` are this plugin's own rules. Whitespace is where RFC 8785 and everyday JSON authoring genuinely disagree: the canonical form has none at all, collapsing a document to a single line, which is exactly wrong for a file someone is expected to keep reading and editing by hand. This plugin resolves that with three configs rather than picking one winner.

## Getting started

```sh
pnpm add -D eslint-plugin-json-canonical @eslint/json
```

```ts
// eslint.config.ts
import json from '@eslint/json';
import jsonCanonical from 'eslint-plugin-json-canonical';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.json'],
    ignores: ['**/tsconfig*.json', '**/turbo.json', '**/package.json'],
    plugins: { json },
    extends: [jsonCanonical.configs.recommended],
  },
]);
```

## The three configs

All three enable the same content-canonicalization rules (`json/sort-keys`, `number-format`, `string-escaping`); they differ only in whitespace/layout handling.

| Config | Content rules | Layout |
| --- | --- | --- |
| `configs.recommended` (default) | ✓ | Pretty-printed: 2-space indentation, one member/element per line, single trailing newline |
| `configs.contentOnly` | ✓ | Untouched -- whatever whitespace the file already has |
| `configs.canonical` | ✓ | Full RFC 8785 §3.2.1: no insignificant whitespace anywhere, collapsed to one line |
| `configs.contentOnlyJsonc` | ✓ | Untouched; for `json/jsonc` files (comments, trailing commas) instead of plain JSON |

`configs.recommended` is the sensible everyday default: stable key order and canonical number/string formatting, in a layout that stays readable and diffable. Reach for `configs.contentOnly` if you already format JSON some other way (Prettier, a `.editorconfig`-driven formatter) and only want the content rules. Reach for `configs.canonical` for a genuine canonicalization pass -- hashing, signing, byte-for-byte comparison against another canonical producer -- where the output is never meant to be hand-edited again.

`configs.recommended`'s pretty-printing is deliberately simple, not a `prettier`-compatible width-aware formatter: every non-empty object or array always breaks one member/element per line, however short, rather than packing short values onto one line the way `prettier --write` would. This is fully deterministic and needs no line-width bookkeeping, at the cost of sometimes producing a more broken-out document than Prettier would for the same input. If your project also runs Prettier over its JSON files, use `configs.contentOnly` instead so the two never disagree about layout.

None of the four configs touch `**/tsconfig*.json`, `**/turbo.json`, or `**/package.json` for you -- scope those yourself (see the example above and [Notes on specific files](#notes-on-specific-files) below).

## Rules

| Rule | Fixable | In `recommended` | In `contentOnly` | In `canonical` |
| --- | --- | --- | --- | --- |
| `json/sort-keys` (from `@eslint/json`, configured `asc`/`caseSensitive: true`/`natural: false`) | ✓ | ✓ | ✓ | ✓ |
| `number-format` | ✓ | ✓ | ✓ | ✓ |
| `string-escaping` | ✓ | ✓ | ✓ | ✓ |
| `pretty-format` | ✓ | ✓ | | |
| `no-insignificant-whitespace` | ✓ | | | ✓ |

- **`number-format`** -- requires a JSON number literal's text to match ECMAScript's own `Number::toString` output (RFC 8785 §3.2.2.3). A value too large or small to represent exactly as an IEEE 754 double (`1e400`, say) is reported without a fix, since RFC 8785 canonicalization is not well-defined for it.
- **`string-escaping`** -- requires a JSON string literal's escaping to match ECMA-262's `Quote()` operation (RFC 8785 §3.2.2.2), i.e. what `JSON.stringify` already produces for a plain string.
- **`pretty-format`** -- see [The three configs](#the-three-configs) above. `json/json` only.
- **`no-insignificant-whitespace`** -- the full RFC 8785 §3.2.1 whitespace facet: no space after `:`/`,`, no newlines, no indentation, nothing before the first token or after the last. `json/json` only -- see the rule's own source comment for why a JSONC counterpart will never exist (there is no well-defined answer for a comment's own attachment to a specific member once its surrounding whitespace is rewritten out from under it).

## Notes on specific files

- **`package.json`** -- its key order is a distinct, separately-optional convention (a fixed field-priority order such as `name`/`version`/`description` first, then alphabetical -- what [`syncpack format`](https://syncpack.dev/command/format) produces), not RFC 8785's plain alphabetical order. Scope this plugin away from `package.json` and use a dedicated tool for it (e.g. syncpack itself, or `@exadev/eslint-config`'s own `package-json-key-order` rule) if you want its ordering enforced too.
- **`tsconfig*.json` / `turbo.json`** -- these genuinely carry comments (TypeScript and Turborepo both accept them), so they need `configs.contentOnlyJsonc` under `json/jsonc`, not the plain-JSON configs, which fail to parse a comment at all.

## Upgrading from v1

`configs.recommended` changed meaning in v2.0.0: it now includes `pretty-format` by default, where v1 left whitespace untouched. If you were relying on v1's `configs.recommended` behaviour, switch to `configs.contentOnly`, which is v1's `configs.recommended` unchanged.

## Build, test, and lint

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test           # 100% coverage required
pnpm test:mutation   # Stryker, 100% mutation score required
pnpm build
```

Each rule has a co-located `*.test.ts`. `vitest.setup.ts` wires `RuleTester.describe`/`.it` to Vitest's `describe`/`it` explicitly.

## Release

Conventional commits drive [semantic-release](https://semantic-release.gitbook.io/semantic-release) on every push to `main`: version bump, `CHANGELOG.md`, GitHub Release, and npm publish via OIDC trusted publishing (no stored token).

## License

MIT
