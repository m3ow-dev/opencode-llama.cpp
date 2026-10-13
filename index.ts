// Package root entrypoint for OpenCode V2 plugin loading.
// OpenCode resolves a plugin package/directory to an `index.ts` at its root,
// while the implementation lives in `src/`.
export * from "./src/index.js"
export {default} from "./src/index.js"