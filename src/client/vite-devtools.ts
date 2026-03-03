/// <reference types="@vitejs/devtools-kit" />
/// <reference types="vite/client" />
import type { DockClientScriptContext } from '@vitejs/devtools-kit/client'
import { defineRpcFunction } from '@vitejs/devtools-kit'
import type { HighlighterTransport } from './transport'
import { overlayEvents, showStoryCreationFeedback } from './overlay'
import { enableHighlightMode, disableHighlightMode } from './listeners'

/**
 * Build the Vite DevTools–backed transport for the component highlighter.
 *
 * - client→server: `ctx.rpc.call('component-highlighter:create-story', data)`
 * - server→client: registers `component-highlighter:story-created` as a typed
 *   client RPC function so the server can reach us via `ctx.rpc.broadcast(...)`.
 */
function createViteDevToolsTransport(
  ctx: DockClientScriptContext,
): HighlighterTransport {
  return {
    async createStory(data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.rpc.call as any)('component-highlighter:create-story', data)
    },

    onStoryCreated(handler) {
      ctx.rpc.client.register(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defineRpcFunction({
          name: 'component-highlighter:story-created',
          type: 'action',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setup: () => ({ handler } as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      )
      // DevTools Kit doesn't expose per-registration unsubscribe yet.
      return () => {}
    },
  }
}

export default function clientScriptSetup(ctx: DockClientScriptContext): void {
  console.log('[component-highlighter] clientScriptSetup called')

  const transport = createViteDevToolsTransport(ctx)

  // Register the server→client handler first so it's ready before any
  // story-creation confirmation can arrive.
  transport.onStoryCreated((data) => {
    console.log(
      `[component-highlighter] ✅ Story created for ${data.componentName}: ${data.filePath}`,
    )
    showStoryCreationFeedback('success', data.filePath, data.componentPath)
  })

  // When dock is activated, enable highlight mode
  ctx.current.events.on('entry:activated', () => {
    console.log(
      '[component-highlighter] dock activated - enabling highlight mode',
    )
    enableHighlightMode()
  })

  // When dock is deactivated, disable highlight mode
  ctx.current.events.on('entry:deactivated', () => {
    console.log(
      '[component-highlighter] dock deactivated - disabling highlight mode',
    )
    disableHighlightMode()
  })

  // Listen for "Create Story" requests emitted by the overlay
  overlayEvents.on('log-info', async (data) => {
    console.log(
      '[component-highlighter] log-info event received, sending via transport:',
      data.meta.componentName,
      'story:',
      data.storyName,
    )

    try {
      await transport.createStory({
        meta: data.meta,
        props: data.props,
        ...(data.serializedProps !== undefined
          ? { serializedProps: data.serializedProps }
          : {}),
        ...(data.componentRegistry !== undefined
          ? { componentRegistry: data.componentRegistry }
          : {}),
        ...(data.storyName !== undefined ? { storyName: data.storyName } : {}),
        ...(data.playFunction ? { playFunction: data.playFunction } : {}),
        ...(data.playImports ? { playImports: data.playImports } : {}),
      })
      console.log('[component-highlighter] transport.createStory successful')
    } catch (error) {
      console.error(
        '[component-highlighter] transport.createStory failed:',
        error,
      )
      showStoryCreationFeedback('error')
    }
  })
}
