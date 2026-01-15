/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'
import { DevTools } from '@vitejs/devtools'
import storybookPlugin from './src/storybook-plugin'

export default defineConfig({
  root: './playground',
  plugins: [react(), DevTools(), storybookPlugin()],
  build: {
    rolldownOptions: {
      devtools: {}, // enable devtools mode
    },
  },
  test: {
    root: '.',
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
})
