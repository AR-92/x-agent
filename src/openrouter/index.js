/**
 * OpenRouter Module for X-Agent
 * 
 * Drop-in replacement for pi-ai when using OpenRouter.
 * Provides the same event streaming interface with full compatibility.
 * 
 * @example
 * ```javascript
 * import { Agent } from '@mariozechner/x-agent';
 * import { createOpenRouterStreamFn, getModel } from './src/openrouter/index.js';
 * 
 * const agent = new Agent({
 *   initialState: {
 *     systemPrompt: 'You are a helpful assistant.',
 *     model: getModel('anthropic/claude-sonnet-4'),
 *   },
 *   streamFn: createOpenRouterStreamFn({
 *     apiKey: 'sk-or-...',
 *     siteUrl: 'https://yoursite.com',
 *     siteName: 'Your Site',
 *   }),
 * });
 * 
 * await agent.prompt('Hello!');
 * ```
 */

// Core stream function
export { createOpenRouterStreamFn } from './client.js';

// Event stream (compatible with X-Agent)
export { createOpenRouterStream } from './stream.js';

// Message conversion utilities
export {
	convertToOpenRouterMessages,
	convertToOpenRouterTools,
	createAssistantMessage,
} from './messages.js';

// Tool validation
export { validateToolArguments } from './tools.js';

// Model helpers
export { getModel, getModels } from './models.js';
