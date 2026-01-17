export interface ComponentMeta {
  componentName: string
  filePath: string
  sourceId: string
  isDefaultExport: boolean
  line?: number
  column?: number
}

export interface ComponentInstance {
  id: string
  meta: ComponentMeta
  props: Record<string, unknown>
  rect?: DOMRect
  element: HTMLElement
}

export interface HighlighterOptions {
  eventName: string
  enableOverlay: boolean
  devtoolsDockId: string
  debugMode?: boolean
}

export function setupVirtualModule(options: HighlighterOptions): string {
  return `
import React, { createElement, useEffect, useRef, useState } from 'react'
const DEBUG_MODE = ${options.debugMode ? 'true' : 'false'}
const logDebug = (...args) => {
  if (DEBUG_MODE) {
    console.log('[component-highlighter]', ...args)
  }
}

logDebug('runtime loaded', { debug: DEBUG_MODE })

// Component registry for tracking live instances
const componentRegistry = new Map()

// Debounce function for performance
function debounce(func, wait) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(null, args), wait)
  }
}

// Generate unique instance ID
function generateInstanceId(sourceId) {
  return \`\${sourceId}:\${Math.random().toString(36).substr(2, 9)}\`
}

// Registry management functions
export function registerInstance(meta, props, element) {
  const id = generateInstanceId(meta.sourceId)
  const instance = {
    id,
    meta,
    props,
    element,
  }
  componentRegistry.set(id, instance)

  logDebug('registerInstance', { id, meta, props })

  return id
}

export function unregisterInstance(id) {
  componentRegistry.delete(id)
  logDebug('unregisterInstance', { id })
}

export function updateInstanceProps(id, props) {
  const instance = componentRegistry.get(id)
  if (instance) {
    instance.props = props
    logDebug('updateInstanceProps', { id, props })
  }
}

// Component boundary that tracks position without DOM modification
export const ComponentHighlighterBoundary = ({ meta, props, children }) => {
  const ref = useRef(null)
  const [instanceId, setInstanceId] = useState(null)

  useEffect(() => {
    if (ref.current && !instanceId) {
      // Find the actual DOM element with dimensions
      let elementToTrack = ref.current

      // If our wrapper span has no dimensions, find the first child with dimensions
      if (elementToTrack.offsetWidth === 0 && elementToTrack.offsetHeight === 0) {
        const walker = document.createTreeWalker(
          elementToTrack,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              const el = node
              return el.offsetWidth > 0 && el.offsetHeight > 0
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_SKIP
            }
          }
        )

        const found = walker.nextNode()
        if (found) {
          elementToTrack = found
          logDebug('found element with dimensions', { tagName: elementToTrack.tagName, rect: elementToTrack.getBoundingClientRect() })
        }
      }

      const id = registerInstance(meta, props, elementToTrack)
      setInstanceId(id)
      logDebug('boundary mounted', { id, meta, elementTag: elementToTrack.tagName })
    }

    return () => {
      if (instanceId) {
        unregisterInstance(instanceId)
        logDebug('boundary unmounted', { id: instanceId })
      }
    }
  }, [meta, props, instanceId])

  useEffect(() => {
    if (instanceId) {
      updateInstanceProps(instanceId, props)
    }
  }, [instanceId, props])

  // Always wrap with span to ensure we have a DOM element to track
  return React.createElement('span', { ref, style: { display: 'contents' } }, children)
}

// Higher-order component that wraps components with boundary
export function withComponentHighlighter(Component, meta) {
  const WrappedComponent = (props) => {
    return React.createElement(
      ComponentHighlighterBoundary,
      { meta, props },
      React.createElement(Component, props)
    )
  }

  WrappedComponent.displayName = \`withComponentHighlighter(\${Component.displayName || Component.name || 'Component'})\`

  return WrappedComponent
}

// Overlay and interaction management
let isOverlayEnabled = ${options.enableOverlay}
let currentHoveredId = null
let selectedComponentId = null
let canvasElement = null
let canvasContext = null
let isAltActive = false
let isHighlightAllActive = false

function createCanvasOverlay() {
  if (canvasElement) return canvasElement

  canvasElement = document.createElement('canvas')
  canvasElement.style.cssText = \`
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 999999;
    width: 100vw;
    height: 100vh;
  \`
  canvasContext = canvasElement.getContext('2d')

  // Set canvas size to match viewport
  canvasElement.width = window.innerWidth
  canvasElement.height = window.innerHeight

  document.body.appendChild(canvasElement)
  logDebug('canvas overlay created', { width: canvasElement.width, height: canvasElement.height })

  // Handle canvas resizing
  const resizeCanvas = () => {
    if (canvasElement) {
      canvasElement.width = window.innerWidth
      canvasElement.height = window.innerHeight
      logDebug('canvas resized', { width: canvasElement.width, height: canvasElement.height })
      if (isOverlayEnabled) {
        drawAllBorders()
      }
    }
  }

  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('scroll', () => {
    if (isOverlayEnabled) {
      drawAllBorders()
    }
  })

  return canvasElement
}

function drawAllBorders() {
  if (!canvasContext) {
    logDebug('drawAllBorders skipped - no canvas context')
    return
  }

  canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height)

  // Always draw status indicator
  canvasContext.fillStyle = isOverlayEnabled ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)'
  canvasContext.fillRect(10, 10, 250, 30)
  canvasContext.fillStyle = 'white'
  canvasContext.font = '14px monospace'
  canvasContext.fillText(\`Overlay: \${isOverlayEnabled ? 'ON' : 'OFF'} (\${componentRegistry.size} components)\`, 15, 28)

  if (!isOverlayEnabled) {
    logDebug('drawAllBorders - overlay disabled, showing status only')
    return
  }

  logDebug('drawing borders', { hovered: currentHoveredId, selected: selectedComponentId, highlightAll: isHighlightAllActive })

  // Draw borders for all components when highlight all is active
  if (isHighlightAllActive) {
    for (const [id, instance] of componentRegistry) {
      const rect = instance.element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        canvasContext.strokeStyle = '#ff4785'
        canvasContext.lineWidth = 1
        canvasContext.setLineDash([])
        canvasContext.strokeRect(rect.left - 1, rect.top - 1, rect.width + 2, rect.height + 2)
        canvasContext.fillStyle = 'rgba(255, 71, 133, 0.05)' // Lighter background for all components
        canvasContext.fillRect(rect.left - 1, rect.top - 1, rect.width + 2, rect.height + 2)
      }
    }
    logDebug('drew borders for all components')
    return
  }

  // Draw border for hovered component (when Alt is held)
  if (currentHoveredId && isAltActive) {
    const hoveredInstance = componentRegistry.get(currentHoveredId)
    if (hoveredInstance) {
      const rect = hoveredInstance.element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        canvasContext.strokeStyle = '#ff4785' // Pink for hover
        canvasContext.lineWidth = 1
        canvasContext.setLineDash([]) // Solid border
        canvasContext.strokeRect(rect.left - 1, rect.top - 1, rect.width + 2, rect.height + 2)
        canvasContext.fillStyle = 'rgba(255, 71, 133, 0.1)' // #ff4785 at 10% opacity
        canvasContext.fillRect(rect.left - 1, rect.top - 1, rect.width + 2, rect.height + 2)
        logDebug('drew hover border for', currentHoveredId)
      }
    }
  }

  // Draw border for selected component (persistent until clicked outside)
  if (selectedComponentId) {
    const selectedInstance = componentRegistry.get(selectedComponentId)
    if (selectedInstance) {
      const rect = selectedInstance.element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        canvasContext.strokeStyle = '#10b981' // Green for selected
        canvasContext.lineWidth = 3
        canvasContext.setLineDash([])
        canvasContext.strokeRect(rect.left - 2, rect.top - 2, rect.width + 4, rect.height + 4)
        canvasContext.fillStyle = 'rgba(16, 185, 129, 0.1)'
        canvasContext.fillRect(rect.left - 2, rect.top - 2, rect.width + 4, rect.height + 4)
        logDebug('drew selected border for', selectedComponentId)
      }
    }
  }
}

function clearCanvas() {
  if (canvasContext) {
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height)
  }
}

function findComponentAtPoint(x, y) {
  // Find component whose element contains the point
  for (const [id, instance] of componentRegistry) {
    const rect = instance.element.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return instance
    }
  }
  return null
}

function handleMouseMove(event) {
  if (!isOverlayEnabled) return

  const instance = findComponentAtPoint(event.clientX, event.clientY)
  const newHoveredId = instance?.id || null

  if (newHoveredId !== currentHoveredId) {
    currentHoveredId = newHoveredId
    drawAllBorders()

    // Show/hide hover menu
    if (instance && isAltActive) {
      const rect = instance.element.getBoundingClientRect()
      const menuX = rect.left + rect.width / 2 - 50 // Center above component
      const menuY = rect.top - 40 // Above component
      showHoverMenu(instance, menuX, menuY)
    } else {
      hideHoverMenu()
    }

    // Send to DevTools via RPC for hover preview (only when Alt is active)
    if (isAltActive && window.__vite_devtools_kit_rpc__) {
      if (instance) {
        window.__vite_devtools_kit_rpc__.emit('component-highlighter:highlight-target', {
          meta: instance.meta,
          props: instance.props,
          rect: instance.element.getBoundingClientRect(),
        })
        logDebug('emit highlight-target', { id: newHoveredId, meta: instance.meta })
      } else {
        window.__vite_devtools_kit_rpc__.emit('component-highlighter:highlight-target', null)
        logDebug('emit highlight-target null (no component at point)')
      }
    }
  }
}

// Context menu management
let contextMenuElement = null
let hoverMenuElement = null
let currentCloseHandler = null

function showHoverMenu(instance, x, y) {
  // Clean up any existing hover menu
  hideHoverMenu()

  hoverMenuElement = document.createElement('div')
  hoverMenuElement.style.cssText = \`
    position: fixed;
    left: \${x}px;
    top: \${y}px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 9999998;
    padding: 8px 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #2563eb;
    white-space: nowrap;
    pointer-events: none;
  \`

  // Add triangle pointer
  const triangle = document.createElement('div')
  triangle.style.cssText = \`
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid white;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  \`

  hoverMenuElement.innerHTML = instance.meta.componentName
  hoverMenuElement.appendChild(triangle)
  document.body.appendChild(hoverMenuElement)

  logDebug('showed hover menu for', instance.id)
}

function hideHoverMenu() {
  if (hoverMenuElement) {
    hoverMenuElement.remove()
    hoverMenuElement = null
    logDebug('hid hover menu')
  }
}

function showContextMenu(instance, x, y) {
  // Clean up any existing menu and handlers
  if (currentCloseHandler) {
    document.removeEventListener('click', currentCloseHandler)
    currentCloseHandler = null
  }
  hideContextMenu()

  contextMenuElement = document.createElement('div')
  contextMenuElement.style.cssText = \`
    position: fixed;
    left: \${x}px;
    top: \${y}px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 9999999;
    min-width: 300px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  \`

  const meta = instance.meta
  const props = instance.props

  const propsHtml = Object.entries(props).map(([key, value]) =>
    \`<div style="font-family: monospace; background: #222222; padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block; font-size: 12px;">\${key}=\${JSON.stringify(value)}</div>\`
  ).join('')

  contextMenuElement.innerHTML = \`
    <div style="padding: 12px;">
      <div style="font-weight: bold; color: #2563eb; margin-bottom: 8px;">\${meta.componentName}</div>
      <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">\${meta.filePath}</div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">Props:</div>
        <div>\${propsHtml || '<span style="color: #9ca3af;">none</span>'}</div>
      </div>
      <button id="log-info-btn" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Log Info
      </button>
    </div>
    <div style="position: absolute; bottom: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid white; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));"></div>
  \`

  document.body.appendChild(contextMenuElement)

  // Add click handler for the log button
  const logBtn = contextMenuElement.querySelector('#log-info-btn')
  logBtn.addEventListener('click', () => {
    const componentInfo = {
      componentName: meta.componentName,
      componentPath: meta.filePath,
      isDefaultExport: meta.isDefaultExport,
      args: props,
    }

    console.log('Component Info:', componentInfo)

    // Emit window event for create-story
    const event = new CustomEvent('create-story', {
      detail: componentInfo,
    })
    window.dispatchEvent(event)

    hideContextMenu()
  })

  // Close on click outside
  currentCloseHandler = (e) => {
    if (!contextMenuElement.contains(e.target)) {
      logDebug('context menu close handler triggered')
      selectedComponentId = null
      hideContextMenu()
      drawAllBorders()
      document.removeEventListener('click', currentCloseHandler)
      currentCloseHandler = null
    }
  }
  setTimeout(() => document.addEventListener('click', currentCloseHandler), 10)

  logDebug('showed context menu for', instance.id)
}

function hideContextMenu() {
  if (contextMenuElement) {
    contextMenuElement.remove()
    contextMenuElement = null
    logDebug('hid context menu')
  }
  if (currentCloseHandler) {
    document.removeEventListener('click', currentCloseHandler)
    currentCloseHandler = null
    logDebug('cleaned up close handler')
  }
}

function handleClick(event) {
  logDebug('handleClick called', { selectedComponentId, isAltActive, hasContextMenu: !!contextMenuElement })

  // If clicking on the current context menu, don't do anything
  if (contextMenuElement && contextMenuElement.contains(event.target)) {
    logDebug('clicked on context menu, ignoring')
    return
  }

  // Find clicked component first
  const instance = findComponentAtPoint(event.clientX, event.clientY)

  // Handle existing selection
  if (selectedComponentId) {
    const clickedElement = document.elementFromPoint(event.clientX, event.clientY)
    const isClickOnSelected = selectedComponentId && componentRegistry.get(selectedComponentId)?.element.contains(clickedElement)

    // If Alt is held and we clicked on a different component, switch selection
    if (isAltActive && instance && instance.id !== selectedComponentId) {
      logDebug('switching selection from', selectedComponentId, 'to', instance.id)
      selectedComponentId = instance.id
      drawAllBorders()
      // Small delay to ensure the menu is fully rendered before attaching close handler
      setTimeout(() => showContextMenu(instance, event.clientX, event.clientY), 0)
      return
    }

    // If clicking on the selected component or outside, clear selection
    if (!isClickOnSelected) {
      logDebug('clicked outside selected component, clearing selection')
      selectedComponentId = null
      hideContextMenu()
      drawAllBorders()
    }
    return
  }

  // Only allow new selections when Alt is held
  if (!isAltActive) return

  // Prevent default context menu
  event.preventDefault()

  if (instance) {
    logDebug('component clicked', { id: instance.id, meta: instance.meta })
    selectedComponentId = instance.id
    drawAllBorders()
    // Small delay to ensure the menu is fully rendered before attaching close handler
    setTimeout(() => showContextMenu(instance, event.clientX, event.clientY), 0)
  }
}

function handleKeyDown(event) {
  logDebug('keydown event', { key: event.key, altKey: event.altKey, shiftKey: event.shiftKey })
  if (event.key === 'Alt') {
    if (!isAltActive) {
      isAltActive = true
      isOverlayEnabled = true
      createCanvasOverlay()
      drawAllBorders()
      logDebug('Alt down - enabling overlay')
    }
  } else if (event.key === 'H' && event.shiftKey) {
    // Shift + H to highlight all components
    event.preventDefault()
    isHighlightAllActive = !isHighlightAllActive
    if (isHighlightAllActive) {
      isOverlayEnabled = true
      createCanvasOverlay()
    }
    drawAllBorders()
    logDebug('highlight all toggled', { active: isHighlightAllActive })
  }
}

function handleKeyUp(event) {
  if (event.key === 'Alt') {
    if (isAltActive) {
      logDebug('Alt up; disabling overlay')
      isAltActive = false
      // Only disable overlay if highlight all is not active
      if (!isHighlightAllActive) {
        isOverlayEnabled = false
        clearCanvas()
      }
      currentHoveredId = null
      hideHoverMenu()
      // Keep selected component and context menu visible when Alt is released
      if (window.__vite_devtools_kit_rpc__) {
        window.__vite_devtools_kit_rpc__.emit('component-highlighter:highlight-target', null)
        logDebug('emit highlight-target null (Alt up)')
      }
    }
  }
}

// Initialize event listeners
if (typeof window !== 'undefined') {
  document.addEventListener('mousemove', debounce(handleMouseMove, 16)) // ~60fps
  document.addEventListener('click', handleClick)
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)

  // Setup DevTools Kit RPC listeners with retry
  const setupRPC = () => {
    if (window.__vite_devtools_kit_rpc__) {
      const rpc = window.__vite_devtools_kit_rpc__

      rpc.on('component-highlighter:create-story', (data) => {
        const detail = data?.meta
          ? { componentName: data.meta.componentName, filePath: data.meta.filePath, props: data.props, sourceId: data.meta.sourceId }
          : data

        // Dispatch custom event for external listeners
        const event = new CustomEvent('${options.eventName}', {
          detail,
        })
        window.dispatchEvent(event)
        logDebug('create-story dispatched', detail)
      })

      rpc.on('component-highlighter:toggle-overlay', (data) => {
        isOverlayEnabled = data.enabled
        // If disabling overlay, also disable highlight all mode
        if (!isOverlayEnabled) {
          isHighlightAllActive = false
        }
        logDebug('toggle-overlay received', data)
        if (isOverlayEnabled) {
          createCanvasOverlay()
          drawAllBorders()
        } else {
          clearCanvas()
          currentHoveredId = null
        }

        // Reflect state back to dock UI
        rpc.emit('component-highlighter:toggle-overlay', { enabled: isOverlayEnabled })
        logDebug('toggle-overlay echo', { enabled: isOverlayEnabled })
      })

      // Send initial overlay state to dock UI (overlay is disabled by default now)
      rpc.emit('component-highlighter:toggle-overlay', { enabled: false })
      logDebug('initial overlay disabled')
    } else {
      // Retry setup after a short delay
      setTimeout(setupRPC, 100)
    }
  }

  setupRPC()
}

// Export for debugging
if (typeof window !== 'undefined') {
  window.__componentHighlighterRegistry = componentRegistry
  window.__componentHighlighterToggle = () => {
    isOverlayEnabled = !isOverlayEnabled
    if (isOverlayEnabled) {
      createCanvasOverlay()
      drawAllBorders()
    } else {
      clearCanvas()
    }
    return isOverlayEnabled
  }
  window.__componentHighlighterDraw = () => {
    createCanvasOverlay()
    drawAllBorders()
  }
}
`
}
