import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import pluginDefinition from '../src/index'
import {buildProviderRecord, toModelInfo, LLAMA_CPP_PROVIDER_ID} from '../src/plugin/provider-source'
import {validateModelLoaded} from '../src/plugin/session-hooks'
import {normalizeBaseURL} from '../src/utils/llama-cpp-api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

// Mock AbortSignal.timeout for older Node versions
if (!global.AbortSignal.timeout) {
    global.AbortSignal.timeout = vi.fn(() => {
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 3000)
        return controller.signal
    }) as any
}

function mockModelsResponse(models: string[]) {
    return {
        ok: true,
        json: async () => ({
            object: 'list',
            data: models.map((id) => ({id, object: 'model', created: 0, owned_by: 'llama.cpp'})),
        }),
    }
}

describe('llama.cpp plugin (OpenCode V2)', () => {
    let added: Array<{info: any; models: any[]}>
    let registrations: Array<{dispose: () => Promise<void>}>
    let hooks: Array<{name: string; callback: (event: any) => Promise<void> | void; options?: any}>
    let eventIterator: AsyncGenerator<any>

    function makeContext(overrides: Record<string, unknown> = {}) {
        added = []
        registrations = []
        hooks = []

        const ctx: any = {
            options: {},
            location: {directory: '/tmp', project: {id: 'test-project', directory: '/tmp'}},
            provider: {
                transform: async (cb: (editor: any) => void) => {
                    const editor = {
                        add: (entry: any) => added.push(entry),
                        remove: vi.fn(),
                        update: vi.fn(),
                        models: {set: vi.fn(), update: vi.fn(), remove: vi.fn()},
                    }
                    cb(editor)
                    const reg = {dispose: async () => {}}
                    registrations.push(reg)
                    return reg
                },
                reload: vi.fn(async () => {}),
                list: vi.fn(async () => []),
                get: vi.fn(async () => undefined),
            },
            session: {
                hook: async (name: string, callback: any, options?: any) => {
                    hooks.push({name, callback, options})
                    return {dispose: async () => {}}
                },
            },
            event: {
                subscribe: (_opts?: any) => {
                    async function* gen() {
                        // Emit nothing; terminates when the plugin aborts the signal on cleanup
                    }
                    eventIterator = gen()
                    return eventIterator
                },
            },
            ...overrides,
        }
        return ctx
    }

    beforeEach(() => {
        mockFetch.mockReset()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.clearAllTimers()
    })

    describe('plugin definition', () => {
        it('defines a stable plugin id and setup function', () => {
            expect(pluginDefinition.id).toBe('llama-cpp')
            expect(pluginDefinition.setup).toBeTypeOf('function')
        })

        it('registers the llama.cpp provider with discovered models', async () => {
            mockFetch.mockImplementation(async (url: any) => {
                expect(String(url)).toContain('/v1/models')
                return mockModelsResponse(['llama-3.2-3b-instruct']) as any
            })

            const ctx = makeContext()
            const cleanup = await pluginDefinition.setup(ctx)

            expect(added.length).toBeGreaterThan(0)
            const entry = added[0]
            expect(entry.info.id).toBe(LLAMA_CPP_PROVIDER_ID)
            expect(entry.info.package).toContain('openai-compatible')
            expect(entry.info.settings.baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/v1$/)
            expect(entry.models.some((m: any) => m.id === 'llama-3.2-3b-instruct')).toBe(true)

            expect(hooks.some((h) => h.name === 'context' && h.options?.providerID === LLAMA_CPP_PROVIDER_ID)).toBe(true)

            expect(cleanup).toBeTypeOf('function')
            await cleanup!()
        })

        it('does not register a provider when llama.cpp is unreachable', async () => {
            mockFetch.mockImplementation(async () => {
                throw new Error('connect ECONNREFUSED')
            })

            const ctx = makeContext()
            const cleanup = await pluginDefinition.setup(ctx)

            expect(added.length).toBe(0)
            expect(cleanup).toBeTypeOf('function')
            await cleanup!()
        })

        it('uses baseURL from plugin options when provided', async () => {
            mockFetch.mockImplementation(async () => mockModelsResponse(['mistral-7b']) as any)

            const ctx = makeContext({options: {baseURL: 'http://localhost:9999/v1'}})
            const cleanup = await pluginDefinition.setup(ctx)

            expect(added.length).toBeGreaterThan(0)
            expect(added[0].info.settings.baseURL).toBe('http://localhost:9999/v1')
            await cleanup!()
        })
    })

    describe('model validation hook', () => {
        it('reports success when the model is loaded', async () => {
            mockFetch.mockImplementation(async () => mockModelsResponse(['llama-3.2-3b-instruct']) as any)

            const result = await validateModelLoaded('http://127.0.0.1:1234', 'llama-3.2-3b-instruct')
            expect(result.status).toBe('success')
            expect(result.availableModels).toContain('llama-3.2-3b-instruct')
        })

        it('reports error with suggestions when the model is not loaded', async () => {
            mockFetch.mockImplementation(async () => mockModelsResponse(['llama-3.1-8b-instruct']) as any)

            // Distinct port: the module-level status cache is keyed by URL and shared across tests
            const result = await validateModelLoaded('http://127.0.0.1:2234', 'llama-3.2-3b-instruct')
            expect(result.status).toBe('error')
            expect(result.availableModels).toEqual(['llama-3.1-8b-instruct'])
            expect(result.similarModels.length).toBeGreaterThan(0)
            expect(result.similarModels[0].model).toBe('llama-3.1-8b-instruct')
        })

        it('handles a failing llama.cpp server gracefully', async () => {
            mockFetch.mockImplementation(async () => {
                throw new Error('network down')
            })

            // Distinct port so the status cache does not return earlier tests' data
            const result = await validateModelLoaded('http://127.0.0.1:3234', 'some-model')
            expect(result.status).toBe('error')
            expect(result.message).toContain('llama.cpp server')
        })

        it('warns through the registered context hook when validation fails', async () => {
            mockFetch.mockImplementation(async () => mockModelsResponse(['llama-3.1-8b']) as any)

            const ctx = makeContext()
            const cleanup = await pluginDefinition.setup(ctx)

            const contextHook = hooks.find((h) => h.name === 'context')
            expect(contextHook).toBeDefined()

            await contextHook!.callback({sessionID: 's1', model: {id: 'missing-model', providerID: 'llama.cpp'}})

            await cleanup!()
        })
    })

    describe('provider source', () => {
        it('builds model definitions with sensible defaults', () => {
            const info = toModelInfo({id: 'llama-3.2-3b-instruct', object: 'model', created: 0, owned_by: 'llama.cpp'})
            expect(info.providerID).toBe(LLAMA_CPP_PROVIDER_ID)
            expect(info.id).toBe('llama-3.2-3b-instruct')
            expect(info.capabilities.tools).toBe(true)
            expect(info.limit.context).toBeGreaterThan(0)
        })

        it('marks embedding models as non-tool models', () => {
            const info = toModelInfo({id: 'nomic-embed-text', object: 'model', created: 0, owned_by: 'llama.cpp'})
            expect(info.capabilities.tools).toBe(false)
            expect(info.capabilities.output).toEqual(['embedding'])
        })

        it('builds a provider record with OpenAI-compatible settings', () => {
            const record = buildProviderRecord('http://127.0.0.1:1234/v1', [
                {id: 'llama-3.2-3b-instruct', object: 'model', created: 0, owned_by: 'llama.cpp'},
            ])
            expect(record.info.name).toContain('llama.cpp')
            expect(record.info.activation).toBe('enabled')
            expect(record.models.length).toBe(1)
        })
    })

    describe('URL normalization', () => {
        it('strips trailing slashes and /v1 suffixes', () => {
            expect(normalizeBaseURL('http://127.0.0.1:1234/')).toBe('http://127.0.0.1:1234')
            expect(normalizeBaseURL('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234')
            expect(normalizeBaseURL('http://127.0.0.1:1234/v1/')).toBe('http://127.0.0.1:1234')
        })
    })
})