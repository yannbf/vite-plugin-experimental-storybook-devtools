// Simple test script for the transform function
const { transform } = require('./dist/component-highlighter-plugin-23YLWg0c.mjs')

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