/// <reference types="@vitejs/devtools-kit" />
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
    ctx.rpc.call('component-highlighter:create-story', data)
  })

  ctx.current.events.on('entry:deactivated', () => {
    console.log('dock deactivated')
    disableOverlay()
  })
}
