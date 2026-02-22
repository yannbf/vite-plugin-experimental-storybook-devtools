/**
 * Vue Transform
 *
 * AST transformation that instruments Vue SFC components
 * with the component highlighter wrapper.
 */

import { parse as parseVue } from '@vue/compiler-sfc'
import type { TransformFunction } from '../types'
import * as path from 'path'

/**
 * Simple hash function for generating source IDs
 */
function createHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Virtual module ID for Vue runtime
 */
export const VIRTUAL_MODULE_ID = 'virtual:component-highlighter/vue-runtime'

/**
 * Transform Vue SFC files to wrap components with the highlighter
 */
export const transform: TransformFunction = (
  code: string,
  id: string,
): string | undefined => {
  try {
    // Parse the Vue SFC
    const { descriptor } = parseVue(code, { filename: id })

    // Check if this is a component (has script or template)
    if (!descriptor.script && !descriptor.scriptSetup) {
      return undefined
    }

    const componentName = getComponentName(id)
    const relativeFilePath = path.relative(process.cwd(), id)
    const sourceId = createHash(id)

    // Generate the wrapper component
    const transformedCode = generateWrappedComponent(
      descriptor,
      componentName,
      sourceId,
      id,
      relativeFilePath,
    )

    return transformedCode
  } catch (error) {
    console.warn(`[component-highlighter] Failed to transform ${id}:`, error)
    return undefined
  }
}

/**
 * Extract component name from file path
 */
function getComponentName(filePath: string): string {
  const fileNameWithExt = path.basename(filePath)
  const fileName = fileNameWithExt.replace(/\.(vue|tsx|ts|jsx|js)$/, '')
  return fileName
}

/**
 * Generate the wrapped Vue component code
 */
function generateWrappedComponent(
  descriptor: any,
  componentName: string,
  sourceId: string,
  filePath: string,
  relativeFilePath: string,
): string {
  // Get or create script setup block
  const scriptSetupContent = descriptor.scriptSetup?.content || ''
  const scriptLang =
    descriptor.scriptSetup?.lang || descriptor.script?.lang || 'ts'

  // Get template
  const templateContent = descriptor.template?.content || ''

  // Get styles
  const styles = descriptor.styles
    .map((style: any) => {
      const scopedAttr = style.scoped ? ' scoped' : ''
      const langAttr = style.lang ? ` lang="${style.lang}"` : ''
      return `<style${scopedAttr}${langAttr}>${style.content}</style>`
    })
    .join('\n')

  // Create metadata object
  const metaObject = {
    componentName,
    sourceId,
    filePath,
    relativeFilePath,
    isDefaultExport: true,
  }

  // Inject the highlighter setup into the script
  const injectedSetup = `import { withComponentHighlighter } from '${VIRTUAL_MODULE_ID}'

const __componentMeta = ${JSON.stringify(metaObject)}
withComponentHighlighter(__componentMeta)

${scriptSetupContent}`

  // Generate new component with wrapper
  const wrappedCode = `
<script setup ${scriptLang === 'ts' ? 'lang="ts"' : ''}>${injectedSetup}</script>

<template>
  ${templateContent}
</template>

${styles}
`

  return wrappedCode
}

/**
 * Detect if a file is a Vue file
 */
export function detectVue(code: string, id: string): boolean {
  // Check file extension
  if (!id.endsWith('.vue')) {
    return false
  }

  // Must have template or script
  return code.includes('<template') || code.includes('<script')
}
