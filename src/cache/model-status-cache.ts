// Model Status Cache for reducing API calls.
// Keyed by base URL; falls back to stale data when a refresh fails.
export class ModelStatusCache {
    private cache = new Map<string, {
        models: string[]
        timestamp: number
        ttl: number
    }>()

    private readonly DEFAULT_TTL = 15000 // 15 seconds
    private readonly MAX_CACHE_SIZE = 50 // Prevent memory leaks
    private readonly MAX_STALE_FACTOR = 5 // Drop entries older than 5x TTL

    // Get cached model status or fetch fresh data.
    // On fetch failure, falls back to stale cached data if it exists.
    async getModels(baseURL: string, fetchFn: () => Promise<string[]>): Promise<string[]> {
        const now = Date.now()
        const cached = this.cache.get(baseURL)

        // Return cached data if still valid
        if (cached && (now - cached.timestamp) < cached.ttl) {
            return cached.models
        }

        try {
            const models = await fetchFn()

            this.cache.set(baseURL, {
                models: [...models], // Copy to prevent mutation of cached data
                timestamp: now,
                ttl: this.DEFAULT_TTL
            })

            if (this.cache.size > this.MAX_CACHE_SIZE) {
                this.cleanup(now)
            }

            return models
        } catch (error) {
            if (cached) {
                const age = now - cached.timestamp
                console.warn('[opencode-llama-cpp] Using stale cache data due to fetch error', {
                    baseURL,
                    age,
                    error: error instanceof Error ? error.message : String(error)
                })
                if (age > cached.ttl * this.MAX_STALE_FACTOR) {
                    this.cache.delete(baseURL)
                }
                return cached.models
            }
            throw error
        }
    }

    // Drop entries older than 5x TTL to prevent memory leaks.
    private cleanup(now: number): void {
        for (const [baseURL, data] of this.cache.entries()) {
            if (now - data.timestamp > data.ttl * this.MAX_STALE_FACTOR) {
                this.cache.delete(baseURL)
            }
        }
    }
}