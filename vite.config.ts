/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'
import { DevTools } from '@vitejs/devtools'
import componentHighlighter from './src/frameworks/react/plugin'

const r = (filepath: string) =>
  fileURLToPath(new URL(filepath, import.meta.url))

export default defineConfig({
  root: './playground',
  plugins: [
    react(),
    DevTools(),
    componentHighlighter({
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
      'vite-plugin-component-highlighter/client/listeners': r(
        './src/client/listeners.ts'
      ),
      'vite-plugin-component-highlighter/client/overlay': r('./src/client/overlay.ts'),
      'vite-plugin-component-highlighter/client/vite-devtools': r(
        './src/client/vite-devtools.ts'
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
