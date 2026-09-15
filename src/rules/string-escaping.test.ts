import json from '@eslint/json';
import { RuleTester } from 'eslint';
import { describe, expect, test } from 'vitest';
import stringEscaping from './string-escaping';

describe('stringEscaping.meta', () => {
  test('exact shape', () => {
    expect(stringEscaping.meta).toStrictEqual({
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
    });
  });
});

const ruleTester = new RuleTester({ language: 'json/json', plugins: { json } });

ruleTester.run('string-escaping', stringEscaping, {
  valid: [
    '"hello"',
    '"a/b"',
    '"tab:\\t"',
    JSON.stringify('quote:"'),
    JSON.stringify(''),
    // Object keys are strings too, and RFC 8785 canonicalizes them identically.
    JSON.stringify({ name: 'ok' }),
  ],
  invalid: [
    {
      // An unnecessary escape of a character RFC 8785 never escapes.
      code: '"a\\/b"',
      output: '"a/b"',
      errors: [{ messageId: 'nonCanonicalString', data: { canonical: '"a/b"' } }],
    },
    {
      // The escape sequence for 'A' -- valid JSON, but not the canonical (unescaped) form.
      code: '"\\u0041"',
      output: '"A"',
      errors: [{ messageId: 'nonCanonicalString', data: { canonical: '"A"' } }],
    },
    {
      // A control character escaped as the numeric 	 instead of the mandated short escape \t.
      code: '"\\u0009"',
      output: '"\\t"',
      errors: [{ messageId: 'nonCanonicalString', data: { canonical: '"\\t"' } }],
    },
    {
      // A non-canonically-escaped object key.
      code: '{"\\u006e\\u0061\\u006d\\u0065": "ok"}',
      output: '{"name": "ok"}',
      errors: [{ messageId: 'nonCanonicalString', data: { canonical: '"name"' } }],
    },
  ],
});
