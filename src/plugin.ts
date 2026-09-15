import json from '@eslint/json';
import type { ESLint, Linter } from 'eslint';
import { version } from '../package.json';
import noInsignificantWhitespace from './rules/no-insignificant-whitespace';
import numberFormat from './rules/number-format';
import prettyFormat from './rules/pretty-format';
import stringEscaping from './rules/string-escaping';

/**
 * The full RFC 8785 member-ordering facet (§3.2.3) is exactly \@eslint/json's own built-in sort-keys rule configured for plain UTF-16 code-unit comparison (`asc`, case-sensitive, non-natural) -- JS's own `<=` on two strings already does that comparison, so no separate ordering rule exists in this plugin. Bundled under the json/ namespace alongside this plugin's own two always-on content rules; every one of this package's three configs (recommended, contentOnly, canonical) includes this exact set unchanged -- they differ only in which whitespace/layout facet, if any, rides alongside it.
 */
const CONTENT_RULES: NonNullable<Linter.Config['rules']> = {
  'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
  'json-canonical/number-format': 'error',
  'json-canonical/string-escaping': 'error',
};

function buildContentConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin, extraRules: Linter.Config['rules']): Linter.Config {
  return {
    plugins: { json: jsonPlugin, 'json-canonical': selfPlugin },
    language: 'json/json',
    rules: { ...CONTENT_RULES, ...extraRules },
  };
}

/**
 * `configs.recommended`'s own builder: content canonicalization plus this package's pretty-printing rule, so a project extending only `configs.recommended` gets both a stable member order and human-readable, 2-space-indented layout by default -- the layout most hand-authored or `prettier`-formatted JSON already has, not RFC 8785's own fully-collapsed canonical form (see `buildCanonicalConfig` for that). A plain top-level function, called from the `configs.recommended` getter below rather than inlined into it, so it's directly unit-testable on its own.
 */
export function buildRecommendedConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin): Linter.Config {
  return buildContentConfig(jsonPlugin, selfPlugin, { 'json-canonical/pretty-format': 'error' });
}

/**
 * `configs.contentOnly`'s own builder: content canonicalization alone, touching no whitespace or layout at all -- this is what `configs.recommended` meant before v2.0.0 introduced pretty-format as a first-class facet. Kept as its own named config, not merely reachable by disabling `json-canonical/pretty-format` on top of `configs.recommended`, since a consumer who wants this exact behaviour shouldn't have to know pretty-format exists at all to turn it back off.
 */
export function buildContentOnlyConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin): Linter.Config {
  return buildContentConfig(jsonPlugin, selfPlugin, {});
}

/**
 * `configs.canonical`'s own builder: content canonicalization plus the full RFC 8785 whitespace facet (`no-insignificant-whitespace`) -- the complete specification, collapsing a document to a single line with no insignificant whitespace anywhere. See that rule's own doc comment for why this is never the default: it makes any hand-edited document disruptive to read, which is exactly right for a genuine canonicalization pass (hashing, signing, byte-for-byte comparison) and exactly wrong for a file someone is expected to keep reading and editing by hand.
 */
export function buildCanonicalConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin): Linter.Config {
  return buildContentConfig(jsonPlugin, selfPlugin, { 'json-canonical/no-insignificant-whitespace': 'error' });
}

/**
 * The JSONC sibling of buildContentOnlyConfig above, for a file whose grammar genuinely admits comments and trailing commas (a tsconfig.json, a turbo.json, a plain .jsonc file) rather than plain JSON. Every rule in CONTENT_RULES already declares `json/jsonc` in its own `meta.languages` (`json/sort-keys` is \@eslint/json's own built-in, which supports it natively; number-format and string-escaping declare it explicitly in their own rule definitions), so the identical rule set applies unchanged -- only the language and its own `allowTrailingCommas` option differ. Confirmed directly, not merely assumed safe: `json/sort-keys`'s own fixer detects when a member carrying an attached comment would need to move to satisfy the requested order and reports the violation without autofixing it in that case, rather than risk relocating the comment to the wrong member -- a genuinely comment-free JSONC document (trailing commas alone) still reorders and autofixes exactly like plain JSON. Neither pretty-format nor no-insignificant-whitespace has a JSONC counterpart here and neither ever will: both rewrite a document's own whitespace wholesale, and neither has a well-defined answer for a comment's own attachment to a specific member once that happens.
 */
export function buildContentOnlyJsoncConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin): Linter.Config {
  // `@eslint/json`'s own language option, which ESLint core's LanguageOptions type does not model -- it declares no index signature, so writing the key inline on the returned Linter.Config is an excess property. Held in a bag typed for what it is (the language's own options, whose shape belongs to the plugin) rather than asserted past the core type.
  const jsoncLanguageOptions: Record<string, unknown> = { allowTrailingCommas: true };
  return {
    plugins: { json: jsonPlugin, 'json-canonical': selfPlugin },
    language: 'json/jsonc',
    languageOptions: jsoncLanguageOptions,
    rules: CONTENT_RULES,
  };
}

// Plain eslint core types (ESLint.Plugin/Linter.Config), not @typescript-eslint/utils' TSESLint.FlatConfig.Plugin: unlike @exadev/eslint-config, which mixes ESLintUtils.RuleCreator-built TSESTree rules into the same plugin object as JSON rules (the reason that package needs the more permissive TSESLint type), every rule here is a plain JSONRuleDefinition from @eslint/json's own types, which are themselves designed to satisfy eslint core's Plugin/Config shape directly -- no cross-type accommodation needed. meta.namespace is what a consumer's `plugins: { 'json-canonical': plugin }` registration turns into the rule-reference prefix; not inferred from the package name automatically.
const plugin: ESLint.Plugin = {
  meta: {
    name: 'eslint-plugin-json-canonical',
    version,
    namespace: 'json-canonical',
  },
  rules: {
    'no-insignificant-whitespace': noInsignificantWhitespace,
    'number-format': numberFormat,
    'pretty-format': prettyFormat,
    'string-escaping': stringEscaping,
  },
  configs: {
    // A getter, not a plain property, because it references `plugin` -- itself -- which is still in its temporal dead zone while this object literal is being constructed. A plain eager property would throw ReferenceError; the getter defers evaluation until a consumer actually reads a given config, by which point construction has finished.
    get recommended(): Linter.Config {
      return buildRecommendedConfig(json, plugin);
    },
    get contentOnly(): Linter.Config {
      return buildContentOnlyConfig(json, plugin);
    },
    get canonical(): Linter.Config {
      return buildCanonicalConfig(json, plugin);
    },
    get contentOnlyJsonc(): Linter.Config {
      return buildContentOnlyJsoncConfig(json, plugin);
    },
  },
};

export default plugin;
