import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts', 'packages/link/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', 'packages/link/src/peer.ts'],
      // 계획서 G3 기준: core·link 테스트 커버리지 80% 이상
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
