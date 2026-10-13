// Test script to verify the plugin exports correctly
import PluginDef, { LlamaCppPlugin } from "./src"
import { PluginInput } from "@opencode-ai/plugin"

console.log("--- Checking OpenCode v2 (Default Export) ---")
console.log("Default export type:", typeof PluginDef)

if (PluginDef && typeof PluginDef === "object") {
  console.log("✓ Default export is an object")
} else {
  console.error("✗ Default export is missing or not an object")
  process.exit(1)
}

if (typeof PluginDef.id === "string") {
  console.log(`✓ Plugin ID exists: ${PluginDef.id}`)
} else {
  console.error("✗ Missing Plugin ID (required for OpenCode v2)")
  process.exit(1)
}

if (typeof PluginDef.setup === "function") {
  console.log("✓ setup() function exists")
} else {
  console.error("✗ Missing setup() function (required for OpenCode v2)")
  process.exit(1)
}

console.log("\n--- Checking OpenCode v1 (Named Export) ---")
console.log("Plugin type:", typeof LlamaCppPlugin)

if (typeof LlamaCppPlugin === "function") {
  console.log("✓ Plugin is a function")
} else {
  console.error("✗ Plugin is not a function")
  process.exit(1)
}

// Mock input data
const mockInput = {
  client: {} as any,
  project: {} as any,
  directory: "/tmp",
  worktree: "/tmp",
  $: {} as any,
}

LlamaCppPlugin(<PluginInput>mockInput)
  .then((hooks) => {
    console.log("✓ Plugin initializes successfully")
    console.log("Returned hooks:", Object.keys(hooks))

    if (hooks.config) {
      console.log("✓ Config hook exists")
    } else {
      console.error("✗ Config hook missing")
      process.exit(1)
    }

    if (hooks.event) {
      console.log("✓ Event hook exists")
    } else {
      console.error("✗ Event hook missing")
      process.exit(1)
    }

    console.log("\n✅ All tests passed!")
  })
  .catch((error) => {
    console.error("✗ Initialization failed:", error)
    process.exit(1)
  })
