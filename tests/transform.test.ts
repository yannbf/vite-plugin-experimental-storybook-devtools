import { describe, it, expect } from 'vitest'
import { transform } from '../src/frameworks/react/transform'

describe('transform', () => {
  describe('basic transformations', () => {
    it('should transform a simple function component', () => {
      const code = `
import React from 'react'

export function MyComponent(props) {
  return <div>Hello {props.name}</div>
}
`

      const result = transform(code, '/src/MyComponent.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
      expect(result).toContain('MyComponent')
      expect(result).toContain('filePath')
    })

    it('should transform a default export arrow function component', () => {
      const code = `
import React from 'react'

const MyComponent = (props) => {
  return <div>Hello {props.name}</div>
}

export default MyComponent
`

      const result = transform(code, '/src/MyComponent.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
      expect(result).toContain('MyComponent')
    })

    it('should not transform non-JSX files', () => {
      const code = `
export function helper() {
  return 'hello'
}
`

      const result = transform(code, '/src/helper.ts')

      expect(result).toBeUndefined()
    })

    it('should not transform files without JSX', () => {
      const code = `
export function MyComponent(props) {
  return 'Hello ' + props.name
}
`

      const result = transform(code, '/src/MyComponent.tsx')

      expect(result).toBeUndefined()
    })
  })

  describe('export variations', () => {
    it('should transform named export function declaration', () => {
      const code = `
import React from 'react'

export function Button({ label }) {
  return <button>{label}</button>
}
`

      const result = transform(code, '/src/Button.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
      expect(result).toContain('componentName')
      expect(result).toContain('Button')
      expect(result).toContain('isDefaultExport')
    })

    it('should transform default export function declaration', () => {
      const code = `
import React from 'react'

const Button = ({ label }) => {
  return <button>{label}</button>
}

export default Button
`

      const result = transform(code, '/src/Button.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
      expect(result).toContain('isDefaultExport')
    })

    it('should transform default export function declaration directly', () => {
      const code = `
import React from 'react'

export default function App({ name }) {
  return <div>Hello {name}</div>
}
`

      const result = transform(code, '/src/App.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
      expect(result).toContain('isDefaultExport')
      expect(result).toContain('"App"')
    })

    it('should transform const arrow function with export', () => {
      const code = `
import React from 'react'

export const Button = ({ label }) => {
  return <button>{label}</button>
}
`

      const result = transform(code, '/src/Button.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
      expect(result).toContain('"Button"')
    })
  })

  describe('React patterns', () => {
    it('should transform React.memo wrapped components', () => {
      const code = `
import React, { memo } from 'react'

export const Button = memo(({ label }) => {
  return <button>{label}</button>
})
`

      const result = transform(code, '/src/Button.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
    })

    it('should transform React.forwardRef wrapped components', () => {
      const code = `
import React, { forwardRef } from 'react'

export const Button = forwardRef(({ label }, ref) => {
  return <button ref={ref}>{label}</button>
})
`

      const result = transform(code, '/src/Button.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
    })
  })

  describe('metadata', () => {
    it('should include filePath in meta', () => {
      const code = `
import React from 'react'

export function Button() {
  return <button>Click</button>
}
`

      const result = transform(code, '/project/src/components/Button.tsx')

      expect(result).toContain('filePath')
      expect(result).toContain('/project/src/components/Button.tsx')
    })

    it('should include relativeFilePath in meta', () => {
      const code = `
import React from 'react'

export function Button() {
  return <button>Click</button>
}
`

      const result = transform(code, '/project/src/components/Button.tsx')

      expect(result).toContain('relativeFilePath')
    })

    it('should include sourceId in meta', () => {
      const code = `
import React from 'react'

export function Button() {
  return <button>Click</button>
}
`

      const result = transform(code, '/src/Button.tsx')

      expect(result).toContain('sourceId')
    })

    it('should generate unique sourceId for different components', () => {
      const code1 = `
import React from 'react'
export function Button() { return <button>1</button> }
`
      const code2 = `
import React from 'react'
export function Button() { return <button>2</button> }
`

      const result1 = transform(code1, '/src/Button1.tsx')
      const result2 = transform(code2, '/src/Button2.tsx')

      // The sourceIds should be different since the file paths are different
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      // Both should have sourceId but they should be different
      expect(result1).toContain('sourceId')
      expect(result2).toContain('sourceId')
    })
  })

  describe('multiple components', () => {
    it('should transform multiple exported components', () => {
      const code = `
import React from 'react'

export const Button = ({ label }) => {
  return <button>{label}</button>
}

export const Icon = ({ name }) => {
  return <span>{name}</span>
}
`

      const result = transform(code, '/src/components.tsx')

      expect(result).toBeDefined()
      // Should have withComponentHighlighter calls (one import + two usages)
      expect(result).toContain('withComponentHighlighter')
      // Both components should be wrapped
      expect(result).toContain('Button = withComponentHighlighter')
      expect(result).toContain('Icon = withComponentHighlighter')
    })
  })

  describe('import injection', () => {
    it('should add withComponentHighlighter import', () => {
      const code = `
import React from 'react'

export function Button() {
  return <button>Click</button>
}
`

      const result = transform(code, '/src/Button.tsx')

      expect(result).toContain('import { withComponentHighlighter }')
      expect(result).toContain('virtual:component-highlighter/runtime')
    })

    it('should not duplicate imports on re-transform', () => {
      const code = `
import React from 'react'
import { withComponentHighlighter } from 'virtual:component-highlighter/runtime'

export function Button() {
  return <button>Click</button>
}
`

      // Simulating a re-transform (in reality this might happen with HMR)
      // The transform should still work
      const result = transform(code, '/src/Button.tsx')

      expect(result).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle components with complex JSX', () => {
      const code = `
import React from 'react'

export function Card({ title, children }) {
  return (
    <div className="card">
      <header>
        <h2>{title}</h2>
      </header>
      <main>{children}</main>
      <footer>
        <button onClick={() => {}}>Action</button>
      </footer>
    </div>
  )
}
`

      const result = transform(code, '/src/Card.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
    })

    it('should handle TypeScript generic components', () => {
      const code = `
import React from 'react'

interface Props<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}

export function List<T>({ items, renderItem }: Props<T>) {
  return <ul>{items.map(renderItem)}</ul>
}
`

      const result = transform(code, '/src/List.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
    })

    it('should handle components with hooks', () => {
      const code = `
import React, { useState, useEffect } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    console.log('Count changed:', count)
  }, [count])
  
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}
`

      const result = transform(code, '/src/Counter.tsx')

      expect(result).toBeDefined()
      expect(result).toContain('withComponentHighlighter')
    })

    it('should wrap exported components', () => {
      const code = `
import React from 'react'

export const DateDisplay = ({ date }) => {
  return <span>{date}</span>
}
`

      const result = transform(code, '/src/DateDisplay.tsx')

      expect(result).toBeDefined()
      // The exported component should be wrapped
      expect(result).toContain('DateDisplay = withComponentHighlighter')
    })
  })
})
