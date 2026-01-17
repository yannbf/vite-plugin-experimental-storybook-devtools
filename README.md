# Vite React Component Highlighter Plugin

A Vite plugin that instruments React components to provide visual highlighting and Storybook story generation capabilities during development. Hover over components in your running app to see their details and create stories with a single click.

## Features

- 🔍 **Component Highlighting**: Hover over any React component to see a blue overlay and component details
- 📚 **Story Generation**: Click "Create Story" to emit events containing component metadata for Storybook integration
- 🎛️ **DevTools Integration**: Built-in Vite DevTools Kit integration with a dedicated dock panel
- ⚡ **Performance Optimized**: Only active in development, tree-shaken in production
- 🎯 **Configurable**: Fine-grained control over which components to instrument
- ⌨️ **Keyboard Shortcuts**: Toggle overlay with `Shift+H`

## Installation

```bash
npm install vite-plugin-component-highlighter
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { DevTools } from '@vitejs/devtools'
import componentHighlighterPlugin from 'vite-plugin-component-highlighter'

export default defineConfig({
  plugins: [
    react(),
    DevTools(),
    componentHighlighterPlugin()
  ],
})
```

### Configuration Options

```typescript
componentHighlighterPlugin({
  // Glob patterns to include for instrumentation (default: ['**/*.{tsx,jsx}'])
  include: ['**/*.{tsx,jsx}', '!**/node_modules/**'],

  // Glob patterns to exclude from instrumentation
  exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],

  // Custom event name for story creation events (default: 'component-highlighter:create-story')
  eventName: 'my-custom-story-event',

  // Enable/disable overlay in development (default: true)
  enableOverlay: true,

  // Custom devtools dock ID (default: 'component-highlighter')
  devtoolsDockId: 'my-component-highlighter',

  // Force instrumentation in production builds (default: false)
  force: false,
})
```

### Listening for Story Creation Events

The plugin emits custom events when users click "Create Story". Listen for these events in your application:

```typescript
// Listen for story creation events
window.addEventListener('component-highlighter:create-story', (event) => {
  const { componentName, filePath, props, sourceId } = event.detail

  console.log('Create story for:', {
    componentName,
    filePath,
    props,
    sourceId
  })

  // Your Storybook integration logic here
  // e.g., open Storybook and create a new story file
})
```

## How It Works

### Build-time Instrumentation

The plugin uses Babel to transform JSX/TSX files during development:

1. **Component Detection**: Identifies React components (function components, arrow functions, memo, forwardRef)
2. **HOC Wrapping**: Wraps components with `withComponentHighlighter` HOC
3. **Metadata Injection**: Adds component name, file path, and source ID
4. **DOM Anchoring**: Creates boundary elements for hover detection

### Runtime Behavior

1. **Registry**: Maintains a registry of live component instances with props and DOM references
2. **Hover Detection**: Listens for `mousemove` events and detects components via data attributes
3. **Overlay Rendering**: Shows a blue highlight overlay on hovered components
4. **DevTools Communication**: Sends component data to the DevTools dock via RPC
5. **Event Dispatch**: Emits custom events when "Create Story" is clicked

### DevTools Integration

The plugin registers a dock panel in Vite DevTools showing:
- Component name and file path
- Current props with syntax highlighting
- "Create Story" button
- Overlay toggle control

## Keyboard Shortcuts

- `Shift + H`: Toggle component highlighting overlay on/off

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vite Plugin   │    │  Virtual Module  │    │  DevTools Dock  │
│                 │    │                  │    │                 │
│ • Transform JSX │    │ • Runtime Client │    │ • Component UI  │
│ • Inject HOC    │    │ • Registry       │    │ • RPC Receiver  │
│ • DevTools Reg  │    │ • Overlay        │    │ • Story Button  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────────────┐
                    │   RPC Communication│
                    │                    │
                    │ • highlight-target │
                    │ • create-story     │
                    │ • toggle-overlay   │
                    └────────────────────┘
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
```

### Playground

```bash
npm run play
```

Navigate to the playground app and hover over the `MyButton` component to see the highlighter in action.

## Limitations

- Only works with React function components (not class components)
- Requires React and Vite DevTools to be installed
- Development-only feature (disabled in production by default)

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT

## Development

- Install dependencies:

```bash
npm install
```

- Run the playground:

```bash
npm run play
```

- Run the unit tests:

```bash
npm run test
```

- Build the library:

```bash
npm run build
```
