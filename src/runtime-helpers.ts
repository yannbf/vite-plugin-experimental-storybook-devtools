export function findFirstTrackableElement(root: Node | null): Element | null {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return null

  const rootElement = root as Element
  const rootRect = rootElement as HTMLElement
  if (rootRect.offsetWidth > 0 || rootRect.offsetHeight > 0) {
    return rootElement
  }

  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const el = node as HTMLElement
        return el.offsetWidth > 0 || el.offsetHeight > 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP
      },
    },
  )

  const firstChild = walker.firstChild() as Element | null
  return firstChild || rootElement
}

export function attachRectObservers(
  getInstance: (
    id: string,
  ) => { element?: Element; rect?: DOMRect } | undefined,
  id: string,
  element: Element,
): () => void {
  const updateRect = () => {
    const instance = getInstance(id)
    if (instance?.element && instance.element.isConnected) {
      instance.rect = (instance.element as HTMLElement).getBoundingClientRect()
    }
  }

  const mutation = new MutationObserver(updateRect)
  mutation.observe(element, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['style', 'class'],
  })

  const resize = new ResizeObserver(updateRect)
  resize.observe(element)

  return () => {
    mutation.disconnect()
    resize.disconnect()
  }
}

type TrackingState = {
  id: string | null
  element: Element | null
  disconnect: (() => void) | null
}

type SyncOptions = {
  state: TrackingState
  element: Element
  props: Record<string, unknown>
  register: (element: Element, props: Record<string, unknown>) => string
  unregister: (id: string) => void
  updateProps: (id: string, props: Record<string, unknown>) => void
  getInstance: (id: string) => { element?: Element; rect?: DOMRect } | undefined
}

export function syncInstanceTracking(options: SyncOptions): void {
  const {
    state,
    element,
    props,
    register,
    unregister,
    updateProps,
    getInstance,
  } = options

  if (state.id && state.element === element) {
    updateProps(state.id, props)
    return
  }

  if (state.id) {
    unregister(state.id)
  }

  state.disconnect?.()
  state.disconnect = null

  const id = register(element, props)
  state.id = id
  state.element = element
  state.disconnect = attachRectObservers(getInstance, id, element)
}

export function cleanupInstanceTracking(
  state: TrackingState,
  unregister: (id: string) => void,
): void {
  state.disconnect?.()
  state.disconnect = null

  if (state.id) {
    unregister(state.id)
  }

  state.id = null
  state.element = null
}
