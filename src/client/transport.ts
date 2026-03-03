import type { SerializedProps } from '../frameworks/types'

/**
 * Payload sent when the user requests story creation from the overlay.
 * Framework-agnostic; consumed by whatever transport adapter is active.
 */
export interface CreateStoryPayload {
  meta: {
    componentName: string
    filePath: string
    relativeFilePath?: string
    sourceId: string
    isDefaultExport?: boolean
  }
  props: Record<string, unknown>
  serializedProps?: SerializedProps
  /** Component registry for import resolution: componentName -> filePath */
  componentRegistry?: Record<string, string>
  storyName?: string
  playFunction?: string[]
  playImports?: string[]
}

/**
 * Payload delivered back to the client after a story is written.
 */
export interface StoryCreatedPayload {
  filePath: string
  componentName: string
  componentPath?: string
  storyName?: string
  isAppend?: boolean
}

/**
 * Transport interface for the component highlighter.
 *
 * Decouples the overlay and listener logic from the communication mechanism
 * so the highlighter can be used outside of Vite DevTools (e.g. as a standalone
 * overlay, browser extension, or custom tooling).
 *
 * @example
 * // Vite DevTools implementation
 * const transport: HighlighterTransport = {
 *   createStory: (data) => ctx.current.rpc.call('component-highlighter:create-story', data),
 *   onStoryCreated: (handler) => {
 *     ctx.current.rpc.client.register({
 *       name: 'component-highlighter:story-created',
 *       type: 'action',
 *       handler,
 *     })
 *     return () => { /* cleanup *\/ }
 *   },
 * }
 */
export interface HighlighterTransport {
  /**
   * Send a create-story request.
   * In DevTools context, this calls the server RPC.
   * In other contexts, this could post a message, call an API, etc.
   */
  createStory(data: CreateStoryPayload): Promise<void>

  /**
   * Register a handler for story-creation confirmation.
   * Returns an unsubscribe function.
   */
  onStoryCreated(handler: (data: StoryCreatedPayload) => void): () => void
}
