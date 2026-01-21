/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'
import { DevTools } from '@vitejs/devtools'
import componentHighlighterPlugin from './src/component-highlighter-plugin'

const r = (filepath: string) =>
  fileURLToPath(new URL(filepath, import.meta.url))

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
  resolve: {
    alias: {
      'vite-plugin-vue-tracer/client/record': r('../src/client/record.ts'),
      'vite-plugin-vue-tracer/client/listeners': r(
        '../src/client/listeners.ts'
      ),
      'vite-plugin-vue-tracer/client/overlay': r('../src/client/overlay.ts'),
      'vite-plugin-vue-tracer/client/vite-devtools': r(
        '../src/client/vite-devtools.ts'
      ),
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
