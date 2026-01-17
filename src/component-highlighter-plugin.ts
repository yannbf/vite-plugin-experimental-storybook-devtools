/// <reference types="@vitejs/devtools-kit" />
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { transform } from './transform'
import { setupVirtualModule } from './virtual-module'
import { defineRpcFunction } from '@vitejs/devtools-kit'

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
  }
  props: Record<string, unknown>
  rect: DOMRect
}

interface ComponentStoryData {
  meta: {
    componentName: string
    filePath: string
    sourceId: string
  }
  props: Record<string, unknown>
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
  } = options

  const filter = createFilter(include, exclude)
  let isServe = false

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
    devtools: {
      setup(ctx) {
        // Register dock entry for component highlighter UI
        ctx.docks.register({
          id: devtoolsDockId,
          title: 'Component Highlighter',
          icon: 'https://avatars.githubusercontent.com/u/22632046',
          type: 'iframe',
          url: '/__component-highlighter-devtools',
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
                console.log('[DevTools] Create story:', data)
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
    configureServer(server) {
      // Serve the devtools iframe content
      server.middlewares.use(
        '/__component-highlighter-devtools',
        (_req, res) => {
          res.setHeader('Content-Type', 'text/html')
          res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Component Highlighter DevTools</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #root { padding: 16px; }
    .component-info { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin: 8px 0; }
    .component-info.hovered { border-color: #f59e0b; background: #fef3c7; }
    .component-info.selected { border-color: #10b981; background: #d1fae5; }
    .status { font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
    .component-info.hovered .status { color: #d97706; }
    .component-info.selected .status { color: #059669; }
    .component-name { font-weight: bold; color: #2563eb; }
    .props-section { margin-top: 8px; }
    .prop { font-family: monospace; background: #f3f4f6; padding: 2px 4px; border-radius: 3px; margin: 2px; display: inline-block; }
    .create-story-btn { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 8px; }
    .create-story-btn:hover { background: #1d4ed8; }
    .no-selection { color: #6b7280; text-align: center; padding: 40px; }
    .toggle-btn { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-bottom: 12px; }
    .toggle-btn:hover { background: #e5e7eb; }
    .enabled { background: #dbeafe; color: #1e40af; border-color: #3b82f6; }
  </style>
</head>
<body>
  <div id="root">
    <h2>Component Highlighter</h2>
    <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">
      Hold Option/Alt to enable highlight mode, then hover to preview components.
    </div>
    <div id="component-info" class="no-selection">Hold Option/Alt and hover over components to see details here</div>
  </div>
  <script>
    // DevTools Kit RPC setup
    let rpc = null;
    let selectedComponent = null;

    const resolveRPC = () => window.__vite_devtools_kit_rpc__ || (window.parent && window.parent.__vite_devtools_kit_rpc__) || null;

    // Wait for DevTools Kit to initialize
    const initRPC = () => {
      const maybeRpc = resolveRPC();
      if (maybeRpc) {
        rpc = maybeRpc;

        // Listen for highlight target updates from the page
        rpc.on('component-highlighter:highlight-target', (data) => {
          updateComponent(data);
        });
      } else {
        // Retry after a short delay
        setTimeout(initRPC, 100);
      }
    };

    initRPC();

    function updateComponent(data) {
      const el = document.getElementById('component-info');
      if (!data) {
        el.innerHTML = '<div class="no-selection">Hold Option/Alt and hover over components to see details here</div>';
        return;
      }

      const meta = data.meta || {};
      const props = data.props || {};

      const propsHtml = Object.entries(props).map(([key, value]) =>
        \`<span class="prop">\${key}=\${JSON.stringify(value)}</span>\`
      ).join('');

      el.innerHTML = \`
        <div class="component-info hovered">
          <div class="status">Hovering Over</div>
          <div class="component-name">\${meta.componentName || 'Unknown Component'}</div>
          <div>File: \${meta.filePath || 'unknown'}</div>
          <div class="props-section">Props: \${propsHtml || 'none'}</div>
          <button class="create-story-btn" onclick='createStory(JSON.parse(this.dataset.payload))' data-payload='\${JSON.stringify({ meta, props }).replace(/'/g, '&apos;').replace(/"/g, '&quot;')}'>
            Create Story
          </button>
        </div>
      \`;
    }

    function createStory(data) {
      if (rpc) {
        rpc.emit('component-highlighter:create-story', data);
      }
    }

  </script>
</body>
</html>`)
        }
      )
    },
  }
}
