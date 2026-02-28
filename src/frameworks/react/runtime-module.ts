/// <reference path="../../runtime-module-shims.d.ts" />
import React, { useEffect, useRef } from 'react'
import reactElementToJSXString from 'react-element-to-jsx-string/dist/esm/index.js'
import {
  cleanupInstanceTracking,
  findFirstTrackableElement,
  syncInstanceTracking,
} from 'virtual:component-highlighter/runtime-helpers'

// Injected by the virtual module loader.
declare const __COMPONENT_HIGHLIGHTER_DEBUG__: boolean

const DEBUG_MODE = __COMPONENT_HIGHLIGHTER_DEBUG__

const logDebug = (...args: unknown[]) => {
  if (DEBUG_MODE) {
    console.log('[component-highlighter]', ...args)
  }
}

;(
  globalThis as typeof globalThis & { logDebug?: (...args: unknown[]) => void }
).logDebug = logDebug

// Always log errors
const logError = (...args: unknown[]) => {
  console.error('[component-highlighter]', ...args)
}

logDebug('React runtime loaded', { debug: DEBUG_MODE })

// Component registry for tracking live instances
type ReactElement = any
type ReactNode = any
type ComponentType = any

const componentRegistry = new Map<
  string,
  {
    id: string
    meta: Record<string, unknown>
    props: Record<string, unknown>
    serializedProps: Record<string, unknown>
    element: Element
    rect?: DOMRect
  }
>()

// Generate unique instance ID
function generateInstanceId(sourceId: string) {
  return `${sourceId}:${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get the display name of a React element's type
 * Checks for __originalName first (set by withComponentHighlighter)
 */
function getComponentName(type: unknown) {
  if (typeof type === 'string') return type // DOM element

  const normalizeDisplayName = (name: string): string => {
    const hocMatch = name.match(/^(?:with\w+|memo|forwardRef)\((.+)\)$/)
    if (hocMatch && hocMatch[1]) {
      return normalizeDisplayName(hocMatch[1])
    }

    const wrapperMatch = name.match(/^([A-Z][A-Za-z0-9_$]*)\(([^)]+)\)$/)
    if (!wrapperMatch) return name

    const prefix = wrapperMatch[1]
    const innerRaw = wrapperMatch[2]
    if (!prefix || !innerRaw) return name

    const parts = innerRaw.match(/[A-Za-z0-9_$]+/g)
    if (!parts || parts.length === 0) return prefix

    const normalizedInner = parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')

    return `${prefix}${normalizedInner}`
  }

  // Check for our custom __originalName property first (most reliable)
  if ((type as { __originalName?: string })?.__originalName) {
    return (type as { __originalName: string }).__originalName
  }

  if (typeof type === 'function') {
    // Try to unwrap HOC patterns from displayName
    const displayName = (type as { displayName?: string }).displayName
    if (displayName) {
      return normalizeDisplayName(displayName)
    }
    return (type as { name?: string }).name || 'Unknown'
  }

  if (type && typeof type === 'object') {
    // Handle React.memo, React.forwardRef, etc.
    if ((type as { __originalName?: string }).__originalName)
      return (type as { __originalName: string }).__originalName
    if ((type as { displayName?: string }).displayName) {
      return normalizeDisplayName(
        (type as { displayName?: string }).displayName as string,
      )
    }
    if (
      (type as { render?: { __originalName?: string } }).render?.__originalName
    )
      return (type as { render: { __originalName: string } }).render
        .__originalName
    if ((type as { render?: { displayName?: string } }).render?.displayName)
      return normalizeDisplayName(
        (type as { render: { displayName: string } }).render.displayName,
      )
    if ((type as { type?: unknown }).type)
      return getComponentName((type as { type: unknown }).type)
  }

  return 'Unknown'
}

/**
 * Extract component references from a React element tree
 */
function extractComponentRefs(element: unknown, refs = new Set<string>()) {
  if (!React.isValidElement(element)) return refs

  const elementNode = element as ReactElement
  const type = elementNode.type
  const name = getComponentName(type)

  // Only track non-DOM components (capitalized names)
  if (typeof type !== 'string' && typeof name === 'string') {
    const firstChar = name.charAt(0)
    if (firstChar && firstChar === firstChar.toUpperCase()) {
      refs.add(name)
    }
  }

  // Recursively check children
  const children = elementNode.props?.children
  if (children) {
    if (Array.isArray(children)) {
      children.forEach((child) => extractComponentRefs(child, refs))
    } else if (React.isValidElement(children)) {
      extractComponentRefs(children, refs)
    }
  }

  // Check other props that might contain JSX
  Object.entries(elementNode.props || {}).forEach(([key, value]) => {
    if (key !== 'children' && React.isValidElement(value)) {
      extractComponentRefs(value, refs)
    }
  })

  return refs
}

/**
 * Serialize props, converting JSX elements to source strings
 */
function serializeProps(props: Record<string, unknown>) {
  const serialized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    serialized[key] = serializeValue(value)
  }

  return serialized
}

/**
 * Serialize a single value, handling JSX elements specially
 */
function serializeValue(value: unknown): unknown {
  // Handle React elements (JSX)
  if (React.isValidElement(value)) {
    try {
      const elementValue = value as { type: unknown }
      const elementName = getComponentName(elementValue.type)
      logDebug('Serializing single JSX element:', elementName)
      const source = reactElementToJSXString(value, {
        showDefaultProps: false,
        showFunctions: false,
        sortProps: true,
        useBooleanShorthandSyntax: true,
        useFragmentShortSyntax: true,
        // Use __originalName if available, otherwise fall back to getComponentName
        displayName: (el: ReactElement) => {
          const t = (el as { type?: unknown }).type as unknown
          if (typeof t === 'string') return t
          if ((t as { __originalName?: string })?.__originalName)
            return (t as { __originalName: string }).__originalName
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
      logError(
        'Failed to serialize JSX element:',
        (err as { message?: string })?.message || err,
        value,
      )
      return {
        __isJSX: true,
        source: '{/* Failed to serialize */}',
        componentRefs: [],
      }
    }
  }

  // Handle arrays that may contain JSX
  if (Array.isArray(value)) {
    const hasJSX = value.some((item) => React.isValidElement(item))
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
          displayName: (el: ReactElement) => {
            const t = (el as { type?: unknown }).type as unknown
            if (typeof t === 'string') return t
            if ((t as { __originalName?: string })?.__originalName)
              return (t as { __originalName: string }).__originalName
            return getComponentName(t)
          },
        })

        // Collect all component refs from the array
        const componentRefs = new Set<string>()
        value.forEach((item) => {
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
        logError(
          'Failed to serialize JSX array:',
          (err as { message?: string })?.message || err,
        )
        // Log what we're trying to serialize for debugging
        value.forEach((item, i) => {
          if (React.isValidElement(item)) {
            logError(
              '  Array item',
              i,
              ':',
              (item as { type?: { name?: string } })?.type?.name ||
                (item as { type?: unknown }).type ||
                typeof item,
            )
          } else {
            logError('  Array item', i, ':', typeof item, item)
          }
        })
        return {
          __isJSX: true,
          source: '{/* Failed to serialize */}',
          componentRefs: [],
        }
      }
    }
    // Regular array - recursively serialize
    return value.map((item) => serializeValue(item))
  }

  // Handle plain objects (but not null)
  if (
    value !== null &&
    typeof value === 'object' &&
    (value as { constructor?: unknown }).constructor === Object
  ) {
    const serialized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      serialized[k] = serializeValue(v)
    }
    return serialized
  }

  // Handle functions - return a placeholder
  if (typeof value === 'function') {
    return {
      __isFunction: true,
      name: (value as { name?: string }).name || 'anonymous',
    }
  }

  // Primitives and other values pass through
  return value
}

// Registry management functions
export function registerInstance(
  meta: Record<string, unknown>,
  props: Record<string, unknown>,
  element: Element,
) {
  const id = generateInstanceId(meta['sourceId'] as string)
  const serializedProps = serializeProps(props)

  const instance = {
    id,
    meta,
    props,
    serializedProps,
    element,
  }
  componentRegistry.set(id, instance)

  logDebug('registerInstance', {
    id,
    componentName: meta['componentName'],
    totalComponents: componentRegistry.size,
  })

  // Dispatch event for listeners module
  const event = new CustomEvent('component-highlighter:register', {
    detail: instance,
  })
  window.dispatchEvent(event)
  logDebug('dispatched register event for', id)

  return id
}

export function unregisterInstance(id: string) {
  // Always unregister when called - the cleanup function knows best
  componentRegistry.delete(id)
  logDebug('unregistered', { id, remaining: componentRegistry.size })

  // Dispatch event for listeners module
  const event = new CustomEvent('component-highlighter:unregister', {
    detail: id,
  })
  window.dispatchEvent(event)
}

export function updateInstanceProps(
  id: string,
  props: Record<string, unknown>,
) {
  const instance = componentRegistry.get(id)
  if (instance) {
    instance.props = props
    instance.serializedProps = serializeProps(props)
    logDebug('updateInstanceProps', { id, props })

    // Dispatch event for listeners module
    const event = new CustomEvent('component-highlighter:update-props', {
      detail: { id, props, serializedProps: instance.serializedProps },
    })
    window.dispatchEvent(event)
  }
}

/**
 * Get the component registry for import resolution
 * Returns a map of component name -> file path
 */
export function getComponentRegistry() {
  const registry = new Map<string, string>()
  for (const instance of componentRegistry.values()) {
    registry.set(
      (instance.meta['componentName'] as string) || '',
      instance.meta['filePath'] as string,
    )
  }
  return registry
}

// Expose registry getter globally for story generation
if (typeof window !== 'undefined') {
  ;(
    window as unknown as {
      __componentHighlighterGetRegistry?: () => Map<string, string>
    }
  ).__componentHighlighterGetRegistry = getComponentRegistry
}

// Component boundary that tracks position without DOM modification
export const ComponentHighlighterBoundary = ({
  meta,
  props,
  children,
}: {
  meta: Record<string, unknown>
  props: Record<string, unknown>
  children: ReactNode
}) => {
  const ref = useRef(null as HTMLSpanElement | null)
  // Track registration state with element reference to handle StrictMode and HMR correctly
  const registrationRef = useRef({
    id: null as string | null,
    element: null as Element | null,
    disconnect: null as (() => void) | null,
  })

  const resolveElementToTrack = (root: Element | null) => {
    if (!root) return null
    return findFirstTrackableElement(root)
  }

  const registerOrUpdateElement = (elementToTrack: Element | null) => {
    if (!elementToTrack) return

    syncInstanceTracking({
      state: registrationRef.current,
      element: elementToTrack,
      props,
      register: (element: Element, nextProps: Record<string, unknown>) =>
        registerInstance(meta, nextProps, element),
      unregister: unregisterInstance,
      updateProps: updateInstanceProps,
      getInstance: (lookupId: string) => componentRegistry.get(lookupId),
    })
  }

  useEffect(() => {
    if (!ref.current) return

    registerOrUpdateElement(resolveElementToTrack(ref.current))

    return () => {
      cleanupInstanceTracking(registrationRef.current, unregisterInstance)
    }
  }, [meta])

  useEffect(() => {
    if (!ref.current) return

    // Re-resolve tracked element on prop changes so components that toggle
    // between null and rendered DOM (e.g. modals) can rebind correctly.
    registerOrUpdateElement(resolveElementToTrack(ref.current))
  }, [props])

  return React.createElement(
    'span',
    { ref, style: { display: 'contents' } },
    children,
  )
}

// Higher-order component that wraps components with boundary
export function withComponentHighlighter(
  Component: ComponentType,
  meta: Record<string, unknown>,
) {
  // Get the original component name
  // Priority: meta.componentName (from Babel transform, always correct)
  //           > Component.displayName (if explicitly set)
  //           > Component.name (might be mangled like '_c' by bundlers)
  const originalName =
    (meta['componentName'] as string) ||
    Component.displayName ||
    Component.name ||
    'Component'

  const WrappedComponent = (props: Record<string, unknown>) => {
    return React.createElement(
      ComponentHighlighterBoundary,
      { meta, props },
      React.createElement(Component, props),
    )
  }

  // Store the original name for serialization
  ;(WrappedComponent as { __originalName?: string }).__originalName =
    originalName
  WrappedComponent.displayName = `withComponentHighlighter(${originalName})`

  return WrappedComponent
}

function createStableHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

const autoRegistry = new Map<string, { fiber: unknown }>()

function findReactFiberKey(element: Element): string | undefined {
  const keys = Object.keys(element)
  return keys.find((key) => key.startsWith('__reactFiber$'))
}

function findReactContainerKey(element: Element): string | undefined {
  const keys = Object.keys(element)
  return keys.find((key) => key.startsWith('__reactContainer$'))
}

function findHostElementFromFiber(fiber: any): Element | null {
  let node = fiber?.child
  while (node) {
    if (node.tag === 5 && node.stateNode instanceof Element) {
      return node.stateNode
    }
    const fromChild = findHostElementFromFiber(node)
    if (fromChild) return fromChild
    node = node.sibling
  }
  return null
}

function getFiberDisplayName(fiber: any): string {
  const fromType = fiber?.elementType || fiber?.type
  return (
    fromType?.displayName ||
    fromType?.name ||
    fiber?.type?.displayName ||
    fiber?.type?.name ||
    'Unknown'
  )
}

function registerOrUpdateAutoInstance(fiber: any) {
  const componentName = getFiberDisplayName(fiber)
  if (!componentName || componentName === 'Unknown') return null

  const props = (fiber?.memoizedProps || {}) as Record<string, unknown>
  const debugSource = fiber?._debugSource
  const filePath =
    (debugSource?.fileName as string | undefined) ||
    (fiber?._debugOwner?._debugSource?.fileName as string | undefined) ||
    'unknown'
  const sourceId = createStableHash(`${filePath}:${componentName}`)
  const instanceId = `${sourceId}:${fiber?._debugID || fiber?._mountOrder || componentName}`
  const element = findHostElementFromFiber(fiber)

  if (!element) return null

  const meta = {
    componentName,
    filePath,
    relativeFilePath: filePath,
    sourceId,
    isDefaultExport: false,
  }

  const existing = componentRegistry.get(instanceId)
  const serializedProps = serializeProps(props)

  if (existing) {
    existing.element = element
    existing.props = props
    existing.serializedProps = serializedProps
    const event = new CustomEvent('component-highlighter:update-props', {
      detail: { id: instanceId, props, serializedProps },
    })
    window.dispatchEvent(event)
  } else {
    const instance = {
      id: instanceId,
      meta,
      props,
      serializedProps,
      element,
    }
    componentRegistry.set(instanceId, instance)
    const event = new CustomEvent('component-highlighter:register', {
      detail: instance,
    })
    window.dispatchEvent(event)
  }

  autoRegistry.set(instanceId, { fiber })
  return instanceId
}

function scanFiberTreeForInstances() {
  if (typeof document === 'undefined') return

  const seen = new Set<string>()
  const containers = Array.from(document.querySelectorAll('*')) as Element[]

  for (const element of containers) {
    const containerKey = findReactContainerKey(element)
    const fiberKey = findReactFiberKey(element)

    const root = containerKey ? (element as any)[containerKey] : null
    const startFiber = root?.current || (fiberKey ? (element as any)[fiberKey] : null)

    if (!startFiber) continue

    const stack = [startFiber]
    while (stack.length > 0) {
      const fiber = stack.pop()
      if (!fiber) continue

      const isComposite = fiber.tag === 0 || fiber.tag === 1 || fiber.tag === 11 || fiber.tag === 14
      if (isComposite) {
        const id = registerOrUpdateAutoInstance(fiber)
        if (id) seen.add(id)
      }

      if (fiber.child) stack.push(fiber.child)
      if (fiber.sibling) stack.push(fiber.sibling)
    }
  }

  for (const id of Array.from(autoRegistry.keys())) {
    if (!seen.has(id)) {
      autoRegistry.delete(id)
      componentRegistry.delete(id)
      const event = new CustomEvent('component-highlighter:unregister', {
        detail: id,
      })
      window.dispatchEvent(event)
    }
  }
}

if (typeof window !== 'undefined') {
  const debouncedScan = () => {
    window.requestAnimationFrame(() => scanFiberTreeForInstances())
  }

  debouncedScan()
  const observer = new MutationObserver(() => debouncedScan())
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  })

  window.addEventListener('component-highlighter:refresh', debouncedScan)
}
