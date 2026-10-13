/**
 * llama.cpp plugin module map (OpenCode V2 plugin API).
 *
 * - provider-source: builds the llama.cpp provider + model definitions from the
 *   local llama-server `/v1/models` endpoint.
 * - session-hooks: model validation on outgoing requests scoped to llama.cpp.
 */
export {LLAMA_CPP_PROVIDER_ID, buildProviderRecord, loadProviderSource, toModelInfo} from './provider-source'
export {validateModelLoaded} from './session-hooks'
export type {ModelValidationResult} from './session-hooks'