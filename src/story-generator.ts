import type { ComponentMeta } from './virtual-module'
import * as path from 'path'

export interface SerializedProps {
  [key: string]: SerializedValue
}

export interface JSXSerializedValue {
  __isJSX: true
  source: string
  componentRefs: string[]
}

export type SerializedValue = JSXSerializedValue | unknown

export interface StoryGenerationData {
  meta: ComponentMeta
  props: SerializedProps
  /** Map of component name to file path for import resolution */
  componentRegistry?: Map<string, string>
  /** Custom story name (defaults to auto-generated name) */
  storyName?: string
  /** Existing file content to append to */
  existingContent?: string
}

export interface GeneratedStory {
  /** The generated story file content */
  content: string
  /** Suggested file path for the story */
  filePath: string
  /** List of imports that need to be added */
  imports: Array<{ name: string; path: string }>
  /** The story name that was used */
  storyName: string
}

/**
 * Generates a Storybook story file from captured component data
 */
export function generateStory(data: StoryGenerationData): GeneratedStory {
  const { meta, props, componentRegistry, storyName: customStoryName, existingContent } = data
  const { componentName, filePath, isDefaultExport } = meta

  // Calculate relative paths and story file location
  const componentDir = path.dirname(filePath)
  const componentFileName = path.basename(filePath, path.extname(filePath))
  const storyFilePath = path.join(
    componentDir,
    `${componentFileName}.stories.tsx`
  )

  // Determine story name
  let storyName = customStoryName || generateStoryName(props)
  // Convert to valid identifier (PascalCase, no spaces/special chars)
  storyName = toValidStoryName(storyName)

  // Collect all component references from JSX props for imports
  const componentRefs = new Set<string>()
  collectComponentRefs(props, componentRefs)

  // Build imports
  const imports: Array<{ name: string; path: string }> = []

  // Main component import
  imports.push({
    name: isDefaultExport ? componentName : `{ ${componentName} }`,
    path: `./${componentFileName}`,
  })

  // Resolve imports for referenced components in JSX props
  if (componentRegistry) {
    for (const refName of componentRefs) {
      if (refName === componentName) continue // Skip self-reference

      const refFilePath = componentRegistry.get(refName)
      if (refFilePath) {
        const refRelativePath = getRelativeImportPath(componentDir, refFilePath)
        imports.push({
          name: `{ ${refName} }`,
          path: refRelativePath,
        })
      }
    }
  }

  // Generate the story content
  let content: string

  if (existingContent) {
    // Append to existing file
    content = appendStoryToExisting({
      existingContent,
      storyName,
      props,
      imports,
      componentName,
    })
  } else {
    // Generate new file
    content = generateStoryContent({
      componentName,
      imports,
      props,
      isDefaultExport,
      storyName,
    })
  }

  return {
    content,
    filePath: storyFilePath,
    imports,
    storyName,
  }
}

/**
 * Convert a string to a valid JavaScript identifier in PascalCase
 */
function toValidStoryName(name: string): string {
  // Remove invalid characters and convert to PascalCase
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
    .split(/\s+/) // Split by whitespace
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    || 'Default'
}

/**
 * Append a new story to an existing story file
 */
function appendStoryToExisting(options: {
  existingContent: string
  storyName: string
  props: SerializedProps
  imports: Array<{ name: string; path: string }>
  componentName: string
}): string {
  const { existingContent, storyName, props, imports } = options

  // Check if story with same name already exists
  let finalStoryName = storyName
  const storyExportRegex = /export\s+const\s+(\w+)\s*[=:]/g
  const existingStories = new Set<string>()
  let match
  while ((match = storyExportRegex.exec(existingContent ?? '')) !== null) {
    if (match[1]) {
      existingStories.add(match[1])
    }
  }

  // If story name exists, add a number suffix
  if (existingStories.has(finalStoryName)) {
    let counter = 2
    while (existingStories.has(`${storyName}${counter}`)) {
      counter++
    }
    finalStoryName = `${storyName}${counter}`
  }

  // Add any missing imports
  let updatedContent = existingContent

  for (const imp of imports) {
    // Skip if import already exists (simple check)
    const importName = imp.name.replace(/[{}]/g, '').trim()
    if (!existingContent.includes(importName) || !existingContent.includes(imp.path)) {
      // Check if there's an existing import from the same path we can extend
      const samePathRegex = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${escapeRegex(imp.path)}['"]`)
      const samePathMatch = updatedContent.match(samePathRegex)

      if (samePathMatch && samePathMatch[1] && imp.name.startsWith('{')) {
        // Extend existing import
        const existingNames = samePathMatch[1]
        if (!existingNames.includes(importName)) {
          const newNames = `${existingNames.trim()}, ${importName}`
          updatedContent = updatedContent.replace(samePathMatch[0], `import { ${newNames} } from '${imp.path}'`)
        }
      } else if (!samePathMatch && !existingContent.includes(`from '${imp.path}'`)) {
        // Add new import at the end of existing imports
        const lastImportMatch = updatedContent.match(/^(import\s+.+from\s+['"][^'"]+['"];?\s*\n)+/m)
        if (lastImportMatch) {
          const insertPos = lastImportMatch.index! + lastImportMatch[0].length
          const newImport = `import ${imp.name} from '${imp.path}';\n`
          updatedContent = updatedContent.slice(0, insertPos) + newImport + updatedContent.slice(insertPos)
        }
      }
    }
  }

  // Generate the new story export
  const argsContent = generateArgsContent(props, 1)
  const newStory = `
export const ${finalStoryName}: Story = {
  args: ${argsContent},
};
`

  // Append the new story at the end
  return updatedContent.trimEnd() + '\n' + newStory

}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Recursively collect component references from serialized props
 */
function collectComponentRefs(
  props: SerializedProps,
  refs: Set<string>
): void {
  for (const value of Object.values(props)) {
    if (isJSXSerializedValue(value)) {
      for (const ref of value.componentRefs) {
        refs.add(ref)
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively check nested objects
      collectComponentRefs(value as SerializedProps, refs)
    }
  }
}

/**
 * Type guard for JSX serialized values
 */
function isJSXSerializedValue(value: unknown): value is JSXSerializedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isJSX' in value &&
    (value as JSXSerializedValue).__isJSX === true
  )
}

/**
 * Get relative import path from one file to another
 */
function getRelativeImportPath(fromDir: string, toFile: string): string {
  const toDir = path.dirname(toFile)
  const toFileName = path.basename(toFile, path.extname(toFile))

  let relativePath = path.relative(fromDir, toDir)
  if (!relativePath) {
    relativePath = '.'
  } else if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath
  }

  return `${relativePath}/${toFileName}`
}

/**
 * Generate the actual story file content
 */
function generateStoryContent(options: {
  componentName: string
  imports: Array<{ name: string; path: string }>
  props: SerializedProps
  isDefaultExport: boolean
  storyName: string
}): string {
  const { componentName, imports, props, storyName } = options

  // Build import statements
  const importStatements = [
    `import React from 'react';`,
    `import type { Meta, StoryObj } from '@storybook/react-vite';`,
    ...imports.map((imp) => `import ${imp.name} from '${imp.path}';`),
  ].join('\n')

  // Generate args object
  const argsContent = generateArgsContent(props, 1)

  // Build the story file
  return `${importStatements}

const meta: Meta<typeof ${componentName}> = {
  component: ${componentName},
};

export default meta;
type Story = StoryObj<typeof ${componentName}>;

export const ${storyName}: Story = {
  args: ${argsContent},
};
`
}

/**
 * Generate the args object content with proper formatting
 */
function generateArgsContent(props: SerializedProps, indentLevel: number): string {
  const indent = '  '.repeat(indentLevel)
  const innerIndent = '  '.repeat(indentLevel + 1)

  const entries = Object.entries(props)

  if (entries.length === 0) {
    return '{}'
  }

  const propsContent = entries
    .map(([key, value]) => {
      const formattedValue = formatPropValue(value, indentLevel + 1)
      return `${innerIndent}${formatPropKey(key)}: ${formattedValue},`
    })
    .join('\n')

  return `{\n${propsContent}\n${indent}}`
}

/**
 * Format a prop key (handle keys that need quoting)
 */
function formatPropKey(key: string): string {
  // Check if key is a valid identifier
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return key
  }
  return JSON.stringify(key)
}

/**
 * Format a prop value for output
 */
function formatPropValue(value: unknown, indentLevel: number): string {
  // Handle JSX serialized values - emit raw JSX
  if (isJSXSerializedValue(value)) {
    // Format multi-line JSX with proper indentation
    const jsxSource = value.source
    if (jsxSource.includes('\n')) {
      const indent = '  '.repeat(indentLevel)
      const lines = jsxSource.split('\n')
      const indentedJsx = lines
        .map((line, i) => (i === 0 ? line : indent + line))
        .join('\n')
      return `(\n${indent}${indentedJsx}\n${'  '.repeat(indentLevel - 1)})`
    }
    return jsxSource
  }

  // Handle null/undefined
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  // Handle primitives
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  // Handle functions (as placeholders)
  if (typeof value === 'function') {
    return '() => {}'
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'

    const indent = '  '.repeat(indentLevel)
    const innerIndent = '  '.repeat(indentLevel + 1)
    const items = value
      .map((item) => `${innerIndent}${formatPropValue(item, indentLevel + 1)},`)
      .join('\n')
    return `[\n${items}\n${indent}]`
  }

  // Handle objects
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'

    const indent = '  '.repeat(indentLevel)
    const innerIndent = '  '.repeat(indentLevel + 1)
    const props = entries
      .map(([k, v]) => {
        const formattedKey = formatPropKey(k)
        const formattedValue = formatPropValue(v, indentLevel + 1)
        return `${innerIndent}${formattedKey}: ${formattedValue},`
      })
      .join('\n')
    return `{\n${props}\n${indent}}`
  }

  // Fallback
  return String(value)
}

/**
 * Generate a story name from component state
 */
export function generateStoryName(props: SerializedProps): string {
  // Try to generate a meaningful name from key props
  const meaningfulProps = ['variant', 'type', 'size', 'mode', 'status', 'kind']

  for (const propName of meaningfulProps) {
    if (propName in props && typeof props[propName] === 'string') {
      const value = props[propName] as string
      return capitalizeFirst(value)
    }
  }

  return 'Snapshot'
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

