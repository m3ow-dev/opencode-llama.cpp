"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Test script to verify the plugin exports correctly
var src_1 = require("./src");
console.log("--- Checking OpenCode v2 (Default Export) ---");
console.log("Default export type:", typeof src_1.default);
if (src_1.default && typeof src_1.default === "object") {
    console.log("✓ Default export is an object");
}
else {
    console.error("✗ Default export is missing or not an object");
    process.exit(1);
}
if (typeof src_1.default.id === "string") {
    console.log("\u2713 Plugin ID exists: ".concat(src_1.default.id));
}
else {
    console.error("✗ Missing Plugin ID (required for OpenCode v2)");
    process.exit(1);
}
if (typeof src_1.default.setup === "function") {
    console.log("✓ setup() function exists");
}
else {
    console.error("✗ Missing setup() function (required for OpenCode v2)");
    process.exit(1);
}
console.log("\n--- Checking OpenCode v1 (Named Export) ---");
console.log("Plugin type:", typeof src_1.LlamaCppPlugin);
if (typeof src_1.LlamaCppPlugin === "function") {
    console.log("✓ Plugin is a function");
}
else {
    console.error("✗ Plugin is not a function");
    process.exit(1);
}
// Mock input data
var mockInput = {
    client: {},
    project: {},
    directory: "/tmp",
    worktree: "/tmp",
    $: {},
};
(0, src_1.LlamaCppPlugin)(mockInput)
    .then(function (hooks) {
    console.log("✓ Plugin initializes successfully");
    console.log("Returned hooks:", Object.keys(hooks));
    if (hooks.config) {
        console.log("✓ Config hook exists");
    }
    else {
        console.error("✗ Config hook missing");
        process.exit(1);
    }
    if (hooks.event) {
        console.log("✓ Event hook exists");
    }
    else {
        console.error("✗ Event hook missing");
        process.exit(1);
    }
    console.log("\n✅ All tests passed!");
})
    .catch(function (error) {
    console.error("✗ Initialization failed:", error);
    process.exit(1);
});
