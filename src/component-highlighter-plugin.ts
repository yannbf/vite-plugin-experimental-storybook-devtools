/// <reference types="@vitejs/devtools-kit" />
import type { Plugin, ViteDevServer } from 'vite'
import { createFilter } from 'vite'
import { transform } from './transform'
import { setupVirtualModule } from './virtual-module'
import type { SerializedProps } from './virtual-module'
import { generateStory } from './story-generator'
import { defineRpcFunction } from '@vitejs/devtools-kit'
import * as fs from 'fs'
import * as path from 'path'

// RPC function type declarations
declare module '@vitejs/devtools-kit' {
  interface DevToolsRpcFunctions {
    'component-highlighter:highlight-target': (
      data: ComponentHighlightData | null
    ) => void
    'component-highlighter:toggle-overlay': (data: { enabled: boolean }) => void
    'component-highlighter:create-story': (data: ComponentStoryData) => void
  }
}

interface ComponentHighlightData {
  meta: {
    componentName: string
    filePath: string
    sourceId: string
    isDefaultExport?: boolean
  }
  props: Record<string, unknown>
  serializedProps?: SerializedProps
  rect: DOMRect
}

interface ComponentStoryData {
  meta: {
    componentName: string
    filePath: string
    sourceId: string
    isDefaultExport?: boolean
  }
  props: Record<string, unknown>
  serializedProps?: SerializedProps
  /** Component registry for import resolution: componentName -> filePath */
  componentRegistry?: Record<string, string>
  /** Custom story name */
  storyName?: string
}

export interface ComponentHighlighterOptions {
  /**
   * Glob patterns to include for component instrumentation
   * @default ["**\/*.{tsx,jsx}"]
   */
  include?: string[]
  /**
   * Glob patterns to exclude from component instrumentation
   * @default ["**\/node_modules/**", "**\/dist/**", "**\/*.d.ts"]
   */
  exclude?: string[]
  /**
   * Event name for the "create story" event
   * @default 'component-highlighter:create-story'
   */
  eventName?: string
  /**
   * Whether to enable the overlay in development
   * @default true
   */
  enableOverlay?: boolean
  /**
   * Custom devtools dock ID
   * @default 'component-highlighter'
   */
  devtoolsDockId?: string
  /**
   * Force instrumentation even in production builds
   * @default false
   */
  force?: boolean
  /**
   * Enable verbose debug logging (browser console)
   * @default false
   */
  debugMode?: boolean
  /**
   * Automatically write story files when "Create Story" is clicked
   * @default true
   */
  writeStoryFiles?: boolean
  /**
   * Custom directory for story files (relative to component)
   * If not set, stories are created next to the component
   */
  storiesDir?: string
}

export default function componentHighlighterPlugin(
  options: ComponentHighlighterOptions = {}
): Plugin {
  const {
    include = ['**/*.{tsx,jsx}'],
    exclude = ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    eventName = 'component-highlighter:create-story',
    enableOverlay = true,
    devtoolsDockId = 'component-highlighter',
    force = false,
    debugMode = false,
    writeStoryFiles = true,
    storiesDir,
  } = options

  const filter = createFilter(include, exclude)
  let isServe = false
  let server: ViteDevServer | undefined

  return {
    name: 'vite-plugin-component-highlighter',
    enforce: 'pre', // run before React plugin so JSX is still present
    configResolved(config) {
      isServe = config.command === 'serve'
      // Detect React setup and warn if missing
      const hasReact = config.plugins?.some(
        (p) =>
          p && typeof p === 'object' && 'name' in p && p.name.includes('react')
      )
      if (!hasReact) {
        console.warn(
          '[vite-plugin-component-highlighter] React plugin not detected. Make sure to add @vitejs/plugin-react to your Vite config.'
        )
      }
    },
    configureServer(srv) {
      server = srv
    },
    devtools: {
      setup(ctx) {
        // Register dock entry for component highlighter UI
        ctx.docks.register({
          id: devtoolsDockId,
          title: 'Component Highlighter',
          icon: 'https://avatars.githubusercontent.com/u/22632046',
          type: 'action',
          action: {
            importFrom:
              'vite-plugin-component-highlighter/client/vite-devtools',
            importName: 'default',
          },
        })

        // Register RPC functions for communication with the client
        ctx.rpc.register(
          defineRpcFunction({
            name: 'component-highlighter:highlight-target',
            type: 'action',
            setup: () => ({
              handler: (data: ComponentHighlightData | null) => {
                // This will be called from the client when hovering over components
                console.log('[DevTools] Highlight target:', data)
              },
            }),
          })
        )

        ctx.rpc.register(
          defineRpcFunction({
            name: 'component-highlighter:toggle-overlay',
            type: 'action',
            setup: () => ({
              handler: (data: { enabled: boolean }) => {
                // This will be called from the client when toggling overlay
                console.log('[DevTools] Toggle overlay:', data.enabled)
              },
            }),
          })
        )

        ctx.rpc.register(
          defineRpcFunction({
            name: 'component-highlighter:create-story',
            type: 'action',
            setup: () => ({
              handler: (data: ComponentStoryData) => {
                // This will be called when creating a story from the component
                console.log('[DevTools] Create story:', data.meta.componentName, 'name:', data.storyName)

                // Generate and write the story file
                if (writeStoryFiles && data.serializedProps) {
                  try {
                    // Convert component registry from object to Map
                    const registryMap = new Map<string, string>()
                    if (data.componentRegistry) {
                      for (const [name, filePath] of Object.entries(
                        data.componentRegistry
                      )) {
                        registryMap.set(name, filePath)
                      }
                    }

                    // Determine the output path
                    const componentDir = path.dirname(data.meta.filePath)
                    const componentFileName = path.basename(
                      data.meta.filePath,
                      path.extname(data.meta.filePath)
                    )
                    let outputPath = path.join(
                      componentDir,
                      `${componentFileName}.stories.tsx`
                    )
                    if (storiesDir) {
                      outputPath = path.join(
                        componentDir,
                        storiesDir,
                        `${componentFileName}.stories.tsx`
                      )
                    }

                    // Check if file already exists
                    let existingContent: string | undefined
                    if (fs.existsSync(outputPath)) {
                      existingContent = fs.readFileSync(outputPath, 'utf-8')
                      console.log(
                        `[DevTools] Appending to existing story file: ${outputPath}`
                      )
                    }

                    const story = generateStory({
                      meta: {
                        componentName: data.meta.componentName,
                        filePath: data.meta.filePath,
                        sourceId: data.meta.sourceId,
                        isDefaultExport: data.meta.isDefaultExport ?? false,
                      },
                      props: data.serializedProps,
                      componentRegistry: registryMap,
                      ...(data.storyName ? { storyName: data.storyName } : {}),
                      ...(existingContent ? { existingContent } : {}),
                    })

                    // Ensure the directory exists
                    const outputDir = path.dirname(outputPath)
                    if (!fs.existsSync(outputDir)) {
                      fs.mkdirSync(outputDir, { recursive: true })
                    }

                    // Write the story file
                    fs.writeFileSync(outputPath, story.content, 'utf-8')
                    console.log(
                      `[DevTools] Story "${story.storyName}" ${existingContent ? 'added to' : 'created in'}: ${outputPath}`
                    )

                    // Notify the client about the created file
                    if (server) {
                      server.ws.send({
                        type: 'custom',
                        event: 'component-highlighter:story-created',
                        data: {
                          filePath: outputPath,
                          componentName: data.meta.componentName,
                          storyName: story.storyName,
                          isAppend: !!existingContent,
                        },
                      })
                    }
                  } catch (error) {
                    console.error('[DevTools] Failed to create story:', error)
                  }
                }

                // Dispatch custom event that can be listened to by external tools (like Storybook)
                const event = new CustomEvent(eventName, {
                  detail: data,
                })
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(event)
                }
              },
            }),
          })
        )
      },
    },
    resolveId(id) {
      if (id === 'virtual:component-highlighter/runtime') {
        return '\0' + id
      }
      return null
    },
    load(id) {
      if (id === '\0virtual:component-highlighter/runtime') {
        return setupVirtualModule({
          eventName,
          enableOverlay,
          devtoolsDockId,
          debugMode,
        })
      }
      return null
    },
    transform(code, id) {
      // Only transform in dev/serve mode unless force is enabled
      if (!isServe && !force) {
        return
      }

      // Skip non-JSX/TSX files and excluded files
      if (!filter(id) || !/\.(tsx|jsx)$/.test(id)) {
        return
      }
      console.log('transform', id)

      return transform(code, id)
    },
  }
}
