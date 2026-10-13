import {ModelStatusCache} from '../cache/model-status-cache'
import {findSimilarModels} from '../utils'
import {fetchLlamaCppModelsDirect} from '../utils/llama-cpp-api'

const modelStatusCache = new ModelStatusCache()

export interface ModelValidationResult {
    status: 'success' | 'error'
    model: string
    availableModels: string[]
    message: string
    similarModels: Array<{
        model: string
        similarity: number
        reason: string
    }>
}

/**
 * Validate that the model selected for an outgoing llama.cpp request is
 * actually loaded on the local server. Returns diagnostics the caller can log.
 */
export async function validateModelLoaded(baseURL: string, modelID: string): Promise<ModelValidationResult> {
    let loadedModels: string[] = []
    try {
        loadedModels = await modelStatusCache.getModels(baseURL, () =>
            fetchLlamaCppModelsDirect(baseURL),
        )
    } catch (error) {
        return {
            status: 'error',
            model: modelID,
            availableModels: [],
            message: `Failed to query llama.cpp server: ${error instanceof Error ? error.message : String(error)}`,
            similarModels: [],
        }
    }

    // fetchLlamaCppModelsDirect swallows transport errors and returns []. An empty
    // list means the server is unreachable or has no usable models loaded.
    if (loadedModels.length === 0) {
        return {
            status: 'error',
            model: modelID,
            availableModels: [],
            message: `No models available on the llama.cpp server at ${baseURL}. Is llama-server running with a model loaded?`,
            similarModels: [],
        }
    }

    if (!loadedModels.includes(modelID)) {
        const suggestions = findSimilarModels(modelID, loadedModels)
        return {
            status: 'error',
            model: modelID,
            availableModels: loadedModels,
            message: `Model '${modelID}' is not loaded on the llama.cpp server. Check loaded models with the llama-server CLI.`,
            similarModels: suggestions.map((s) => ({
                model: s.model,
                similarity: Math.round(s.similarity * 100),
                reason: s.reason,
            })),
        }
    }

    return {
        status: 'success',
        model: modelID,
        availableModels: loadedModels,
        message: `Model '${modelID}' is loaded and ready.`,
        similarModels: [],
    }
}