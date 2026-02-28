/**
 * OpenRouter Message Converter
 * Converts between X-Agent messages and OpenRouter API format
 */

/**
 * Convert X-Agent messages to OpenRouter format
 * @param {import("../types.js").AgentMessage[]} messages - X-Agent messages
 * @param {string} systemPrompt - System prompt
 * @returns {any[]} OpenRouter messages
 */
export function convertToOpenRouterMessages(messages, systemPrompt) {
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
			const assistantMsg = convertAssistantMessage(msg);
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
 * Convert assistant message to OpenRouter format
 * @param {any} msg - X-Agent assistant message
 * @returns {any} OpenRouter assistant message
 */
function convertAssistantMessage(msg) {
	const assistantMsg = {
		role: 'assistant',
		content: [],
	};

	for (const block of msg.content) {
		if (block.type === 'text') {
			assistantMsg.content.push({ type: 'text', text: block.text });
		} else if (block.type === 'thinking') {
			// OpenRouter supports reasoning via separate field
			assistantMsg.reasoning = block.thinking;
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
	} else if (assistantMsg.content.length === 0 && !assistantMsg.tool_calls) {
		assistantMsg.content = null;
	}

	return assistantMsg;
}

/**
 * Convert user content to OpenRouter format
 * @param {any} content - User content
 * @returns {string | any[]} OpenRouter content
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

/**
 * Convert X-Agent tools to OpenRouter format
 * @param {import("../types.js").AgentTool<any>[]} tools - X-Agent tools
 * @returns {any[]} OpenRouter tools
 */
export function convertToOpenRouterTools(tools) {
	return tools.map((tool) => ({
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	}));
}

/**
 * Create empty assistant message (for building partial responses)
 * @param {string} [text] - Initial text
 * @param {string} [stopReason] - Stop reason
 * @returns {any} Assistant message
 */
export function createAssistantMessage(text = '', stopReason = 'stop') {
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
