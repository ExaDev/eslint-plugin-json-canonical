import json from '@eslint/json';
import { Linter } from 'eslint';
import { describe, expect, test } from 'vitest';
import plugin, { buildCanonicalConfig, buildContentOnlyConfig, buildContentOnlyJsoncConfig, buildRecommendedConfig } from './plugin';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

describe('buildContentOnlyConfig', () => {
  test('wires the given json and self plugins in under their own fixed names, with the json/json language', () => {
    const config = buildContentOnlyConfig(json, plugin);
    expect(config.language).toBe('json/json');
    expect(config.plugins).toStrictEqual({ json, 'json-canonical': plugin });
  });

  test('sort-keys is case-sensitive: "B" (0x42) sorts before "a" (0x61) by raw code unit, left untouched', () => {
    const config = buildContentOnlyConfig(json, plugin);
    const linter = new Linter();
    const result = linter.verifyAndFix('{"B":1,"a":2}', config);
    expect(result.fixed).toBe(false);
    expect(result.output).toBe('{"B":1,"a":2}');
  });

  test('sort-keys is non-natural: "10" sorts before "9" by character, not numeric, comparison', () => {
    const config = buildContentOnlyConfig(json, plugin);
    const linter = new Linter();
    const result = linter.verifyAndFix('{"9":1,"10":2}', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{"10":2,"9":1}');
  });

  test('number-format and string-escaping are both enabled as errors', () => {
    const config = buildContentOnlyConfig(json, plugin);
    expect(config.rules?.['json-canonical/number-format']).toBe('error');
    expect(config.rules?.['json-canonical/string-escaping']).toBe('error');
  });

  test('carries exactly these three rules -- no pretty-format, no no-insignificant-whitespace', () => {
    const config = buildContentOnlyConfig(json, plugin);
    expect(Object.keys(config.rules ?? {})).toStrictEqual(['json/sort-keys', 'json-canonical/number-format', 'json-canonical/string-escaping']);
  });

  test('does not touch whitespace at all: a document with irregular spacing is left byte-for-byte alone', () => {
    const config = buildContentOnlyConfig(json, plugin);
    const linter = new Linter();
    const input = '{ "a"  :   1 }';
    const result = linter.verifyAndFix(input, config);
    expect(result.fixed).toBe(false);
    expect(result.output).toBe(input);
  });
});

describe('buildRecommendedConfig', () => {
  test('carries the content rules plus pretty-format, and nothing else', () => {
    const config = buildRecommendedConfig(json, plugin);
    expect(Object.keys(config.rules ?? {})).toStrictEqual(['json/sort-keys', 'json-canonical/number-format', 'json-canonical/string-escaping', 'json-canonical/pretty-format']);
  });

  test('pretty-prints a compact document: 2-space indentation, one member per line, trailing newline', () => {
    const config = buildRecommendedConfig(json, plugin);
    const linter = new Linter();
    const result = linter.verifyAndFix('{"b":1,"a":2}', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{\n  "a": 2,\n  "b": 1\n}\n');
  });
});

describe('buildCanonicalConfig', () => {
  test('carries the content rules plus no-insignificant-whitespace, and nothing else', () => {
    const config = buildCanonicalConfig(json, plugin);
    expect(Object.keys(config.rules ?? {})).toStrictEqual(['json/sort-keys', 'json-canonical/number-format', 'json-canonical/string-escaping', 'json-canonical/no-insignificant-whitespace']);
  });

  test('collapses a pretty document to the full RFC 8785 canonical single-line form', () => {
    const config = buildCanonicalConfig(json, plugin);
    const linter = new Linter();
    const result = linter.verifyAndFix('{\n  "b": 1,\n  "a": 2\n}\n', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{"a":2,"b":1}');
  });
});

describe('buildContentOnlyJsoncConfig', () => {
  test('wires the given json and self plugins in under their own fixed names, with the json/jsonc language and trailing commas allowed', () => {
    const config = buildContentOnlyJsoncConfig(json, plugin);
    expect(config.language).toBe('json/jsonc');
    expect(config.plugins).toStrictEqual({ json, 'json-canonical': plugin });
    expect(config.languageOptions).toStrictEqual({ allowTrailingCommas: true });
  });

  test('carries the identical three rules as the plain-JSON content-only config', () => {
    const jsoncConfig = buildContentOnlyJsoncConfig(json, plugin);
    const jsonConfig = buildContentOnlyConfig(json, plugin);
    expect(jsoncConfig.rules).toStrictEqual(jsonConfig.rules);
  });

  test('a comment-free JSONC document (trailing comma only) reorders and autofixes exactly like plain JSON', () => {
    const linter = new Linter();
    const config = buildContentOnlyJsoncConfig(json, plugin);
    const result = linter.verifyAndFix('{"b": 1, "a": 2,}', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{"a": 2, "b": 1,}');
  });

  test('a document with a comment attached to a member that would need to move is reported but never autofixed, so the comment can never be relocated onto the wrong member', () => {
    const linter = new Linter();
    const config = buildContentOnlyJsoncConfig(json, plugin);
    const input = '{\n  // leading comment\n  "b": 1,\n  // comment on a\n  "a": 2\n}';
    const result = linter.verifyAndFix(input, config);
    expect(result.fixed).toBe(false);
    expect(result.output).toBe(input);
    expect(result.messages.some((message) => message.ruleId === 'json/sort-keys')).toBe(true);
  });
});

describe('plugin.configs', () => {
  function assertSingleFlatConfig(value: unknown): asserts value is Linter.Config {
    if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value) || !('language' in value)) {
      throw new Error('expected a single, flat-config-shaped config object');
    }
  }

  test("configs.recommended's exact shape: content rules plus pretty-format", () => {
    const recommended = plugin.configs?.['recommended'];
    assertSingleFlatConfig(recommended);
    expect(recommended.language).toBe('json/json');
    expect(recommended.rules).toStrictEqual({
      'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
      'json-canonical/number-format': 'error',
      'json-canonical/string-escaping': 'error',
      'json-canonical/pretty-format': 'error',
    });
  });

  test("configs.contentOnly's exact shape: content rules alone", () => {
    const contentOnly = plugin.configs?.['contentOnly'];
    assertSingleFlatConfig(contentOnly);
    expect(contentOnly.language).toBe('json/json');
    expect(contentOnly.rules).toStrictEqual({
      'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
      'json-canonical/number-format': 'error',
      'json-canonical/string-escaping': 'error',
    });
  });

  test("configs.canonical's exact shape: content rules plus no-insignificant-whitespace", () => {
    const canonical = plugin.configs?.['canonical'];
    assertSingleFlatConfig(canonical);
    expect(canonical.language).toBe('json/json');
    expect(canonical.rules).toStrictEqual({
      'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
      'json-canonical/number-format': 'error',
      'json-canonical/string-escaping': 'error',
      'json-canonical/no-insignificant-whitespace': 'error',
    });
  });

  test("configs.contentOnlyJsonc's exact shape", () => {
    const contentOnlyJsonc = plugin.configs?.['contentOnlyJsonc'];
    assertSingleFlatConfig(contentOnlyJsonc);
    expect(contentOnlyJsonc.language).toBe('json/jsonc');
    expect(contentOnlyJsonc.languageOptions).toStrictEqual({ allowTrailingCommas: true });
  });

  test('every config wires plugins under the same fixed names', () => {
    for (const name of ['recommended', 'contentOnly', 'canonical', 'contentOnlyJsonc'] as const) {
      const config = plugin.configs?.[name];
      assertSingleFlatConfig(config);
      const configPlugins = config.plugins;
      if (configPlugins === undefined || Array.isArray(configPlugins)) throw new Error('expected plugins to be a name-to-plugin record');
      expect(configPlugins['json']).toBe(json);
      expect(configPlugins['json-canonical']).toBe(plugin);
    }
  });

  test('ordering (json/sort-keys), number-format, string-escaping, and pretty-format all converge together in one eslint --fix run under configs.recommended', () => {
    const thirdElement = 3;
    const positionalArray = [thirdElement, 1, 2];
    const input = `{ "b": 1.0, "a": "\\u0041", "c": [${positionalArray.join(', ')}] }`;

    const recommended = plugin.configs?.['recommended'];
    assertSingleFlatConfig(recommended);
    const linter = new Linter();
    const result = linter.verifyAndFix(input, recommended);

    expect(result.messages).toStrictEqual([]);
    const parsed: unknown = JSON.parse(result.output);
    if (!isRecord(parsed)) throw new Error('expected the fixed output to parse to an object');
    expect(parsed).toStrictEqual({ a: 'A', b: 1, c: positionalArray });
    expect(Object.keys(parsed)).toStrictEqual(['a', 'b', 'c']);
    expect(result.output).not.toContain('1.0');
    expect(result.output).not.toContain('\\u0041');
    expect(result.output).toContain('\n');
  });
});

describe('plugin.meta', () => {
  test('identifies this exact package under the json-canonical namespace', () => {
    expect(plugin.meta?.name).toBe('eslint-plugin-json-canonical');
    expect(plugin.meta?.namespace).toBe('json-canonical');
    expect(typeof plugin.meta?.version).toBe('string');
  });
});

describe('plugin.rules', () => {
  test('registers exactly the four rules this package ships, under their own file-derived names', () => {
    expect(Object.keys(plugin.rules ?? {})).toStrictEqual(['no-insignificant-whitespace', 'number-format', 'pretty-format', 'string-escaping']);
  });
});
