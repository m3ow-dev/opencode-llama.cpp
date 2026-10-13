import {Model, Provider} from '@opencode/plugin'
import {categorizeModel, formatModelName} from '../utils'
import {discoverLlamaCppModels} from '../utils/llama-cpp-api'
import type {LlamaCppModel} from '../types'

/**
 * The stable provider ID this plugin registers under.
 */
export const LLAMA_CPP_PROVIDER_ID = 'llama.cpp'

/** npm package implementing the OpenAI-compatible protocol used by llama.cpp. */
const OPENAI_COMPATIBLE_PACKAGE = '@opencode/ai/providers/openai-compatible'

/** Fallback context window for locally served models (llama.cpp does not report limits). */
const DEFAULT_CONTEXT_LIMIT = 32_768
const DEFAULT_OUTPUT_LIMIT = 8_192

/**
 * Convert a discovered llama.cpp model into an immutable OpenCode model definition.
 */
export function toModelInfo(model: LlamaCppModel): Model.Info {
    const providerID = Provider.ID.make(LLAMA_CPP_PROVIDER_ID)
    const modelID = Model.ID.make(model.id)
    const modelType = categorizeModel(model.id)

    const base = Model.Info.default(providerID, modelID)

    const input: string[] = modelType === 'chat' ? ['text'] : ['text']
    const output: string[] = modelType === 'embedding' ? ['embedding'] : ['text']

    return {
        ...base,
        name: formatModelName(model),
        capabilities: {
            tools: modelType === 'chat',
            input,
            output,
        },
        limit: {
            ...base.limit,
            context: DEFAULT_CONTEXT_LIMIT,
            output: modelType === 'embedding' ? 0 : DEFAULT_OUTPUT_LIMIT,
        },
    }
}

/**
 * Build the llama.cpp provider definition including its discovered model inventory.
 */
export function buildProviderRecord(baseURL: string, models: readonly LlamaCppModel[]): {
    info: Provider.Info
    models: readonly Model.Info[]
} {
    const providerID = Provider.ID.make(LLAMA_CPP_PROVIDER_ID)
    const info: Provider.Info = {
        ...Provider.Info.empty(providerID),
        name: 'llama.cpp (local)',
        activation: 'enabled',
        package: OPENAI_COMPATIBLE_PACKAGE,
        settings: {
            baseURL,
        },
    }

    return {
        info,
        models: models.map(toModelInfo),
    }
}

/**
 * Discover the current llama.cpp model inventory and return the provider source
 * entry for `ctx.provider.transform`. Returns null when llama.cpp is unreachable.
 */
export async function loadProviderSource(baseURL: string): Promise<{
    info: Provider.Info
    models: readonly Model.Info[]
} | null> {
    let models: LlamaCppModel[]
    try {
        models = await discoverLlamaCppModels(baseURL)
    } catch {
        return null
    }

    if (models.length === 0) {
        return null
    }

    return buildProviderRecord(`${baseURL.replace(/\/+$/, '')}/v1`, models)
}

/**
 * Re-export discovery for callers that only need the raw model list.
 */
export {discoverLlamaCppModels}