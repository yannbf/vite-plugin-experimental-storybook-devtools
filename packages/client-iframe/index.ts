
// we need to embed/host/check for the URL provided to `storybookUrl`

// * [ ] storybookUrl option passed from devtools
// * [ ] set up polling, to detect if `${storybookUrl}/project.json` is available (/healthcheck.json)
  // * Is it possible to avoid polling by making one vite server to be aware of a storybook server running on the same machine? Maybe via IPC or something?
// * [ ] if available, embed the whole `storybookUrl` iframe
// * [ ] if not available, show fallback state
  
export default "FROG"