/**
 * OpenRouter Event Stream
 * Complete implementation matching pi-ai EventStream with all event types
 */

import { createLogger } from '../logger.js';

const log = createLogger('OpenRouter.Stream');

/**
 * Generic event stream class for async iteration
 * Matches pi-ai EventStream exactly
 */
export class EventStream {
	constructor(isComplete, extractResult) {
		this.isComplete = isComplete;
		this.extractResult = extractResult;
		this.queue = [];
		this.waiting = [];
		this.done = false;
		this.finalResultPromise = new Promise((resolve) => {
			this.resolveFinalResult = resolve;
		});
	}

	push(event) {
		if (this.done) return;
		if (this.isComplete(event)) {
			this.done = true;
			this.resolveFinalResult(this.extractResult(event));
		}
		// Deliver to waiting consumer or queue it
		const waiter = this.waiting.shift();
		if (waiter) {
			waiter({ value: event, done: false });
		} else {
			this.queue.push(event);
		}
	}

	end(result) {
		this.done = true;
		if (result !== undefined) {
			this.resolveFinalResult(result);
		}
		// Notify all waiting consumers that we're done
		while (this.waiting.length > 0) {
			const waiter = this.waiting.shift();
			waiter({ value: undefined, done: true });
		}
	}

	async *[Symbol.asyncIterator]() {
		while (true) {
			if (this.queue.length > 0) {
				yield this.queue.shift();
			} else if (this.done) {
				return;
			} else {
				const result = await new Promise((resolve) => this.waiting.push(resolve));
				if (result.done) return;
				yield result.value;
			}
		}
	}

	result() {
		return this.finalResultPromise;
	}
}

/**
 * AssistantMessageEventStream - specialized for assistant messages
 * Matches pi-ai AssistantMessageEventStream exactly
 */
export class AssistantMessageEventStream extends EventStream {
	constructor() {
		super(
			(event) => event.type === 'done' || event.type === 'error',
			(event) => {
				if (event.type === 'done') {
					return event.message;
				} else if (event.type === 'error') {
					return event.error;
				}
				throw new Error('Unexpected event type for final result');
			}
		);
	}
}

/**
 * Factory function for AssistantMessageEventStream
 */
export function createAssistantMessageEventStream() {
	return new AssistantMessageEventStream();
}

/**
 * Parse partial JSON during streaming
 * Matches pi-ai parseStreamingJson exactly
 * @param {string} partialJson
 * @returns {any}
 */
export function parseStreamingJson(partialJson) {
	if (!partialJson || partialJson.trim() === '') {
		return {};
	}
	// Try standard parsing first (fastest for complete JSON)
	try {
		return JSON.parse(partialJson);
	} catch {
		// For incomplete JSON, try to parse what we can
		try {
			// Simple partial JSON parser - handles common cases
			let cleaned = partialJson.trim();
			// Add missing closing braces/brackets
			const openBraces = (cleaned.match(/\{/g) || []).length;
			const closeBraces = (cleaned.match(/\}/g) || []).length;
			const openBrackets = (cleaned.match(/\[/g) || []).length;
			const closeBrackets = (cleaned.match(/\]/g) || []).length;
			
			cleaned += '}'.repeat(openBraces - closeBraces);
			cleaned += ']'.repeat(openBrackets - closeBrackets);
			
			return JSON.parse(cleaned) || {};
		} catch {
			// If all parsing fails, return empty object
			return {};
		}
	}
}

/**
 * Create an OpenRouter event stream compatible with X-Agent
 * Emits all event types: start, text_*, thinking_*, toolcall_*, done, error
 *
 * @returns {EventStream} EventStream
 */
export function createOpenRouterStream() {
	const listeners = new Set();
	let result = null;
	let resultResolver = null;
	let resultRejector = null;

	const resultPromise = new Promise((resolve, reject) => {
		resultResolver = resolve;
		resultRejector = reject;
	});

	let isDone = false;

	return {
		/**
		 * Push an event to all listeners
		 * @param {any} event
		 */
		push(event) {
			if (isDone && event.type !== 'done' && event.type !== 'error') {
				return; // Ignore events after done
			}

			for (const listener of listeners) {
				try {
					listener(event);
				} catch (e) {
					log.error('Event listener error:', e);
				}
			}

			// Handle terminal events
			if (event.type === 'done') {
				isDone = true;
				result = event.message;
				resultResolver(result);
			} else if (event.type === 'error') {
				isDone = true;
				result = event.error;
				resultRejector(event.error);
			}
		},

		/**
		 * Subscribe to events
		 * @param {(event: any) => void} listener
		 * @returns {() => void} Unsubscribe function
		 */
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},

		/**
		 * Get the final result
		 * @returns {Promise<any>}
		 */
		async result() {
			return resultPromise;
		},

		/**
		 * Check if stream is done
		 * @returns {boolean}
		 */
		isDone() {
			return isDone;
		},

		/**
		 * Async iterator support (for await...of)
		 */
		async *[Symbol.asyncIterator]() {
			const queue = [];
			let done = false;
			let error = null;

			const unsubscribe = this.subscribe((event) => {
				queue.push({ event, done: false });
				if (event.type === 'done') {
					done = true;
					queue.push({ event, done: true });
				} else if (event.type === 'error') {
					done = true;
					error = event.error;
					queue.push({ event, done: true });
				}
			});

			try {
				while (!done || queue.length > 0) {
					if (queue.length === 0) {
						await new Promise(resolve => setTimeout(resolve, 1));
						continue;
					}
					const item = queue.shift();
					if (item.done && error) {
						throw error;
					}
					yield item.event;
				}
			} finally {
				unsubscribe();
			}
		},

		/**
		 * Abort the stream
		 */
		abort() {
			if (!isDone) {
				const errorMsg = {
					role: 'assistant',
					content: [],
					stopReason: 'aborted',
					errorMessage: 'Request aborted',
					timestamp: Date.now(),
				};
				this.push({ type: 'error', reason: 'aborted', error: errorMsg });
			}
		},
	};
}

/**
 * Event types reference (matching pi-ai)
 * 
 * @typedef {Object} StartEvent
 * @property {'start'} type
 * @property {any} partial - Partial assistant message
 * 
 * @typedef {Object} TextStartEvent
 * @property {'text_start'} type
 * @property {number} contentIndex - Index in content array
 * @property {any} partial
 * 
 * @typedef {Object} TextDeltaEvent
 * @property {'text_delta'} type
 * @property {number} contentIndex
 * @property {string} delta - New text chunk
 * @property {any} partial
 * 
 * @typedef {Object} TextEndEvent
 * @property {'text_end'} type
 * @property {number} contentIndex
 * @property {string} content - Full text
 * @property {string|null} contentSignature
 * @property {any} partial
 * 
 * @typedef {Object} ThinkingStartEvent
 * @property {'thinking_start'} type
 * @property {number} contentIndex
 * @property {any} partial
 * 
 * @typedef {Object} ThinkingDeltaEvent
 * @property {'thinking_delta'} type
 * @property {number} contentIndex
 * @property {string} delta - New thinking chunk
 * @property {any} partial
 * 
 * @typedef {Object} ThinkingEndEvent
 * @property {'thinking_end'} type
 * @property {number} contentIndex
 * @property {string} content - Full thinking
 * @property {string|null} contentSignature
 * @property {any} partial
 * 
 * @typedef {Object} ToolcallStartEvent
 * @property {'toolcall_start'} type
 * @property {number} contentIndex
 * @property {string} id - Tool call ID
 * @property {string} toolName - Tool name
 * @property {any} partial
 * 
 * @typedef {Object} ToolcallDeltaEvent
 * @property {'toolcall_delta'} type
 * @property {number} contentIndex
 * @property {string} delta - JSON arguments chunk
 * @property {any} partial - With partial JSON parsing
 * 
 * @typedef {Object} ToolcallEndEvent
 * @property {'toolcall_end'} type
 * @property {number} contentIndex
 * @property {any} toolCall - Complete validated tool call
 * @property {any} partial
 * 
 * @typedef {Object} DoneEvent
 * @property {'done'} type
 * @property {'stop' | 'length' | 'toolUse'} reason
 * @property {any} message - Complete assistant message
 * 
 * @typedef {Object} ErrorEvent
 * @property {'error'} type
 * @property {'error' | 'aborted'} reason
 * @property {any} error - Assistant message with error
 */
