import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import { exadevConfig } from '@exadev/eslint-config';

// exadevConfig() derives its own ignores from this repo's .gitignore automatically (auto-detected, as of @exadev/eslint-config@2.17.0) -- no separate wiring needed here any more. This is what stopped a leftover Stryker report file from getting linted as source once configs.recommended started bundling eslint-plugin-json-canonical against every JSON file by default.
export default defineConfig(
  {
    languageOptions: {
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
    },
  },
  { ...js.configs.recommended, files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'] },
  ...exadevConfig({ react: false, nextjs: false }),
  {
    // src/index.ts is this package's own entry point (package.json exports), so it keeps one barrel: override the default 'banned' policy to 'single'.
    files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    rules: {
      'exadev/barrel-policy': ['error', { mode: 'single' }],
    },
  },
);
