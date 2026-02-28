/**
 * OpenRouter Message Converter
 * Complete implementation matching pi-ai with context handling, signatures, and all content types
 */

/**
 * Convert X-Agent messages to OpenRouter format
 * Handles all content types including thinking, tool calls, images
 * 
 * @param {import("../types.js").AgentMessage[]} messages 
 * @param {string} systemPrompt 
 * @returns {any[]}
 */
export function convertToOpenRouterMessages(messages, systemPrompt) {
	const openRouterMessages = [];

	// Add system prompt
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
			openRouterMessages.push(convertAssistantMessage(msg));
		} else if (msg.role === 'toolResult') {
			openRouterMessages.push(convertToolResult(msg));
		}
	}

	return openRouterMessages;
}

/**
 * Convert assistant message with all content types
 */
function convertAssistantMessage(msg) {
	const assistantMsg = {
		role: 'assistant',
		content: [],
	};

	for (const block of msg.content) {
		if (block.type === 'text') {
			assistantMsg.content.push({
				type: 'text',
				text: block.text,
				...(block.textSignature && { text_signature: block.textSignature }),
			});
		} else if (block.type === 'thinking') {
			// OpenRouter supports reasoning via reasoning field or separate content
			if (block.thinking) {
				assistantMsg.reasoning = block.thinking;
				if (block.thinkingSignature) {
					assistantMsg.reasoning_signature = block.thinkingSignature;
				}
			}
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

	// Simplify content if only text
	if (assistantMsg.content.length === 1 && assistantMsg.content[0].type === 'text') {
		assistantMsg.content = assistantMsg.content[0].text;
	} else if (assistantMsg.content.length === 0 && !assistantMsg.tool_calls) {
		assistantMsg.content = null;
	}

	return assistantMsg;
}

/**
 * Convert user content with all types (text, images)
 */
function convertUserContent(content) {
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		return content.map(block => {
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
			} else if (block.type === 'thinking') {
				// Thinking in user messages (rare but possible in cross-provider)
				return {
					type: 'text',
					text: `<thinking>${block.thinking}</thinking>`,
				};
			}
			return block;
		});
	}

	return String(content);
}

/**
 * Convert tool result
 */
function convertToolResult(msg) {
	// Handle both text and image content in tool results
	const content = msg.content?.map(block => {
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
	}).join('\n') || '';

	return {
		role: 'tool',
		tool_call_id: msg.toolCallId,
		content,
	};
}

/**
 * Convert X-Agent tools to OpenRouter format with full schema
 */
export function convertToOpenRouterTools(tools) {
	return tools.map(tool => ({
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	}));
}

/**
 * Create assistant message with all fields
 */
export function createAssistantMessage(text = '', stopReason = 'stop') {
	return {
		role: 'assistant',
		content: text ? [{ type: 'text', text, textSignature: null }] : [],
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

/**
 * Serialize context to JSON (for storage/transfer)
 */
export function serializeContext(context) {
	return JSON.stringify({
		systemPrompt: context.systemPrompt,
		messages: context.messages,
		tools: context.tools?.map(t => ({
			name: t.name,
			description: t.description,
			parameters: t.parameters,
		})),
	});
}

/**
 * Deserialize context from JSON
 */
export function deserializeContext(json) {
	return JSON.parse(json);
}

/**
 * Transform thinking blocks to text tags (for providers that don't support thinking)
 */
export function thinkingToTextTags(messages) {
	return messages.map(msg => {
		if (msg.role === 'assistant' && Array.isArray(msg.content)) {
			const newContent = [];
			for (const block of msg.content) {
				if (block.type === 'thinking') {
					newContent.push({
						type: 'text',
						text: `<thinking>${block.thinking}</thinking>`,
					});
				} else {
					newContent.push(block);
				}
			}
			return { ...msg, content: newContent };
		}
		return msg;
	});
}
