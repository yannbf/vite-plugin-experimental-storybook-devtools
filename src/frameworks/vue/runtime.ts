/**
 * Vue Runtime
 *
 * Contains the runtime code for Vue component tracking and prop serialization.
 * This is injected as a virtual module during development.
 */

import type { HighlighterOptions, VirtualModuleSetup } from '../types'

/**
 * Setup the Vue virtual module runtime
 * Returns the runtime code as a string to be served as a virtual module
 */
export const setupVirtualModule: VirtualModuleSetup = (
  options: HighlighterOptions,
): string => {
  return `
import { defineComponent, h, ref, provide, inject, onMounted, onUpdated, onUnmounted, getCurrentInstance, computed } from 'vue'
import { findFirstTrackableElement } from 'vite-plugin-experimental-storybook-devtools/runtime-helpers'

const DEBUG_MODE = ${options.debugMode ? 'true' : 'false'}
globalThis.logDebug = (...args) => {
  if (DEBUG_MODE) {
    console.log('[component-highlighter-vue]', ...args)
  }
}

// Always log errors
const logError = (...args) => {
  console.error('[component-highlighter-vue]', ...args)
}

logDebug('Vue runtime loaded', { debug: DEBUG_MODE })

// Component registry for tracking live instances
const componentRegistry = new Map()

// Generate unique instance ID
function generateInstanceId(sourceId) {
  return \`\${sourceId}:\${Math.random().toString(36).substr(2, 9)}\`
}

/**
 * Serialize props, handling Vue reactive objects
 */
function serializeProps(props) {
  const serialized = {}
  
  for (const [key, value] of Object.entries(props)) {
    serialized[key] = serializeValue(value)
  }
  
  return serialized
}

/**
 * Serialize a single value
 */
function serializeValue(value) {
  // Handle Vue reactive objects
  if (value && typeof value === 'object') {
    if (typeof value.toJSON === 'function') {
      // Vue ref or reactive object
      try {
        return JSON.parse(JSON.stringify(value.toJSON?.() ?? value))
      } catch {
        return undefined
      }
    } else if (Array.isArray(value)) {
      // Handle arrays
      return value.map(item => serializeValue(item))
    } else if (value.constructor === Object) {
      // Plain objects
      const serialized = {}
      for (const [k, v] of Object.entries(value)) {
        serialized[k] = serializeValue(v)
      }
      return serialized
    }
  }
  
  // Handle functions - return a placeholder
  if (typeof value === 'function') {
    return { __isFunction: true, name: value.name || 'anonymous' }
  }
  
  // Primitives pass through
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

/**
 * Track a Vue component instance with the highlighter
 */
export function withComponentHighlighter(meta) {
  if (typeof window === 'undefined') return

  const instance = getCurrentInstance()
  if (!instance) {
    logDebug('Could not get current Vue instance for', meta.componentName)
    return
  }

  const registration = { id: null, element: null }
  let mutationObserver = null
  let resizeObserver = null

  const disconnectObservers = () => {
    mutationObserver?.disconnect()
    resizeObserver?.disconnect()
    mutationObserver = null
    resizeObserver = null
  }

  const resolveElementToTrack = () => {
    let element = instance.proxy?.$el || instance.vnode?.el || instance.subTree?.el
    if (!element) return null

    if (element.nodeType !== Node.ELEMENT_NODE) {
      logDebug('Component root is not an Element node', {
        componentName: meta.componentName,
        nodeType: element.nodeType,
        nodeName: element.nodeName,
      })

      const children = element.parentNode?.childNodes
      if (children) {
        for (const child of children) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            element = child
            break
          }
        }
      }

      if (element.nodeType !== Node.ELEMENT_NODE) {
        return null
      }
    }

    return findFirstTrackableElement(element)
  }

  const attachObservers = (id, element) => {
    mutationObserver = new MutationObserver(() => {
      const registeredInstance = componentRegistry.get(id)
      if (
        registeredInstance &&
        registeredInstance.element &&
        registeredInstance.element.isConnected
      ) {
        registeredInstance.rect =
          registeredInstance.element.getBoundingClientRect()
      }
    })

    mutationObserver.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style', 'class'],
    })

    resizeObserver = new ResizeObserver(() => {
      const registeredInstance = componentRegistry.get(id)
      if (
        registeredInstance &&
        registeredInstance.element &&
        registeredInstance.element.isConnected
      ) {
        registeredInstance.rect =
          registeredInstance.element.getBoundingClientRect()
      }
    })

    resizeObserver.observe(element)
  }

  const registerOrUpdate = () => {
    const element = resolveElementToTrack()
    if (!element) {
      logDebug('Could not find valid Element node for', meta.componentName)
      return
    }

    const props = instance.proxy?.$props || {}

    if (registration.id && registration.element === element) {
      updateInstanceProps(registration.id, props)
      return
    }

    if (registration.id) {
      unregisterInstance(registration.id)
    }

    disconnectObservers()

    const id = registerInstance(meta, props, element)
    registration.id = id
    registration.element = element
    attachObservers(id, element)
  }
  
  // Store meta in a way that child components can access it
  provide('__componentHighlighterMeta', meta)
  
  onMounted(() => {
    registerOrUpdate()
  })

  onUpdated(() => {
    registerOrUpdate()
  })

  onUnmounted(() => {
    disconnectObservers()
    if (registration.id) {
      unregisterInstance(registration.id)
      registration.id = null
      registration.element = null
    }
  })
}

export default {
  registerInstance,
  unregisterInstance,
  updateInstanceProps,
  getComponentRegistry,
  withComponentHighlighter,
}
`
}
