import React, { useEffect } from 'react'
import { MyButton } from './MyButton'
import { Other } from './Other'

export function App() {
  useEffect(() => {
    // Listen for component highlighter story creation events
    const handleStoryCreation = (event: CustomEvent) => {
      console.log('🎨 Component Highlighter - Create Story:', event.detail)

      // You can integrate with Storybook here
      alert(`Create story for ${event.detail.componentName} in ${event.detail.filePath}`)
    }

    window.addEventListener('component-highlighter:create-story', handleStoryCreation as EventListener)

    return () => {
      window.removeEventListener('component-highlighter:create-story', handleStoryCreation as EventListener)
    }
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Component Highlighter Demo</h1>
      <p>Hover over the button below to see the component highlighter in action!</p>
      <p>Press <kbd>Shift + H</kbd> to toggle the overlay.</p>
      <p>Open DevTools to see the Component Highlighter dock panel.</p>

      <div style={{ marginTop: '20px' }}>
        <MyButton type="primary" />
      </div>

      <Other label="Other" mode="primary" deepObject={{ value: 'test', nested: { value: 'nested' } }} />

      <div style={{ marginTop: '40px', padding: '20px', background: 'transparent', borderRadius: '8px' }}>
        <h2>How to use:</h2>
        <ol>
          <li>Hover over the button above</li>
          <li>See the blue overlay highlight</li>
          <li>Check the DevTools dock panel for component details</li>
          <li>Click "Create Story" to trigger the event</li>
        </ol>
      </div>
    </div>
  )
}
