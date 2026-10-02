import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Unit suites for pure domain/service logic (S11 starts with the stateful
 * store helpers). Node environment — these modules are deliberately DOM-free.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
