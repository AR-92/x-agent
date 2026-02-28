/**
 * OpenRouter Module for X-Agent
 * 
 * Complete drop-in replacement for @mariozechner/pi-ai when using OpenRouter.
 * Produces identical events with full compatibility.
 * 
 * Features:
 * - All event types (start, text_*, thinking_*, toolcall_*, done, error)
 * - Full tool calling with streaming partial JSON and validation
 * - Thinking/reasoning support
 * - Image/multi-modal support
 * - Context serialization/deserialization
 * - 300+ OpenRouter models
 * - All OpenRouter parameters (temperature, top_p, tool_choice, etc.)
 * - Log probabilities support
 * - Structured outputs
 * - Provider-specific parameters
 * 
 * @example
 * ```javascript
 * import { Agent } from '@mariozechner/x-agent';
 * import { openRouterStream, getModel } from '@mariozechner/x-agent/openrouter';
 * 
 * const agent = new Agent({
 *   initialState: {
 *     systemPrompt: 'You are helpful.',
 *     model: getModel('anthropic/claude-sonnet-4'),
 *   },
 *   streamFn: async (model, context, options) => {
 *     const stream = await openRouterStream({
 *       ...options,
 *       apiKey: 'sk-or-...',
 *       modelId: model.id,
 *       siteUrl: 'https://yoursite.com',
 *       siteName: 'Your Site',
 *     }, context);
 *     return stream;
 *   },
 * });
 * 
 * await agent.prompt('Hello!');
 * ```
 */

// Main stream function (matches pi-ai streamSimple)
export { openRouterStream } from './client.js';

// Event stream (compatible with X-Agent/pi-ai)
export { createOpenRouterStream } from './stream.js';

// Message conversion with full context handling
export {
	convertToOpenRouterMessages,
	convertToOpenRouterTools,
	createAssistantMessage,
	serializeContext,
	deserializeContext,
	thinkingToTextTags,
} from './messages.js';

// Tool validation (matches pi-ai validateToolCall)
export {
	validateToolArguments,
	createToolResult,
	createToolCall,
} from './tools.js';

// Model discovery
export { getModel, getModels, getModelsByProvider, getProviders } from './models.js';
