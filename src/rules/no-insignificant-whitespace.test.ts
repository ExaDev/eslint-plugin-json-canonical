import json from '@eslint/json';
import type { Token } from '@humanwhocodes/momoa';
import { Linter } from 'eslint';
import { describe, expect, test } from 'vitest';
import noInsignificantWhitespace, { computeInsignificantWhitespaceGaps, filterRangedTokens, type RangedTokenLike } from './no-insignificant-whitespace';

function token(start: number, end: number): RangedTokenLike {
  return { range: [start, end] };
}

const fakeLoc: Token['loc'] = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
const tokenWithRange: Token = { type: 'Number', loc: fakeLoc, range: [0, 1] };
const tokenWithoutRange: Token = { type: 'Colon', loc: fakeLoc };

// Computed at module scope, not inside each test body: Stryker's per-mutant test execution was confirmed directly (see this file's own PR) to reliably activate a mutant only for code that runs at module-evaluation time -- a mutation inside a function only ever called from within a test body reproducibly survived even with an otherwise-correct, directly-asserting unit test, across every coverage-analysis mode (perTest, all, off) and confirmed by reproducing the exact same result with a minimal isolated case. Moving the actual calls up here, so their evaluation happens the moment the test FILE loads rather than when an individual test runs, was confirmed to fix it. Likely a real bug in @stryker-mutator/vitest-runner's static/non-static mutant classification interacting with vitest 5's own module handling; each test below still asserts independently, this just changes when the call underneath it happens.
const filterUndefinedResult = filterRangedTokens(undefined);
const filterKeepsRangedResult = filterRangedTokens([tokenWithRange, tokenWithoutRange]);
const noGapsResult = computeInsignificantWhitespaceGaps([token(0, 1), token(1, 2)], 2);
const leadingGapResult = computeInsignificantWhitespaceGaps([token(1, 2)], 2);
const betweenGapSecondTokenStart = 3;
const betweenGapDocumentLength = 4;
const betweenGapResult = computeInsignificantWhitespaceGaps([token(0, 1), token(betweenGapSecondTokenStart, betweenGapDocumentLength)], betweenGapDocumentLength);
const trailingGapDocumentLength = 3;
const trailingGapResult = computeInsignificantWhitespaceGaps([token(0, 1)], trailingGapDocumentLength);
const emptyTokensNonZeroLengthDocumentLength = 3;
const emptyTokensNonZeroLengthResult = computeInsignificantWhitespaceGaps([], emptyTokensNonZeroLengthDocumentLength);
const emptyTokensZeroLengthResult = computeInsignificantWhitespaceGaps([], 0);
const ruleMeta = noInsignificantWhitespace.meta;

describe('noInsignificantWhitespace.meta', () => {
  test('exact shape', () => {
    expect(ruleMeta).toStrictEqual({
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
    });
  });
});

describe('filterRangedTokens', () => {
  test('undefined (a document parsed without tokens: true, which @eslint/json never actually does) yields an empty list', () => {
    expect(filterUndefinedResult).toStrictEqual([]);
  });

  test('keeps only tokens that carry a range, preserving order', () => {
    expect(filterKeepsRangedResult).toStrictEqual([tokenWithRange]);
  });
});

describe('computeInsignificantWhitespaceGaps', () => {
  test('no gaps for a fully compact document', () => {
    expect(noGapsResult).toStrictEqual([]);
  });

  test('a leading gap before the first token', () => {
    expect(leadingGapResult).toStrictEqual([{ start: 0, end: 1 }]);
  });

  test('a gap between two tokens', () => {
    expect(betweenGapResult).toStrictEqual([{ start: 1, end: betweenGapSecondTokenStart }]);
  });

  test('a trailing gap after the last token', () => {
    expect(trailingGapResult).toStrictEqual([{ start: 1, end: trailingGapDocumentLength }]);
  });

  test('an empty token list with a non-zero document length is entirely a trailing gap -- not reachable via a real parsed document (every JSON value is at least one token), exercised directly here since the function itself makes no such assumption', () => {
    expect(emptyTokensNonZeroLengthResult).toStrictEqual([{ start: 0, end: emptyTokensNonZeroLengthDocumentLength }]);
  });

  test('an empty token list with a zero-length document has no gaps at all', () => {
    expect(emptyTokensZeroLengthResult).toStrictEqual([]);
  });
});

// A shared config, and each assertion's own Linter call made from inside its own test body: driving the rule through a real `Linter` is what reliably kills a mutation inside the rule's own Document() visitor, since the visitor only ever runs when ESLint actually lints something. RuleTester (dropped from this file entirely, in favour of these plain `Linter#verify`/`verifyAndFix` calls) computes each of its fixtures' outcomes eagerly, during test collection, rather than lazily inside the `it()` callback that later reports them -- confirmed directly, by reproducing a mutant's activation env var against this file's own compiled sandbox output outside of Stryker's own orchestration, that RuleTester's fixtures genuinely do fail under a mutation Stryker itself still marked "survived": a real incompatibility between RuleTester's own collection-time execution model and how @stryker-mutator/vitest-runner attributes a static mutant's test outcomes, not a gap in what these fixtures cover. Each `test()` body below calls `Linter#verify`/`verifyAndFix` directly instead, matching the exact pattern already confirmed (see the `meta` exact-shape test above) to attribute a mutation-caused failure correctly regardless of coverage-analysis mode. The `Linter` calls stay inside `test()`, not at module scope: `Linter#verify`/`verifyAndFix` throw synchronously when the rule's own `meta` is broken (missing `fixable`, `messages`, or a `languages` entry ESLint's config validation checks against) -- a real, deliberate, mutation-testing-relevant behaviour, not a defect to guard against -- and a throw from a bare top-level statement aborts the whole module's evaluation before every later `describe`/`test` call in the file gets to register, discarding whichever of this file's own tests were still to come. Keeping the call inside `test()` turns that same throw into an ordinary, individually-attributed failing assertion instead.
const eagerConfig = { language: 'json/json' as const, plugins: { json, 'json-canonical': { rules: { 'no-insignificant-whitespace': noInsignificantWhitespace } } }, rules: { 'json-canonical/no-insignificant-whitespace': 'error' as const } };

describe('noInsignificantWhitespace, driven directly through Linter', () => {
  test.each(['{"a":1,"b":[1,2]}', '{}', '[]', '"a string"', '1'])('valid: %s produces no violations', (code) => {
    const linter = new Linter();
    const messages = linter.verify(code, eagerConfig);
    expect(messages).toStrictEqual([]);
  });

  test('a document with whitespace between every token gets fully compacted, reporting one violation per gap', () => {
    const linter = new Linter();
    const result = linter.verifyAndFix('{ "a": 1 }', eagerConfig);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{"a":1}');
    expect(result.messages).toStrictEqual([]);
    const dryRunMessages = new Linter().verify('{ "a": 1 }', eagerConfig);
    const gapsInSpacedSingleMember = 3;
    expect(dryRunMessages).toHaveLength(gapsInSpacedSingleMember);
    expect(dryRunMessages.every((message) => message.messageId === 'insignificantWhitespace')).toBe(true);
  });

  test('a leading and trailing newline is compacted away, reporting one violation per gap', () => {
    const linter = new Linter();
    const result = linter.verifyAndFix('\n{"a":1}\n', eagerConfig);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{"a":1}');
    const dryRunMessages = new Linter().verify('\n{"a":1}\n', eagerConfig);
    expect(dryRunMessages).toHaveLength(2);
    expect(dryRunMessages.every((message) => message.messageId === 'insignificantWhitespace')).toBe(true);
  });

  test('a single gap between two members is compacted away, reporting exactly one violation', () => {
    const linter = new Linter();
    const result = linter.verifyAndFix('{"a":1,\n"b":2}', eagerConfig);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{"a":1,"b":2}');
    const dryRunMessages = new Linter().verify('{"a":1,\n"b":2}', eagerConfig);
    expect(dryRunMessages).toStrictEqual([expect.objectContaining({ messageId: 'insignificantWhitespace' })]);
  });
});
