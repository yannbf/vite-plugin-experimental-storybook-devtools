/**
 * Vue Entry Point
 *
 * Import this to use the component highlighter with Vue:
 * ```ts
 * import componentHighlighter from 'vite-plugin-experimental-storybook-devtools/vue'
 * ```
 */

import {
  createPlugin,
  type ComponentHighlighterOptions,
} from '../../create-plugin'
import { vueFramework } from '.'

/**
 * Vue Component Highlighter Plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite'
 * import vue from '@vitejs/plugin-vue'
 * import { DevTools } from '@vitejs/devtools'
 * import componentHighlighter from 'vite-plugin-experimental-storybook-devtools/vue'
 *
 * export default defineConfig({
 *   plugins: [
 *     vue(),
 *     DevTools(),
 *     componentHighlighter(),
 *   ],
 * })
 * ```
 */
export default function componentHighlighterVue(
  options: ComponentHighlighterOptions = {},
) {
  return createPlugin(vueFramework, options)
}

// Re-export types
export type { ComponentHighlighterOptions } from '../../create-plugin'
export { vueFramework } from '.'
