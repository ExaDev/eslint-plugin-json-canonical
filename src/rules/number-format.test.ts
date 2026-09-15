import json from '@eslint/json';
import { RuleTester } from 'eslint';
import { describe, expect, test } from 'vitest';
import numberFormat from './number-format';

describe('numberFormat.meta', () => {
  test('exact shape', () => {
    expect(numberFormat.meta).toStrictEqual({
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
    });
  });
});

const ruleTester = new RuleTester({ language: 'json/json', plugins: { json } });

ruleTester.run('number-format', numberFormat, {
  valid: ['0', '1', '-1', '1.5', '100', '1.5e-7', '1e+21', '0.1', JSON.stringify({ a: 1, b: -1.5, c: 100 })],
  invalid: [
    { code: '1.0', output: '1', errors: [{ messageId: 'nonCanonicalNumber', data: { canonical: '1' } }] },
    { code: '1.50', output: '1.5', errors: [{ messageId: 'nonCanonicalNumber', data: { canonical: '1.5' } }] },
    { code: '-0', output: '0', errors: [{ messageId: 'nonCanonicalNumber', data: { canonical: '0' } }] },
    { code: '1e2', output: '100', errors: [{ messageId: 'nonCanonicalNumber', data: { canonical: '100' } }] },
    { code: '2.5e3', output: '2500', errors: [{ messageId: 'nonCanonicalNumber', data: { canonical: '2500' } }] },
    {
      code: JSON.stringify({ a: 1.5e-7, b: 100 }).replace('1.5e-7', '0.00000015'),
      output: JSON.stringify({ a: 1.5e-7, b: 100 }),
      errors: [{ messageId: 'nonCanonicalNumber', data: { canonical: '1.5e-7' } }],
    },
    {
      // Exceeds IEEE 754 double range -- Number(text) is Infinity, which is not valid JSON, so this is reported but deliberately left unfixed rather than "fixed" into invalid output.
      code: '1e400',
      output: null,
      errors: [{ messageId: 'unrepresentable' }],
    },
  ],
});
