# @m3ow-dev/opencode-llama-cpp

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OpenCode **V2** plugin for [llama.cpp](https://github.com/ggml-org/llama.cpp) `llama-server`: auto-detects a local server, discovers loaded models dynamically, and validates the selected model on every request.

## Features

- **Auto-detection**: detects a running `llama-server` on common ports (1234, 8080, 11434)
- **Dynamic model discovery**: queries the `/v1/models` endpoint and registers models through the OpenCode provider registry — including models loaded *after* OpenCode starts
- **Periodic refresh**: re-discovers models on an interval (configurable) so load/unload changes appear without a restart
- **Model validation**: on each request scoped to `llama.cpp`, checks that the selected model is actually loaded and warns with similar-model suggestions if not
- **Sensible defaults**: chat models get tool capability, embedding models are marked non-tool; models get readable names (e.g. "Qwen3 30B A3B" instead of `qwen/qwen3-30b-a3b`)

## Requirements

- OpenCode **v2.0.28** or newer (OpenCode V2 plugin API)
- A local `llama-server` instance

## Installation

Published package:

```bash
npm install @m3ow-dev/opencode-llama-cpp
```

Then add it to `opencode.json(c)` **as a `plugins` entry** (note: in OpenCode V2 the key is `plugins`, and local paths must point at a *directory*, not a `.ts` file):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "@m3ow-dev/opencode-llama-cpp"
  ]
}
```

Local development checkout:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/opencode-llama.cpp/src"
  ]
}
```

## Options

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "@m3ow-dev/opencode-llama-cpp",
      "options": {
        "baseURL": "http://127.0.0.1:8080", // default: auto-detect (1234, 8080, 11434)
        "refreshIntervalMs": 60000,          // default: 60s
        "refreshDisabled": false             // set true to disable periodic refresh
      }
    }
  ]
}
```

| Option | Default | Description |
|---|---|---|
| `baseURL` | auto-detect | Base URL of the llama.cpp server. Checked in order: 1234, 8080, 11434. |
| `refreshIntervalMs` | `60000` | How often to re-discover models and reload the provider registry. |
| `refreshDisabled` | `false` | Disable periodic refresh entirely. |

## Usage

Start your server, e.g.:

```bash
llama-server -hf MaziyarPanahi/GLM-4.6V-Flash-GGUF:Q6_K --port 8080
```

Then use any discovered model from OpenCode (select it in the TUI model picker, or):

```bash
opencode run -m 'llama.cpp/MaziyarPanahi/GLM-4.6V-Flash-GGUF:Q6_K' 'hello'
```

> Model IDs containing `/` or `:` work fine, but quote them on the CLI.

If you select a model that is not loaded on the server, the plugin logs a warning with the currently available models and close-match suggestions.

## How it works

1. On startup, the plugin's `setup` resolves the server URL (option → auto-detection).
2. It discovers models from `/v1/models` and registers the `llama.cpp` provider through `ctx.provider.transform` using the OpenAI-compatible protocol.
3. A `ctx.session.hook("context", ..., { providerID: "llama.cpp" })` validates the selected model against the server's loaded models on each agent request.
4. An optional timer re-discovers models and calls `ctx.provider.reload()` so registry transforms replay with fresh data.
5. On unload, the timer and event subscription are cleaned up.

## Development

```bash
pnpm install
pnpm run validate   # lint + typecheck + tests
```

## License

MIT — see [LICENSE](LICENSE).