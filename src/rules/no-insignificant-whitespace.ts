import type { JSONRuleDefinition, JSONRuleVisitor } from '@eslint/json';
import type { DocumentNode, Token } from '@humanwhocodes/momoa';

export type NoInsignificantWhitespaceMessageIds = 'insignificantWhitespace';

export type NoInsignificantWhitespaceRuleDefinition = JSONRuleDefinition<{
  MessageIds: NoInsignificantWhitespaceMessageIds;
}>;

export interface WhitespaceGap {
  readonly start: number;
  readonly end: number;
}

export interface RangedTokenLike {
  readonly range: readonly [number, number];
}

type RangedToken = Token & RangedTokenLike;

function hasRange(token: Token): token is RangedToken {
  return token.range !== undefined;
}

/**
 * `DocumentNode.tokens` is typed optional by momoa (only populated when `parse()` is called with `tokens: true`), but `@eslint/json`'s own language always passes that option, so in practice this rule is never invoked with it missing. Narrowing lives in its own function, rather than an inline `?? []` on the call site, specifically so its own "tokens is missing" branch can be unit-tested directly (see this file's own test) without needing a contrived momoa parse that doesn't reflect how the rule is actually ever invoked.
 */
export function filterRangedTokens(tokens: readonly Token[] | undefined): readonly RangedTokenLike[] {
  return (tokens ?? []).filter(hasRange);
}

/**
 * Every whitespace gap in a document: before the first token, between two tokens, and after the last -- as a plain forward scan needing no indexed array access at all (each token is compared against `previousEnd`, which starts at 0 and advances to that token's own end), so there's no defensive "what if this index is out of bounds" branch to write or to leave uncovered. Handles an empty `tokens` array correctly too (falls straight to the trailing check), even though a real parsed JSON document can never actually produce one -- every JSON value is at least one token, so `Document()` below is never invoked with zero tokens in practice; this function's own unit tests cover that case anyway since it's genuinely exercisable without needing a real (impossible) fixture. Only ever reads `.range`, so it's typed against that alone rather than the full momoa `Token` shape -- a test can hand it a plain `{ range }` object with no need to fabricate a real token's `type`/`loc`.
 */
export function computeInsignificantWhitespaceGaps(tokens: readonly RangedTokenLike[], documentLength: number): readonly WhitespaceGap[] {
  const gaps: WhitespaceGap[] = [];
  let previousEnd = 0;
  for (const token of tokens) {
    if (token.range[0] > previousEnd) gaps.push({ start: previousEnd, end: token.range[0] });
    previousEnd = token.range[1];
  }
  if (previousEnd < documentLength) gaps.push({ start: previousEnd, end: documentLength });
  return gaps;
}

/**
 * RFC 8785 §3.2.1: the canonical serialization has no insignificant whitespace anywhere -- no space after a `:`/`,`, no newlines, no indentation, nothing before the first token or after the last. A real document rewritten this way collapses to a single line, which is disruptive for anything hand-edited -- this rule is deliberately NOT part of `configs.recommended` and stays opt-in (see this package's own README).
 *
 * Scoped to `json/json` only, never `json/jsonc`: JSONC's whole reason to exist is carrying comments, which JSON's own grammar (and therefore RFC 8785) has no concept of at all -- there's no meaningful canonical answer for "should this comment's surrounding whitespace be removed" the way there is for a plain space or newline between two JSON tokens.
 */
export const noInsignificantWhitespace: NoInsignificantWhitespaceRuleDefinition = {
  meta: {
    type: 'layout',
    fixable: 'code',
    languages: ['json/json'],
    docs: {
      recommended: false,
      description: 'Require the RFC 8785 canonical serialization to carry no insignificant whitespace at all.',
      url: 'https://github.com/ExaDev/eslint-plugin-json-canonical/blob/main/src/rules/no-insignificant-whitespace.ts',
    },
    messages: {
      insignificantWhitespace: 'RFC 8785 canonical JSON carries no whitespace between tokens.',
    },
  },

  create(context) {
    return {
      Document(node: DocumentNode) {
        const tokens = filterRangedTokens(node.tokens);
        const gaps = computeInsignificantWhitespaceGaps(tokens, context.sourceCode.text.length);

        for (const gap of gaps) {
          context.report({
            loc: { start: context.sourceCode.getLocFromIndex(gap.start), end: context.sourceCode.getLocFromIndex(gap.end) },
            messageId: 'insignificantWhitespace',
            fix: (fixer) => fixer.removeRange([gap.start, gap.end]),
          });
        }
      },
    } satisfies JSONRuleVisitor;
  },
};

export default noInsignificantWhitespace;
