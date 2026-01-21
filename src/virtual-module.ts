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

  logDebug('registerInstance', { id, componentName: meta.componentName, totalComponents: componentRegistry.size })

  // Dispatch event for listeners module
  const event = new CustomEvent('component-highlighter:register', { detail: instance })
  window.dispatchEvent(event)
  logDebug('dispatched register event for', id)

  return id
}

export function unregisterInstance(id) {
  // Check if the DOM element is still in the document
  const instance = componentRegistry.get(id)
  if (instance && instance.element && instance.element.isConnected) {
    // Element is still in DOM, don't unregister yet
    logDebug('skipping unregistration for', id, '- element still in DOM')
    return
  }

  // Element is not in DOM anymore, safe to unregister
  componentRegistry.delete(id)
  logDebug('unregistered', { id, remaining: componentRegistry.size })

  // Dispatch event for listeners module
  const event = new CustomEvent('component-highlighter:unregister', { detail: id })
  window.dispatchEvent(event)
}

export function updateInstanceProps(id, props) {
  const instance = componentRegistry.get(id)
  if (instance) {
    instance.props = props
    logDebug('updateInstanceProps', { id, props })

    // Dispatch event for listeners module
    const event = new CustomEvent('component-highlighter:update-props', { detail: { id, props } })
    window.dispatchEvent(event)
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
            },
          }
        )
        const firstChild = walker.firstChild()
        if (firstChild) {
          elementToTrack = firstChild
        }
      }

      const id = registerInstance(meta, props, elementToTrack)
      setInstanceId(id)

      // Set up mutation observer to watch for DOM changes
      const observer = new MutationObserver(() => {
        // Update rect when DOM changes
        const instance = componentRegistry.get(id)
        if (instance && instance.element && instance.element.isConnected) {
          instance.rect = instance.element.getBoundingClientRect()
        }
      })
      observer.observe(elementToTrack, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['style', 'class'],
      })

      // Set up resize observer to watch for size changes
      const resizeObserver = new ResizeObserver(() => {
        const instance = componentRegistry.get(id)
        if (instance && instance.element && instance.element.isConnected) {
          instance.rect = instance.element.getBoundingClientRect()
        }
      })
      resizeObserver.observe(elementToTrack)

      return () => {
        observer.disconnect()
        resizeObserver.disconnect()
        unregisterInstance(id)
      }
    }
  }, [meta, props, instanceId])

  useEffect(() => {
    if (instanceId) {
      updateInstanceProps(instanceId, props)
    }
  }, [instanceId, props])

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
`
}
