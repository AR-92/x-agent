/**
 * @typedef {import("@mariozechner/pi-ai").AssistantMessageEvent} AssistantMessageEvent
 * @typedef {import("@mariozechner/pi-ai").ImageContent} ImageContent
 * @typedef {import("@mariozechner/pi-ai").Message} Message
 * @typedef {import("@mariozechner/pi-ai").Model} Model
 * @typedef {import("@mariozechner/pi-ai").SimpleStreamOptions} SimpleStreamOptions
 * @typedef {import("@mariozechner/pi-ai").streamSimple} streamSimple
 * @typedef {import("@mariozechner/pi-ai").TextContent} TextContent
 * @typedef {import("@mariozechner/pi-ai").Tool} Tool
 * @typedef {import("@mariozechner/pi-ai").ToolResultMessage} ToolResultMessage
 * @typedef {import("@sinclair/typebox").Static} Static
 * @typedef {import("@sinclair/typebox").TSchema} TSchema
 */

/**
 * Stream function - can return sync or Promise for async config lookup
 * @callback StreamFn
 * @param  {...any} args
 * @returns {ReturnType<typeof streamSimple> | Promise<ReturnType<typeof streamSimple>>}
 */

/**
 * @typedef {Object} AgentLoopConfig
 * @property {Model<any>} model
 * @property {(messages: AgentMessage[]) => Message[] | Promise<Message[]>} convertToLlm - Converts AgentMessage[] to LLM-compatible Message[]
 * @property {(messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>} [transformContext] - Optional transform for context
 * @property {(provider: string) => Promise<string | undefined> | string | undefined} [getApiKey] - Resolve API key dynamically
 * @property {() => Promise<AgentMessage[]>} [getSteeringMessages] - Returns steering messages
 * @property {() => Promise<AgentMessage[]>} [getFollowUpMessages] - Returns follow-up messages
 * @property {string} [sessionId]
 * @property {string} [transport]
 * @property {import("@mariozechner/pi-ai").ThinkingBudgets} [thinkingBudgets]
 * @property {number} [maxRetryDelayMs]
 */

/**
 * Thinking/reasoning level for models that support it
 * @typedef {"off" | "minimal" | "low" | "medium" | "high" | "xhigh"} ThinkingLevel
 */

/**
 * Extensible interface for custom app messages
 * @typedef {Object} CustomAgentMessages
 */

/**
 * AgentMessage union type
 * @typedef {Message | CustomAgentMessages[keyof CustomAgentMessages]} AgentMessage
 */

/**
 * Agent state
 * @typedef {Object} AgentState
 * @property {string} systemPrompt
 * @property {Model<any>} model
 * @property {ThinkingLevel} thinkingLevel
 * @property {AgentTool<any>[]} tools
 * @property {AgentMessage[]} messages
 * @property {boolean} isStreaming
 * @property {AgentMessage | null} streamMessage
 * @property {Set<string>} pendingToolCalls
 * @property {string} [error]
 */

/**
 * @template {TSchema} [T=any]
 * @typedef {Object} AgentToolResult
 * @property {(TextContent | ImageContent)[]} content
 * @property {T} details
 */

/**
 * Callback for streaming tool execution updates
 * @callback AgentToolUpdateCallback
 * @param {any} partialResult
 */

/**
 * AgentTool extends Tool but adds the execute function
 * @template {TSchema} [TParameters=any]
 * @template [TDetails=any]
 * @typedef {Tool<TParameters> & {
 *   label: string,
 *   execute: (
 *     toolCallId: string,
 *     params: any,
 *     signal?: AbortSignal,
 *     onUpdate?: AgentToolUpdateCallback<TDetails>
 *   ) => Promise<AgentToolResult<TDetails>>
 * }} AgentTool
 */

/**
 * AgentContext
 * @typedef {Object} AgentContext
 * @property {string} systemPrompt
 * @property {AgentMessage[]} messages
 * @property {AgentTool<any>[]} [tools]
 */

/**
 * Events emitted by the Agent
 * @typedef {Object} AgentEvent
 * @property {string} type
 */

/**
 * @typedef {
 *   { type: "agent_start" } |
 *   { type: "agent_end", messages: AgentMessage[] } |
 *   { type: "turn_start" } |
 *   { type: "turn_end", message: AgentMessage, toolResults: ToolResultMessage[] } |
 *   { type: "message_start", message: AgentMessage } |
 *   { type: "message_update", message: AgentMessage, assistantMessageEvent: AssistantMessageEvent } |
 *   { type: "message_end", message: AgentMessage } |
 *   { type: "tool_execution_start", toolCallId: string, toolName: string, args: any } |
 *   { type: "tool_execution_update", toolCallId: string, toolName: string, args: any, partialResult: any } |
 *   { type: "tool_execution_end", toolCallId: string, toolName: string, result: any, isError: boolean }
 * } AgentEventType
 */

export {};
