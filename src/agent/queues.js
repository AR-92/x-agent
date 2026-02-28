/**
 * Queue manager for steering and follow-up messages
 */
export class QueueManager {
	/** @type {import("../types.js").AgentMessage[]} */
	steeringQueue = [];

	/** @type {import("../types.js").AgentMessage[]} */
	followUpQueue = [];

	/** @type {"all" | "one-at-a-time"} */
	steeringMode = "one-at-a-time";

	/** @type {"all" | "one-at-a-time"} */
	followUpMode = "one-at-a-time";

	/**
	 * Set steering mode
	 * @param {"all" | "one-at-a-time"} mode
	 */
	setSteeringMode(mode) {
		this.steeringMode = mode;
	}

	/**
	 * Get steering mode
	 * @returns {"all" | "one-at-a-time"}
	 */
	getSteeringMode() {
		return this.steeringMode;
	}

	/**
	 * Set follow-up mode
	 * @param {"all" | "one-at-a-time"} mode
	 */
	setFollowUpMode(mode) {
		this.followUpMode = mode;
	}

	/**
	 * Get follow-up mode
	 * @returns {"all" | "one-at-a-time"}
	 */
	getFollowUpMode() {
		return this.followUpMode;
	}

	/**
	 * Queue a steering message
	 * @param {import("../types.js").AgentMessage} message
	 */
	steer(message) {
		this.steeringQueue.push(message);
	}

	/**
	 * Queue a follow-up message
	 * @param {import("../types.js").AgentMessage} message
	 */
	followUp(message) {
		this.followUpQueue.push(message);
	}

	/**
	 * Clear steering queue
	 */
	clearSteeringQueue() {
		this.steeringQueue = [];
	}

	/**
	 * Clear follow-up queue
	 */
	clearFollowUpQueue() {
		this.followUpQueue = [];
	}

	/**
	 * Clear all queues
	 */
	clearAllQueues() {
		this.steeringQueue = [];
		this.followUpQueue = [];
	}

	/**
	 * Check if there are queued messages
	 * @returns {boolean}
	 */
	hasQueuedMessages() {
		return this.steeringQueue.length > 0 || this.followUpQueue.length > 0;
	}

	/**
	 * Dequeue steering messages based on mode
	 * @returns {import("../types.js").AgentMessage[]}
	 */
	dequeueSteeringMessages() {
		if (this.steeringMode === "one-at-a-time") {
			if (this.steeringQueue.length > 0) {
				const first = this.steeringQueue[0];
				this.steeringQueue = this.steeringQueue.slice(1);
				return [first];
			}
			return [];
		}
		const steering = this.steeringQueue.slice();
		this.steeringQueue = [];
		return steering;
	}

	/**
	 * Dequeue follow-up messages based on mode
	 * @returns {import("../types.js").AgentMessage[]}
	 */
	dequeueFollowUpMessages() {
		if (this.followUpMode === "one-at-a-time") {
			if (this.followUpQueue.length > 0) {
				const first = this.followUpQueue[0];
				this.followUpQueue = this.followUpQueue.slice(1);
				return [first];
			}
			return [];
		}
		const followUp = this.followUpQueue.slice();
		this.followUpQueue = [];
		return followUp;
	}
}
