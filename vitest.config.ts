import { defineConfig } from 'vitest/config'

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          include: ['tests/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
