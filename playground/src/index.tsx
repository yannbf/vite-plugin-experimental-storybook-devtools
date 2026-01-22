import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'

// Load component highlighter client modules
import 'vite-plugin-component-highlighter/client/listeners'
import 'vite-plugin-component-highlighter/client/overlay'

createRoot(document.querySelector('#app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
