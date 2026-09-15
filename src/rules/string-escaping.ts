import type { JSONRuleDefinition, JSONRuleVisitor } from '@eslint/json';
import type { StringNode } from '@humanwhocodes/momoa';

export type StringEscapingMessageIds = 'nonCanonicalString';

export type StringEscapingRuleDefinition = JSONRuleDefinition<{
  MessageIds: StringEscapingMessageIds;
}>;

/**
 * RFC 8785 §3.2.2.2 canonicalizes a JSON string's escaping via ECMA-262's `Quote(value)` abstract operation: `"` and `\` are always escaped, a control character below U+0020 uses the short escape (`\b\f\n\r\t`) where one exists and `\u00XX` otherwise, and every other character -- including U+2028/U+2029 and U+007F DEL -- is written literally, never escaped. `JSON.stringify` on a plain string implements exactly this same algorithm (confirmed directly: it leaves U+2028/U+2029 and DEL unescaped, matching a JSON-native reserializer rather than a JS-string-literal one, and escapes a lone surrogate as `\u00XX` to keep the output well-formed) -- so `JSON.stringify(node.value)` on momoa's already-unescaped `StringNode.value` IS the canonical form; no separate escaping algorithm needs implementing here.
 */
export const stringEscaping: StringEscapingRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    languages: ['json/json', 'json/jsonc'],
    docs: {
      recommended: true,
      description: "Require JSON string literals to use their RFC 8785 canonical escaping (ECMA-262's Quote).",
      url: 'https://github.com/ExaDev/eslint-plugin-json-canonical/blob/main/src/rules/string-escaping.ts',
    },
    messages: {
      nonCanonicalString: 'This string is not in its RFC 8785 canonical form. Expected {{canonical}}.',
    },
  },

  create(context) {
    return {
      String(node: StringNode) {
        const canonical = JSON.stringify(node.value);
        const raw = context.sourceCode.getText(node);
        if (raw === canonical) return;

        context.report({
          loc: node.loc,
          messageId: 'nonCanonicalString',
          data: { canonical },
          fix: (fixer) => fixer.replaceText(node, canonical),
        });
      },
    } satisfies JSONRuleVisitor;
  },
};

export default stringEscaping;
