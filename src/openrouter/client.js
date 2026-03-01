/**
 * OpenRouter Stream - Complete Implementation
 * Matches pi-ai streamSimple API with full event support
 */

import { createOpenRouterStream } from './stream.js';
import { convertToOpenRouterMessages, convertToOpenRouterTools, createAssistantMessage } from './messages.js';
import { validateToolArguments } from './tools.js';
import { createLogger } from '../logger.js';

const log = createLogger('OpenRouter');

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

	// Start the request in the background (stream is returned immediately)
	(async () => {
		try {
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

				log.error('API error:', error);

				// Handle specific error cases
				if (error.error?.code === 'invalid_api_key') {
					throw new Error('Invalid OpenRouter API key');
				} else if (error.error?.code === 'insufficient_quota') {
					throw new Error('Insufficient OpenRouter credits');
				} else if (error.error?.code === 'model_not_found') {
					throw new Error(`Model not found: ${config.modelId}`);
				} else if (response.status === 429) {
					throw new Error(`Rate limit exceeded (429). ${error.error?.message || 'Please wait and try again.'}`);
				} else if (response.status === 404) {
					throw new Error(`OpenRouter API endpoint not found (404). Model: ${config.modelId}. Error: ${error.error?.message || response.statusText}`);
				} else {
					throw new Error(`OpenRouter error (${response.status}): ${error.error?.message || response.statusText}`);
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
			log.info('Starting SSE stream processing...');
			log.info('Response status:', response.status);

			// Read response to check if it's empty
			const responseText = await response.clone().text();
			log.info('Response body length:', responseText.length);
			log.info('Response body (raw):', responseText);

			if (!responseText.trim()) {
				const errorMsg = createAssistantMessage('', 'error');
				errorMsg.errorMessage = 'OpenRouter returned empty response. Check your API key has credits or the model is available.';
				log.error('Empty response from OpenRouter. Raw response:', JSON.stringify(responseText));
				stream.push({ type: 'error', reason: 'error', error: errorMsg });
				return;
			}

			// Check if response is a single JSON object (non-streaming) vs SSE stream
			const trimmedText = responseText.trim();
			if (trimmedText.startsWith('{') && !trimmedText.startsWith('data:')) {
				// Non-streaming JSON response - parse and emit events
				log.info('Detected non-streaming JSON response');
				try {
					const response = JSON.parse(trimmedText);
					processNonStreamingResponse(response, stream, config);
				} catch (e) {
					log.error('Failed to parse JSON response:', e);
					const errorMsg = createAssistantMessage('', 'error');
					errorMsg.errorMessage = 'Failed to parse OpenRouter response: ' + e.message;
					stream.push({ type: 'error', reason: 'error', error: errorMsg });
				}
				return;
			}

			// Create a new readable stream from the text for SSE processing
			const textStream = new Blob([responseText]).stream();
			await processSSEStream(textStream, stream, config);

		} catch (error) {
			handleStreamError(stream, error, signal);
		}
	})();

	return stream;
}

/**
 * Process non-streaming JSON response and emit events
 * @param {any} response - OpenRouter JSON response
 * @param {any} stream - Event stream
 * @param {OpenRouterConfig} config
 */
function processNonStreamingResponse(response, stream, config) {
	log.info('Processing non-streaming response:', response);
	
	const choice = response.choices?.[0];
	if (!choice) {
		log.error('No choices in response');
		return;
	}
	
	const message = choice.message;
	const finishReason = choice.finish_reason || 'stop';
	
	// Create partial message
	const partialMessage = createAssistantMessage('');
	
	// Emit start event
	log.debug('Emitting event: start');
	stream.push({
		type: 'start',
		partial: { ...partialMessage },
	});
	
	// Emit text content
	if (message?.content) {
		log.info('Response content:', message.content);
		
		// Emit text_start
		const textBlock = { type: 'text', text: '', textSignature: null };
		partialMessage.content.push(textBlock);
		log.debug('Emitting event: text_start');
		stream.push({
			type: 'text_start',
			contentIndex: 0,
			partial: { ...partialMessage },
		});
		
		// Emit text_delta (send full content at once for non-streaming)
		textBlock.text = message.content;
		log.debug('Emitting event: text_delta', message.content);
		stream.push({
			type: 'text_delta',
			contentIndex: 0,
			delta: message.content,
			partial: { ...partialMessage },
		});
		
		// Emit text_end
		log.debug('Emitting event: text_end');
		stream.push({
			type: 'text_end',
			contentIndex: 0,
			content: message.content,
			contentSignature: null,
			partial: { ...partialMessage },
		});
	}
	
	// Handle tool calls if present
	if (message?.tool_calls) {
		log.info('Tool calls in response:', message.tool_calls);
		for (let i = 0; i < message.tool_calls.length; i++) {
			const toolCall = message.tool_calls[i];
			const toolCallBlock = {
				type: 'toolCall',
				id: toolCall.id,
				name: toolCall.function?.name || '',
				arguments: {},
				partialJson: '',
			};
			partialMessage.content.push(toolCallBlock);
			
			// Emit toolcall_start
			log.debug('Emitting event: toolcall_start', toolCall.function?.name);
			stream.push({
				type: 'toolcall_start',
				contentIndex: partialMessage.content.length - 1,
				id: toolCall.id,
				toolName: toolCall.function?.name || '',
				partial: { ...partialMessage },
			});
			
			// Parse arguments
			try {
				toolCallBlock.arguments = JSON.parse(toolCall.function?.arguments || '{}');
				toolCallBlock.partialJson = toolCall.function?.arguments || '';
			} catch (e) {
				log.error('Failed to parse tool arguments:', e);
			}
			
			// Emit toolcall_end
			log.debug('Emitting event: toolcall_end');
			stream.push({
				type: 'toolcall_end',
				contentIndex: partialMessage.content.length - 1,
				toolCall: {
					id: toolCall.id,
					type: 'function',
					name: toolCall.function?.name || '',
					arguments: toolCallBlock.arguments,
				},
				partial: { ...partialMessage },
			});
		}
	}
	
	// Add usage if available
	if (response.usage) {
		partialMessage.usage = {
			input: response.usage.prompt_tokens || 0,
			output: response.usage.completion_tokens || 0,
			cacheRead: response.usage.prompt_tokens_details?.cached_tokens || 0,
			cacheWrite: 0,
			totalTokens: response.usage.total_tokens || 0,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
			},
		};
	}
	
	// Emit done
	partialMessage.stopReason = finishReason === 'tool_calls' ? 'toolUse' : finishReason;
	log.info('Emitting event: done, reason:', partialMessage.stopReason);
	stream.push({
		type: 'done',
		reason: partialMessage.stopReason,
		message: { ...partialMessage },
	});
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
	let chunkCount = 0;
	let hasFinishReason = false;
	let hasContent = false;

	const partialMessage = createAssistantMessage('');
	let currentContentIndex = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			log.debug('Stream done, processed', chunkCount, 'chunks, hasFinishReason:', hasFinishReason, 'hasContent:', hasContent);
			// If stream ended without finish_reason, emit done anyway
			if (!hasFinishReason) {
				// If no content was received, show an error
				if (!hasContent && chunkCount > 0) {
					const errorMsg = createAssistantMessage('', 'error');
					errorMsg.errorMessage = 'OpenRouter returned empty response. Check your API key has credits.';
					log.error('Empty response from OpenRouter');
					stream.push({ type: 'error', reason: 'error', error: errorMsg });
					return;
				} else {
					handleFinish('stop', null, stream, partialMessage);
				}
			}
			break;
		}

		chunkCount++;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		log.debug('Raw buffer lines:', lines.length);

		for (const line of lines) {
			log.debug('Line:', JSON.stringify(line));
			const trimmedLine = line.trim();
			if (!trimmedLine || trimmedLine === 'data: [DONE]') {
				if (trimmedLine === 'data: [DONE]') {
					log.debug('Received [DONE]');
					hasFinishReason = true;
					handleFinish('stop', null, stream, partialMessage);
				}
				continue;
			}

			if (trimmedLine.startsWith('data: ')) {
				try {
					const chunk = JSON.parse(trimmedLine.slice(6));
					log.debug('Raw chunk:', trimmedLine);
					log.debug('Parsed chunk:', JSON.stringify(chunk, null, 2));
					const choice = chunk.choices?.[0];
					if (choice?.finish_reason) {
						hasFinishReason = true;
					}
					// Check if chunk has actual content
					if (choice?.delta?.content) {
						hasContent = true;
					}
					processChunk(chunk, stream, partialMessage, config);
				} catch (e) {
					log.error('Failed to parse chunk:', trimmedLine.substring(0, 100), e);
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
	log.debug('Processing chunk, choice:', choice);

	if (!choice) {
		// Check if there's usage info
		if (chunk.usage) {
			log.debug('Usage only chunk:', chunk.usage);
		}
		// Some APIs return chunks with just usage, no choices
		return;
	}

	const delta = choice.delta;
	const finishReason = choice.finish_reason;

	log.debug('delta:', delta, 'finishReason:', finishReason);
	log.debug('delta.content:', delta?.content, 'type:', typeof delta?.content);

	// Handle reasoning/thinking
	if (delta.reasoning || delta.reasoning_content) {
		handleThinking(delta.reasoning || delta.reasoning_content, stream, partialMessage);
	}

	// Handle text content - check for empty string too
	if (delta.content !== undefined && delta.content !== null && delta.content !== '') {
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

		log.debug('Emitting event: thinking_start');
		stream.push({
			type: 'thinking_start',
			contentIndex: partialMessage.content.length - 1,
			partial: { ...partialMessage },
		});
	}

	const prevThinking = thinkingBlock.thinking;
	thinkingBlock.thinking += reasoning;

	log.debug('Emitting event: thinking_delta', reasoning.substring(0, 50));
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

		log.debug('Emitting event: text_start');
		stream.push({
			type: 'text_start',
			contentIndex: partialMessage.content.length - 1,
			partial: { ...partialMessage },
		});
	}

	const prevText = textBlock.text;
	textBlock.text += content;

	log.debug('Emitting event: text_delta', content.substring(0, 50));
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

			log.debug('Emitting event: toolcall_start', toolDelta.function?.name);
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

			log.debug('Emitting event: toolcall_delta');
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

			log.debug('Emitting event: toolcall_end');
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
	log.debug('handleFinish called with reason:', finishReason);

	partialMessage.stopReason = finishReason === 'tool_calls' ? 'toolUse' : finishReason;

	// Add usage statistics
	if (usage) {
		log.debug('Usage:', usage);
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
			log.debug('Emitting event: text_end, index:', index);
			stream.push({
				type: 'text_end',
				contentIndex: index,
				content: block.text,
				contentSignature: block.textSignature,
				partial: { ...partialMessage },
			});
		} else if (block.type === 'thinking') {
			log.debug('Emitting event: thinking_end, index:', index);
			stream.push({
				type: 'thinking_end',
				contentIndex: index,
				content: block.thinking,
				contentSignature: block.thinkingSignature,
				partial: { ...partialMessage },
			});
		}
	});

	// Emit done for any finish reason
	log.info('Emitting event: done, reason:', partialMessage.stopReason);
	stream.push({
		type: 'done',
		reason: partialMessage.stopReason,
		message: { ...partialMessage },
	});
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
