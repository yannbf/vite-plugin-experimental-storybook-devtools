/**
 * Provider Analyzer
 *
 * Analyzes React application entry points to detect provider dependencies.
 * This helps identify what decorators/wrappers are needed for Storybook stories.
 *
 * @module provider-analyzer
 */

import * as fs from 'fs'
import * as path from 'path'
import { parse, ParserOptions } from '@babel/parser'
import traverse, { NodePath } from '@babel/traverse'
import * as t from '@babel/types'

// Known provider patterns and their Storybook decorator suggestions
export const PROVIDER_PATTERNS = {
  redux: {
    packages: ['react-redux', '@reduxjs/toolkit'],
    hooks: ['useSelector', 'useDispatch', 'useStore'],
    components: ['Provider'],
    decoratorSuggestion: `(Story) => (
  <Provider store={store}>
    <Story />
  </Provider>
)`,
    requiredImports: ["import { Provider } from 'react-redux'", "import { store } from './store'"],
    docs: 'https://storybook.js.org/recipes/redux',
  },
  router: {
    packages: ['react-router-dom', 'react-router', '@tanstack/react-router'],
    hooks: ['useNavigate', 'useParams', 'useLocation', 'useSearchParams', 'useMatch', 'useRouter'],
    components: ['BrowserRouter', 'HashRouter', 'MemoryRouter', 'RouterProvider', 'Router'],
    decoratorSuggestion: `(Story) => (
  <MemoryRouter initialEntries={['/']}>
    <Story />
  </MemoryRouter>
)`,
    requiredImports: ["import { MemoryRouter } from 'react-router-dom'"],
    docs: 'https://storybook.js.org/recipes/react-router',
  },
  emotion: {
    packages: ['@emotion/react', '@emotion/styled'],
    hooks: ['useTheme'],
    components: ['ThemeProvider', 'Global'],
    decoratorSuggestion: `(Story) => (
  <ThemeProvider theme={theme}>
    <Story />
  </ThemeProvider>
)`,
    requiredImports: ["import { ThemeProvider } from '@emotion/react'", "import { theme } from './theme'"],
    docs: 'https://storybook.js.org/recipes/@emotion/styled',
  },
  styledComponents: {
    packages: ['styled-components'],
    hooks: ['useTheme'],
    components: ['ThemeProvider', 'StyleSheetManager'],
    decoratorSuggestion: `(Story) => (
  <ThemeProvider theme={theme}>
    <Story />
  </ThemeProvider>
)`,
    requiredImports: ["import { ThemeProvider } from 'styled-components'", "import { theme } from './theme'"],
    docs: 'https://storybook.js.org/recipes/styled-components',
  },
  tanstackQuery: {
    packages: ['@tanstack/react-query', 'react-query'],
    hooks: ['useQuery', 'useMutation', 'useQueryClient', 'useInfiniteQuery'],
    components: ['QueryClientProvider'],
    decoratorSuggestion: `(Story) => (
  <QueryClientProvider client={queryClient}>
    <Story />
  </QueryClientProvider>
)`,
    requiredImports: [
      "import { QueryClient, QueryClientProvider } from '@tanstack/react-query'",
      'const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })',
    ],
    docs: 'https://storybook.js.org/recipes/@tanstack/react-query',
  },
  reactIntl: {
    packages: ['react-intl'],
    hooks: ['useIntl'],
    components: ['IntlProvider', 'FormattedMessage', 'FormattedDate', 'FormattedNumber'],
    decoratorSuggestion: `(Story) => (
  <IntlProvider locale="en" messages={messages}>
    <Story />
  </IntlProvider>
)`,
    requiredImports: ["import { IntlProvider } from 'react-intl'", "import messages from './locales/en.json'"],
    docs: 'https://storybook.js.org/recipes/react-intl',
  },
  reactI18next: {
    packages: ['react-i18next', 'i18next'],
    hooks: ['useTranslation'],
    components: ['I18nextProvider', 'Trans'],
    decoratorSuggestion: `(Story) => (
  <I18nextProvider i18n={i18n}>
    <Story />
  </I18nextProvider>
)`,
    requiredImports: ["import { I18nextProvider } from 'react-i18next'", "import i18n from './i18n'"],
    docs: 'https://storybook.js.org/recipes/react-i18next',
  },
  chakraUI: {
    packages: ['@chakra-ui/react'],
    hooks: ['useColorMode', 'useTheme', 'useToast'],
    components: ['ChakraProvider', 'ColorModeProvider'],
    decoratorSuggestion: `(Story) => (
  <ChakraProvider theme={theme}>
    <Story />
  </ChakraProvider>
)`,
    requiredImports: ["import { ChakraProvider } from '@chakra-ui/react'", "import { theme } from './theme'"],
    docs: 'https://storybook.js.org/recipes/@chakra-ui/react',
  },
  mantineUI: {
    packages: ['@mantine/core', '@mantine/hooks'],
    hooks: ['useMantineTheme', 'useMantineColorScheme'],
    components: ['MantineProvider'],
    decoratorSuggestion: `(Story) => (
  <MantineProvider theme={theme}>
    <Story />
  </MantineProvider>
)`,
    requiredImports: ["import { MantineProvider } from '@mantine/core'", "import { theme } from './theme'"],
    docs: 'https://storybook.js.org/recipes/@mantine/core',
  },
  nextjs: {
    packages: ['next/router', 'next/navigation'],
    hooks: ['useRouter', 'usePathname', 'useSearchParams'],
    components: [],
    decoratorSuggestion: '// Use @storybook/nextjs framework for automatic Next.js support',
    requiredImports: [],
    docs: 'https://storybook.js.org/docs/get-started/frameworks/nextjs',
  },
} as const

export type ProviderType = keyof typeof PROVIDER_PATTERNS

export interface DetectedProvider {
  type: ProviderType | 'customContext'
  source: string
  confidence: 'high' | 'medium' | 'low'
  location?: {
    file: string
    line?: number
    column?: number
  }
  props?: Record<string, unknown>
  suggestedDecorator?: string
  requiredImports?: string[]
  docsUrl?: string
}

export interface ProviderAnalysisResult {
  projectRoot: string
  entryFile: string | null
  detectedProviders: DetectedProvider[]
  customContexts: Array<{
    name: string
    file: string
    usages: string[]
  }>
  suggestions: string[]
  timestamp: string
}

// Common entry point patterns
const ENTRY_POINT_PATTERNS = [
  'src/App.tsx',
  'src/App.jsx',
  'src/app.tsx',
  'src/app.jsx',
  'src/main.tsx',
  'src/main.jsx',
  'src/index.tsx',
  'src/index.jsx',
  'app/layout.tsx', // Next.js App Router
  'app/layout.jsx',
  'pages/_app.tsx', // Next.js Pages Router
  'pages/_app.jsx',
  'src/pages/_app.tsx',
  'src/pages/_app.jsx',
]

const BABEL_PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
}

/**
 * Find the app entry point file
 */
async function findEntryPoint(projectRoot: string): Promise<string | null> {
  for (const pattern of ENTRY_POINT_PATTERNS) {
    const fullPath = path.join(projectRoot, pattern)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }
  return null
}

/**
 * Get the name of a JSX element
 */
function getJSXElementName(node: t.JSXOpeningElement): string | null {
  if (t.isJSXIdentifier(node.name)) {
    return node.name.name
  }
  if (t.isJSXMemberExpression(node.name)) {
    // Handle cases like Foo.Provider
    const parts: string[] = []
    let current: t.JSXMemberExpression | t.JSXIdentifier = node.name
    while (t.isJSXMemberExpression(current)) {
      parts.unshift(current.property.name)
      current = current.object as t.JSXMemberExpression | t.JSXIdentifier
    }
    if (t.isJSXIdentifier(current)) {
      parts.unshift(current.name)
    }
    return parts.join('.')
  }
  return null
}

/**
 * Extract props from a JSX element
 */
function extractJSXProps(node: t.JSXOpeningElement): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const attr of node.attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
      const propName = attr.name.name

      if (attr.value === null) {
        props[propName] = true
      } else if (t.isStringLiteral(attr.value)) {
        props[propName] = attr.value.value
      } else if (t.isJSXExpressionContainer(attr.value)) {
        // Just note that it's a dynamic expression
        props[propName] = '<expression>'
      }
    }
  }

  return props
}

/**
 * Analyze a file for provider patterns
 */
function analyzeFileForProviders(
  code: string,
  filePath: string
): { providers: DetectedProvider[]; imports: Map<string, string> } {
  const providers: DetectedProvider[] = []
  const imports = new Map<string, string>() // name -> package

  let ast: t.File
  try {
    ast = parse(code, BABEL_PARSER_OPTIONS)
  } catch {
    console.warn(`[provider-analyzer] Failed to parse ${filePath}`)
    return { providers, imports }
  }

  traverse(ast, {
    // Track imports
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const source = path.node.source.value

      // Map imported names to their packages
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
          imports.set(specifier.local.name, source)
        } else if (t.isImportDefaultSpecifier(specifier)) {
          imports.set(specifier.local.name, source)
        }
      }

      // Check against known provider packages
      for (const [providerType, pattern] of Object.entries(PROVIDER_PATTERNS)) {
        if (pattern.packages.some((pkg) => source === pkg || source.startsWith(pkg + '/'))) {
          // Check if any provider components are imported
          for (const specifier of path.node.specifiers) {
            if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
              const importedName = specifier.imported.name
              if (pattern.components.includes(importedName)) {
                providers.push({
                  type: providerType as ProviderType,
                  source: `import { ${importedName} } from '${source}'`,
                  confidence: 'high',
                  location: {
                    file: filePath,
                    line: path.node.loc?.start.line,
                  },
                  suggestedDecorator: pattern.decoratorSuggestion,
                  requiredImports: pattern.requiredImports,
                  docsUrl: pattern.docs,
                })
              }
            }
          }
        }
      }
    },

    // Check for JSX provider elements
    JSXElement(path: NodePath<t.JSXElement>) {
      const elementName = getJSXElementName(path.node.openingElement)
      if (!elementName) return

      // Check if this is a known provider component
      for (const [providerType, pattern] of Object.entries(PROVIDER_PATTERNS)) {
        if (pattern.components.includes(elementName) || elementName.endsWith('Provider')) {
          const existingProvider = providers.find(
            (p) => p.type === providerType && p.source.includes(elementName)
          )

          if (!existingProvider) {
            providers.push({
              type: providerType as ProviderType,
              source: `<${elementName}>`,
              confidence: elementName.endsWith('Provider') ? 'medium' : 'high',
              location: {
                file: filePath,
                line: path.node.loc?.start.line,
              },
              props: extractJSXProps(path.node.openingElement),
              suggestedDecorator: pattern.decoratorSuggestion,
              requiredImports: pattern.requiredImports,
              docsUrl: pattern.docs,
            })
          }
        }
      }

      // Detect custom context providers (SomethingContext.Provider or SomethingProvider)
      if (elementName.endsWith('.Provider') || (elementName.endsWith('Provider') && !isKnownProvider(elementName))) {
        providers.push({
          type: 'customContext',
          source: `<${elementName}>`,
          confidence: 'medium',
          location: {
            file: filePath,
            line: path.node.loc?.start.line,
          },
          props: extractJSXProps(path.node.openingElement),
        })
      }
    },

    // Check for hook usage
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!t.isIdentifier(path.node.callee)) return

      const hookName = path.node.callee.name

      // Check for useContext
      if (hookName === 'useContext' && path.node.arguments.length > 0) {
        const arg = path.node.arguments[0]
        const contextName = t.isIdentifier(arg) ? arg.name : 'Unknown'
        providers.push({
          type: 'customContext',
          source: `useContext(${contextName})`,
          confidence: 'high',
          location: {
            file: filePath,
            line: path.node.loc?.start.line,
          },
        })
      }

      // Check for known provider hooks
      for (const [providerType, pattern] of Object.entries(PROVIDER_PATTERNS)) {
        if (pattern.hooks.includes(hookName)) {
          const existingProvider = providers.find((p) => p.type === providerType)
          if (!existingProvider) {
            providers.push({
              type: providerType as ProviderType,
              source: `${hookName}() hook`,
              confidence: 'high',
              location: {
                file: filePath,
                line: path.node.loc?.start.line,
              },
              suggestedDecorator: pattern.decoratorSuggestion,
              requiredImports: pattern.requiredImports,
              docsUrl: pattern.docs,
            })
          }
        }
      }
    },
  })

  return { providers, imports }
}

/**
 * Check if a provider name is from a known library
 */
function isKnownProvider(name: string): boolean {
  for (const pattern of Object.values(PROVIDER_PATTERNS)) {
    if (pattern.components.includes(name)) {
      return true
    }
  }
  return false
}

/**
 * Deduplicate providers by type
 */
function deduplicateProviders(providers: DetectedProvider[]): DetectedProvider[] {
  const seen = new Map<string, DetectedProvider>()

  for (const provider of providers) {
    const key = provider.type === 'customContext' ? `${provider.type}:${provider.source}` : provider.type

    const existing = seen.get(key)
    if (!existing || provider.confidence === 'high') {
      seen.set(key, provider)
    }
  }

  return Array.from(seen.values())
}

/**
 * Generate suggestions based on detected providers
 */
function generateSuggestions(providers: DetectedProvider[]): string[] {
  const suggestions: string[] = []

  if (providers.length === 0) {
    suggestions.push('No provider dependencies detected. Your components should work in Storybook without additional setup.')
    return suggestions
  }

  suggestions.push(`Detected ${providers.length} provider dependencies that may need Storybook decorators:`)

  for (const provider of providers) {
    if (provider.type === 'customContext') {
      suggestions.push(
        `\n⚠️  Custom Context: ${provider.source}`,
        `   You may need to create a decorator that provides this context.`,
        `   Location: ${provider.location?.file}:${provider.location?.line}`
      )
    } else {
      const pattern = PROVIDER_PATTERNS[provider.type]
      suggestions.push(
        `\n📦 ${provider.type.charAt(0).toUpperCase() + provider.type.slice(1)}:`,
        `   Source: ${provider.source}`,
        `   Docs: ${pattern.docs}`,
        `   Suggested decorator:`,
        `   ${pattern.decoratorSuggestion.split('\n').join('\n   ')}`
      )
    }
  }

  suggestions.push(
    '\n💡 Add these decorators to your .storybook/preview.ts file:',
    '   export default { decorators: [...] } satisfies Preview'
  )

  return suggestions
}

/**
 * Main function: Analyze the app entry point for provider dependencies
 */
export async function analyzeAppProviders(projectRoot: string): Promise<ProviderAnalysisResult> {
  console.log('\n[provider-analyzer] 🔍 Starting provider analysis...')
  console.log(`[provider-analyzer] Project root: ${projectRoot}`)

  const entryFile = await findEntryPoint(projectRoot)

  if (!entryFile) {
    console.log('[provider-analyzer] ⚠️  No entry point found. Searched for:')
    ENTRY_POINT_PATTERNS.forEach((p) => console.log(`   - ${p}`))

    return {
      projectRoot,
      entryFile: null,
      detectedProviders: [],
      customContexts: [],
      suggestions: ['Could not find app entry point. Please ensure your app has a standard entry file (App.tsx, main.tsx, etc.)'],
      timestamp: new Date().toISOString(),
    }
  }

  console.log(`[provider-analyzer] 📄 Found entry point: ${entryFile}`)

  const code = fs.readFileSync(entryFile, 'utf-8')
  const { providers } = analyzeFileForProviders(code, entryFile)
  const deduplicatedProviders = deduplicateProviders(providers)
  const suggestions = generateSuggestions(deduplicatedProviders)

  // Extract custom contexts
  const customContexts = deduplicatedProviders
    .filter((p) => p.type === 'customContext')
    .map((p) => ({
      name: p.source,
      file: p.location?.file || 'unknown',
      usages: [p.source],
    }))

  // Log findings
  console.log('\n[provider-analyzer] ═══════════════════════════════════════════')
  console.log('[provider-analyzer] 📊 PROVIDER ANALYSIS RESULTS')
  console.log('[provider-analyzer] ═══════════════════════════════════════════\n')

  if (deduplicatedProviders.length === 0) {
    console.log('[provider-analyzer] ✅ No provider dependencies detected!')
    console.log('[provider-analyzer]    Components should work in Storybook without additional setup.\n')
  } else {
    console.log(`[provider-analyzer] Found ${deduplicatedProviders.length} provider(s):\n`)

    for (const provider of deduplicatedProviders) {
      const icon = provider.type === 'customContext' ? '🔧' : '📦'
      console.log(`[provider-analyzer] ${icon} ${provider.type.toUpperCase()}`)
      console.log(`[provider-analyzer]    Source: ${provider.source}`)
      console.log(`[provider-analyzer]    Confidence: ${provider.confidence}`)
      if (provider.location) {
        console.log(`[provider-analyzer]    Location: ${provider.location.file}:${provider.location.line}`)
      }
      if (provider.docsUrl) {
        console.log(`[provider-analyzer]    Docs: ${provider.docsUrl}`)
      }
      console.log('')
    }

    console.log('[provider-analyzer] ───────────────────────────────────────────')
    console.log('[provider-analyzer] 💡 SUGGESTIONS\n')
    suggestions.forEach((s) => console.log(`[provider-analyzer] ${s}`))
    console.log('')
  }

  console.log('[provider-analyzer] ═══════════════════════════════════════════\n')

  return {
    projectRoot,
    entryFile,
    detectedProviders: deduplicatedProviders,
    customContexts,
    suggestions,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Analyze a single component file for provider dependencies
 * (Useful for on-demand analysis when creating stories)
 */
export function analyzeComponentFile(filePath: string): DetectedProvider[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[provider-analyzer] File not found: ${filePath}`)
    return []
  }

  const code = fs.readFileSync(filePath, 'utf-8')
  const { providers } = analyzeFileForProviders(code, filePath)
  return deduplicateProviders(providers)
}

// Export for testing
export { analyzeFileForProviders, findEntryPoint, generateSuggestions }

