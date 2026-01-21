import type { ComponentInstance } from '../frameworks/types'
import {
  enableOverlay,
  disableOverlay,
  setHighlightAll,
  updateHover,
  updateInstanceRects,
  setComponentRegistry,
  showHoverMenu,
  hideHoverMenu,
  hasSelection,
  clearSelection,
  isHighlightAllEnabled,
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

// Track Option key state
let isOptionHeld = false

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
  isOptionHeld = false
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


// Find component at pointer position
// When Option is held, we don't need to find component at point for hovering
// but we still need it for clicks
function findComponentAtPoint(x: number, y: number): ComponentInstance | null {
  // When highlights are showing, we need to check what's under the pointer
  // accounting for the highlight layer
  const highlightContainer = document.getElementById('component-highlighter-container')

  // Temporarily hide the highlight container to get the actual element
  if (highlightContainer) {
    highlightContainer.style.display = 'none'
  }

  const elementAtPoint = document.elementFromPoint(x, y)

  // Restore highlight container
  if (highlightContainer) {
    highlightContainer.style.display = ''
  }

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

  // Update instance rects for all components (for overlay positioning)
  updateInstanceRects()

  // Find component under cursor for hover highlight
  const instance = findComponentAtPoint(event.clientX, event.clientY)
  updateHover(instance?.id || null)

  if (instance) {
    // Update rect for this instance (needed for proper highlight positioning)
    instance.rect = instance.element.getBoundingClientRect()
    showHoverMenu(instance, event.clientX, event.clientY)
  } else {
    hideHoverMenu()
  }
}, 16) // ~60fps

// Keyboard handlers
function handleKeyDown(event: KeyboardEvent) {
  // Option/Alt key handling
  if (event.key === 'Alt' && isDockActive && !isOptionHeld) {
    isOptionHeld = true
    setHighlightAll(true)
    console.log('[component-highlighter] Option held - showing all highlights')
  }

  // Shift+H to toggle sticky highlight-all mode
  if (event.key === 'H' && event.shiftKey && isDockActive) {
    event.preventDefault()
    const currentState = isHighlightAllEnabled()
    setHighlightAll(!currentState)
    console.log(
      '[component-highlighter] highlight all toggled:',
      !currentState,
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

function handleKeyUp(event: KeyboardEvent) {
  // Option/Alt key release
  if (event.key === 'Alt' && isOptionHeld) {
    isOptionHeld = false
    // Only disable highlight-all if it wasn't toggled sticky with Shift+H
    setHighlightAll(false)
    console.log('[component-highlighter] Option released - hiding non-hovered highlights')
  }
}

// Initialize event listeners
if (typeof window !== 'undefined') {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)

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
      const currentState = isHighlightAllEnabled()
      setHighlightAll(!currentState)
      return !currentState
    }
    ; (window as any).__componentHighlighterDraw = () => {
      enableOverlay()
      updateInstanceRects()
    }
}
