import json from '@eslint/json';
import type { ESLint, Linter } from 'eslint';
import { version } from '../package.json';
import noInsignificantWhitespace from './rules/no-insignificant-whitespace';
import numberFormat from './rules/number-format';
import stringEscaping from './rules/string-escaping';

const RECOMMENDED_RULES: NonNullable<Linter.Config['rules']> = {
  'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
  'json-canonical/number-format': 'error',
  'json-canonical/string-escaping': 'error',
};

/**
 * The full RFC 8785 member-ordering facet (§3.2.3) is exactly \@eslint/json's own built-in sort-keys rule configured for plain UTF-16 code-unit comparison (`asc`, case-sensitive, non-natural) -- JS's own `<=` on two strings already does that comparison, so no separate ordering rule exists in this plugin. Bundled here, under the json/ namespace, alongside this plugin's own two always-on rules, so extending this one config gives the whole spec except the whitespace facet (see no-insignificant-whitespace's own doc comment for why that one stays opt-in) with a single `extends`. A plain top-level function, called from the `configs.recommended` getter below rather than inlined into it, so it's directly unit-testable on its own.
 */
export function buildRecommendedConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin): Linter.Config {
  return {
    plugins: { json: jsonPlugin, 'json-canonical': selfPlugin },
    language: 'json/json',
    rules: RECOMMENDED_RULES,
  };
}

/**
 * The JSONC sibling of buildRecommendedConfig above, for a file whose grammar genuinely admits comments and trailing commas (a tsconfig.json, a turbo.json, a plain .jsonc file) rather than plain JSON. Every rule in RECOMMENDED_RULES already declares `json/jsonc` in its own `meta.languages` (`json/sort-keys` is \@eslint/json's own built-in, which supports it natively; number-format and string-escaping declare it explicitly in their own rule definitions), so the identical rule set applies unchanged -- only the language and its own `allowTrailingCommas` option differ. Confirmed directly, not merely assumed safe: `json/sort-keys`'s own fixer detects when a member carrying an attached comment would need to move to satisfy the requested order and reports the violation without autofixing it in that case, rather than risk relocating the comment to the wrong member -- a genuinely comment-free JSONC document (trailing commas alone) still reorders and autofixes exactly like plain JSON. `no-insignificant-whitespace` has no JSONC counterpart here and never will: it collapses a document's own formatting to a single line, which would delete every comment outright, not merely leave one attached to the wrong member -- see that rule's own doc comment for why it stays opt-in even for plain JSON, a fortiori for a format whose entire purpose is carrying comments.
 */
export function buildRecommendedJsoncConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin): Linter.Config {
  // `@eslint/json`'s own language option, which ESLint core's LanguageOptions type does not model -- it declares no index signature, so writing the key inline on the returned Linter.Config is an excess property. Held in a bag typed for what it is (the language's own options, whose shape belongs to the plugin) rather than asserted past the core type.
  const jsoncLanguageOptions: Record<string, unknown> = { allowTrailingCommas: true };
  return {
    plugins: { json: jsonPlugin, 'json-canonical': selfPlugin },
    language: 'json/jsonc',
    languageOptions: jsoncLanguageOptions,
    rules: RECOMMENDED_RULES,
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
    'string-escaping': stringEscaping,
  },
  configs: {
    // A getter, not a plain property, because it references `plugin` -- itself -- which is still in its temporal dead zone while this object literal is being constructed. A plain eager property would throw ReferenceError; the getter defers evaluation until a consumer actually reads `configs.recommended`, by which point construction has finished.
    get recommended(): Linter.Config {
      return buildRecommendedConfig(json, plugin);
    },
    get recommendedJsonc(): Linter.Config {
      return buildRecommendedJsoncConfig(json, plugin);
    },
  },
};

export default plugin;
