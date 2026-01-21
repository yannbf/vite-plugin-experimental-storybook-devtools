// Simple test script for the transform function
import { transform } from './dist/component-highlighter-plugin-BlFm08z-.mjs'

const testCode = `
import React from 'react'

export function MyComponent(props) {
  return <div>Hello {props.name}</div>
}
`

console.log('Testing transform...')
try {
  const result = transform(testCode, '/src/MyComponent.tsx')
  console.log('Transform result:', result)
} catch (error) {
  console.error('Transform error:', error)
}