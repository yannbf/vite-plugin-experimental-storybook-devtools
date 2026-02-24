/**
 * Vue VNode to Template Serialization
 *
 * Converts Vue VNode structures into template source strings for story generation.
 * This enables the component highlighter to capture slot content with nested components
 * and serialize them as ready-to-use Vue template markup.
 */

/**
 * Result of VNode serialization
 */
export interface VNodeTemplateResult {
  /** Generated template source string */
  source: string
  /** Component names referenced in the template (for imports) */
  componentRefs: string[]
}

/**
 * Convert a camelCase or PascalCase string to kebab-case
 */
export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

/**
 * Convert a Vue listener prop name (e.g., "onClick") to event name (e.g., "click")
 */
export function toEventName(listenerName: string): string {
  const raw = listenerName.slice(2)
  if (!raw) return ''
  return raw.charAt(0).toLowerCase() + raw.slice(1)
}

/**
 * Escape single quotes for use in Vue template attribute expressions
 */
export function escapeAttributeExpression(value: string): string {
  return value.replace(/'/g, '&#39;')
}

/**
 * Escape HTML text content
 */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Convert a value to a Vue template expression string
 */
export function toTemplateExpression(
  value: unknown,
  serializeValue: (v: unknown) => unknown,
): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'bigint') {
    return `BigInt(${value.toString()})`
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'function') {
    return '() => {}'
  }

  return JSON.stringify(serializeValue(value))
}

/**
 * Extract component name from a Vue VNode type
 */
export function getVueNodeName(type: unknown): string | null {
  if (typeof type === 'string') return type
  if (!type || typeof type !== 'object') return null

  const componentType = type as {
    name?: string
    __name?: string
  }

  if (componentType.__name && componentType.__name !== 'Fragment') {
    return componentType.__name
  }

  if (componentType.name && componentType.name !== 'Fragment') {
    return componentType.name
  }

  return null
}

/**
 * Generate template attribute/prop bindings from VNode props
 */
export function generateTemplateProps(
  props: Record<string, unknown>,
  serializeValue: (v: unknown) => unknown,
): string {
  const entries: string[] = []

  for (const [rawName, value] of Object.entries(props)) {
    if (rawName === 'key' || rawName === 'ref') continue
    if (value === undefined || value === null) continue

    if (rawName.startsWith('on') && rawName.length > 2) {
      const eventName = toEventName(rawName)
      if (!eventName) continue
      entries.push(`@${eventName}="() => {}"`)
      continue
    }

    const propName = toKebabCase(rawName)

    if (typeof value === 'boolean') {
      if (value) entries.push(propName)
      continue
    }

    if (typeof value === 'string') {
      entries.push(`${propName}=${JSON.stringify(value)}`)
      continue
    }

    const expression = toTemplateExpression(value, serializeValue)
    entries.push(`:${propName}='${escapeAttributeExpression(expression)}'`)
  }

  return entries.join(' ')
}

/**
 * Generate Vue template source from a VNode or VNode tree
 *
 * @param value - VNode, array of VNodes, or primitive value
 * @param componentRefs - Set to collect component names for imports
 * @param serializeValue - Function to serialize complex prop values
 * @returns Template source string
 */
export function generateVNodeSource(
  value: unknown,
  componentRefs: Set<string>,
  serializeValue: (v: unknown) => unknown,
): string {
  if (value === null || value === undefined || value === false) return ''

  if (typeof value === 'string') {
    return escapeHtmlText(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => generateVNodeSource(item, componentRefs, serializeValue))
      .join('')
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const vnode = value as {
    __v_isVNode?: boolean
    type?: unknown
    props?: Record<string, unknown> | null
    children?: unknown
  }

  if (vnode.__v_isVNode !== true) {
    return escapeHtmlText(String(value))
  }

  // Handle Fragment (symbol type)
  if (typeof vnode.type === 'symbol') {
    return generateVNodeSource(vnode.children, componentRefs, serializeValue)
  }

  const tagName = getVueNodeName(vnode.type)
  if (!tagName) {
    return generateVNodeSource(vnode.children, componentRefs, serializeValue)
  }

  const isComponent = typeof vnode.type === 'object'
  if (isComponent) {
    componentRefs.add(tagName)
  }

  const propsString = generateTemplateProps(vnode.props ?? {}, serializeValue)
  const attrs = propsString ? ` ${propsString}` : ''

  // Handle named slots as children object
  if (
    vnode.children &&
    typeof vnode.children === 'object' &&
    !Array.isArray(vnode.children)
  ) {
    const slotChildren = vnode.children as Record<string, unknown>
    const slotParts: string[] = []

    for (const [slotName, slotValue] of Object.entries(slotChildren)) {
      if (slotName.startsWith('$')) continue
      if (typeof slotValue !== 'function') continue

      let rendered = ''
      try {
        rendered = generateVNodeSource(
          slotValue({}),
          componentRefs,
          serializeValue,
        )
      } catch {
        rendered = ''
      }

      if (!rendered) continue
      if (slotName === 'default') {
        slotParts.push(rendered)
      } else {
        slotParts.push(`<template #${slotName}>${rendered}</template>`)
      }
    }

    if (slotParts.length > 0) {
      return `<${tagName}${attrs}>${slotParts.join('')}</${tagName}>`
    }
  }

  const childrenSource = generateVNodeSource(
    vnode.children,
    componentRefs,
    serializeValue,
  )
  if (childrenSource) {
    return `<${tagName}${attrs}>${childrenSource}</${tagName}>`
  }

  return `<${tagName}${attrs} />`
}

/**
 * Serialize a Vue VNode (or tree of VNodes) into a template string
 *
 * @param vnode - VNode or VNode array from a slot function result
 * @param serializeValue - Function to serialize complex prop values (e.g., objects, arrays)
 * @returns Object with template source and component references
 */
export function serializeVNodeToTemplate(
  vnode: unknown,
  serializeValue: (v: unknown) => unknown = (v) => v,
): VNodeTemplateResult {
  const componentRefs = new Set<string>()
  const source = generateVNodeSource(vnode, componentRefs, serializeValue)

  return {
    source,
    componentRefs: [...componentRefs].sort((a, b) => a.localeCompare(b)),
  }
}
