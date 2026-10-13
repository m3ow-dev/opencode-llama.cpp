// Core types for the llama.cpp plugin

/** A model entry from llama.cpp's OpenAI-compatible /v1/models endpoint. */
export interface LlamaCppModel {
    id: string
    object: string
    created: number
    owned_by: string
}

/** Response shape of llama.cpp's /v1/models endpoint. */
export interface LlamaCppModelsResponse {
    object: string
    data: LlamaCppModel[]
}

/** A similarity-ranked suggestion for a missing model. */
export interface SimilarModel {
    model: string
    similarity: number
    reason: string
}