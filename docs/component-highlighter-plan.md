# Vite React Component Highlighter Plugin — Implementation Plan

## Goals
- Highlight React components in the running app and show a hover popover with component name and live props.
- Provide a “Create story” button in the popover that emits an event containing component file path, component name, and props values.
- Developer-focused: enabled in dev by default, tree-shaken/disabled in production builds.

## Developer Experience
- Opt-in Vite plugin `componentHighlighterPlugin({ include, exclude, eventName, enableOverlay, devtoolsDockId })`.
- Works with React + Vite (CSR) and respects HMR.
- Adds a small runtime overlay script and lightweight instrumentation; keeps bundle size minimal in production (guarded by `command === 'serve'`).
- Configuration-driven allowlist/denylist (globs) for files/components to instrument. By default it will instrument all component files.
- Ships a Vite DevTools Kit integration (dock panel + RPC) so the overlay UI and “Create story” event are handled through the Kit channel instead of ad-hoc `window` events ([docs](https://vite-devtools.netlify.app/kit/)).

## Architecture Overview
- **Build-time instrumentation (Vite plugin `transform`)**
  - Use Babel/SWC transform on JSX/TSX modules (filtered by `include/exclude`).
  - Wrap exported React components (named + default) with a `withComponentHighlighter(Component, meta)` HOC imported from a virtual module.
  - Inject metadata: `componentName`, `filePath`, `line/col` if available, `sourceId` (hash of path + export name).
  - Add a lightweight wrapper element with `data-component-highlighter-id="<sourceId>:<instanceId>"` to anchor the overlay to a real DOM node.
- **Runtime client (virtual module)**
  - Maintains a registry of live component instances with refs + props.
  - Listens to `pointerover`/`mousemove` on `document` to detect when the pointer is over an instrumented node (via `data-component-highlighter-id`).
  - Renders an absolutely positioned overlay/panel near the target node; UI gets its content and actions via DevTools Kit RPC instead of local DOM listeners.
  - Emits events through DevTools Kit RPC to a dock panel (instead of `CustomEvent`), carrying `{ componentName, filePath, props, sourceId }`.
- **DevTools Kit integration**
  - Use the DevTools Kit `devtools.setup(ctx)` hook to register a dock entry (`ctx.docks.register`) hosting the overlay/action UI; leverage the dock system and shared RPC provided by the Kit ([docs](https://vite-devtools.netlify.app/kit/)).
  - RPC flow: runtime client → DevTools RPC client → dock UI; dock UI can in turn trigger actions back to runtime (e.g., toggling overlay, enabling/disabling instrumentation).
  - Use Kit shared state for active highlight target and last emitted payload, so both runtime overlay and dock UI stay in sync.

## Vite Plugin Responsibilities
- `configResolved`: detect React setup; warn if missing.
- `transform` (JSX/TSX only):
  - Skip server-only modules and node_modules.
  - Identify component exports:
    - Functions starting with caps.
    - `forwardRef`/`memo` wrappers (unwrap to find inner id where possible).
    - Default exports referencing identifiers.
  - Inject import: `import { withComponentHighlighter } from 'virtual:component-highlighter/runtime'`.
  - Replace component declarations/exports with wrapped version:
    - `const Button = withComponentHighlighter(function Button(props) { ... }, { componentName: 'Button', filePath, sourceId })`.
    - For memo/forwardRef, wrap outermost call: `memo(withComponentHighlighter(...))`.
  - Add lightweight DOM anchor:
    - Wrap returned JSX root with `<ComponentHighlighterBoundary meta={meta}>{original}</ComponentHighlighterBoundary>`.
    - Boundary uses a `span` (or `Fragment + ref` via `cloneElement`) to attach `data-component-highlighter-id`.
- `resolveId/load` for virtual runtime module.
- `transformIndexHtml` or `configureServer` to inject overlay stylesheet (small inline CSS) and a toggle script guard.
- `devtools` hook:
  - Register dock entry with title/icon; point to a small UI (e.g., `/__component-highlighter-devtools`) that consumes the RPC channel.
  - Expose RPC methods to receive `createStory` payloads and to push overlay state (current hover) into the dock UI.
- Disable transforms when `command === 'build'` unless `force` option is set.

## Runtime Client Responsibilities
- **Registry**
  - `registerInstance(id, meta, ref, props)` and `unregisterInstance(id)`.
  - Store last seen bounding rect to avoid forced layouts.
  - Debounce updates during rapid renders.
- **Boundary Component**
  - React component that:
    - Grabs a ref to the closest DOM node (prefers single-child DOM; falls back to wrapping `span`).
    - On render, registers with the registry using `meta` and current `props`.
    - On unmount, unregisters.
    - Adds `data-component-highlighter-id` to the DOM node.
- **Overlay UI (DevTools Kit powered)**
  - Runtime still draws a minimal positional overlay near the target node (for highlight box), but the content panel is driven via DevTools Kit dock UI rendered in an iframe using the Kit’s dock system.
  - Hover flow: runtime detects target → sends `highlightTarget` RPC message with meta + props → dock UI renders component details and “Create story” action.
  - “Create story” button in the dock UI calls back through RPC to runtime, which dispatches the configured `eventName` or forwards the payload to Node-side handlers if needed.
  - Keyboard toggle: e.g., `Shift+H` toggles listeners and notifies dock UI via shared state.

## Data Model & Event Schema
- `meta`: `{ componentName, filePath, sourceId, line?, column? }`.
- `instance`: `{ id: string, meta, props: any, rect?: DOMRect, element: HTMLElement }`.
- Event payload (RPC + optional DOM event): `{ componentName: string, filePath: string, props: Record<string, unknown>, sourceId: string }`.
- Default event name: `component-highlighter:create-story`; configurable.
- RPC channels:
  - `highlightTarget` (runtime → dock): `{ meta, props, rect }`.
  - `createStory` (dock → runtime): `{ meta, props }`.
  - `toggleOverlay` (dock ↔ runtime): `{ enabled: boolean }`.

## Testing Strategy
- **Unit (Vitest)**
  - Transform tests: snapshot transformed output for representative cases (named export, default export, memo/forwardRef, multiple components per file, exclude/include patterns).
  - Registry tests: register/unregister, props updates, id generation stability.
  - Boundary component tests with JSDOM: ensures `data-component-highlighter-id` and registry interactions.
- **Integration**
  - Spin up Vite dev server in tests (using `vite-node` or `vite-preview` with playwright).
  - Render sample app; assert that hovering over instrumented nodes triggers RPC `highlightTarget` and the dock UI shows expected text.
  - Verify `createStory` RPC from dock to runtime dispatches the configured event/payload.
  - HMR test: edit component, ensure registry updates without duplicate overlays.
- **E2E (Playwright)**
  - Run the playground app with DevTools Kit enabled; simulate hover and click through dock UI; screenshot overlay positioning and dock content.
  - Test keyboard toggle enabling/disabling listeners and dock UI state.
- **Performance checks**
  - Measure added transform time on a sample project; ensure opt-out for large files via `exclude`.
  - Ensure production build has no injected runtime by asserting absence of `virtual:component-highlighter` strings in build output.
  - Ensure devtools kit assets are only loaded in dev (command serve) and dock registration is skipped in production.

## Milestones
1. Scaffold plugin API, virtual module, and DevTools Kit dock registration (minimal iframe UI).
2. Implement transform with wrapping + meta injection (dev-only).
3. Build runtime registry + boundary component and RPC wiring (runtime → dock).
4. Build dock UI (DevTools Kit) to display target info and trigger `createStory`; runtime to honor RPC calls.
5. Add configuration toggles and docs (include DevTools Kit setup and fallback when DevTools is disabled).
6. Add unit + integration + E2E tests; wire into CI (include RPC/dock flows).
7. Polish DX (warnings, console hints) and performance guards; document experimental DevTools Kit API surface.

