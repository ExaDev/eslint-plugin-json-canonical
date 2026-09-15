import json from '@eslint/json';
import type { ESLint, Linter } from 'eslint';
import { version } from '../package.json';
import noInsignificantWhitespace from './rules/no-insignificant-whitespace';
import numberFormat from './rules/number-format';
import stringEscaping from './rules/string-escaping';

/**
 * The full RFC 8785 member-ordering facet (§3.2.3) is exactly \@eslint/json's own built-in sort-keys rule configured for plain UTF-16 code-unit comparison (`asc`, case-sensitive, non-natural) -- JS's own `<=` on two strings already does that comparison, so no separate ordering rule exists in this plugin. Bundled here, under the json/ namespace, alongside this plugin's own two always-on rules, so extending this one config gives the whole spec except the whitespace facet (see no-insignificant-whitespace's own doc comment for why that one stays opt-in) with a single `extends`. A plain top-level function, called from the `configs.recommended` getter below rather than inlined into it, so it's directly unit-testable on its own.
 */
export function buildRecommendedConfig(jsonPlugin: ESLint.Plugin, selfPlugin: ESLint.Plugin): Linter.Config {
  return {
    plugins: { json: jsonPlugin, 'json-canonical': selfPlugin },
    language: 'json/json',
    rules: {
      'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
      'json-canonical/number-format': 'error',
      'json-canonical/string-escaping': 'error',
    },
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
  },
};

export default plugin;
