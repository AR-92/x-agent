/**
 * OpenRouter API Client
 * Handles communication with OpenRouter API
 */

import { createOpenRouterStream } from './stream.js';
import { convertToOpenRouterMessages, convertToOpenRouterTools, createAssistantMessage } from './messages.js';

/**
 * OpenRouter API configuration
 * @typedef {Object} OpenRouterConfig
 * @property {string} apiKey - OpenRouter API key
 * @property {string} [baseUrl] - API base URL (default: https://openrouter.ai/api/v1)
 * @property {string} [siteUrl] - Site URL for OpenRouter ranking
 * @property {string} [siteName] - Site name for OpenRouter ranking
 * @property {Record<string, string>} [headers] - Additional headers
 */

/**
 * Create OpenRouter stream function for X-Agent
 * 
 * @param {OpenRouterConfig} config - OpenRouter configuration
 * @returns {Function} Stream function compatible with X-Agent
 */
export function createOpenRouterStreamFn(config) {
	const {
		apiKey,
		baseUrl = 'https://openrouter.ai/api/v1',
		siteUrl,
		siteName,
		headers = {},
	} = config;

	if (!apiKey) {
		throw new Error('OpenRouter API key is required');
	}

	/**
	 * Stream function that X-Agent will call
	 * 
	 * @param {any} model - Model configuration
	 * @param {any} context - Agent context (messages, tools, systemPrompt)
	 * @param {any} options - Stream options (temperature, maxTokens, signal, etc.)
	 * @returns {Promise<any>} Event stream
	 */
	return async function openRouterStream(model, context, options) {
		const stream = createOpenRouterStream();

		// Convert messages and tools to OpenRouter format
		const openRouterMessages = convertToOpenRouterMessages(context.messages, context.systemPrompt);
		const openRouterTools = context.tools?.length > 0 ? convertToOpenRouterTools(context.tools) : undefined;

		// Build request body
		const requestBody = {
			model: model.id,
			message: openRouterMessages,
			tools: openRouterTools,
			stream: true,
			temperature: options.temperature,
			max_tokens: options.maxTokens,
			// OpenRouter-specific options
			transforms: ['middle-out'], // Compress long contexts
			...(siteUrl && { site_url: siteUrl }),
			...(siteName && { site_name: siteName }),
		};

		// Add reasoning support
		if (options.reasoning) {
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
				signal: options.signal,
			});

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: response.statusText }));
				throw new Error(`OpenRouter error: ${error.error?.message || response.statusText}`);
			}

			// Process SSE stream
			await processSSEStream(response.body, stream, options);

		} catch (error) {
			handleStreamError(stream, error, options?.signal);
		}

		return stream;
	};
}

/**
 * Process SSE stream from OpenRouter
 * 
 * @param {ReadableStream} body - Response body stream
 * @param {any} stream - Event stream to push events to
 * @param {any} options - Stream options
 */
async function processSSEStream(body, stream, options) {
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
 * Process a single SSE chunk and emit X-Agent compatible events
 * 
 * @param {any} chunk - SSE chunk from OpenRouter
 * @param {any} stream - Event stream
 * @param {any} partialMessage - Partial message being built
 */
function processChunk(chunk, stream, partialMessage) {
	const choice = chunk.choices?.[0];
	if (!choice) return;

	const delta = choice.delta;
	const finishReason = choice.finish_reason;

	// Handle reasoning/thinking (OpenRouter specific)
	if (delta.reasoning) {
		handleThinkingDelta(delta.reasoning, stream, partialMessage);
	}

	// Handle text content
	if (delta.content !== undefined) {
		handleTextDelta(delta.content, stream, partialMessage);
	}

	// Handle tool calls
	if (delta.tool_calls) {
		handleToolCallDelta(delta.tool_calls, stream, partialMessage, finishReason);
	}

	// Handle stream end
	if (finishReason) {
		handleFinishReason(finishReason, chunk.usage, stream, partialMessage);
	}
}

/**
 * Handle thinking/reasoning delta
 * @param {string} reasoning - Reasoning text
 * @param {any} stream - Event stream
 * @param {any} partialMessage - Partial message
 */
function handleThinkingDelta(reasoning, stream, partialMessage) {
	// Check if we already have a thinking block
	let thinkingBlock = partialMessage.content.find((c) => c.type === 'thinking');
	
	if (!thinkingBlock) {
		// Create new thinking block
		thinkingBlock = { type: 'thinking', thinking: '' };
		partialMessage.content.push(thinkingBlock);
		
		stream.push({
			type: 'thinking_start',
			contentIndex: partialMessage.content.length - 1,
			partial: { ...partialMessage },
		});
	}

	const prevThinking = thinkingBlock.thinking;
	thinkingBlock.thinking += reasoning;

	stream.push({
		type: 'thinking_delta',
		contentIndex: partialMessage.content.findIndex((c) => c.type === 'thinking'),
		delta: reasoning,
		partial: { ...partialMessage },
	});
}

/**
 * Handle text delta
 * @param {string} content - Text content
 * @param {any} stream - Event stream
 * @param {any} partialMessage - Partial message
 */
function handleTextDelta(content, stream, partialMessage) {
	if (!content) return;

	// Check if we already have a text block
	let textBlock = partialMessage.content.find((c) => c.type === 'text');

	if (!textBlock) {
		// Create new text block
		textBlock = { type: 'text', text: '' };
		partialMessage.content.push(textBlock);

		stream.push({
			type: 'text_start',
			contentIndex: partialMessage.content.length - 1,
			partial: { ...partialMessage },
		});
	}

	textBlock.text += content;

	stream.push({
		type: 'text_delta',
		contentIndex: partialMessage.content.findIndex((c) => c.type === 'text'),
		delta: content,
		partial: { ...partialMessage },
	});
}

/**
 * Handle tool call delta
 * @param {any[]} toolCalls - Tool call deltas
 * @param {any} stream - Event stream
 * @param {any} partialMessage - Partial message
 * @param {string} finishReason - Finish reason
 */
function handleToolCallDelta(toolCalls, stream, partialMessage, finishReason) {
	for (const toolDelta of toolCalls) {
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

		// Handle tool call end
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

/**
 * Handle finish reason
 * @param {string} finishReason - Finish reason
 * @param {any} usage - Usage statistics
 * @param {any} stream - Event stream
 * @param {any} partialMessage - Partial message
 */
function handleFinishReason(finishReason, usage, stream, partialMessage) {
	partialMessage.stopReason = finishReason === 'tool_calls' ? 'toolUse' : finishReason;

	// Add usage if available
	if (usage) {
		partialMessage.usage = {
			input: usage.prompt_tokens || 0,
			output: usage.completion_tokens || 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: usage.total_tokens || 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		};
	}

	// Emit done or error event
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
	} else if (finishReason === 'content_filter') {
		stream.push({
			type: 'error',
			reason: 'error',
			error: { ...partialMessage, errorMessage: 'Content filtered' },
		});
	}
}

/**
 * Handle stream errors
 * @param {any} stream - Event stream
 * @param {Error} error - Error
 * @param {AbortSignal} [signal] - Abort signal
 */
function handleStreamError(stream, error, signal) {
	if (error?.name === 'AbortError' || signal?.aborted) {
		const errorMsg = createAssistantMessage('', 'aborted');
		errorMsg.errorMessage = 'Request aborted';
		stream.push({ type: 'error', reason: 'aborted', error: errorMsg });
	} else {
		const errorMsg = createAssistantMessage('', 'error');
		errorMsg.errorMessage = error?.message || String(error);
		stream.push({ type: 'error', reason: 'error', error: errorMsg });
	}
}
