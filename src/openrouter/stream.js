/**
 * OpenRouter Event Stream
 * Complete implementation matching pi-ai EventStream with all event types
 */

import { createLogger } from '../logger.js';

const log = createLogger('OpenRouter.Stream');

/**
 * Create an OpenRouter event stream compatible with X-Agent
 * Emits all event types: start, text_*, thinking_*, toolcall_*, done, error
 *
 * @returns {any} EventStream
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
