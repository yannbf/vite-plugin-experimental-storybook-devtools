/**
 * React Runtime
 *
 * Contains the runtime code for the React HOC and prop serialization.
 * This is injected as a virtual module during development.
 */

import type { HighlighterOptions, VirtualModuleSetup } from '../types'

/**
 * Setup the React virtual module runtime
 * Returns the runtime code as a string to be served as a virtual module
 */
export const setupVirtualModule: VirtualModuleSetup = (options: HighlighterOptions): string => {
  return `
import React, { createElement, useEffect, useRef, useState } from 'react'
import reactElementToJSXString from 'react-element-to-jsx-string/dist/esm/index.js'

const DEBUG_MODE = ${options.debugMode ? 'true' : 'false'}
const logDebug = (...args) => {
  if (DEBUG_MODE) {
    console.log('[component-highlighter]', ...args)
  }
}

// Always log errors
const logError = (...args) => {
  console.error('[component-highlighter]', ...args)
}

logDebug('React runtime loaded', { debug: DEBUG_MODE })

// Component registry for tracking live instances
const componentRegistry = new Map()

// Generate unique instance ID
function generateInstanceId(sourceId) {
  return \`\${sourceId}:\${Math.random().toString(36).substr(2, 9)}\`
}

/**
 * Get the display name of a React element's type
 * Checks for __originalName first (set by withComponentHighlighter)
 */
function getComponentName(type) {
  if (typeof type === 'string') return type // DOM element
  
  // Check for our custom __originalName property first (most reliable)
  if (type?.__originalName) {
    return type.__originalName
  }
  
  if (typeof type === 'function') {
    // Try to unwrap HOC patterns from displayName
    const displayName = type.displayName
    if (displayName) {
      const match = displayName.match(/^(?:with\\w+|memo|forwardRef)\\((.+)\\)$/)
      if (match) return match[1]
      return displayName
    }
    return type.name || 'Unknown'
  }
  
  if (type && typeof type === 'object') {
    // Handle React.memo, React.forwardRef, etc.
    if (type.__originalName) return type.__originalName
    if (type.displayName) {
      const match = type.displayName.match(/^(?:with\\w+|memo|forwardRef)\\((.+)\\)$/)
      if (match) return match[1]
      return type.displayName
    }
    if (type.render?.__originalName) return type.render.__originalName
    if (type.render?.displayName) return type.render.displayName
    if (type.type) return getComponentName(type.type)
  }
  
  return 'Unknown'
}

/**
 * Extract component references from a React element tree
 */
function extractComponentRefs(element, refs = new Set()) {
  if (!React.isValidElement(element)) return refs
  
  const type = element.type
  const name = getComponentName(type)
  
  // Only track non-DOM components (capitalized names)
  if (typeof type !== 'string' && name && name[0] === name[0].toUpperCase()) {
    refs.add(name)
  }
  
  // Recursively check children
  const children = element.props?.children
  if (children) {
    if (Array.isArray(children)) {
      children.forEach(child => extractComponentRefs(child, refs))
    } else if (React.isValidElement(children)) {
      extractComponentRefs(children, refs)
    }
  }
  
  // Check other props that might contain JSX
  Object.entries(element.props || {}).forEach(([key, value]) => {
    if (key !== 'children' && React.isValidElement(value)) {
      extractComponentRefs(value, refs)
    }
  })
  
  return refs
}

/**
 * Serialize props, converting JSX elements to source strings
 */
function serializeProps(props) {
  const serialized = {}
  
  for (const [key, value] of Object.entries(props)) {
    serialized[key] = serializeValue(value)
  }
  
  return serialized
}

/**
 * Serialize a single value, handling JSX elements specially
 */
function serializeValue(value) {
  // Handle React elements (JSX)
  if (React.isValidElement(value)) {
    try {
      const elementName = getComponentName(value.type)
      logDebug('Serializing single JSX element:', elementName)
      const source = reactElementToJSXString(value, {
        showDefaultProps: false,
        showFunctions: true,
        sortProps: true,
        useBooleanShorthandSyntax: true,
        useFragmentShortSyntax: true,
        // Use __originalName if available, otherwise fall back to getComponentName
        displayName: (el) => {
          const t = el.type
          if (typeof t === 'string') return t
          if (t?.__originalName) return t.__originalName
          return getComponentName(t)
        },
      })
      const componentRefs = Array.from(extractComponentRefs(value))
      logDebug('Serialized JSX element successfully:', source.substring(0, 100))
      return {
        __isJSX: true,
        source,
        componentRefs,
      }
    } catch (err) {
      logError('Failed to serialize JSX element:', err?.message || err, value)
      return { __isJSX: true, source: '{/* Failed to serialize */}', componentRefs: [] }
    }
  }
  
  // Handle arrays that may contain JSX
  if (Array.isArray(value)) {
    const hasJSX = value.some(item => React.isValidElement(item))
    if (hasJSX) {
      try {
        logDebug('Serializing JSX array with', value.length, 'items')
        // Wrap in fragment for serialization
        const fragment = React.createElement(React.Fragment, null, ...value)
        const source = reactElementToJSXString(fragment, {
          showDefaultProps: false,
          showFunctions: true,
          sortProps: true,
          useBooleanShorthandSyntax: true,
          useFragmentShortSyntax: true,
          // Use __originalName if available, otherwise fall back to getComponentName
          displayName: (el) => {
            const t = el.type
            if (typeof t === 'string') return t
            if (t?.__originalName) return t.__originalName
            return getComponentName(t)
          },
        })
        
        // Collect all component refs from the array
        const componentRefs = new Set()
        value.forEach(item => {
          if (React.isValidElement(item)) {
            extractComponentRefs(item, componentRefs)
          }
        })
        
        logDebug('Serialized JSX array successfully:', source.substring(0, 100))
        return {
          __isJSX: true,
          source,
          componentRefs: Array.from(componentRefs),
        }
      } catch (err) {
        logError('Failed to serialize JSX array:', err?.message || err)
        // Log what we're trying to serialize for debugging
        value.forEach((item, i) => {
          if (React.isValidElement(item)) {
            logError('  Array item', i, ':', item.type?.name || item.type || typeof item)
          } else {
            logError('  Array item', i, ':', typeof item, item)
          }
        })
        return { __isJSX: true, source: '{/* Failed to serialize */}', componentRefs: [] }
      }
    }
    // Regular array - recursively serialize
    return value.map(item => serializeValue(item))
  }
  
  // Handle plain objects (but not null)
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const serialized = {}
    for (const [k, v] of Object.entries(value)) {
      serialized[k] = serializeValue(v)
    }
    return serialized
  }
  
  // Handle functions - return a placeholder
  if (typeof value === 'function') {
    return { __isFunction: true, name: value.name || 'anonymous' }
  }
  
  // Primitives and other values pass through
  return value
}

// Registry management functions
export function registerInstance(meta, props, element) {
  const id = generateInstanceId(meta.sourceId)
  const serializedProps = serializeProps(props)

  const instance = {
    id,
    meta,
    props,
    serializedProps,
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
    instance.serializedProps = serializeProps(props)
    logDebug('updateInstanceProps', { id, props })

    // Dispatch event for listeners module
    const event = new CustomEvent('component-highlighter:update-props', { 
      detail: { id, props, serializedProps: instance.serializedProps } 
    })
    window.dispatchEvent(event)
  }
}

/**
 * Get the component registry for import resolution
 * Returns a map of component name -> file path
 */
export function getComponentRegistry() {
  const registry = new Map()
  for (const instance of componentRegistry.values()) {
    registry.set(instance.meta.componentName, instance.meta.filePath)
  }
  return registry
}

// Expose registry getter globally for story generation
if (typeof window !== 'undefined') {
  window.__componentHighlighterGetRegistry = getComponentRegistry
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
  // Get the original component name
  // Priority: meta.componentName (from Babel transform, always correct)
  //           > Component.displayName (if explicitly set)
  //           > Component.name (might be mangled like '_c' by bundlers)
  const originalName = meta.componentName || Component.displayName || Component.name || 'Component'
  
  const WrappedComponent = (props) => {
    return React.createElement(
      ComponentHighlighterBoundary,
      { meta, props },
      React.createElement(Component, props)
    )
  }

  // Store the original name for serialization
  WrappedComponent.__originalName = originalName
  WrappedComponent.displayName = \`withComponentHighlighter(\${originalName})\`

  return WrappedComponent
}
`
}

