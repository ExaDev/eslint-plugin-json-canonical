import { defineConfig } from 'vitest/config';

// Pinned to the 4.x line in package.json (not the latest major) deliberately: @stryker-mutator/vitest-runner@10.0.0 misreports genuinely-killing mutants as Survived under vitest 5, confirmed here for both @eslint/json rule visitor bodies and plain object-literal `meta` fields, reproducible by activating the exact mutant Stryker's own sandbox generates and running `vitest run` directly against it -- see https://github.com/stryker-mutator/stryker-js/issues/6210 (filed against the runner's per-test name-filter path; this repo's own confirmation there also covers static mutants, which that issue's author found unaffected). Revert to vitest 5 once that issue ships a fix.
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      // src/index.ts is a pure re-export barrel (no branches, no logic) -- there is nothing in it a test could meaningfully cover, the same reason it's excluded here rather than chased to 100% with a contrived test. .stryker-tmp/**/src/**/*.ts would otherwise ALSO match `src/**/*.ts` from the project root -- a leftover or in-progress Stryker sandbox copy under .stryker-tmp genuinely contains its own nested src/ tree, so a plain `test` run picks it up as a second, differently-instrumented copy of the same files and reports bogus low coverage against it.
      exclude: ['src/**/*.test.ts', 'src/index.ts', '.stryker-tmp/**'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
