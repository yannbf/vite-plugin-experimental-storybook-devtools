import type { ComponentInstance } from '../virtual-module'
import {
  enableOverlay,
  disableOverlay,
  toggleHighlightAll,
  updateHover,
  selectComponent,
  updateInstanceRects,
  setComponentRegistry,
  showHoverMenu,
  hideHoverMenu,
  hasSelection,
  clearSelection,
} from './overlay'

// Type declarations for devtools
declare global {
  interface Window {
    __vite_devtools_kit_rpc__?: any
  }
}

// Component registry - maintained locally and synced via events
const componentRegistry = new Map<string, ComponentInstance>()

// Set the registry reference for overlay module
setComponentRegistry(componentRegistry)

// Track if the dock is active (highlight mode)
let isDockActive = false

/**
 * Enable highlight mode (called when dock is activated)
 */
export function enableHighlightMode() {
  console.log('[component-highlighter] enableHighlightMode called')
  isDockActive = true
  enableOverlay()
}

/**
 * Disable highlight mode (called when dock is deactivated)
 */
export function disableHighlightMode() {
  console.log('[component-highlighter] disableHighlightMode called')
  isDockActive = false
  clearSelection()
  disableOverlay()
  hideHoverMenu()
}

// Event listeners for registry synchronization
if (typeof window !== 'undefined') {
  console.log('[component-highlighter] setting up event listeners')

  window.addEventListener('component-highlighter:register', ((
    event: CustomEvent
  ) => {
    const instance = event.detail
    componentRegistry.set(instance.id, instance)
    console.log(
      '[component-highlighter] component registered via event:',
      instance.id,
      instance.meta.componentName,
      'total:',
      componentRegistry.size
    )
  }) as EventListener)

  window.addEventListener('component-highlighter:unregister', ((
    event: CustomEvent
  ) => {
    const id = event.detail
    componentRegistry.delete(id)
    console.log(
      '[component-highlighter] component unregistered via event:',
      id,
      'total:',
      componentRegistry.size
    )
  }) as EventListener)

  window.addEventListener('component-highlighter:update-props', ((
    event: CustomEvent
  ) => {
    const { id, props, serializedProps } = event.detail
    const instance = componentRegistry.get(id)
    if (instance) {
      instance.props = props
      if (serializedProps) {
        instance.serializedProps = serializedProps
      }
    }
  }) as EventListener)
}

// Debounce function for performance
function debounce(func: Function, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(null, args), wait)
  }
}

// Registry management functions - these are now handled by the virtual module
// These functions are kept for compatibility but delegate to the virtual module
export function registerInstance(
  _meta: any,
  _props: Record<string, unknown>,
  _element: HTMLElement
): string {
  // This should be called from the virtual module, not directly
  console.warn(
    '[component-highlighter] registerInstance called from listeners - should be called from virtual module'
  )
  return ''
}

export function unregisterInstance(_id: string): void {
  // This should be called from the virtual module, not directly
  console.warn(
    '[component-highlighter] unregisterInstance called from listeners - should be called from virtual module'
  )
}

export function updateInstanceProps(
  _id: string,
  _props: Record<string, unknown>
): void {
  // This should be called from the virtual module, not directly
  console.warn(
    '[component-highlighter] updateInstanceProps called from listeners - should be called from virtual module'
  )
}

// Find component at pointer position (deepest first)
function findComponentAtPoint(x: number, y: number): ComponentInstance | null {
  // Get the deepest DOM element at the point
  const elementAtPoint = document.elementFromPoint(x, y)
  if (!elementAtPoint) return null

  // Walk up the DOM tree from the deepest element to find component instances
  let currentElement: Element | null = elementAtPoint

  while (currentElement) {
    // Check if this element has a component instance
    for (const instance of componentRegistry.values()) {
      if (instance.element === currentElement && instance.element.isConnected) {
        return instance
      }
    }

    // Move up to parent
    currentElement = currentElement.parentElement
  }

  return null
}

// Mouse move handler with debouncing
const handleMouseMove = debounce((event: MouseEvent) => {
  // Only respond when dock is active (highlight mode is on)
  if (!isDockActive) return

  const instance = findComponentAtPoint(event.clientX, event.clientY)
  updateHover(instance?.id || null)

  // Update instance rects for all components (for overlay positioning)
  updateInstanceRects()

  if (instance) {
    // Update rect for this instance
    instance.rect = instance.element.getBoundingClientRect()
    // Show hover menu (tooltip)
    showHoverMenu(instance, event.clientX, event.clientY)
    console.log('[component-highlighter] hovering:', instance.meta.componentName)
  } else {
    // Hide hover menu when not hovering over a component
    hideHoverMenu()
  }

  // Send to devtools if available
  if (window.__vite_devtools_kit_rpc__) {
    window.__vite_devtools_kit_rpc__.emit(
      'component-highlighter:highlight-target',
      instance
        ? {
          meta: instance.meta,
          props: instance.props,
          rect: instance.rect,
        }
        : null
    )
  }
}, 16) // ~60fps

// Click handler
function handleClick(event: MouseEvent) {
  // Only respond when dock is active (highlight mode is on)
  if (!isDockActive) return

  console.log('[component-highlighter] handleClick called', {
    isDockActive,
    hasSelection: hasSelection(),
  })

  const instance = findComponentAtPoint(event.clientX, event.clientY)

  if (instance) {
    console.log('[component-highlighter] component clicked:', instance.meta.componentName)
    selectComponent(instance, event.clientX, event.clientY)
  }
}

// Keyboard handlers (Shift+H to highlight all still works)
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'H' && event.shiftKey && isDockActive) {
    // Shift + H to highlight all components (only when dock is active)
    event.preventDefault()
    const enabled = toggleHighlightAll()
    console.log(
      '[component-highlighter] highlight all toggled:',
      enabled,
      'components:',
      componentRegistry.size
    )
  }

  // Escape to close selection
  if (event.key === 'Escape' && isDockActive && hasSelection()) {
    console.log('[component-highlighter] Escape pressed, clearing selection')
    clearSelection()
  }
}

// Initialize event listeners
if (typeof window !== 'undefined') {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('click', handleClick)
  document.addEventListener('keydown', handleKeyDown)

  // Update component positions on scroll
  window.addEventListener(
    'scroll',
    () => {
      if (isDockActive) {
        updateInstanceRects()
      }
    },
    { passive: true }
  )

  // Setup DevTools Kit RPC listeners with retry
  const setupRPC = () => {
    if (window.__vite_devtools_kit_rpc__) {
      const rpc = window.__vite_devtools_kit_rpc__
      console.log('[component-highlighter] RPC connected')

      rpc.on('component-highlighter:create-story', (data: any) => {
        // Dispatch custom event for external listeners
        const event = new CustomEvent('create-story', {
          detail: data,
        })
        window.dispatchEvent(event)
        console.log('[component-highlighter] create-story dispatched', data)
      })

      rpc.on(
        'component-highlighter:toggle-overlay',
        (data: { enabled: boolean }) => {
          console.log('[component-highlighter] toggle-overlay received', data)
          if (data.enabled) {
            enableHighlightMode()
          } else {
            disableHighlightMode()
          }

          // Reflect state back to dock UI
          rpc.emit('component-highlighter:toggle-overlay', {
            enabled: data.enabled,
          })
        }
      )

      // Send initial overlay state to dock UI (overlay is disabled by default)
      rpc.emit('component-highlighter:toggle-overlay', { enabled: false })
      console.log('[component-highlighter] initial state sent: disabled')
    } else {
      // Retry setup after a short delay
      setTimeout(setupRPC, 100)
    }
  }

  setupRPC()
}

// Export for debugging
if (typeof window !== 'undefined') {
  ; (window as any).__componentHighlighterRegistry = componentRegistry
    ; (window as any).__componentHighlighterToggle = () => {
      const enabled = toggleHighlightAll()
      return enabled
    }
    ; (window as any).__componentHighlighterDraw = () => {
      enableOverlay()
      updateInstanceRects()
    }
}
