# Vite Component Highlighter Plugin

A Vite plugin that instruments React components to provide visual highlighting and **automatic Storybook story generation** during development. Hover over components in your running app to see their details and create stories with a single click.

![Component Highlighter Demo](https://via.placeholder.com/800x400?text=Component+Highlighter+Demo)

## ✨ Features

- 🔍 **Component Highlighting** - Visual overlay on React components with configurable colors
- 📚 **One-Click Story Generation** - Create Storybook stories directly from your running app
- 🎯 **JSX Props Support** - Properly serializes JSX children and nested components
- 🔄 **Append to Existing Stories** - Add new stories to existing story files
- 📁 **Smart Imports** - Automatically resolves and adds component imports
- 🎛️ **DevTools Integration** - Built-in Vite DevTools Kit dock panel
- 📊 **Debug Overlay** - Component stats and story coverage when holding Alt
- ⚡ **Performance Optimized** - Only active in development, tree-shaken in production
- ⌨️ **Keyboard Shortcuts** - Quick toggles and navigation

## 📦 Installation

```bash
npm install vite-plugin-experimental-storybook-devtools
# or
pnpm add vite-plugin-experimental-storybook-devtools
# or
yarn add vite-plugin-experimental-storybook-devtools
```

### Peer Dependencies

This plugin requires:
- `vite` >= 5.0.0
- `react` >= 18.0.0
- `@vitejs/devtools` >= 0.1.0

## 🚀 Quick Start

### 1. Add the plugin to your Vite config

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { DevTools } from '@vitejs/devtools'
import componentHighlighter from 'vite-plugin-experimental-storybook-devtools/react'

export default defineConfig({
  plugins: [
    react(),
    DevTools(),
    componentHighlighter(),
  ],
})
```

### 2. Start your development server

```bash
npm run dev
```

### 3. Open Vite DevTools

Click the Vite DevTools floating button (usually bottom-right) and select the **Component Highlighter** tab.

### 4. Start highlighting!

Once the dock is active:
- **Hover** over any component to see its tooltip
- **Click** on a component to open the context menu
- **Hold Alt** to see all components highlighted at once
- **Create stories** with a single click!

## 🎮 Usage

### Highlight Modes

| Mode | Trigger | Description |
|------|---------|-------------|
| **Hover** | Mouse over | Shows tooltip for single component |
| **Highlight All** | Hold `Alt` | Shows all components with debug overlay |
| **Toggle Sticky** | `Shift + H` | Keeps highlight-all mode active |
| **Dismiss** | `Escape` | Closes context menu or selection |

### Highlight Colors

- 🔵 **Blue** - Non-hovered components (when Alt is held)
- 🩷 **Pink Solid** - Currently hovered component
- 🩷 **Pink Dashed** - Other instances of the same component
- 🩷 **Pink (20% bg)** - Selected component

### Creating Stories

1. **Click on a highlighted component** to open the context menu
2. **Enter a story name** (auto-suggested based on props)
3. **Click "Create Story"** (or "Add Story" if stories exist)
4. The story file is created/updated automatically!

### Context Menu Features

- **Component name** with Storybook icon (if stories exist)
- **Relative file path** for quick reference
- **Props display** with current values
- **Story name input** with smart suggestions
- **Open Component** - Opens the component file in your editor
- **Open Stories** - Opens the story file in your editor
- **Create/Add Story** - Generates story with current props

## ⚙️ Configuration

```typescript
componentHighlighter({
  // Glob patterns for files to instrument (default: framework's extensions)
  include: ['**/*.{tsx,jsx}'],
  
  // Glob patterns to exclude
  exclude: ['**/node_modules/**', '**/dist/**', '**/*.stories.{tsx,jsx}'],
  
  // Custom event name for story creation
  eventName: 'component-highlighter:create-story',
  
  // Enable/disable overlay (default: true)
  enableOverlay: true,
  
  // Custom DevTools dock ID
  devtoolsDockId: 'component-highlighter',
  
  // Force instrumentation in production (default: false)
  force: false,
})
```

### Default Exclusions

The following patterns are excluded by default:
- `**/node_modules/**`
- `**/dist/**`
- `**/*.d.ts`
- `**/*.stories.{tsx,jsx,ts,js}`
- `**/*.test.{tsx,jsx,ts,js}`
- `**/*.spec.{tsx,jsx,ts,js}`

## 📖 Generated Story Format

The plugin generates TypeScript stories compatible with Storybook 7+:

```typescript
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import MyButton from './MyButton';
import Icon from './Icon';

const meta = {
  title: 'Components/MyButton',
  component: MyButton,
} satisfies Meta<typeof MyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    label: 'Click me',
    icon: <Icon name="star" />,
    onClick: fn(),
  },
};
```

### Supported Prop Types

| Type | Example | Generated Code |
|------|---------|----------------|
| Primitives | `"hello"`, `42`, `true` | `"hello"`, `42`, `true` |
| Objects | `{ nested: { value: 1 } }` | `{ nested: { value: 1 } }` |
| Arrays | `[1, 2, 3]` | `[1, 2, 3]` |
| JSX Elements | `<Icon />` | `<Icon />` (with import) |
| JSX Children | `<>Hello <Button /></>` | `<>Hello <Button /></>` |
| Functions | `onClick={handleClick}` | `fn()` (with import) |

## 🔍 Debug Overlay

When holding `Alt`, a debug overlay appears in the top-right corner showing:

- **Total components** - Number of component instances on screen
- **Unique components** - Number of distinct component types
- **With stories** - Components that have story files
- **Coverage %** - Percentage of components with stories

## 🏗️ Architecture

For detailed technical documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vite Plugin   │    │  Virtual Module  │    │  DevTools Dock  │
│                 │    │                  │    │                 │
│ • Transform JSX │───▶│ • Runtime HOC    │───▶│ • Component UI  │
│ • Inject meta   │    │ • Registry       │    │ • RPC Handler   │
│ • Story gen     │    │ • Serialization  │    │ • Story create  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### How It Works

1. **Build-time**: Babel transforms wrap components with `withComponentHighlighter` HOC
2. **Runtime**: HOC registers component instances with metadata and props
3. **Interaction**: Overlay detects mouse events and renders highlights
4. **Story Creation**: Serialized props are sent via RPC, story files are written to disk

## 🧪 Development

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/vite-plugin-experimental-storybook-devtools.git
cd vite-plugin-experimental-storybook-devtools

# Install dependencies
pnpm install
```

### Available Scripts

```bash
# Run the playground app
pnpm play

# Run unit tests
pnpm test

# Run E2E tests (requires playground running)
pnpm exec playwright test

# Build the library
pnpm build

# Type check
pnpm typecheck
```

### Project Structure

```
├── src/
│   ├── index.ts                    # Package entry
│   ├── component-highlighter-plugin.ts  # Main Vite plugin
│   ├── transform.ts                # Babel AST transformation
│   ├── virtual-module.ts           # Runtime HOC
│   ├── story-generator.ts          # Story file generation
│   ├── provider-analyzer.ts        # Provider detection
│   └── client/
│       ├── overlay.ts              # UI overlay
│       ├── listeners.ts            # Event handlers
│       └── vite-devtools.ts        # DevTools dock
├── tests/                          # Unit tests
├── e2e/                            # E2E tests
└── playground/                     # Development app
```

## ⚠️ Limitations

- **React only** - Currently supports React function components (not class components)
- **Development only** - Disabled in production builds by default
- **Vite DevTools required** - Needs `@vitejs/devtools` for full functionality
- **Provider dependencies** - Components requiring context providers may need Storybook decorators

### Handling Provider Dependencies

If your components use context providers (Redux, Router, Theme, etc.), you'll need to set up decorators in your Storybook preview file. The plugin includes a provider analyzer that can help identify these dependencies.

See the [Provider Analysis](#provider-analysis) section for more details.

## 🔮 Future Plans

- [ ] Vue support
- [ ] Svelte support
- [ ] Angular support
- [ ] Automatic decorator generation
- [ ] Component usage analytics

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting a PR.

### Reporting Issues

When reporting issues, please include:
- Node.js version
- Vite version
- React version
- Browser and version
- Minimal reproduction

## 📄 License

MIT © Yann Braga

---

## Appendix

### Provider Analysis

The plugin includes a provider analyzer (`src/provider-analyzer.ts`) that can detect common provider dependencies:

**Supported Providers**:
- Redux (`react-redux`, `@reduxjs/toolkit`)
- React Router (`react-router-dom`)
- Emotion (`@emotion/react`)
- Styled Components (`styled-components`)
- TanStack Query (`@tanstack/react-query`)
- React Intl (`react-intl`)
- i18next (`react-i18next`)
- Chakra UI (`@chakra-ui/react`)
- Mantine (`@mantine/core`)
- Next.js (`next/router`, `next/navigation`)

The analyzer scans your app entry point and logs detected providers with decorator suggestions.

### Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Alt` (hold) | Show all component highlights + debug overlay |
| `Shift + H` | Toggle sticky highlight-all mode |
| `Escape` | Dismiss context menu / clear selection |

### Troubleshooting

#### Stories aren't being created

1. Ensure the DevTools dock is open and the Component Highlighter tab is active
2. Check the browser console for errors
3. Verify the output path is writable

#### Components not being highlighted

1. Ensure the file matches the `include` patterns
2. Check that it's not matching an `exclude` pattern
3. Verify the component is a function component (not a class)

#### JSX props showing as `[Object]`

This typically means the component rendered before the plugin fully loaded. Try refreshing the page.
