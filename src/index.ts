/**
 * vite-plugin-component-highlighter
 *
 * Import from a framework-specific path:
 * ```ts
 * import componentHighlighter from 'vite-plugin-component-highlighter/react'
 * ```
 */

// Core plugin factory (for advanced use cases)
export { createComponentHighlighterPlugin, type ComponentHighlighterOptions } from './component-highlighter-plugin'

// Story generator
export { generateStory, generateStoryName } from './story-generator'
export type {
  SerializedProps,
  JSXSerializedValue,
  StoryGenerationData,
  GeneratedStory,
} from './story-generator'

// Framework types
export type {
  ComponentMeta,
  ComponentInstance,
  HighlighterOptions,
  TransformFunction,
  VirtualModuleSetup,
  FrameworkDetector,
  FrameworkConfig,
  ProviderDependency,
} from './frameworks'

// Provider analyzer
export { analyzeAppProviders, analyzeComponentFile } from './provider-analyzer'
