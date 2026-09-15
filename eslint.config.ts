import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import { exadevConfig } from '@exadev/eslint-config';

export default defineConfig(
  {
    ignores: ['dist', 'coverage', 'node_modules'],
  },
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
