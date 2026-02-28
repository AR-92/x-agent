/**
 * Event emitter for agent events
 */
export class EventManager {
	/** @type {Set<(e: import("../types.js").AgentEvent) => void>} */
	listeners = new Set();

	/**
	 * Subscribe to agent events
	 * @param {(e: import("../types.js").AgentEvent) => void} fn
	 * @returns {() => void} Unsubscribe function
	 */
	subscribe(fn) {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	/**
	 * Emit an event to all listeners
	 * @param {import("../types.js").AgentEvent} e
	 */
	emit(e) {
		for (const listener of this.listeners) {
			listener(e);
		}
	}

	/**
	 * Clear all listeners
	 */
	clear() {
		this.listeners.clear();
	}
}
