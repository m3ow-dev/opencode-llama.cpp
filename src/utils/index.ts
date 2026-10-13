import type {SimilarModel} from '../types'

export {formatModelName} from './format-model-name'

/**
 * Categorize a model ID as chat, embedding, or unknown based on naming
 * conventions. Used to decide tool capability and input/output modalities.
 */
export function categorizeModel(modelId: string): 'chat' | 'embedding' | 'unknown' {
    const lowerId = modelId.toLowerCase()
    if (lowerId.includes('embedding') || lowerId.includes('embed')) {
        return 'embedding'
    }
    if (lowerId.includes('gpt') || lowerId.includes('llama') ||
        lowerId.includes('claude') || lowerId.includes('qwen') ||
        lowerId.includes('mistral') || lowerId.includes('gemma') ||
        lowerId.includes('phi') || lowerId.includes('falcon')) {
        return 'chat'
    }
    return 'unknown'
}

/**
 * Rank available models by similarity to a target model ID, for
 * suggestions when the selected model is not loaded. Returns the top 5
 * candidates with a similarity score and human-readable reason.
 */
export function findSimilarModels(targetModel: string, availableModels: string[]): SimilarModel[] {
    const target = targetModel.toLowerCase()
    const targetTokens = target.split(/[-_\s]/).filter(Boolean)

    return availableModels
        .map(model => {
            const candidate = model.toLowerCase()
            const candidateTokens = candidate.split(/[-_\s]/).filter(Boolean)

            let similarity = 0
            const reasons: string[] = []

            // Exact match gets highest score
            if (candidate === target) {
                similarity = 1.0
                reasons.push("Exact match")
            }

            // Check for common model family prefixes
            const targetPrefix = targetTokens[0]
            const candidatePrefix = candidateTokens[0]
            if (targetPrefix && candidatePrefix && targetPrefix === candidatePrefix) {
                similarity += 0.5
                reasons.push(`Same family: ${targetPrefix}`)
            }

            // Check for common suffixes (quantization levels, sizes)
            const commonSuffixes = ['3b', '7b', '13b', '70b', 'q4', 'q8', 'instruct', 'chat', 'base']
            for (const suffix of commonSuffixes) {
                if (target.includes(suffix) && candidate.includes(suffix)) {
                    similarity += 0.2
                    reasons.push(`Shared suffix: ${suffix}`)
                }
            }

            // Token overlap score
            const commonTokens = targetTokens.filter(token => candidateTokens.includes(token))
            if (commonTokens.length > 0) {
                similarity += (commonTokens.length / Math.max(targetTokens.length, candidateTokens.length)) * 0.3
                reasons.push(`Common tokens: ${commonTokens.join(', ')}`)
            }

            return {
                model,
                similarity: Math.min(similarity, 1.0),
                reason: reasons.join(", ")
            }
        })
        .filter(item => item.similarity > 0.1) // Only include models with some similarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5) // Top 5 suggestions
}