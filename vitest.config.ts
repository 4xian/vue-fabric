import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'demo/',
        '*.config.ts',
        'src/types/**',
        'src/assets/**',
        'src/index.ts'
      ],
      thresholds: {
        lines: 45,
        functions: 45,
        branches: 45,
        statements: 45
      }
    }
  }
})
