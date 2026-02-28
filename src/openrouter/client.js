/**
 * OpenRouter Stream - Complete Implementation
 * Matches pi-ai streamSimple API with full event support
 */

import { createOpenRouterStream } from './stream.js';
import { convertToOpenRouterMessages, convertToOpenRouterTools, createAssistantMessage } from './messages.js';
import { validateToolArguments } from './tools.js';

/**
 * @typedef {Object} OpenRouterConfig
 * @property {string} apiKey - OpenRouter API key
 * @property {string} [baseUrl] - API base URL
 * @property {string} [siteUrl] - Site URL for ranking
 * @property {string} [siteName] - Site name for ranking
 * @property {Record<string, string>} [headers] - Additional headers
 * @property {AbortSignal} [signal] - Abort signal
 * @property {string} [reasoning] - Reasoning level
 * @property {number} [temperature] - Temperature
 * @property {number} [maxTokens] - Max tokens
 * @property {(payload: any) => void} [onPayload] - Payload inspection callback
 */

/**
 * @typedef {Object} OpenRouterContext
 * @property {string} [systemPrompt] - System prompt
 * @property {any[]} messages - Messages
 * @property {any[]} [tools] - Tools
 */

/**
 * Complete OpenRouter stream function matching pi-ai streamSimple
 * 
 * @param {OpenRouterConfig} config - Configuration
 * @param {OpenRouterContext} context - Context
 * @returns {Promise<any>} Event stream
 */
export async function openRouterStream(config, context) {
	const {
		apiKey,
		baseUrl = 'https://openrouter.ai/api/v1',
		siteUrl,
		siteName,
		headers = {},
		signal,
		reasoning,
		temperature,
		maxTokens,
		onPayload,
	} = config;

	if (!apiKey) {
		throw new Error('OpenRouter API key is required');
	}

	const stream = createOpenRouterStream();

	// Convert messages and tools
	const openRouterMessages = convertToOpenRouterMessages(context.messages, context.systemPrompt);
	const openRouterTools = context.tools?.length > 0 ? convertToOpenRouterTools(context.tools) : undefined;

	// Build request with ALL OpenRouter parameters
	const requestBody = {
		model: config.modelId,
		messages: openRouterMessages,
		
		// Sampling parameters
		temperature: temperature ?? 1.0,
		max_tokens: maxTokens,
		top_p: config.top_p,
		top_k: config.top_k,
		frequency_penalty: config.frequency_penalty,
		presence_penalty: config.presence_penalty,
		repetition_penalty: config.repetition_penalty,
		min_p: config.min_p,
		top_a: config.top_a,
		seed: config.seed,
		
		// Output control
		stop: config.stop,
		verbosity: config.verbosity,
		
		// Log probs
		logprobs: config.logprobs,
		top_logprobs: config.top_logprobs,
		logit_bias: config.logit_bias,
		
		// Structured outputs
		response_format: config.response_format,
		
		// Tool calling
		tools: openRouterTools,
		tool_choice: config.tool_choice,
		parallel_tool_calls: config.parallel_tool_calls ?? true,
		
		// OpenRouter specific
		transforms: config.transforms ?? ['middle-out'], // Context compression
		include_reasoning: !!reasoning,
		
		// Provider passthrough
		provider: config.provider,
		
		// Site info for ranking
		...(siteUrl && { site_url: siteUrl }),
		...(siteName && { site_name: siteName }),
	};

	// Remove undefined values
	Object.keys(requestBody).forEach(key => {
		if (requestBody[key] === undefined) {
			delete requestBody[key];
		}
	});

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
			signal,
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: response.statusText }));
			
			// Handle specific error cases
			if (error.error?.code === 'invalid_api_key') {
				throw new Error('Invalid OpenRouter API key');
			} else if (error.error?.code === 'insufficient_quota') {
				throw new Error('Insufficient OpenRouter credits');
			} else if (error.error?.code === 'model_not_found') {
				throw new Error(`Model not found: ${config.modelId}`);
			} else {
				throw new Error(`OpenRouter error: ${error.error?.message || response.statusText}`);
			}
		}

		// Invoke onPayload callback if provided
		if (onPayload) {
			const clonedResponse = response.clone();
			clonedResponse.text().then(text => {
				try {
					onPayload(JSON.parse(text));
				} catch (e) {
					// Ignore parse errors
				}
			});
		}

		// Process SSE stream
		await processSSEStream(response.body, stream, config);

	} catch (error) {
		handleStreamError(stream, error, signal);
	}

	return stream;
}

/**
 * Process SSE stream with complete event handling
 * @param {ReadableStream} body 
 * @param {any} stream 
 * @param {OpenRouterConfig} config 
 */
async function processSSEStream(body, stream, config) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	const partialMessage = createAssistantMessage('');
	let currentContentIndex = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const trimmedLine = line.trim();
			if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

			if (trimmedLine.startsWith('data: ')) {
				try {
					const chunk = JSON.parse(trimmedLine.slice(6));
					processChunk(chunk, stream, partialMessage, config);
				} catch (e) {
					// Skip invalid JSON
				}
			}
		}
	}
}

/**
 * Process chunk with full event support
 */
function processChunk(chunk, stream, partialMessage, config) {
	const choice = chunk.choices?.[0];
	if (!choice) return;

	const delta = choice.delta;
	const finishReason = choice.finish_reason;

	// Handle reasoning/thinking
	if (delta.reasoning || delta.reasoning_content) {
		handleThinking(delta.reasoning || delta.reasoning_content, stream, partialMessage);
	}

	// Handle text content
	if (delta.content !== undefined) {
		handleText(delta.content, stream, partialMessage);
	}

	// Handle tool calls with full validation
	if (delta.tool_calls) {
		handleToolCalls(delta.tool_calls, stream, partialMessage, finishReason, config);
	}

	// Handle finish
	if (finishReason) {
		handleFinish(finishReason, chunk.usage, stream, partialMessage);
	}
}

/**
 * Handle thinking events with all event types
 */
function handleThinking(reasoning, stream, partialMessage) {
	let thinkingBlock = partialMessage.content.find(c => c.type === 'thinking');
	
	if (!thinkingBlock) {
		thinkingBlock = { type: 'thinking', thinking: '', thinkingSignature: null };
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
		contentIndex: partialMessage.content.findIndex(c => c.type === 'thinking'),
		delta: reasoning,
		partial: { ...partialMessage },
	});
}

/**
 * Handle text events with all event types
 */
function handleText(content, stream, partialMessage) {
	if (!content) return;

	let textBlock = partialMessage.content.find(c => c.type === 'text');

	if (!textBlock) {
		textBlock = { type: 'text', text: '', textSignature: null };
		partialMessage.content.push(textBlock);

		stream.push({
			type: 'text_start',
			contentIndex: partialMessage.content.length - 1,
			partial: { ...partialMessage },
		});
	}

	const prevText = textBlock.text;
	textBlock.text += content;

	stream.push({
		type: 'text_delta',
		contentIndex: partialMessage.content.findIndex(c => c.type === 'text'),
		delta: content,
		partial: { ...partialMessage },
	});
}

/**
 * Handle tool calls with validation and all event types
 */
function handleToolCalls(toolCalls, stream, partialMessage, finishReason, config) {
	for (const toolDelta of toolCalls) {
		const index = toolDelta.index ?? partialMessage.content.filter(c => c.type === 'toolCall').length;

		// Ensure tool call slot exists
		while (partialMessage.content.length <= index) {
			partialMessage.content.push({ type: 'toolCall', id: '', name: '', arguments: {}, partialJson: '' });
		}

		const existingToolCall = partialMessage.content[index];

		// Tool call start
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

		// Tool call delta with partial JSON parsing
		if (toolDelta.function?.arguments) {
			existingToolCall.partialJson += toolDelta.function.arguments;

			try {
				existingToolCall.arguments = JSON.parse(existingToolCall.partialJson) || {};
			} catch (e) {
				// Partial JSON - keep accumulating
			}

			stream.push({
				type: 'toolcall_delta',
				contentIndex: index,
				delta: toolDelta.function.arguments,
				partial: { ...partialMessage },
			});
		}

		// Tool call end with validation
		if (finishReason === 'tool_calls' && existingToolCall.id && existingToolCall.name) {
			// Validate against tools if available
			if (config.tools && config.tools.length > 0) {
				const tool = config.tools.find(t => t.name === existingToolCall.name);
				if (tool) {
					try {
						existingToolCall.arguments = validateToolArguments(tool, {
							id: existingToolCall.id,
							name: existingToolCall.name,
							arguments: existingToolCall.arguments,
						});
					} catch (e) {
						// Validation failed - will be handled by agent
					}
				}
			}

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
 * Handle finish with usage and all event types
 */
function handleFinish(finishReason, usage, stream, partialMessage) {
	partialMessage.stopReason = finishReason === 'tool_calls' ? 'toolUse' : finishReason;

	// Add usage statistics
	if (usage) {
		partialMessage.usage = {
			input: usage.prompt_tokens || 0,
			output: usage.completion_tokens || 0,
			cacheRead: usage.prompt_tokens_details?.cached_tokens || 0,
			cacheWrite: 0,
			totalTokens: usage.total_tokens || 0,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
			},
		};

		// Add logprobs if available
		if (usage.completion_tokens_details) {
			partialMessage.usage.details = usage.completion_tokens_details;
		}
	}

	// Emit text_end for all text blocks
	partialMessage.content.forEach((block, index) => {
		if (block.type === 'text') {
			stream.push({
				type: 'text_end',
				contentIndex: index,
				content: block.text,
				contentSignature: block.textSignature,
				partial: { ...partialMessage },
			});
		} else if (block.type === 'thinking') {
			stream.push({
				type: 'thinking_end',
				contentIndex: index,
				content: block.thinking,
				contentSignature: block.thinkingSignature,
				partial: { ...partialMessage },
			});
		}
	});

	// Emit done or error
	if (finishReason === 'stop' || finishReason === 'tool_calls' || finishReason === 'length') {
		stream.push({
			type: 'done',
			reason: partialMessage.stopReason,
			message: { ...partialMessage },
		});
	} else {
		const errorMsg = {
			...partialMessage,
			errorMessage: finishReason === 'content_filter' ? 'Content filtered' : 'Unknown error',
		};
		
		stream.push({
			type: 'error',
			reason: finishReason === 'error' ? 'error' : 'aborted',
			error: errorMsg,
		});
	}
}

/**
 * Handle stream errors
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
