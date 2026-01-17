import { describe, it, expect } from 'vitest'
import { transform } from '../src/transform'

describe('transform', () => {
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
