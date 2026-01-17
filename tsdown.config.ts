import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/component-highlighter-plugin.ts'],
  format: ['esm'],
  dts: true,
  external: ['vite', '@babel/parser', '@babel/traverse', '@babel/generator', '@babel/types'],
})
