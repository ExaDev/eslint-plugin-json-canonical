import json from '@eslint/json';
import { Linter } from 'eslint';
import { describe, expect, test } from 'vitest';
import plugin, { buildRecommendedConfig } from './plugin';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

describe('buildRecommendedConfig', () => {
  test('wires the given json and self plugins in under their own fixed names, with the json/json language', () => {
    const config = buildRecommendedConfig(json, plugin);
    expect(config.language).toBe('json/json');
    expect(config.plugins).toStrictEqual({ json, 'json-canonical': plugin });
  });

  test('sort-keys is case-sensitive: "B" (0x42) sorts before "a" (0x61) by raw code unit, left untouched', () => {
    // Verified directly against a real `Linter#verifyAndFix` run: a case-INsensitive comparator would instead fold both to lowercase and report a violation here (fixing to {"a", "B"}). caseSensitive:true leaves this fixture alone.
    const config = buildRecommendedConfig(json, plugin);
    const linter = new Linter();
    const result = linter.verifyAndFix('{"B":1,"a":2}', config);
    expect(result.fixed).toBe(false);
    expect(result.output).toBe('{"B":1,"a":2}');
  });

  test('sort-keys is non-natural: "10" sorts before "9" by character, not numeric, comparison', () => {
    // Verified directly: natural:true would instead compare these numerically (9 before 10) and leave this fixture unchanged. natural:false treats them as plain strings, where "10" < "9" ('1' < '9'), so this genuinely gets fixed.
    const config = buildRecommendedConfig(json, plugin);
    const linter = new Linter();
    const result = linter.verifyAndFix('{"9":1,"10":2}', config);
    expect(result.fixed).toBe(true);
    expect(result.output).toBe('{"10":2,"9":1}');
  });

  test('number-format and string-escaping are both enabled as errors', () => {
    const config = buildRecommendedConfig(json, plugin);
    expect(config.rules?.['json-canonical/number-format']).toBe('error');
    expect(config.rules?.['json-canonical/string-escaping']).toBe('error');
  });

  test('carries exactly these three rules -- no more, no fewer', () => {
    const config = buildRecommendedConfig(json, plugin);
    expect(Object.keys(config.rules ?? {})).toStrictEqual(['json/sort-keys', 'json-canonical/number-format', 'json-canonical/string-escaping']);
  });
});

describe('plugin.configs.recommended', () => {
  test('ordering (json/sort-keys), number-format, and string-escaping all converge together in one eslint --fix run', () => {
    const thirdElement = 3;
    const positionalArray = [thirdElement, 1, 2];
    const input = `{ "b": 1.0, "a": "\\u0041", "c": [${positionalArray.join(', ')}] }`;

    const linter = new Linter();
    const result = linter.verifyAndFix(input, {
      language: 'json/json',
      plugins: { json, 'json-canonical': plugin },
      rules: {
        'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
        'json-canonical/number-format': 'error',
        'json-canonical/string-escaping': 'error',
      },
    });

    expect(result.messages).toStrictEqual([]);
    const parsed: unknown = JSON.parse(result.output);
    if (!isRecord(parsed)) throw new Error('expected the fixed output to parse to an object');
    // configs.recommended deliberately doesn't include no-insignificant-whitespace (see that rule's own doc comment), so the fixed output still carries its original spacing -- asserting on the parsed value and the raw key order separately is what actually proves ordering/number/string canonicalization converged, without also depending on exactly how @eslint/json's own sort-keys fixer happens to preserve whitespace around a swapped member.
    expect(parsed).toStrictEqual({ a: 'A', b: 1, c: positionalArray });
    expect(Object.keys(parsed)).toStrictEqual(['a', 'b', 'c']);
    expect(result.output).not.toContain('1.0');
    expect(result.output).not.toContain('\\u0041');
  });

  test("configs.recommended's exact shape", () => {
    const recommended = plugin.configs?.['recommended'];
    if (recommended === undefined || Array.isArray(recommended) || !('language' in recommended)) {
      throw new Error('expected plugin.configs.recommended to be a single, flat-config-shaped config object');
    }

    expect(recommended.language).toBe('json/json');
    const configPlugins = recommended.plugins;
    if (configPlugins === undefined || Array.isArray(configPlugins)) throw new Error('expected plugins to be a name-to-plugin record');
    expect(configPlugins['json']).toBe(json);
    expect(configPlugins['json-canonical']).toBe(plugin);
    expect(recommended.rules).toStrictEqual({
      'json/sort-keys': ['error', 'asc', { caseSensitive: true, natural: false }],
      'json-canonical/number-format': 'error',
      'json-canonical/string-escaping': 'error',
    });
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
  test('registers exactly the three rules this package ships, under their own file-derived names', () => {
    expect(Object.keys(plugin.rules ?? {})).toStrictEqual(['no-insignificant-whitespace', 'number-format', 'string-escaping']);
  });
});
