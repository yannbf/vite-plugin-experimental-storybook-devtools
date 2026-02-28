/**
 * React Transform
 *
 * Lightweight AST transform that ensures the React runtime module is loaded
 * without wrapping or mutating component declarations.
 */

// @ts-nocheck
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import generatorModule from '@babel/generator'
import * as t from '@babel/types'
import type { TransformFunction } from '../types'

const traverse = (traverseModule as any).default ?? traverseModule
const generate = (generatorModule as any).default ?? generatorModule

/**
 * Virtual module ID for React runtime
 */
export const VIRTUAL_MODULE_ID = 'virtual:component-highlighter/runtime'

/**
 * Transform React JSX/TSX files to ensure runtime side-effects are loaded.
 *
 * NOTE: we intentionally avoid wrapping user components to preserve their
 * original component structure and source shape.
 */
export const transform: TransformFunction = (code: string, id: string): string | undefined => {
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        ['decorators', { decoratorsBeforeExport: true }],
      ],
      sourceFilename: id,
    })

    let hasJsx = false
    let hasRuntimeImport = false

    traverse(ast, {
      JSXElement() {
        hasJsx = true
      },
      JSXFragment() {
        hasJsx = true
      },
      ImportDeclaration(path) {
        if (path.node.source.value === VIRTUAL_MODULE_ID) {
          hasRuntimeImport = true
        }
      },
    })

    if (!hasJsx || hasRuntimeImport) {
      return undefined
    }

    ast.program.body.unshift(
      t.importDeclaration([], t.stringLiteral(VIRTUAL_MODULE_ID)),
    )

    const output = generate(ast, {
      sourceMaps: true,
      sourceFileName: id,
    })

    return output.code
  } catch (error) {
    console.warn(`[component-highlighter] Failed to transform ${id}:`, error)
    return undefined
  }
}

/**
 * Detect if a file is a React file
 */
export function detectReact(code: string, id: string): boolean {
  // Check file extension
  if (!id.match(/\.(tsx|jsx)$/)) {
    return false
  }

  // Check for React imports or JSX
  const hasReactImport = /import\s+(?:React|\{[^}]*\})\s+from\s+['"]react['"]/.test(code)
  const hasJSX = /<[A-Z][a-zA-Z]*|<[a-z]+[^>]*>/.test(code)

  return hasReactImport || hasJSX
}
