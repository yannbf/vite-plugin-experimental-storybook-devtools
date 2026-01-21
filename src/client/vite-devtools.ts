/// <reference types="@vitejs/devtools-kit" />
/// <reference types="vite/client" />
import type { DockClientScriptContext } from '@vitejs/devtools-kit/client'
import { enableOverlay, disableOverlay, overlayEvents } from './overlay'

export default function clientScriptSetup(ctx: DockClientScriptContext): void {
  console.log('clientScriptSetup called', ctx)
  ctx.current.events.on('entry:activated', () => {
    console.log('dock activated - setting up log-info listener')
    enableOverlay()
  })

  // Set up event listener when dock is activated (like vue-tracer does)
  overlayEvents.on('log-info', (data) => {
    console.log('log-info event received, calling RPC:', data)
      // Pass serialized props and component registry to the server
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (ctx.rpc.call as any)('component-highlighter:create-story', {
        meta: data.meta,
        props: data.props,
        serializedProps: data.serializedProps,
        componentRegistry: data.componentRegistry,
      })
  })

  ctx.current.events.on('entry:deactivated', () => {
    console.log('dock deactivated')
    disableOverlay()
  })

  // Listen for story creation confirmation from the server
  if (import.meta.hot) {
    import.meta.hot.on('component-highlighter:story-created', (data: { filePath: string; componentName: string }) => {
      console.log(`✅ Story created for ${data.componentName}: ${data.filePath}`)
      // Could show a toast notification here
    })
  }
}
