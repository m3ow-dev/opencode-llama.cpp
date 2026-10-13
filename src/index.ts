import {Plugin} from '@opencode/plugin'
import {autoDetectLlamaCpp, checkLlamaCppHealth, discoverLlamaCppModels, normalizeBaseURL} from './utils/llama-cpp-api'
import {buildProviderRecord, LLAMA_CPP_PROVIDER_ID} from './plugin/provider-source'
import {validateModelLoaded} from './plugin/session-hooks'
import type {Model} from '@opencode/plugin'

/** Plugin options (pass via `plugins` in opencode.jsonc). */
export interface LlamaCppPluginOptions {
    /** Base URL of the llama.cpp server, e.g. "http://127.0.0.1:1234". Auto-detected when omitted. */
    baseURL?: string
    /** Poll interval for model discovery refresh, in milliseconds. Default 60000. */
    refreshIntervalMs?: number
    /** Disable periodic refresh entirely. */
    refreshDisabled?: boolean
}

interface ProviderSource {
    info: ReturnType<typeof buildProviderRecord>['info']
    models: readonly Model.Info[]
}

const DEFAULT_REFRESH_INTERVAL_MS = 60_000

export default Plugin.define({
    id: 'llama-cpp',
    async setup(ctx) {
        const options = (ctx.options ?? {}) as LlamaCppPluginOptions
        console.log('[opencode-llama-cpp] llama.cpp plugin initialized')

        // Resolve the llama.cpp server URL: explicit option first, then auto-detection.
        let baseURL = options.baseURL ? normalizeBaseURL(options.baseURL) : null
        if (!baseURL) {
            baseURL = await autoDetectLlamaCpp()
        }

        if (!baseURL || !(await checkLlamaCppHealth(baseURL))) {
            console.warn('[opencode-llama-cpp] No running llama.cpp server detected; provider not registered. Start llama-server and reload OpenCode.')
        }

        // Captured source state for the provider transform. The refresh timer
        // updates `source` and calls `ctx.provider.reload()`, which replays the
        // transform onto fresh registry state.
        const source: {current: ProviderSource | null} = {current: null}

        if (baseURL) {
            const models = await safeDiscover(baseURL)
            if (models.length > 0) {
                source.current = buildProviderRecord(`${baseURL}/v1`, models)
            }
        }

        // Register the llama.cpp provider and its model inventory. Transforms are
        // replayable, so this also runs again on every `provider.reload()`.
        await ctx.provider.transform((editor) => {
            if (source.current) {
                editor.add({info: source.current.info, models: source.current.models})
            }
        })

        // Validate the selected model on every agent loop request scoped to the
        // llama.cpp provider, warning when it is not loaded locally.
        if (baseURL) {
            await ctx.session.hook('context', async (event) => {
                const result = await validateModelLoaded(baseURL!, event.model.id)
                if (result.status === 'error') {
                    console.warn('[opencode-llama-cpp] Model validation failed', {
                        model: result.model,
                        message: result.message,
                        availableModels: result.availableModels,
                        similarModels: result.similarModels,
                    })
                }
            }, {providerID: LLAMA_CPP_PROVIDER_ID})
        }

        // Periodically refresh the model inventory while llama.cpp models
        // change (load/unload) without restarting OpenCode.
        let refreshTimer: ReturnType<typeof setInterval> | undefined
        if (baseURL && !options.refreshDisabled) {
            const interval = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS
            refreshTimer = setInterval(() => {
                void (async () => {
                    try {
                        if (!(await checkLlamaCppHealth(baseURL!))) {
                            return
                        }
                        const models = await safeDiscover(baseURL!)
                        if (models.length === 0) {
                            return
                        }
                        source.current = buildProviderRecord(`${baseURL!}/v1`, models)
                        await ctx.provider.reload()
                    } catch (error) {
                        console.warn('[opencode-llama-cpp] Model refresh failed', {
                            error: error instanceof Error ? error.message : String(error),
                        })
                    }
                })()
            }, interval)
        }

        // Monitor the public event stream (replaces the V1 `event` hook).
        const eventController = new AbortController()
        void (async () => {
            try {
                for await (const event of ctx.event.subscribe({signal: eventController.signal})) {
                    if (event.type === 'session.created' || event.type === 'session.metadata.updated') {
                        // llama.cpp availability is validated per request; nothing to act on yet.
                    }
                }
            } catch {
                // Ignore abort on shutdown
            }
        })()

        console.log(`[opencode-llama-cpp] Registered provider "llama.cpp"${source.current ? ` with ${source.current.models.length} model(s)` : ''}`)

        // Cleanup: stop refresh timer and the event subscription.
        return () => {
            if (refreshTimer) {
                clearInterval(refreshTimer)
            }
            eventController.abort()
        }
    },
})

async function safeDiscover(baseURL: string): Promise<ReturnType<typeof discoverLlamaCppModels>> {
    try {
        return await discoverLlamaCppModels(baseURL)
    } catch {
        return []
    }
}

// Backwards-compatible named export for programmatic use.
export {validateModelLoaded} from './plugin/session-hooks'
export {LLAMA_CPP_PROVIDER_ID}