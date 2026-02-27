/**
 * Agent class that uses the agent-loop directly.
 * No transport abstraction - calls streamSimple via the loop.
 */

import {
	getModel,
	streamSimple,
} from "@mariozechner/pi-ai";
import { agentLoop, agentLoopContinue } from "./agent-loop.js";

/**
 * Default convertToLlm: Keep only LLM-compatible messages
 * @param {import("./types.js").AgentMessage[]} messages
 * @returns {import("@mariozechner/pi-ai").Message[]}
 */
function defaultConvertToLlm(messages) {
	return messages.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult");
}

/**
 * Agent class for stateful AI conversations with tool execution
 */
export class Agent {
	_state = {
		systemPrompt: "",
		model: getModel("google", "gemini-2.5-flash-lite-preview-06-17"),
		thinkingLevel: "off",
		tools: [],
		messages: [],
		isStreaming: false,
		streamMessage: null,
		pendingToolCalls: new Set(),
		error: undefined,
	};

	listeners = new Set();
	abortController = undefined;
	convertToLlm;
	transformContext;
	steeringQueue = [];
	followUpQueue = [];
	steeringMode = "one-at-a-time";
	followUpMode = "one-at-a-time";
	streamFn;
	_sessionId = undefined;
	getApiKey = undefined;
	runningPrompt = undefined;
	resolveRunningPrompt = undefined;
	_thinkingBudgets = undefined;
	_transport = "sse";
	_maxRetryDelayMs = undefined;

	/**
	 * @param {Object} [opts]
	 * @param {Partial<import("./types.js").AgentState>} [opts.initialState]
	 * @param {(messages: import("./types.js").AgentMessage[]) => import("@mariozechner/pi-ai").Message[] | Promise<import("@mariozechner/pi-ai").Message[]>} [opts.convertToLlm]
	 * @param {(messages: import("./types.js").AgentMessage[], signal?: AbortSignal) => Promise<import("./types.js").AgentMessage[]>} [opts.transformContext]
	 * @param {"all" | "one-at-a-time"} [opts.steeringMode]
	 * @param {"all" | "one-at-a-time"} [opts.followUpMode]
	 * @param {import("./types.js").StreamFn} [opts.streamFn]
	 * @param {string} [opts.sessionId]
	 * @param {(provider: string) => Promise<string | undefined> | string | undefined} [opts.getApiKey]
	 * @param {import("@mariozechner/pi-ai").ThinkingBudgets} [opts.thinkingBudgets]
	 * @param {import("@mariozechner/pi-ai").Transport} [opts.transport]
	 * @param {number} [opts.maxRetryDelayMs]
	 */
	constructor(opts = {}) {
		this._state = { ...this._state, ...opts.initialState };
		this.convertToLlm = opts.convertToLlm || defaultConvertToLlm;
		this.transformContext = opts.transformContext;
		this.steeringMode = opts.steeringMode || "one-at-a-time";
		this.followUpMode = opts.followUpMode || "one-at-a-time";
		this.streamFn = opts.streamFn || streamSimple;
		this._sessionId = opts.sessionId;
		this.getApiKey = opts.getApiKey;
		this._thinkingBudgets = opts.thinkingBudgets;
		this._transport = opts.transport ?? "sse";
		this._maxRetryDelayMs = opts.maxRetryDelayMs;
	}

	/**
	 * Get the current session ID used for provider caching.
	 * @returns {string | undefined}
	 */
	get sessionId() {
		return this._sessionId;
	}

	/**
	 * Set the session ID for provider caching.
	 * @param {string | undefined} value
	 */
	set sessionId(value) {
		this._sessionId = value;
	}

	/**
	 * Get the current thinking budgets.
	 * @returns {import("@mariozechner/pi-ai").ThinkingBudgets | undefined}
	 */
	get thinkingBudgets() {
		return this._thinkingBudgets;
	}

	/**
	 * Set custom thinking budgets for token-based providers.
	 * @param {import("@mariozechner/pi-ai").ThinkingBudgets | undefined} value
	 */
	set thinkingBudgets(value) {
		this._thinkingBudgets = value;
	}

	/**
	 * Get the current preferred transport.
	 * @returns {import("@mariozechner/pi-ai").Transport}
	 */
	get transport() {
		return this._transport;
	}

	/**
	 * Set the preferred transport.
	 * @param {import("@mariozechner/pi-ai").Transport} value
	 */
	setTransport(value) {
		this._transport = value;
	}

	/**
	 * Get the current max retry delay in milliseconds.
	 * @returns {number | undefined}
	 */
	get maxRetryDelayMs() {
		return this._maxRetryDelayMs;
	}

	/**
	 * Set the maximum delay to wait for server-requested retries.
	 * @param {number | undefined} value
	 */
	set maxRetryDelayMs(value) {
		this._maxRetryDelayMs = value;
	}

	/**
	 * Get the current agent state.
	 * @returns {import("./types.js").AgentState}
	 */
	get state() {
		return this._state;
	}

	/**
	 * Subscribe to agent events.
	 * @param {(e: import("./types.js").AgentEvent) => void} fn
	 * @returns {() => void}
	 */
	subscribe(fn) {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	/**
	 * Set the system prompt.
	 * @param {string} v
	 */
	setSystemPrompt(v) {
		this._state.systemPrompt = v;
	}

	/**
	 * Set the model.
	 * @param {import("@mariozechner/pi-ai").Model<any>} m
	 */
	setModel(m) {
		this._state.model = m;
	}

	/**
	 * Set the thinking level.
	 * @param {import("./types.js").ThinkingLevel} l
	 */
	setThinkingLevel(l) {
		this._state.thinkingLevel = l;
	}

	/**
	 * Set the steering mode.
	 * @param {"all" | "one-at-a-time"} mode
	 */
	setSteeringMode(mode) {
		this.steeringMode = mode;
	}

	/**
	 * Get the steering mode.
	 * @returns {"all" | "one-at-a-time"}
	 */
	getSteeringMode() {
		return this.steeringMode;
	}

	/**
	 * Set the follow-up mode.
	 * @param {"all" | "one-at-a-time"} mode
	 */
	setFollowUpMode(mode) {
		this.followUpMode = mode;
	}

	/**
	 * Get the follow-up mode.
	 * @returns {"all" | "one-at-a-time"}
	 */
	getFollowUpMode() {
		return this.followUpMode;
	}

	/**
	 * Set the tools.
	 * @param {import("./types.js").AgentTool<any>[]} t
	 */
	setTools(t) {
		this._state.tools = t;
	}

	/**
	 * Replace all messages.
	 * @param {import("./types.js").AgentMessage[]} ms
	 */
	replaceMessages(ms) {
		this._state.messages = ms.slice();
	}

	/**
	 * Append a message.
	 * @param {import("./types.js").AgentMessage} m
	 */
	appendMessage(m) {
		this._state.messages = [...this._state.messages, m];
	}

	/**
	 * Queue a steering message to interrupt the agent mid-run.
	 * @param {import("./types.js").AgentMessage} m
	 */
	steer(m) {
		this.steeringQueue.push(m);
	}

	/**
	 * Queue a follow-up message to be processed after the agent finishes.
	 * @param {import("./types.js").AgentMessage} m
	 */
	followUp(m) {
		this.followUpQueue.push(m);
	}

	/**
	 * Clear the steering queue.
	 */
	clearSteeringQueue() {
		this.steeringQueue = [];
	}

	/**
	 * Clear the follow-up queue.
	 */
	clearFollowUpQueue() {
		this.followUpQueue = [];
	}

	/**
	 * Clear all queues.
	 */
	clearAllQueues() {
		this.steeringQueue = [];
		this.followUpQueue = [];
	}

	/**
	 * Check if there are queued messages.
	 * @returns {boolean}
	 */
	hasQueuedMessages() {
		return this.steeringQueue.length > 0 || this.followUpQueue.length > 0;
	}

	/**
	 * Dequeue steering messages based on mode.
	 * @returns {import("./types.js").AgentMessage[]}
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
	 * Dequeue follow-up messages based on mode.
	 * @returns {import("./types.js").AgentMessage[]}
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

	/**
	 * Clear all messages.
	 */
	clearMessages() {
		this._state.messages = [];
	}

	/**
	 * Abort the current operation.
	 */
	abort() {
		this.abortController?.abort();
	}

	/**
	 * Wait for the agent to become idle.
	 * @returns {Promise<void>}
	 */
	waitForIdle() {
		return this.runningPrompt ?? Promise.resolve();
	}

	/**
	 * Reset the agent state.
	 */
	reset() {
		this._state.messages = [];
		this._state.isStreaming = false;
		this._state.streamMessage = null;
		this._state.pendingToolCalls = new Set();
		this._state.error = undefined;
		this.steeringQueue = [];
		this.followUpQueue = [];
	}

	/**
	 * Send a prompt.
	 * @param {string | import("./types.js").AgentMessage | import("./types.js").AgentMessage[]} input
	 * @param {import("@mariozechner/pi-ai").ImageContent[]} [images]
	 */
	async prompt(input, images) {
		if (this._state.isStreaming) {
			throw new Error(
				"Agent is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.",
			);
		}

		const model = this._state.model;
		if (!model) throw new Error("No model configured");

		let msgs;

		if (Array.isArray(input)) {
			msgs = input;
		} else if (typeof input === "string") {
			const content = [{ type: "text", text: input }];
			if (images && images.length > 0) {
				content.push(...images);
			}
			msgs = [
				{
					role: "user",
					content,
					timestamp: Date.now(),
				},
			];
		} else {
			msgs = [input];
		}

		await this._runLoop(msgs);
	}

	/**
	 * Continue from current context.
	 */
	async continue() {
		if (this._state.isStreaming) {
			throw new Error("Agent is already processing. Wait for completion before continuing.");
		}

		const messages = this._state.messages;
		if (messages.length === 0) {
			throw new Error("No messages to continue from");
		}
		if (messages[messages.length - 1].role === "assistant") {
			const queuedSteering = this.dequeueSteeringMessages();
			if (queuedSteering.length > 0) {
				await this._runLoop(queuedSteering, { skipInitialSteeringPoll: true });
				return;
			}

			const queuedFollowUp = this.dequeueFollowUpMessages();
			if (queuedFollowUp.length > 0) {
				await this._runLoop(queuedFollowUp);
				return;
			}

			throw new Error("Cannot continue from message role: assistant");
		}

		await this._runLoop(undefined);
	}

	/**
	 * Run the agent loop.
	 * @param {import("./types.js").AgentMessage[]} [messages]
	 * @param {{ skipInitialSteeringPoll?: boolean }} [options]
	 */
	async _runLoop(messages, options) {
		const model = this._state.model;
		if (!model) throw new Error("No model configured");

		this.runningPrompt = new Promise((resolve) => {
			this.resolveRunningPrompt = resolve;
		});

		this.abortController = new AbortController();
		this._state.isStreaming = true;
		this._state.streamMessage = null;
		this._state.error = undefined;

		const reasoning = this._state.thinkingLevel === "off" ? undefined : this._state.thinkingLevel;

		const context = {
			systemPrompt: this._state.systemPrompt,
			messages: this._state.messages.slice(),
			tools: this._state.tools,
		};

		let skipInitialSteeringPoll = options?.skipInitialSteeringPoll === true;

		const config = {
			model,
			reasoning,
			sessionId: this._sessionId,
			transport: this._transport,
			thinkingBudgets: this._thinkingBudgets,
			maxRetryDelayMs: this._maxRetryDelayMs,
			convertToLlm: this.convertToLlm,
			transformContext: this.transformContext,
			getApiKey: this.getApiKey,
			getSteeringMessages: async () => {
				if (skipInitialSteeringPoll) {
					skipInitialSteeringPoll = false;
					return [];
				}
				return this.dequeueSteeringMessages();
			},
			getFollowUpMessages: async () => this.dequeueFollowUpMessages(),
		};

		let partial = null;

		try {
			const stream = messages
				? agentLoop(messages, context, config, this.abortController.signal, this.streamFn)
				: agentLoopContinue(context, config, this.abortController.signal, this.streamFn);

			for await (const event of stream) {
				// Update internal state based on events
				switch (event.type) {
					case "message_start":
						partial = event.message;
						this._state.streamMessage = event.message;
						break;

					case "message_update":
						partial = event.message;
						this._state.streamMessage = event.message;
						break;

					case "message_end":
						partial = null;
						this._state.streamMessage = null;
						this.appendMessage(event.message);
						break;

					case "tool_execution_start": {
						const s = new Set(this._state.pendingToolCalls);
						s.add(event.toolCallId);
						this._state.pendingToolCalls = s;
						break;
					}

					case "tool_execution_end": {
						const s = new Set(this._state.pendingToolCalls);
						s.delete(event.toolCallId);
						this._state.pendingToolCalls = s;
						break;
					}

					case "turn_end":
						if (event.message.role === "assistant" && event.message.errorMessage) {
							this._state.error = event.message.errorMessage;
						}
						break;

					case "agent_end":
						this._state.isStreaming = false;
						this._state.streamMessage = null;
						break;
				}

				// Emit to listeners
				this.emit(event);
			}

			// Handle any remaining partial message
			if (partial && partial.role === "assistant" && partial.content.length > 0) {
				const onlyEmpty = !partial.content.some(
					(c) =>
						(c.type === "thinking" && c.thinking.trim().length > 0) ||
						(c.type === "text" && c.text.trim().length > 0) ||
						(c.type === "toolCall" && c.name.trim().length > 0),
				);
				if (!onlyEmpty) {
					this.appendMessage(partial);
				} else {
					if (this.abortController?.signal.aborted) {
						throw new Error("Request was aborted");
					}
				}
			}
		} catch (err) {
			const errorMsg = {
				role: "assistant",
				content: [{ type: "text", text: "" }],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: this.abortController?.signal.aborted ? "aborted" : "error",
				errorMessage: err?.message || String(err),
				timestamp: Date.now(),
			};

			this.appendMessage(errorMsg);
			this._state.error = err?.message || String(err);
			this.emit({ type: "agent_end", messages: [errorMsg] });
		} finally {
			this._state.isStreaming = false;
			this._state.streamMessage = null;
			this._state.pendingToolCalls = new Set();
			this.abortController = undefined;
			this.resolveRunningPrompt?.();
			this.runningPrompt = undefined;
			this.resolveRunningPrompt = undefined;
		}
	}

	/**
	 * Emit an event to all listeners.
	 * @param {import("./types.js").AgentEvent} e
	 */
	emit(e) {
		for (const listener of this.listeners) {
			listener(e);
		}
	}
}
