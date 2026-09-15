import json from '@eslint/json';
import type { Token } from '@humanwhocodes/momoa';
import { Linter } from 'eslint';
import { describe, expect, test } from 'vitest';
import prettyFormat, { computeExpectedGap, computePrettyWhitespaceGaps, filterRangedTokens, type RangedTokenLike } from './pretty-format';

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

describe('filterRangedTokens', () => {
  test('undefined yields an empty list', () => {
    expect(filterRangedTokens(undefined)).toStrictEqual([]);
  });

  test('keeps only tokens that carry a range, preserving order', () => {
    expect(filterRangedTokens([tokenWithRange, tokenWithoutRange])).toStrictEqual([tokenWithRange]);
  });
});

describe('computeExpectedGap', () => {
  test('the very first token in the document gets no leading whitespace', () => {
    expect(computeExpectedGap(undefined, token('Number', 0, 1), 0)).toBe('');
  });

  test('after a comma, the next sibling starts on a new line at the current depth', () => {
    const depth = 2;
    const stringStart = 1;
    const stringEnd = stringStart + '"a"'.length;
    expect(computeExpectedGap(token('Comma', 0, 1), token('String', stringStart, stringEnd), depth)).toBe('\n    ');
  });

  test('after a colon, the value stays on the same line as its key', () => {
    expect(computeExpectedGap(token('Colon', 0, 1), token('Number', 1, 2), 1)).toBe(' ');
  });

  test('before a colon, no space separates the key from it', () => {
    const stringEnd = '"a"'.length;
    const colonEnd = stringEnd + ':'.length;
    expect(computeExpectedGap(token('String', 0, stringEnd), token('Colon', stringEnd, colonEnd), stringEnd)).toBe('');
  });

  test('before a comma, no space separates the value from it', () => {
    expect(computeExpectedGap(token('Number', 0, 1), token('Comma', 1, 2), 0)).toBe('');
  });

  test('an empty object has no whitespace between its braces', () => {
    expect(computeExpectedGap(token('LBrace', 0, 1), token('RBrace', 1, 2), 0)).toBe('');
  });

  test('an empty array has no whitespace between its brackets', () => {
    expect(computeExpectedGap(token('LBracket', 0, 1), token('RBracket', 1, 2), 0)).toBe('');
  });

  test('a non-empty object’s first member starts on a new line, one level deeper', () => {
    const depthInsideContainer = 1;
    const stringStart = 1;
    const stringEnd = stringStart + '"a"'.length;
    expect(computeExpectedGap(token('LBrace', 0, 1), token('String', stringStart, stringEnd), depthInsideContainer)).toBe('\n  ');
  });

  test('a non-empty container’s closing brace sits on its own line, back at the outer depth', () => {
    expect(computeExpectedGap(token('Number', 0, 1), token('RBrace', 1, 2), 0)).toBe('\n');
  });

  test('throws for a token pair that can never be adjacent in valid JSON', () => {
    // Two value tokens directly adjacent has no valid JSON grammar path to reach through this rule's own visitor (@eslint/json only ever calls it against a document it already parsed successfully) -- exercised directly here, matching the same "impossible but tested" pattern computeInsignificantWhitespaceGaps' own sibling test suite uses.
    const stringStart = 1;
    const stringEnd = stringStart + '"a"'.length;
    expect(() => computeExpectedGap(token('Number', 0, 1), token('String', stringStart, stringEnd), 0)).toThrow(/unreachable token pair/);
  });
});

describe('computePrettyWhitespaceGaps', () => {
  test('a bare scalar document gets no leading whitespace and one trailing newline', () => {
    const tokens = [token('Number', 0, 2)];
    expect(computePrettyWhitespaceGaps(tokens, 2)).toStrictEqual([
      { start: 0, end: 0, expected: '' },
      { start: 2, end: 2, expected: '\n' },
    ]);
  });

  test('an empty token list still gets a trailing gap, expecting nothing (mirrors the impossible-in-practice case computeInsignificantWhitespaceGaps also tests)', () => {
    expect(computePrettyWhitespaceGaps([], 0)).toStrictEqual([{ start: 0, end: 0, expected: '' }]);
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
    expect(computePrettyWhitespaceGaps(tokens, documentLength)).toStrictEqual([
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
      docs: {
        recommended: true,
        description: 'Require JSON documents to be pretty-printed: 2-space indentation, one member/element per line, a single trailing newline.',
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

  test('a compact document is fully expanded, one member/element per line, 2-space indented', () => {
    const linter = new Linter();
    const result = linter.verifyAndFix('{"b":1,"a":2,"nested":{"z":1},"arr":[1,2],"empty":{},"emptyArr":[]}', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe(
      ['{', '  "b": 1,', '  "a": 2,', '  "nested": {', '    "z": 1', '  },', '  "arr": [', '    1,', '    2', '  ],', '  "empty": {},', '  "emptyArr": []', '}', ''].join('\n'),
    );
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
