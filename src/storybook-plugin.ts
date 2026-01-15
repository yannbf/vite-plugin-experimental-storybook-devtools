/// <reference types="@vitejs/devtools-kit" />
import type { Plugin } from 'vite'

export default function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    devtools: {
      setup(ctx) {
        // Register a dock entry that shows an iframe
        ctx.docks.register({
          id: 'storybook-devtools-plugin',
          title: 'Storybook Devtools Plugin',
          icon: 'https://avatars.githubusercontent.com/u/22632046',
          type: 'iframe',
          url: 'https://storybook.js.org/',
        })
      },
    },
  }
}
