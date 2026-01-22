import React, { useEffect } from 'react'
import { MyButton } from './components/Button'
import { WithChildren } from './WithChildren'
import { Emoji } from './Emoji'

export function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginTop: '20px' }}>
        <MyButton variant="primary">Primary</MyButton>
      </div>

      <h2>Some non-component Heading</h2>
      <MyButton variant="secondary" size="small">With JSX emoji <Emoji onClick={() => alert('Snap!')} /></MyButton>

      <WithChildren label="Other" mode="primary" deepObject={{ value: 'test', nested: { value: 'nested' } }}>
        With children!
        <MyButton size="small">Small button</MyButton>
      </WithChildren>
    </div>
  )
}
