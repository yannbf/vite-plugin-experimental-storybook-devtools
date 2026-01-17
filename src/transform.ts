// @ts-nocheck
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import generatorModule from '@babel/generator'
import * as t from '@babel/types'

const traverse = (traverseModule as any).default ?? traverseModule
const generate = (generatorModule as any).default ?? generatorModule
// Simple hash function for browser compatibility
function createHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

export function transform(code: string, id: string): string | undefined {
  try {
    // Parse the file as TypeScript/JSX
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
    let hasReactImport = false
    const componentsToWrap: Array<{
      name: string
      node:
        | t.VariableDeclarator
        | t.FunctionDeclaration
        | t.ExportDefaultDeclaration
        | t.ExportNamedDeclaration
      isDefaultExport: boolean
      isMemo: boolean
      isForwardRef: boolean
    }> = []

    // Check if file contains JSX and collect component exports
    traverse(ast, {
      JSXElement() {
        hasJsx = true
      },
      JSXFragment() {
        hasJsx = true
      },
      ImportDeclaration(path) {
        // Check for React import
        if (
          path.node.source.value === 'react' ||
          path.node.source.value === 'React'
        ) {
          hasReactImport = true
        }
      },
      FunctionDeclaration(path) {
        if (isComponentFunction(path.node) && path.parent.type === 'Program') {
          componentsToWrap.push({
            name: path.node.id?.name || 'AnonymousFunction',
            node: path.node,
            isDefaultExport: false,
            isMemo: false,
            isForwardRef: false,
          })
        }
      },
      VariableDeclaration(path) {
        if (path.parent.type === 'Program') {
          path.node.declarations.forEach((decl) => {
            if (isComponentVariable(decl)) {
              const name = getVariableName(decl)
              const isMemo = isMemoWrapper(decl.init)
              const isForwardRef = isForwardRefWrapper(decl.init)

              componentsToWrap.push({
                name,
                node: decl,
                isDefaultExport: false,
                isMemo,
                isForwardRef,
              })
            }
          })
        }
      },
      ExportDefaultDeclaration(path) {
        const { declaration } = path.node

        if (isComponentDeclaration(declaration)) {
          const name = getDeclarationName(declaration) || 'DefaultExport'
          const isMemo =
            declaration.type === 'CallExpression' && isMemoWrapper(declaration)
          const isForwardRef =
            declaration.type === 'CallExpression' &&
            isForwardRefWrapper(declaration)

          componentsToWrap.push({
            name,
            node: path.node,
            isDefaultExport: true,
            isMemo,
            isForwardRef,
          })
        }
      },
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          const { declaration } = path.node

          if (
            declaration.type === 'FunctionDeclaration' &&
            isComponentFunction(declaration)
          ) {
            componentsToWrap.push({
              name: declaration.id?.name || 'ExportedFunction',
              node: path.node,
              isDefaultExport: false,
              isMemo: false,
              isForwardRef: false,
            })
          } else if (declaration.type === 'VariableDeclaration') {
            declaration.declarations.forEach((decl) => {
              if (isComponentVariable(decl)) {
                const name = getVariableName(decl)
                const isMemo = isMemoWrapper(decl.init)
                const isForwardRef = isForwardRefWrapper(decl.init)

                componentsToWrap.push({
                  name,
                  node: path.node,
                  isDefaultExport: false,
                  isMemo,
                  isForwardRef,
                })
              }
            })
          }
        }
      },
    })

    // Skip if no JSX or no components to wrap
    if (!hasJsx || componentsToWrap.length === 0) {
      return undefined
    }

    // Add import for the highlighter
    if (!hasReactImport) {
      // Add React import if not present
      const reactImport = t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier('React'))],
        t.stringLiteral('react')
      )
      ast.program.body.unshift(reactImport)
    }

    // Add highlighter import
    const highlighterImport = t.importDeclaration(
      [
        t.importSpecifier(
          t.identifier('withComponentHighlighter'),
          t.identifier('withComponentHighlighter')
        ),
      ],
      t.stringLiteral('virtual:component-highlighter/runtime')
    )
    ast.program.body.unshift(highlighterImport)

    // Transform components
    componentsToWrap.forEach(
      ({ name, node, isDefaultExport, isMemo, isForwardRef }) => {
        wrapComponent(
          ast,
          node,
          name,
          isDefaultExport,
          isMemo,
          isForwardRef,
          id
        )
      }
    )

    // Generate transformed code
    const output = generate(ast, {
      sourceMaps: true,
      sourceFileName: id,
    })

    return output.code
  } catch (error) {
    console.warn(
      `[vite-plugin-component-highlighter] Failed to transform ${id}:`,
      error
    )
    return undefined
  }
}

function isComponentFunction(node: t.FunctionDeclaration): boolean {
  return !!(
    node.id &&
    node.id.name[0] === node.id.name[0].toUpperCase() &&
    node.id.name[0] !== node.id.name[0].toLowerCase()
  )
}

function isComponentVariable(node: t.VariableDeclarator): boolean {
  if (!node.id || node.id.type !== 'Identifier') return false

  const name = node.id.name
  if (name[0] !== name[0].toUpperCase() || name[0] === name[0].toLowerCase())
    return false

  if (!node.init) return false

  return (
    node.init.type === 'ArrowFunctionExpression' ||
    node.init.type === 'FunctionExpression' ||
    isMemoWrapper(node.init) ||
    isForwardRefWrapper(node.init)
  )
}

function isComponentDeclaration(
  node: t.Expression | t.Pattern | t.Statement
): boolean {
  if (node.type === 'FunctionDeclaration' && isComponentFunction(node))
    return true
  if (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression'
  )
    return true
  if (node.type === 'Identifier')
    return node.name[0] === node.name[0].toUpperCase()
  if (node.type === 'CallExpression')
    return isMemoWrapper(node) || isForwardRefWrapper(node)
  return false
}

function isMemoWrapper(node: t.Expression | null): boolean {
  return !!(
    node &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'memo'
  )
}

function isForwardRefWrapper(node: t.Expression | null): boolean {
  return !!(
    node &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'forwardRef'
  )
}

function getVariableName(node: t.VariableDeclarator): string {
  return node.id.type === 'Identifier' ? node.id.name : 'AnonymousVariable'
}

function getDeclarationName(
  node: t.Expression | t.Pattern | t.Statement
): string | null {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name
  if (node.type === 'Identifier') return node.name
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
    if (node.callee.name === 'memo' || node.callee.name === 'forwardRef') {
      const arg = node.arguments[0]
      if (arg.type === 'FunctionDeclaration' && arg.id) return arg.id.name
      if (arg.type === 'ArrowFunctionExpression') return 'AnonymousWrapped'
    }
  }
  return null
}

function wrapComponent(
  ast: t.File,
  node:
    | t.VariableDeclarator
    | t.FunctionDeclaration
    | t.ExportDefaultDeclaration
    | t.ExportNamedDeclaration,
  componentName: string,
  isDefaultExport: boolean,
  isMemo: boolean,
  isForwardRef: boolean,
  filePath: string
): void {
  const sourceId = createHash(filePath + ':' + componentName)

  const metaObject = t.objectExpression([
    t.objectProperty(
      t.identifier('componentName'),
      t.stringLiteral(componentName)
    ),
    t.objectProperty(t.identifier('filePath'), t.stringLiteral(filePath)),
    t.objectProperty(t.identifier('sourceId'), t.stringLiteral(sourceId)),
    t.objectProperty(
      t.identifier('isDefaultExport'),
      t.booleanLiteral(isDefaultExport)
    ),
  ])

  if (isDefaultExport) {
    // Handle default export
    const exportDecl = node as t.ExportDefaultDeclaration
    const originalDeclaration = exportDecl.declaration

    if (
      originalDeclaration.type === 'FunctionDeclaration' ||
      originalDeclaration.type === 'ArrowFunctionExpression' ||
      originalDeclaration.type === 'FunctionExpression' ||
      (originalDeclaration.type === 'CallExpression' &&
        (isMemo || isForwardRef))
    ) {
      // Wrap the component
      const wrappedComponent = t.callExpression(
        t.identifier('withComponentHighlighter'),
        [originalDeclaration as t.Expression, metaObject]
      )

      exportDecl.declaration = wrappedComponent
    }
  } else if (node.type === 'ExportNamedDeclaration') {
    // Handle named export
    const exportDecl = node as t.ExportNamedDeclaration

    if (exportDecl.declaration?.type === 'FunctionDeclaration') {
      // Named exported function
      const funcDecl = exportDecl.declaration

      // Create wrapped version
      const wrappedComponent = t.callExpression(
        t.identifier('withComponentHighlighter'),
        [
          t.functionExpression(
            funcDecl.id,
            funcDecl.params,
            funcDecl.body,
            funcDecl.generator,
            funcDecl.async
          ),
          metaObject,
        ]
      )

      // Replace the function with a variable declaration
      const variableDecl = t.variableDeclaration('const', [
        t.variableDeclarator(funcDecl.id!, wrappedComponent),
      ])

      exportDecl.declaration = variableDecl
    } else if (exportDecl.declaration?.type === 'VariableDeclaration') {
      // Named exported variable
      const varDecl = exportDecl.declaration
      varDecl.declarations.forEach((decl) => {
        if (decl.init) {
          decl.init = t.callExpression(
            t.identifier('withComponentHighlighter'),
            [decl.init, metaObject]
          )
        }
      })
    }
  } else if (node.type === 'FunctionDeclaration') {
    // Top-level function declaration
    const funcDecl = node as t.FunctionDeclaration

    // Create wrapped version
    const wrappedComponent = t.callExpression(
      t.identifier('withComponentHighlighter'),
      [
        t.functionExpression(
          funcDecl.id,
          funcDecl.params,
          funcDecl.body,
          funcDecl.generator,
          funcDecl.async
        ),
        metaObject,
      ]
    )

    // Replace with variable declaration
    const variableDecl = t.variableDeclaration('const', [
      t.variableDeclarator(funcDecl.id!, wrappedComponent),
    ])

    // Find and replace in program body
    const index = ast.program.body.indexOf(funcDecl)
    if (index !== -1) {
      ast.program.body[index] = variableDecl
    }
  } else if (node.type === 'VariableDeclarator') {
    // Top-level variable declaration
    const varDecl = node as t.VariableDeclarator

    if (varDecl.init) {
      varDecl.init = t.callExpression(
        t.identifier('withComponentHighlighter'),
        [varDecl.init, metaObject]
      )
    }
  }
}
