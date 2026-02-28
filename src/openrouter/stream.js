/**
 * OpenRouter Event Stream
 * Compatible with X-Agent event system
 */

/**
 * Create an OpenRouter event stream
 * @returns {any} EventStream compatible with X-Agent
 */
export function createOpenRouterStream() {
	const listeners = new Set();
	let result = null;
	let resultResolver = null;
	const resultPromise = new Promise((resolve) => {
		resultResolver = resolve;
	});

	return {
		/**
		 * Push an event to all listeners
		 * @param {any} event
		 */
		push(event) {
			for (const listener of listeners) {
				listener(event);
			}

			// Handle terminal events
			if (event.type === 'done' || event.type === 'error') {
				result = event.type === 'done' ? event.message : event.error;
				resultResolver(result);
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
		},
	};
}
