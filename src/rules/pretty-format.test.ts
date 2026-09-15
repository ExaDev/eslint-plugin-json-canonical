import json from '@eslint/json';
import type { Token } from '@humanwhocodes/momoa';
import type { Linter as LinterType } from 'eslint';
import { Linter } from 'eslint';
import { describe, expect, test } from 'vitest';
import prettyFormat, { computeExpectedGap, computePrettyWhitespaceGaps, detectIndentUnit, filterRangedTokens, resolveIndentUnit, type RangedTokenLike } from './pretty-format';

function token(type: Token['type'], start: number, end: number): RangedTokenLike {
  return { type, range: [start, end] };
}

/**
 * Builds a run of adjacent, gap-free tokens (no whitespace between them) purely from their own text, so a test fixture's token ranges are computed from real string lengths rather than hand-counted character offsets -- the actual source text these tokens would come from is `pairs.map(([, text]) => text).join('')`, and this rule's own gap-finding logic is precisely what fills in the whitespace between them, which a hand-built fixture with real gaps would otherwise have to duplicate by hand.
 */
function sequentialTokens(pairs: readonly (readonly [Token['type'], string])[]): { readonly tokens: readonly RangedTokenLike[]; readonly documentLength: number } {
  let position = 0;
  const tokens = pairs.map(([type, text]) => {
    const start = position;
    position += text.length;
    return token(type, start, position);
  });
  return { tokens, documentLength: position };
}

const fakeLoc: Token['loc'] = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
const tokenWithRange: Token = { type: 'Number', loc: fakeLoc, range: [0, 1] };
const tokenWithoutRange: Token = { type: 'Colon', loc: fakeLoc };
const TWO_SPACE_INDENT = 2;
const FOUR_SPACE_INDENT = 4;
const TWO_SPACES = ' '.repeat(TWO_SPACE_INDENT);
const FOUR_SPACES = ' '.repeat(FOUR_SPACE_INDENT);
const TAB = '\t';

describe('filterRangedTokens', () => {
  test('undefined yields an empty list', () => {
    expect(filterRangedTokens(undefined)).toStrictEqual([]);
  });

  test('keeps only tokens that carry a range, preserving order', () => {
    expect(filterRangedTokens([tokenWithRange, tokenWithoutRange])).toStrictEqual([tokenWithRange]);
  });
});

/**
 * Builds a source string and its own real token list from segments alternating "token text" and "raw gap text" (starting and ending on a token segment) -- unlike sequentialTokens above, this preserves genuine whitespace gaps between tokens (in both the returned source text and the tokens' own ranges), which detectIndentUnit needs to have anything to find.
 */
function withGaps(...segments: readonly (readonly [Token['type'], string] | string)[]): { readonly source: string; readonly tokens: readonly RangedTokenLike[] } {
  let source = '';
  const tokens: RangedTokenLike[] = [];
  for (const segment of segments) {
    if (typeof segment === 'string') {
      source += segment;
      continue;
    }
    const [type, text] = segment;
    const start = source.length;
    source += text;
    tokens.push(token(type, start, source.length));
  }
  return { source, tokens };
}

describe('detectIndentUnit', () => {
  test('detects two spaces from a document indented that way', () => {
    const { source, tokens } = withGaps(['LBrace', '{'], '\n  ', ['String', '"a"'], ['Colon', ':'], ' ', ['Number', '1'], '\n', ['RBrace', '}']);
    expect(detectIndentUnit(tokens, source)).toBe(TWO_SPACES);
  });

  test('detects four spaces from a document indented that way', () => {
    const { source, tokens } = withGaps(['LBrace', '{'], '\n    ', ['String', '"a"'], ['Colon', ':'], ' ', ['Number', '1'], '\n', ['RBrace', '}']);
    expect(detectIndentUnit(tokens, source)).toBe(FOUR_SPACES);
  });

  test('detects a tab from a document indented that way', () => {
    const { source, tokens } = withGaps(['LBrace', '{'], '\n\t', ['String', '"a"'], ['Colon', ':'], ' ', ['Number', '1'], '\n', ['RBrace', '}']);
    expect(detectIndentUnit(tokens, source)).toBe(TAB);
  });

  test('skips an empty container (nothing to detect from) and finds the next real one', () => {
    const { source, tokens } = withGaps(
      ['LBrace', '{'],
      ['String', '"empty"'],
      ['Colon', ':'],
      ['LBrace', '{'],
      ['RBrace', '}'],
      ['Comma', ','],
      '\n  ',
      ['String', '"a"'],
      ['Colon', ':'],
      ['Number', '1'],
      ['RBrace', '}'],
    );
    // The first container ("empty"'s own {}) has nothing between its brace pair to detect from; detection has to fall through to a later gap. This one happens to be a Comma-preceded gap rather than an LBrace-preceded one, so it isn't actually reachable by detectIndentUnit's own LBrace/LBracket-only check -- confirming that case returns undefined here, not a false detection.
    expect(detectIndentUnit(tokens, source)).toBeUndefined();
  });

  test('returns undefined for a fully compact document with nothing to detect', () => {
    const { tokens } = sequentialTokens([
      ['LBrace', '{'],
      ['String', '"a"'],
      ['Colon', ':'],
      ['Number', '1'],
      ['RBrace', '}'],
    ]);
    expect(detectIndentUnit(tokens, '{"a":1}')).toBeUndefined();
  });

  test('returns undefined for an empty token list', () => {
    expect(detectIndentUnit([], '')).toBeUndefined();
  });
});

describe('resolveIndentUnit', () => {
  test('2 and 4 resolve to that many literal spaces, regardless of the document', () => {
    expect(resolveIndentUnit(TWO_SPACE_INDENT, [], '')).toBe(TWO_SPACES);
    expect(resolveIndentUnit(FOUR_SPACE_INDENT, [], '')).toBe(FOUR_SPACES);
  });

  test('an explicit 2 wins over what auto-detection would otherwise find in the document', () => {
    // Distinguishes "option === TWO_SPACE_INDENT actually short-circuits to two spaces" from "it happened to fall through to auto-detection, which happened to also find two spaces" -- this document's own real indent is four spaces, so only the explicit branch, not a fallthrough, produces TWO_SPACES here.
    const { source, tokens } = withGaps(['LBrace', '{'], '\n    ', ['String', '"a"'], ['Colon', ':'], ' ', ['Number', '1'], '\n', ['RBrace', '}']);
    expect(resolveIndentUnit(TWO_SPACE_INDENT, tokens, source)).toBe(TWO_SPACES);
  });

  test('‘tab’ resolves to one literal tab character', () => {
    expect(resolveIndentUnit('tab', [], '')).toBe(TAB);
  });

  test('‘auto’ detects the document’s own indent when there is one to find', () => {
    const { source, tokens } = withGaps(['LBrace', '{'], '\n    ', ['String', '"a"'], ['Colon', ':'], ' ', ['Number', '1'], '\n', ['RBrace', '}']);
    expect(resolveIndentUnit('auto', tokens, source)).toBe(FOUR_SPACES);
  });

  test('‘auto’ falls back to two spaces when there is nothing to detect', () => {
    const { tokens } = sequentialTokens([
      ['LBrace', '{'],
      ['String', '"a"'],
      ['Colon', ':'],
      ['Number', '1'],
      ['RBrace', '}'],
    ]);
    expect(resolveIndentUnit('auto', tokens, '{"a":1}')).toBe(TWO_SPACES);
  });
});

describe('computeExpectedGap', () => {
  test('the very first token in the document gets no leading whitespace', () => {
    expect(computeExpectedGap(undefined, token('Number', 0, 1), 0, TWO_SPACES)).toBe('');
  });

  test('after a comma, the next sibling starts on a new line at the current depth', () => {
    const depth = 2;
    const stringStart = 1;
    const stringEnd = stringStart + '"a"'.length;
    expect(computeExpectedGap(token('Comma', 0, 1), token('String', stringStart, stringEnd), depth, TWO_SPACES)).toBe('\n    ');
  });

  test('after a comma, at a custom indent unit, the next sibling still starts on a new line at the current depth', () => {
    const depth = 2;
    const stringStart = 1;
    const stringEnd = stringStart + '"a"'.length;
    expect(computeExpectedGap(token('Comma', 0, 1), token('String', stringStart, stringEnd), depth, FOUR_SPACES)).toBe('\n        ');
  });

  test('after a colon, the value stays on the same line as its key', () => {
    expect(computeExpectedGap(token('Colon', 0, 1), token('Number', 1, 2), 1, TWO_SPACES)).toBe(' ');
  });

  test('before a colon, no space separates the key from it', () => {
    const stringEnd = '"a"'.length;
    const colonEnd = stringEnd + ':'.length;
    expect(computeExpectedGap(token('String', 0, stringEnd), token('Colon', stringEnd, colonEnd), stringEnd, TWO_SPACES)).toBe('');
  });

  test('before a comma, no space separates the value from it', () => {
    expect(computeExpectedGap(token('Number', 0, 1), token('Comma', 1, 2), 0, TWO_SPACES)).toBe('');
  });

  test('an empty object has no whitespace between its braces', () => {
    expect(computeExpectedGap(token('LBrace', 0, 1), token('RBrace', 1, 2), 0, TWO_SPACES)).toBe('');
  });

  test('an empty array has no whitespace between its brackets', () => {
    expect(computeExpectedGap(token('LBracket', 0, 1), token('RBracket', 1, 2), 0, TWO_SPACES)).toBe('');
  });

  test('a non-empty object’s first member starts on a new line, one level deeper', () => {
    const depthInsideContainer = 1;
    const stringStart = 1;
    const stringEnd = stringStart + '"a"'.length;
    expect(computeExpectedGap(token('LBrace', 0, 1), token('String', stringStart, stringEnd), depthInsideContainer, TWO_SPACES)).toBe('\n  ');
  });

  test('a non-empty container’s closing brace sits on its own line, back at the outer depth', () => {
    expect(computeExpectedGap(token('Number', 0, 1), token('RBrace', 1, 2), 0, TWO_SPACES)).toBe('\n');
  });

  test('throws for a token pair that can never be adjacent in valid JSON', () => {
    // Two value tokens directly adjacent has no valid JSON grammar path to reach through this rule's own visitor (@eslint/json only ever calls it against a document it already parsed successfully) -- exercised directly here, matching the same "impossible but tested" pattern computeInsignificantWhitespaceGaps' own sibling test suite uses.
    const stringStart = 1;
    const stringEnd = stringStart + '"a"'.length;
    expect(() => computeExpectedGap(token('Number', 0, 1), token('String', stringStart, stringEnd), 0, TWO_SPACES)).toThrow(/unreachable token pair/);
  });
});

describe('computePrettyWhitespaceGaps', () => {
  test('a bare scalar document gets no leading whitespace and one trailing newline', () => {
    const tokens = [token('Number', 0, 2)];
    expect(computePrettyWhitespaceGaps(tokens, 2, TWO_SPACES)).toStrictEqual([
      { start: 0, end: 0, expected: '' },
      { start: 2, end: 2, expected: '\n' },
    ]);
  });

  test('an empty token list still gets a trailing gap, expecting nothing (mirrors the impossible-in-practice case computeInsignificantWhitespaceGaps also tests)', () => {
    expect(computePrettyWhitespaceGaps([], 0, TWO_SPACES)).toStrictEqual([{ start: 0, end: 0, expected: '' }]);
  });

  test('a two-member object nests both members one level deep and closes back at depth 0', () => {
    // The token run for the compact source `{"a":1,"b":2}`, with no whitespace of its own between any pair -- computePrettyWhitespaceGaps' own job is to say what canonical whitespace belongs in each of those zero-width gaps.
    const { tokens, documentLength } = sequentialTokens([
      ['LBrace', '{'],
      ['String', '"a"'],
      ['Colon', ':'],
      ['Number', '1'],
      ['Comma', ','],
      ['String', '"b"'],
      ['Colon', ':'],
      ['Number', '2'],
      ['RBrace', '}'],
    ]);
    // One expected string per token boundary above (LBrace, "a", :, 1, ',', "b", :, 2, RBrace), in order, plus the trailing gap after the closing brace -- each gap's own start/end is that token's own range[0] (every token here is immediately gap-free, so a gap's start and end coincide exactly with where the next token begins).
    const expectedPerToken = ['', '\n  ', '', ' ', '', '\n  ', '', ' ', '\n'];
    expect(computePrettyWhitespaceGaps(tokens, documentLength, TWO_SPACES)).toStrictEqual([
      ...tokens.map((sourceToken, index) => ({ start: sourceToken.range[0], end: sourceToken.range[0], expected: expectedPerToken[index] })),
      { start: documentLength, end: documentLength, expected: '\n' },
    ]);
  });
});

describe('prettyFormat.meta', () => {
  test('exact shape', () => {
    expect(prettyFormat.meta).toStrictEqual({
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
    });
  });
});

describe('prettyFormat, driven through a real Linter', () => {
  const config = { language: 'json/json' as const, plugins: { json, 'json-canonical': { rules: { 'pretty-format': prettyFormat } } }, rules: { 'json-canonical/pretty-format': 'error' as const } };

  test('with no options, a compact document defaults to auto-detection, which falls back to 2-space indentation', () => {
    const linter = new Linter();
    const result = linter.verifyAndFix('{"b":1,"a":2,"nested":{"z":1},"arr":[1,2],"empty":{},"emptyArr":[]}', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe(
      ['{', '  "b": 1,', '  "a": 2,', '  "nested": {', '    "z": 1', '  },', '  "arr": [', '    1,', '    2', '  ],', '  "empty": {},', '  "emptyArr": []', '}', ''].join('\n'),
    );
  });

  test('with no options set (auto), an already-4-space-indented document keeps its own 4-space indent once fully expanded', () => {
    const linter = new Linter();
    const alreadyPretty = '{\n    "nested": {\n        "a": 1\n    }\n}\n';
    const messages = linter.verify(alreadyPretty, config);
    expect(messages).toStrictEqual([]);
  });

  test('an explicit indent: 4 reformats a 2-space document to 4-space, overriding auto-detection', () => {
    const explicitFourSpaceConfig: LinterType.Config = { ...config, rules: { 'json-canonical/pretty-format': ['error', FOUR_SPACE_INDENT] } };
    const linter = new Linter();
    const result = linter.verifyAndFix('{\n  "a": 1\n}\n', explicitFourSpaceConfig);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{\n    "a": 1\n}\n');
  });

  test('an explicit indent: ‘tab’ reformats a space-indented document to tabs', () => {
    const explicitTabConfig: LinterType.Config = { ...config, rules: { 'json-canonical/pretty-format': ['error', 'tab'] } };
    const linter = new Linter();
    const result = linter.verifyAndFix('{\n  "a": 1\n}\n', explicitTabConfig);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{\n\t"a": 1\n}\n');
  });

  test('a bare scalar document gets a trailing newline and nothing else', () => {
    const linter = new Linter();
    const result = linter.verifyAndFix('42', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('42\n');
  });

  test('already-pretty output is left alone (idempotent) and reports nothing', () => {
    const linter = new Linter();
    const pretty = '{\n  "a": 1\n}\n';
    const messages = linter.verify(pretty, config);
    expect(messages).toStrictEqual([]);
  });

  test('extra whitespace around a scalar member is normalized to a single space after the colon', () => {
    const linter = new Linter();
    const result = linter.verifyAndFix('{  "a"  :  1  }', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{\n  "a": 1\n}\n');
  });
});
