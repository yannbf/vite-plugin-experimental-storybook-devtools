import type { ComponentInstance, SerializedProps } from '../virtual-module'
import type { Emitter } from 'nanoevents'
import { createNanoEvents } from 'nanoevents'

// Event emitter for overlay actions
export interface OverlayEvents {
  'log-info': (data: {
    meta: ComponentInstance['meta']
    props: Record<string, unknown>
    serializedProps?: SerializedProps
    componentRegistry?: Record<string, string>
    storyName?: string
  }) => void
}

export const overlayEvents: Emitter<OverlayEvents> =
  createNanoEvents<OverlayEvents>()

// Global state for overlay management
let canvasElement: HTMLCanvasElement | null = null
let canvasContext: CanvasRenderingContext2D | null = null
let contextMenuElement: HTMLDivElement | null = null
let isOverlayEnabled = false
let isHighlightAllActive = false
let currentHoveredId: string | null = null
let selectedComponentId: string | null = null
let currentCloseHandler: ((e: MouseEvent) => void) | null = null

// Import component registry from listeners
let componentRegistry: Map<string, ComponentInstance>

// Function to set component registry reference
export function setComponentRegistry(registry: Map<string, ComponentInstance>) {
  componentRegistry = registry
}

// Helper to escape HTML for safe display
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Suggest a story name based on props
function suggestStoryName(props: Record<string, unknown>): string {
  // Common prop names that make good story names
  const meaningfulProps = ['variant', 'type', 'size', 'mode', 'status', 'kind', 'color', 'intent', 'appearance']

  for (const propName of meaningfulProps) {
    const value = props[propName]
    if (typeof value === 'string' && value.length > 0 && value.length < 30) {
      // Capitalize first letter
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
  }

  // Check for boolean props that are true
  for (const [key, value] of Object.entries(props)) {
    if (value === true && !key.startsWith('_')) {
      return key.charAt(0).toUpperCase() + key.slice(1)
    }
  }

  return 'Default'
}

// Canvas overlay management
function createCanvasOverlay() {
  if (canvasElement) return

  canvasElement = document.createElement('canvas')
  canvasElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 999998;
    opacity: 0.8;
  `
  canvasContext = canvasElement.getContext('2d')!
  document.body.appendChild(canvasElement)

  // Resize canvas to match viewport
  function resizeCanvas() {
    if (canvasElement) {
      canvasElement.width = window.innerWidth
      canvasElement.height = window.innerHeight
    }
  }

  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
}

function clearCanvas() {
  if (canvasContext && canvasElement) {
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height)
  }
}

function drawBorder(instance: ComponentInstance, color: string, thickness = 2) {
  if (!canvasContext || !instance.rect) return

  const rect = instance.rect
  canvasContext.strokeStyle = color
  canvasContext.lineWidth = thickness
  canvasContext.strokeRect(rect.left, rect.top, rect.width, rect.height)
}

function drawAllBorders() {
  clearCanvas()
  if (!canvasContext) return

  const instances = Array.from(componentRegistry.values())

  // Find the component name to highlight (either hovered or selected)
  let highlightComponentName: string | null = null
  if (selectedComponentId) {
    // When a component is selected, highlight other instances of the same type
    const selectedInstance = instances.find(
      (inst) => inst.id === selectedComponentId
    )
    if (selectedInstance) {
      highlightComponentName = selectedInstance.meta.componentName
    }
  } else if (currentHoveredId && isOverlayEnabled) {
    // When hovering, highlight other instances of the same type
    const hoveredInstance = instances.find(
      (inst) => inst.id === currentHoveredId
    )
    if (hoveredInstance) {
      highlightComponentName = hoveredInstance.meta.componentName
    }
  }

  for (const instance of instances) {
    if (!instance.rect) continue

    let color = '#999999' // Default gray for inactive
    let shouldDraw = false

    if (selectedComponentId === instance.id) {
      color = '#ff6b35' // Orange for selected
      shouldDraw = true
    } else if (currentHoveredId === instance.id && isOverlayEnabled) {
      color = '#4ade80' // Green for hovered (only when overlay is enabled)
      shouldDraw = true
    } else if (isHighlightAllActive) {
      color = '#3b82f6' // Blue for highlight all
      shouldDraw = true
    } else if (
      highlightComponentName &&
      instance.meta.componentName === highlightComponentName &&
      instance.id !== selectedComponentId // Don't highlight the selected component again
    ) {
      // Highlight other instances of the same component type with blue
      color = '#3b82f6' // Blue for same component type
      shouldDraw = true
    }

    if (shouldDraw) {
      drawBorder(instance, color)
    }
  }
}

// Context menu management
function showContextMenu(instance: ComponentInstance, x: number, y: number) {
  hideContextMenu()

  const meta = instance.meta
  const props = instance.props
  const serializedProps = instance.serializedProps

  contextMenuElement = document.createElement('div')
  contextMenuElement.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 9999999;
    min-width: 300px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  `

  // Use serialized props for display if available, otherwise fall back to raw props
  const displayProps = serializedProps || props
  const propsHtml = Object.entries(displayProps)
    .map(([key, value]) => {
      // Check if this is a serialized JSX value
      if (
        value &&
        typeof value === 'object' &&
        '__isJSX' in value &&
        (value as { __isJSX: boolean }).__isJSX
      ) {
        const jsxValue = value as unknown as { __isJSX: true; source: string }
        return `<div style="font-family: monospace; background: #1e3a5f; color: #93c5fd; padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block; font-size: 12px;" title="${escapeHtml(jsxValue.source)}">${key}=&lt;JSX&gt;</div>`
      }
      // Check if this is a function placeholder
      if (
        value &&
        typeof value === 'object' &&
        '__isFunction' in value
      ) {
        return `<div style="font-family: monospace; background: #4a3728; color: #fbbf24; padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block; font-size: 12px;">${key}=&lt;fn&gt;</div>`
      }
      return `<div style="font-family: monospace; background: #222222; color: white; padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block; font-size: 12px;">${key}=${JSON.stringify(
        value
      )}</div>`
    })
    .join('')

  const suggestedName = suggestStoryName(props)

  contextMenuElement.innerHTML = `
    <div style="padding: 12px;">
      <div style="font-weight: bold; color: #2563eb; margin-bottom: 8px;">${meta.componentName
    }</div>
      <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">${meta.filePath
    }</div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">Props:</div>
        <div>${propsHtml || '<span style="color: #9ca3af;">none</span>'}</div>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="font-weight: bold; display: block; margin-bottom: 4px; font-size: 12px;">Story Name:</label>
        <input 
          id="story-name-input" 
          type="text" 
          value="${suggestedName}"
          style="width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; box-sizing: border-box;"
          placeholder="Enter story name..."
        />
      </div>
      <button id="create-story-btn" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">
        Create Story
      </button>
    </div>
  `

  document.body.appendChild(contextMenuElement)

  // Add click handler for the create story button
  const createStoryBtn = contextMenuElement.querySelector(
    '#create-story-btn'
  ) as HTMLButtonElement
  const storyNameInput = contextMenuElement.querySelector(
    '#story-name-input'
  ) as HTMLInputElement

  // Select input text on focus for easy editing
  storyNameInput.addEventListener('focus', () => {
    storyNameInput.select()
  })

  // Allow Enter key to submit
  storyNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      createStoryBtn.click()
    }
  })

  createStoryBtn.addEventListener('click', () => {
    // Get the story name from input
    const storyName = storyNameInput.value.trim() || suggestedName

    // Get the component registry for import resolution
    const getRegistry = (window as unknown as { __componentHighlighterGetRegistry?: () => Map<string, string> }).__componentHighlighterGetRegistry
    let componentRegistryObj: Record<string, string> = {}
    if (getRegistry) {
      const registry = getRegistry()
      componentRegistryObj = Object.fromEntries(registry)
    }

    const componentInfo: {
      meta: typeof meta
      props: typeof props
      serializedProps: SerializedProps | undefined
      componentRegistry: Record<string, string>
      storyName: string
    } = {
      meta,
      props,
      serializedProps,
      componentRegistry: componentRegistryObj,
      storyName,
    }

    console.log('Component Info:', componentInfo)

    // Emit event that vite-devtools client script can listen to (when dock is active)
    console.log('Emitting log-info event:', componentInfo)
    overlayEvents.emit('log-info', componentInfo as Parameters<typeof overlayEvents.emit<'log-info'>>[1])

    // Show feedback - button state will be updated by showStoryCreationFeedback
    createStoryBtn.textContent = 'Creating...'
    createStoryBtn.disabled = true
  })

  // Close on click outside
  currentCloseHandler = (e: MouseEvent) => {
    if (!contextMenuElement!.contains(e.target as Node)) {
      selectedComponentId = null
      hideContextMenu()
      drawAllBorders()
      document.removeEventListener('click', currentCloseHandler!)
      currentCloseHandler = null
    }
  }
  setTimeout(() => document.addEventListener('click', currentCloseHandler!), 10)
}

function hideContextMenu() {
  if (contextMenuElement) {
    contextMenuElement.remove()
    contextMenuElement = null
  }
  if (currentCloseHandler) {
    document.removeEventListener('click', currentCloseHandler)
    currentCloseHandler = null
  }
}

// Hover menu management
let hoverMenuElement: HTMLDivElement | null = null
let hoverMenuTimeout: number | null = null

export function showHoverMenu(
  instance: ComponentInstance,
  x: number,
  y: number
) {
  hideHoverMenu()

  const meta = instance.meta

  hoverMenuElement = document.createElement('div')
  hoverMenuElement.style.cssText = `
    position: fixed;
    left: ${x + 10}px;
    top: ${y + 10}px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    pointer-events: none;
    z-index: 999999;
    max-width: 300px;
    word-break: break-all;
  `

  hoverMenuElement.textContent = `<${meta.componentName}>`
  document.body.appendChild(hoverMenuElement)
}

export function hideHoverMenu() {
  if (hoverMenuElement) {
    hoverMenuElement.remove()
    hoverMenuElement = null
  }
  if (hoverMenuTimeout) {
    clearTimeout(hoverMenuTimeout)
    hoverMenuTimeout = null
  }
}

// Public API
export function enableOverlay() {
  isOverlayEnabled = true
  createCanvasOverlay()
  // Don't draw borders immediately - wait for hover or selection
}

export function disableOverlay() {
  isOverlayEnabled = false
  clearCanvas()
  currentHoveredId = null
  hideHoverMenu()
  if (!isHighlightAllActive) {
    if (canvasElement) {
      canvasElement.remove()
      canvasElement = null
      canvasContext = null
    }
  }
}

export function toggleHighlightAll() {
  isHighlightAllActive = !isHighlightAllActive
  if (isHighlightAllActive) {
    isOverlayEnabled = true
    createCanvasOverlay()
  }
  drawAllBorders()
  return isHighlightAllActive
}

export function updateHover(instanceId: string | null) {
  currentHoveredId = instanceId
  if (isOverlayEnabled) {
    drawAllBorders()
  }
}

export function selectComponent(
  instance: ComponentInstance,
  x: number,
  y: number
) {
  selectedComponentId = instance.id
  drawAllBorders()
  showContextMenu(instance, x, y)
}

export function clearSelection() {
  selectedComponentId = null
  hideContextMenu()
  drawAllBorders()

  // Disable overlay when selection is cleared (unless highlight-all is active)
  if (!isHighlightAllActive) {
    disableOverlay()
  }
}

export function updateInstanceRects() {
  // Update rects for all instances and redraw
  for (const instance of componentRegistry.values()) {
    if (instance.element && instance.element.isConnected) {
      instance.rect = instance.element.getBoundingClientRect()
    }
  }
  drawAllBorders()
}

export function hasSelection(): boolean {
  return selectedComponentId !== null
}

/**
 * Show feedback for story creation (success or error)
 */
export function showStoryCreationFeedback(status: 'success' | 'error', filePath?: string): void {
  const createStoryBtn = contextMenuElement?.querySelector('#create-story-btn') as HTMLButtonElement | null

  if (!createStoryBtn) {
    console.log('[component-highlighter] No create-story button found for feedback')
    return
  }

  if (status === 'success') {
    createStoryBtn.textContent = '✓ Created!'
    createStoryBtn.style.background = '#16a34a'
    console.log('[component-highlighter] Story creation success feedback shown', filePath)
  } else {
    createStoryBtn.textContent = '✗ Failed'
    createStoryBtn.style.background = '#dc2626'
    console.log('[component-highlighter] Story creation error feedback shown')
  }

  // Reset button after a delay
  setTimeout(() => {
    if (createStoryBtn && contextMenuElement?.contains(createStoryBtn)) {
      createStoryBtn.textContent = 'Create Story'
      createStoryBtn.style.background = '#2563eb'
      createStoryBtn.disabled = false
    }
  }, 2000)
}
