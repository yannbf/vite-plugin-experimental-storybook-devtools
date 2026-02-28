/**
 * React Transform
 *
 * Lightweight AST transform that keeps user component declarations intact.
 * We only inject runtime import + exported component source registration.
 */

// @ts-nocheck
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import generatorModule from '@babel/generator'
import * as t from '@babel/types'
import path from 'node:path'
import type { TransformFunction } from '../types'

const traverse = (traverseModule as any).default ?? traverseModule
const generate = (generatorModule as any).default ?? generatorModule

/**
 * Virtual module ID for React runtime
 */
export const VIRTUAL_MODULE_ID = 'virtual:component-highlighter/runtime'

function createHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function isPascalCaseName(name: string): boolean {
  return !!name && name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()
}

/**
 * Transform React JSX/TSX files to ensure runtime side-effects are loaded
 * and exported component source metadata is registered.
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
    let hasRegisterImport = false
    const exportedComponents = new Map<string, { isDefaultExport: boolean }>()

    traverse(ast, {
      JSXElement() {
        hasJsx = true
      },
      JSXFragment() {
        hasJsx = true
      },
      ImportDeclaration(path) {
        if (path.node.source.value !== VIRTUAL_MODULE_ID) return
        for (const specifier of path.node.specifiers) {
          if (
            t.isImportSpecifier(specifier) &&
            t.isIdentifier(specifier.imported) &&
            specifier.imported.name === 'registerComponentSource'
          ) {
            hasRegisterImport = true
          }
        }
      },
      ExportNamedDeclaration(path) {
        const declaration = path.node.declaration
        if (declaration) {
          if (t.isFunctionDeclaration(declaration) && declaration.id) {
            const name = declaration.id.name
            if (isPascalCaseName(name)) {
              exportedComponents.set(name, { isDefaultExport: false })
            }
          }

          if (t.isVariableDeclaration(declaration)) {
            for (const decl of declaration.declarations) {
              if (t.isIdentifier(decl.id) && isPascalCaseName(decl.id.name)) {
                exportedComponents.set(decl.id.name, { isDefaultExport: false })
              }
            }
          }
        }

        for (const specifier of path.node.specifiers || []) {
          if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.local)) {
            const name = specifier.local.name
            if (isPascalCaseName(name)) {
              exportedComponents.set(name, {
                isDefaultExport: t.isIdentifier(specifier.exported) && specifier.exported.name === 'default',
              })
            }
          }
        }
      },
      ExportDefaultDeclaration(path) {
        const declaration = path.node.declaration

        if (t.isIdentifier(declaration)) {
          if (isPascalCaseName(declaration.name)) {
            exportedComponents.set(declaration.name, { isDefaultExport: true })
          }
          return
        }

        if (t.isFunctionDeclaration(declaration) && declaration.id) {
          if (isPascalCaseName(declaration.id.name)) {
            exportedComponents.set(declaration.id.name, { isDefaultExport: true })
          }
        }
      },
    })

    if (!hasJsx) {
      return undefined
    }

    if (!hasRegisterImport) {
      ast.program.body.unshift(
        t.importDeclaration(
          [
            t.importSpecifier(
              t.identifier('registerComponentSource'),
              t.identifier('registerComponentSource'),
            ),
          ],
          t.stringLiteral(VIRTUAL_MODULE_ID),
        ),
      )
    }

    const relativeFilePath = path.relative(process.cwd(), id)

    for (const [componentName, { isDefaultExport }] of exportedComponents) {
      const meta = t.objectExpression([
        t.objectProperty(t.identifier('componentName'), t.stringLiteral(componentName)),
        t.objectProperty(t.identifier('filePath'), t.stringLiteral(id)),
        t.objectProperty(
          t.identifier('relativeFilePath'),
          t.stringLiteral(relativeFilePath),
        ),
        t.objectProperty(
          t.identifier('sourceId'),
          t.stringLiteral(createHash(`${id}:${componentName}`)),
        ),
        t.objectProperty(
          t.identifier('isDefaultExport'),
          t.booleanLiteral(isDefaultExport),
        ),
      ])

      ast.program.body.push(
        t.expressionStatement(
          t.callExpression(t.identifier('registerComponentSource'), [
            t.identifier(componentName),
            meta,
          ]),
        ),
      )
    }

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
  if (!id.match(/\.(tsx|jsx)$/)) {
    return false
  }

  const hasReactImport = /import\s+(?:React|\{[^}]*\})\s+from\s+['"]react['"]/.test(code)
  const hasJSX = /<[A-Z][a-zA-Z]*|<[a-z]+[^>]*>/.test(code)

  return hasReactImport || hasJSX
}
