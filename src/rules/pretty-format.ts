import type { JSONRuleDefinition, JSONRuleVisitor } from '@eslint/json';
import type { DocumentNode, Token } from '@humanwhocodes/momoa';

export type PrettyFormatMessageIds = 'nonPrettyWhitespace';

/**
 * `2`/`4` request that many literal spaces per level; `'tab'` requests one literal tab character per level; `'auto'` (the default) detects the document's own existing indent unit from its first genuinely indented member -- see detectIndentUnit's own doc comment -- falling back to two spaces for a document with no indentation to detect from (already compact, or a bare scalar/empty container).
 */
export type PrettyFormatIndentOption = 2 | 4 | 'tab' | 'auto';

export type PrettyFormatRuleOptions = [PrettyFormatIndentOption];

export type PrettyFormatRuleDefinition = JSONRuleDefinition<{
  RuleOptions: PrettyFormatRuleOptions;
  MessageIds: PrettyFormatMessageIds;
}>;

export interface ExpectedWhitespaceGap {
  readonly start: number;
  readonly end: number;
  readonly expected: string;
}

export interface RangedTokenLike {
  readonly type: Token['type'];
  readonly range: readonly [number, number];
}

type RangedToken = Token & RangedTokenLike;

function hasRange(token: Token): token is RangedToken {
  return token.range !== undefined;
}

/**
 * `DocumentNode.tokens` is typed optional by momoa (only populated when `parse()` is called with `tokens: true`), but `@eslint/json`'s own language always passes that option, so in practice this rule is never invoked with it missing -- see no-insignificant-whitespace's own identical function for the full reasoning (that rule's own copy is used verbatim as the model for this one, deliberately duplicated rather than imported: the two rules' own token-shape needs already diverge, this one needs `.type` too, and a shared cross-file helper would only save a handful of lines at the cost of coupling two otherwise-independent rules to a shape neither owns).
 */
export function filterRangedTokens(tokens: readonly Token[] | undefined): readonly RangedTokenLike[] {
  return (tokens ?? []).filter(hasRange);
}

const TWO_SPACE_INDENT = 2;
const FOUR_SPACE_INDENT = 4;
const DEFAULT_INDENT_UNIT = ' '.repeat(TWO_SPACE_INDENT);
const OPENING_TYPES: ReadonlySet<Token['type']> = new Set(['LBrace', 'LBracket']);
const CLOSING_TYPES: ReadonlySet<Token['type']> = new Set(['RBrace', 'RBracket']);

function indent(depth: number, indentUnit: string): string {
  return indentUnit.repeat(depth);
}

/**
 * Resolves an `indent` option to the literal string repeated once per nesting level: `2`/`4` to that many spaces, `'tab'` to one tab character, and `'auto'` to whatever `detectIndentUnit` finds in the document itself (falling back to `DEFAULT_INDENT_UNIT` when there's nothing to detect). A plain lookup/detection step, kept separate from `indent` above, so a rule invocation resolves the unit exactly once per document rather than re-detecting it for every gap.
 */
export function resolveIndentUnit(option: PrettyFormatIndentOption, tokens: readonly RangedTokenLike[], sourceText: string): string {
  if (option === 'tab') return '\t';
  if (option === TWO_SPACE_INDENT || option === FOUR_SPACE_INDENT) return ' '.repeat(option);
  return detectIndentUnit(tokens, sourceText) ?? DEFAULT_INDENT_UNIT;
}

/**
 * The document's own existing indent unit, read directly from its source text rather than assumed: the whitespace text between the first non-empty container's opening brace/bracket and its first member/element, if -- and only if -- that gap actually contains a newline (an already-compact document, or one whose only containers are empty, has no indentation to detect at all, so this genuinely returns `undefined` rather than guessing). Whatever text follows the last newline in that one gap -- a run of spaces, a run of tabs, or a mix, however a real file happens to be indented -- becomes the unit applied at every depth throughout the whole document; RFC 8785 canonicalization does not require every JSON file in the world to agree on an indent width, only that a given file's own layout be internally consistent, which is exactly what re-applying one detected unit at every level guarantees.
 */
export function detectIndentUnit(tokens: readonly RangedTokenLike[], sourceText: string): string | undefined {
  let previousToken: RangedTokenLike | undefined;

  for (const token of tokens) {
    if (previousToken !== undefined && OPENING_TYPES.has(previousToken.type) && !CLOSING_TYPES.has(token.type)) {
      const gapText = sourceText.slice(previousToken.range[1], token.range[0]);
      const lastNewline = gapText.lastIndexOf('\n');
      if (lastNewline !== -1) return gapText.slice(lastNewline + 1);
    }

    previousToken = token;
  }

  return undefined;
}

/**
 * The canonical whitespace expected immediately before `right`, given the token immediately before it (`left`, `undefined` only for the very first token in the document), the current nesting depth (the depth `right` itself sits at, already adjusted for `right` closing a container -- see computePrettyWhitespaceGaps' own comment on why), and the indent unit repeated once per level (see resolveIndentUnit). Deliberately "always fully expanded": every non-empty object or array breaks every member/element onto its own line, however short -- no Prettier-style width-based fill/inline decision (see this rule's own doc comment for why that's a deliberate simplification, not an oversight). A member's own key and value stay on the same line (a single space after `:`, matching ordinary JSON convention); only members/elements themselves, and a container's own opening/closing braces, get their own line.
 *
 * Every reachable pair of adjacent token types in a valid JSON document is covered by one of the branches below; the trailing throw is a genuine invariant, not defensive dead code -- verified directly by enumerating every combination of the ten JSON token types this rule ever sees (Number/String/Boolean/Null/Colon/LBrace/RBrace/LBracket/RBracket/Comma), not merely assumed. Two adjacent value tokens, a value directly followed by an opening brace, an opening brace directly followed by a colon or comma, and a closing brace directly followed by a value are all grammatically impossible in valid JSON; this rule only ever receives a document `@eslint/json` has already parsed successfully as JSON, so this rule's own test suite exercises the throw directly with a synthetic pair rather than through a real (unreachable) fixture -- the same pattern filterRangedTokens' own doc comment already establishes for this rule's sibling.
 */
export function computeExpectedGap(left: RangedTokenLike | undefined, right: RangedTokenLike, depth: number, indentUnit: string): string {
  if (left === undefined) return '';
  if (left.type === 'Comma') return `\n${indent(depth, indentUnit)}`;
  if (left.type === 'Colon') return ' ';
  if (right.type === 'Colon') return '';
  if (right.type === 'Comma') return '';
  if (OPENING_TYPES.has(left.type)) return CLOSING_TYPES.has(right.type) ? '' : `\n${indent(depth, indentUnit)}`;
  if (CLOSING_TYPES.has(right.type)) return `\n${indent(depth, indentUnit)}`;
  throw new Error(`pretty-format: unreachable token pair in valid JSON (${left.type} directly followed by ${right.type})`);
}

/**
 * Every whitespace gap in the document, paired with the canonical text that should fill it -- a gap the source already matches needs no fix; one it doesn't (including an empty gap that should have something inserted into it, e.g. immediately after `{`) is a violation. A plain forward scan mirroring computeInsignificantWhitespaceGaps' own shape (see that function's comment for why no indexed access is needed), plus a running `depth` counter: incremented the moment an opening brace/bracket has been fully processed (so the gap it starts is indented one level deeper), decremented the moment a closing brace/bracket is reached (before computing the gap that precedes it, so that gap -- and the closing token's own eventual line -- sit back at the outer level).
 */
export function computePrettyWhitespaceGaps(tokens: readonly RangedTokenLike[], documentLength: number, indentUnit: string): readonly ExpectedWhitespaceGap[] {
  const gaps: ExpectedWhitespaceGap[] = [];
  let depth = 0;
  let previousEnd = 0;
  let previousToken: RangedTokenLike | undefined;

  for (const token of tokens) {
    if (CLOSING_TYPES.has(token.type)) depth -= 1;

    gaps.push({ start: previousEnd, end: token.range[0], expected: computeExpectedGap(previousToken, token, depth, indentUnit) });

    previousEnd = token.range[1];
    previousToken = token;

    if (OPENING_TYPES.has(token.type)) depth += 1;
  }

  gaps.push({ start: previousEnd, end: documentLength, expected: previousToken === undefined ? '' : '\n' });

  return gaps;
}

/**
 * The pretty-printing facet this package bundles as its own default (`configs.recommended`): every JSON document gets human-readable, indented, one-member/element-per-line formatting with a single trailing newline -- the layout a hand-authored or `prettier`-formatted JSON file already has, not RFC 8785's own canonical form (that one collapses every gap to nothing; see no-insignificant-whitespace). Deliberately does not attempt Prettier's own width-based fill/inline algorithm (packing short arrays or nested values onto one line when they fit within a print width) -- a fixed, depth-only rule is fully deterministic and needs no line-width bookkeeping, at the cost of sometimes producing a longer, more-broken-out document than `prettier --write` would for the identical input.
 *
 * The `indent` option (`2`/`4`/`'tab'`/`'auto'`, defaulting to `'auto'`) exists so a project with an established indent width isn't silently reformatted to a hardcoded default the moment this rule activates -- see resolveIndentUnit/detectIndentUnit.
 *
 * Scoped to `json/json` only, never `json/jsonc`, for the same reason no-insignificant-whitespace is: a comment's own attachment to a specific member has no well-defined answer once that member's surrounding whitespace is rewritten out from under it.
 */
export const prettyFormat: PrettyFormatRuleDefinition = {
  meta: {
    type: 'layout',
    fixable: 'code',
    languages: ['json/json'],
    defaultOptions: ['auto'],
    schema: [{ enum: [TWO_SPACE_INDENT, FOUR_SPACE_INDENT, 'tab', 'auto'] }],
    docs: {
      recommended: true,
      description: 'Require JSON documents to be pretty-printed: indented, one member/element per line, a single trailing newline.',
      url: 'https://github.com/ExaDev/eslint-plugin-json-canonical/blob/main/src/rules/pretty-format.ts',
    },
    messages: {
      nonPrettyWhitespace: 'This whitespace does not match this package’s pretty-printed form.',
    },
  },

  create(context) {
    return {
      Document(node: DocumentNode) {
        const [indentOption] = context.options;
        const tokens = filterRangedTokens(node.tokens);
        const indentUnit = resolveIndentUnit(indentOption, tokens, context.sourceCode.text);
        const gaps = computePrettyWhitespaceGaps(tokens, context.sourceCode.text.length, indentUnit);

        for (const gap of gaps) {
          const actual = context.sourceCode.text.slice(gap.start, gap.end);
          if (actual === gap.expected) continue;

          context.report({
            loc: { start: context.sourceCode.getLocFromIndex(gap.start), end: context.sourceCode.getLocFromIndex(gap.end) },
            messageId: 'nonPrettyWhitespace',
            fix: (fixer) => fixer.replaceTextRange([gap.start, gap.end], gap.expected),
          });
        }
      },
    } satisfies JSONRuleVisitor;
  },
};

export default prettyFormat;
