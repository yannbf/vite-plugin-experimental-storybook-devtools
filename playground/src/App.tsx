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
      <div style={{ marginTop: '20px' }}>
        <MyButton type="primary" />
      </div>

      <Other label="Other" mode="primary" deepObject={{ value: 'test', nested: { value: 'nested' } }}>
        With children!
        <MyButton type="primary" />
      </Other>

      <h2>Some Heading</h2>
      <MyButton type="secondary" size="small" />
    </div>
  )
}
