import { useEffect, useState } from 'react'
import './App.css'

const POLL_INTERVAL_MS = 1000

// Derived once from the URL — never changes for the lifetime of this page.
const storybookUrl = new URLSearchParams(window.location.search).get('storybookUrl') ?? ''

function App() {
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    if (!storybookUrl) return

    let timeoutId
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`${storybookUrl}/project.json`)
        if (!cancelled) setIsAvailable(res.ok)
      } catch {
        if (!cancelled) setIsAvailable(false)
      }
      if (!cancelled) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, []) // storybookUrl is module-level; this effect runs once

  return isAvailable ? (
    <iframe
      title="Storybook"
      src={storybookUrl}
      style={{ width: '100vw', height: '100vh', border: 'none', margin: 0, padding: 0, overflow: 'hidden' }}
    />
  ) : (
    <div className="unavailable">
      Storybook is unavailable. Please make sure it is running and accessible at the specified URL.
    </div>
  )
}

export default App
