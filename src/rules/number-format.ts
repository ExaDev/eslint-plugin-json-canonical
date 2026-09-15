import type { JSONRuleDefinition, JSONRuleVisitor } from '@eslint/json';
import type { NumberNode } from '@humanwhocodes/momoa';

export type NumberFormatMessageIds = 'nonCanonicalNumber' | 'unrepresentable';

export type NumberFormatRuleDefinition = JSONRuleDefinition<{
  MessageIds: NumberFormatMessageIds;
}>;

/**
 * RFC 8785 §3.2.2.3: a JSON number's canonical form is exactly what ECMAScript's `Number::toString` produces for its parsed value -- the same algorithm JavaScript's own `String(number)` implements (confirmed directly: `String(-0)` is `"0"`, `String(1.5e-7)` is `"1.5e-7"`, `String(1e21)` is `"1e+21"`, all matching the spec's own canonical examples). Momoa already parses each number literal's raw text into that value (`node.value`), so canonicalization is just `String(node.value)` compared against the node's own raw source text -- no separate number-formatting algorithm needs implementing here.
 */
export const numberFormat: NumberFormatRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    languages: ['json/json', 'json/jsonc'],
    docs: {
      recommended: true,
      description: "Require JSON number literals to use their RFC 8785 canonical form (ECMAScript's Number::toString).",
      url: 'https://github.com/ExaDev/eslint-plugin-json-canonical/blob/main/src/rules/number-format.ts',
    },
    messages: {
      nonCanonicalNumber: 'This number is not in its RFC 8785 canonical form. Expected "{{canonical}}".',
      unrepresentable:
        'This number is too large or too small to be represented exactly as an IEEE 754 double, so RFC 8785 canonicalization is not well-defined for it. Left unchanged.',
    },
  },

  create(context) {
    return {
      Number(node: NumberNode) {
        if (!Number.isFinite(node.value)) {
          context.report({ loc: node.loc, messageId: 'unrepresentable' });
          return;
        }

        const canonical = String(node.value);
        const raw = context.sourceCode.getText(node);
        if (raw === canonical) return;

        context.report({
          loc: node.loc,
          messageId: 'nonCanonicalNumber',
          data: { canonical },
          fix: (fixer) => fixer.replaceText(node, canonical),
        });
      },
    } satisfies JSONRuleVisitor;
  },
};

export default numberFormat;
