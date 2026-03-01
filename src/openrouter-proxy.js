/**
 * OpenRouter Proxy Client for X-Agent
 *
 * A drop-in proxy client that handles all LLM communication with OpenRouter.
 * Use this instead of pi-ai when you want to use OpenRouter directly.
 *
 * Features:
 * - Model routing (300+ OpenRouter models)
 * - API authentication
 * - Request formatting
 * - Streaming response parsing
 * - Tool call handling with partial JSON
 * - Event formatting (compatible with X-Agent)
 * - Thinking/reasoning support
 *
 * @example
 * ```javascript
 * import { Agent } from '@mariozechner/x-agent';
 * import { createOpenRouterStream } from './openrouter-proxy.js';
 *
 * const agent = new Agent({
 *   streamFn: createOpenRouterStream,
 * });
 * ```
 */

import { createLogger } from './logger.js';

const log = createLogger('OpenRouterProxy');

/**
 * @typedef {Object} OpenRouterOptions
 * @property {string} apiKey - OpenRouter API key (sk-or-...)
 * @property {string} [siteUrl] - Your site URL for OpenRouter ranking
 * @property {string} [siteName] - Your site name for OpenRouter ranking
 * @property {string} [proxyUrl] - Optional CORS proxy URL
 * @property {Record<string, string>} [headers] - Additional headers
 */

/**
 * @typedef {Object} OpenRouterMessage
 * @property {'user' | 'assistant' | 'system' | 'tool'} role
 * @property {string | OpenRouterContent[]} content
 * @property {string} [name]
 * @property {string} [tool_call_id]
 * @property {OpenRouterToolCall[]} [tool_calls]
 */

/**
 * @typedef {Object} OpenRouterContent
 * @property {'text' | 'image_url'} type
 * @property {string} [text]
 * @property {{url: string}} [image_url]
 */

/**
 * @typedef {Object} OpenRouterTool
 * @property {'function'} type
 * @property {OpenRouterFunction} function
 */

/**
 * @typedef {Object} OpenRouterFunction
 * @property {string} name
 * @property {string} description
 * @property {Object} parameters
 */

/**
 * @typedef {Object} OpenRouterToolCall
 * @property {string} id
 * @property {'function'} type
 * @property {OpenRouterFunctionCall} function
 */

/**
 * @typedef {Object} OpenRouterFunctionCall
 * @property {string} name
 * @property {string} arguments
 */

/**
 * @typedef {Object} OpenRouterUsage
 * @property {number} prompt_tokens
 * @property {number} completion_tokens
 * @property {number} total_tokens
 * @property {number} [prompt_tokens_details]
 * @property {number} [completion_tokens_details]
 */

/**
 * @typedef {Object} OpenRouterDelta
 * @property {string} [content]
 * @property {OpenRouterToolCall[]} [tool_calls]
 * @property {string} [reasoning]
 */

/**
 * @typedef {Object} OpenRouterChunk
 * @property {OpenRouterChoice[]} choices
 * @property {OpenRouterUsage} [usage]
 */

/**
 * @typedef {Object} OpenRouterChoice
 * @property {OpenRouterDelta} delta
 * @property {string | null} finish_reason
 * @property {number} index
 */

// =============================================================================
// Event Stream Class (Compatible with X-Agent)
// =============================================================================

/**
 * Simple event stream implementation compatible with X-Agent
 */
class EventStream {
  constructor() {
    this._listeners = new Set();
    this._result = null;
    this._resultResolver = null;
    this._resultPromise = new Promise((resolve) => {
      this._resultResolver = resolve;
    });
  }

  /**
   * Push an event to all listeners
   * @param {any} event
   */
  push(event) {
    for (const listener of this._listeners) {
      listener(event);
    }

    // Handle terminal events
    if (event.type === 'done' || event.type === 'error') {
      this._result = event.type === 'done' ? event.message : event.error;
      this._resultResolver(this._result);
    }
  }

  /**
   * Subscribe to events
   * @param {(event: any) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Get the final result
   * @returns {Promise<any>}
   */
  async result() {
    return this._resultPromise;
  }

  /**
   * Async iterator support
   */
  async *[Symbol.asyncIterator]() {
    const queue = [];
    let done = false;

    const unsubscribe = this.subscribe((event) => {
      queue.push(event);
      if (event.type === 'done' || event.type === 'error') {
        done = true;
      }
    });

    try {
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));
          continue;
        }
        yield queue.shift();
      }
    } finally {
      unsubscribe();
    }
  }
}

// =============================================================================
// Main OpenRouter Stream Function
// =============================================================================

/**
 * Create an OpenRouter stream function for X-Agent
 * 
 * @param {OpenRouterOptions} options - OpenRouter configuration
 * @returns {Function} Stream function compatible with X-Agent
 */
export function createOpenRouterStream(options) {
  const {
    apiKey,
    siteUrl,
    siteName,
    proxyUrl,
    headers = {},
  } = options;

  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  const baseUrl = proxyUrl || 'https://openrouter.ai/api/v1';

  /**
   * Stream function that X-Agent will call
   * 
   * @param {Object} model - Model configuration
   * @param {Object} context - Agent context
   * @param {Object} streamOptions - Stream options
   * @returns {Promise<EventStream>}
   */
  return async function openRouterStream(model, context, streamOptions) {
    const stream = new EventStream();

    // Convert X-Agent messages to OpenRouter format
    const openRouterMessages = convertMessages(context.messages, context.systemPrompt);
    
    // Convert X-Agent tools to OpenRouter format
    const openRouterTools = context.tools?.length > 0 ? convertTools(context.tools) : undefined;

    // Build request body
    const requestBody = {
      model: model.id,
      messages: openRouterMessages,
      tools: openRouterTools,
      stream: true,
      temperature: streamOptions.temperature,
      max_tokens: streamOptions.maxTokens,
      // OpenRouter-specific options
      transforms: ['middle-out'], // Compress long contexts
      ...(siteUrl && { site_url: siteUrl }),
      ...(siteName && { site_name: siteName }),
      ...(model.provider === 'openrouter' && { provider: { order: [model.id] } }),
    };

    // Add reasoning/thinking support for compatible models
    if (streamOptions.reasoning) {
      requestBody.include_reasoning = true;
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': siteUrl || 'https://github.com/badlogic/x-agent',
          'X-Title': siteName || 'X-Agent',
          ...headers,
        },
        body: JSON.stringify(requestBody),
        signal: streamOptions.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`OpenRouter error: ${error.error?.message || response.statusText}`);
      }

      // Process SSE stream
      await processStream(response.body, stream);

    } catch (error) {
      if (error.name === 'AbortError') {
        const errorMsg = createAssistantMessage('', 'aborted');
        errorMsg.errorMessage = 'Request aborted';
        stream.push({ type: 'error', reason: 'aborted', error: errorMsg });
      } else {
        const errorMsg = createAssistantMessage('', 'error');
        errorMsg.errorMessage = error.message;
        stream.push({ type: 'error', reason: 'error', error: errorMsg });
      }
    }

    return stream;
  };
}

// =============================================================================
// Message Conversion
// =============================================================================

/**
 * Convert X-Agent messages to OpenRouter format
 * 
 * @param {any[]} messages - X-Agent messages
 * @param {string} systemPrompt - System prompt
 * @returns {OpenRouterMessage[]}
 */
function convertMessages(messages, systemPrompt) {
  const openRouterMessages = [];

  // Add system prompt first
  if (systemPrompt) {
    openRouterMessages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      openRouterMessages.push({
        role: 'user',
        content: convertUserContent(msg.content),
      });
    } else if (msg.role === 'assistant') {
      const assistantMsg = {
        role: 'assistant',
        content: [],
      };

      for (const block of msg.content) {
        if (block.type === 'text') {
          assistantMsg.content.push({ type: 'text', text: block.text });
        } else if (block.type === 'toolCall') {
          if (!assistantMsg.tool_calls) {
            assistantMsg.tool_calls = [];
          }
          assistantMsg.tool_calls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.arguments),
            },
          });
        }
      }

      // If only text content, use string instead of array
      if (assistantMsg.content.length === 1 && assistantMsg.content[0].type === 'text') {
        assistantMsg.content = assistantMsg.content[0].text;
      } else if (assistantMsg.content.length === 0) {
        assistantMsg.content = null;
      }

      openRouterMessages.push(assistantMsg);
    } else if (msg.role === 'toolResult') {
      openRouterMessages.push({
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content?.filter((c) => c.type === 'text').map((c) => c.text).join('\n') || '',
      });
    }
  }

  return openRouterMessages;
}

/**
 * Convert user content to OpenRouter format
 * 
 * @param {any} content - User content
 * @returns {string | OpenRouterContent[]}
 */
function convertUserContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      } else if (block.type === 'image') {
        return {
          type: 'image_url',
          image_url: {
            url: block.data.startsWith('http') 
              ? block.data 
              : `data:${block.mimeType};base64,${block.data}`,
          },
        };
      }
      return block;
    });
  }

  return String(content);
}

// =============================================================================
// Tool Conversion
// =============================================================================

/**
 * Convert X-Agent tools to OpenRouter format
 * 
 * @param {any[]} tools - X-Agent tools
 * @returns {OpenRouterTool[]}
 */
function convertTools(tools) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// =============================================================================
// Stream Processing
// =============================================================================

/**
 * Process SSE stream from OpenRouter
 * 
 * @param {ReadableStream} body - Response body stream
 * @param {EventStream} stream - Event stream to push events to
 */
async function processStream(body, stream) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Track partial message for building up the response
  const partialMessage = createAssistantMessage('');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === 'data: [DONE]') {
        continue;
      }

      if (trimmedLine.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(trimmedLine.slice(6));
          processChunk(chunk, stream, partialMessage);
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

/**
 * Process a single SSE chunk
 * 
 * @param {OpenRouterChunk} chunk - SSE chunk
 * @param {EventStream} stream - Event stream
 * @param {any} partialMessage - Partial message being built
 */
function processChunk(chunk, stream, partialMessage) {
  const choice = chunk.choices?.[0];
  if (!choice) return;

  const delta = choice.delta;
  const finishReason = choice.finish_reason;

  // Handle reasoning/thinking
  if (delta.reasoning) {
    if (!partialMessage.content.some((c) => c.type === 'thinking')) {
      partialMessage.content.push({ type: 'thinking', thinking: '' });
      stream.push({
        type: 'thinking_start',
        contentIndex: partialMessage.content.length - 1,
        partial: { ...partialMessage },
      });
    }

    const thinkingBlock = partialMessage.content.find((c) => c.type === 'thinking');
    if (thinkingBlock) {
      const prevThinking = thinkingBlock.thinking;
      thinkingBlock.thinking += delta.reasoning;
      
      stream.push({
        type: 'thinking_delta',
        contentIndex: partialMessage.content.findIndex((c) => c.type === 'thinking'),
        delta: delta.reasoning,
        partial: { ...partialMessage },
      });
    }
  }

  // Handle text content
  if (delta.content !== undefined) {
    if (delta.content && !partialMessage.content.some((c) => c.type === 'text')) {
      partialMessage.content.push({ type: 'text', text: '' });
      stream.push({
        type: 'text_start',
        contentIndex: partialMessage.content.length - 1,
        partial: { ...partialMessage },
      });
    }

    const textBlock = partialMessage.content.find((c) => c.type === 'text');
    if (textBlock && delta.content) {
      textBlock.text += delta.content;
      
      stream.push({
        type: 'text_delta',
        contentIndex: partialMessage.content.findIndex((c) => c.type === 'text'),
        delta: delta.content,
        partial: { ...partialMessage },
      });
    }
  }

  // Handle tool calls
  if (delta.tool_calls) {
    for (const toolDelta of delta.tool_calls) {
      const index = toolDelta.index ?? 0;

      // Ensure we have enough tool call slots
      while (partialMessage.content.length <= index) {
        partialMessage.content.push({ type: 'toolCall', id: '', name: '', arguments: {}, partialJson: '' });
      }

      const existingToolCall = partialMessage.content[index];

      // Handle tool call start
      if (toolDelta.id && !existingToolCall.id) {
        existingToolCall.id = toolDelta.id;
        existingToolCall.name = toolDelta.function?.name || '';
        existingToolCall.arguments = {};
        existingToolCall.partialJson = '';

        stream.push({
          type: 'toolcall_start',
          contentIndex: index,
          id: toolDelta.id,
          toolName: toolDelta.function?.name || '',
          partial: { ...partialMessage },
        });
      }

      // Handle tool call arguments delta
      if (toolDelta.function?.arguments) {
        existingToolCall.partialJson += toolDelta.function.arguments;
        
        try {
          existingToolCall.arguments = JSON.parse(existingToolCall.partialJson) || {};
        } catch (e) {
          // Partial JSON, keep accumulating
        }

        stream.push({
          type: 'toolcall_delta',
          contentIndex: index,
          delta: toolDelta.function.arguments,
          partial: { ...partialMessage },
        });
      }

      // Handle tool call end (when finish_reason is tool_calls)
      if (finishReason === 'tool_calls') {
        stream.push({
          type: 'toolcall_end',
          contentIndex: index,
          toolCall: {
            id: existingToolCall.id,
            type: 'function',
            name: existingToolCall.name,
            arguments: existingToolCall.arguments,
          },
          partial: { ...partialMessage },
        });
      }
    }
  }

  // Handle stream end
  if (finishReason) {
    partialMessage.stopReason = finishReason === 'tool_calls' ? 'toolUse' : finishReason;

    if (chunk.usage) {
      partialMessage.usage = {
        input: chunk.usage.prompt_tokens || 0,
        output: chunk.usage.completion_tokens || 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: chunk.usage.total_tokens || 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      };
    }

    if (finishReason === 'stop' || finishReason === 'tool_calls' || finishReason === 'length') {
      stream.push({
        type: 'done',
        reason: partialMessage.stopReason,
        message: { ...partialMessage },
      });
    } else if (finishReason === 'error') {
      stream.push({
        type: 'error',
        reason: 'error',
        error: { ...partialMessage, errorMessage: 'Unknown error' },
      });
    }
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create an empty assistant message
 * 
 * @param {string} text - Initial text
 * @param {string} [stopReason] - Stop reason
 * @returns {any}
 */
function createAssistantMessage(text = '', stopReason = 'stop') {
  return {
    role: 'assistant',
    content: text ? [{ type: 'text', text }] : [],
    api: 'openrouter-chat',
    provider: 'openrouter',
    model: 'openrouter',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Model Helpers (Optional - for model discovery)
// =============================================================================

/**
 * Get a model configuration for OpenRouter
 * 
 * @param {string} modelId - OpenRouter model ID (e.g., 'anthropic/claude-sonnet-4')
 * @returns {Object} Model object for X-Agent
 */
export function getModel(modelId) {
  return {
    id: modelId,
    provider: 'openrouter',
    name: modelId.split('/')[1] || modelId,
  };
}

/**
 * Get all available OpenRouter models
 * Fetches from OpenRouter API
 * 
 * @returns {Promise<Object[]>} List of available models
 */
export async function getModels() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    const data = await response.json();
    return data.data?.map((model) => ({
      id: model.id,
      provider: 'openrouter',
      name: model.name,
      contextWindow: model.context_length,
      pricing: model.pricing,
    })) || [];
  } catch (e) {
    log.error('Failed to fetch OpenRouter models:', e);
    return [];
  }
}

// =============================================================================
// Exports
// =============================================================================

export {
  createOpenRouterStream,
  getModel,
  getModels,
  EventStream,
};
