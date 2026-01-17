/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'
import { DevTools } from '@vitejs/devtools'
import componentHighlighterPlugin from './src/component-highlighter-plugin'

export default defineConfig({
  root: './playground',
  plugins: [
    react(),
    DevTools(),
    componentHighlighterPlugin({
      debugMode: true,
    }),
  ].filter(Boolean),
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
