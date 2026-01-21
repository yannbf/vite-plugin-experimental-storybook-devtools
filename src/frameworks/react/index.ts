/**
 * React Framework Configuration
 *
 * Exports the React-specific implementation for the component highlighter.
 */

import type { FrameworkConfig } from '../types'
import { transform, detectReact, VIRTUAL_MODULE_ID } from './transform'
import { setupVirtualModule } from './runtime'

/**
 * React framework configuration
 */
export const reactFramework: FrameworkConfig = {
  name: 'react',
  displayName: 'React',
  extensions: ['.tsx', '.jsx'],
  detect: detectReact,
  transform,
  setupVirtualModule,
  virtualModuleId: VIRTUAL_MODULE_ID,
  storybookFramework: '@storybook/react-vite',
}

// Re-export for convenience
export { transform, detectReact, VIRTUAL_MODULE_ID } from './transform'
export { setupVirtualModule } from './runtime'

