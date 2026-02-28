import { getModel, streamSimple } from "@mariozechner/pi-ai";
import { agentLoop, agentLoopContinue } from "../loop/loop.js";
import { createState } from "./state.js";
import { EventManager } from "./events.js";
import { QueueManager } from "./queues.js";

/**
 * Default convertToLlm: Keep only LLM-compatible messages
 * @param {import("../types.js").AgentMessage[]} messages
 * @returns {import("@mariozechner/pi-ai").Message[]}
 */
function defaultConvertToLlm(messages) {
	return messages.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult");
}

/**
 * Agent class for stateful AI conversations with tool execution
 */
export class Agent {
	/** @type {import("../types.js").AgentState} */
	_state;

	/** @type {EventManager} */
	_events;

	/** @type {QueueManager} */
	_queues;

	/** @type {(messages: import("../types.js").AgentMessage[]) => import("@mariozechner/pi-ai").Message[] | Promise<import("@mariozechner/pi-ai").Message[]>} */
	_convertToLlm;

	/** @type {(messages: import("../types.js").AgentMessage[], signal?: AbortSignal) => Promise<import("../types.js").AgentMessage[]> | undefined} */
	_transformContext;

	/** @type {import("../types.js").StreamFn} */
	_streamFn;

	/** @type {string | undefined} */
	_sessionId;

	/** @type {((provider: string) => Promise<string | undefined> | string | undefined) | undefined} */
	_getApiKey;

	/** @type {Promise<void> | undefined} */
	_runningPrompt;

	/** @type {(() => void) | undefined} */
	_resolveRunningPrompt;

	/** @type {import("@mariozechner/pi-ai").ThinkingBudgets | undefined} */
	_thinkingBudgets;

	/** @type {import("@mariozechner/pi-ai").Transport} */
	_transport;

	/** @type {number | undefined} */
	_maxRetryDelayMs;

	/** @type {AbortController | undefined} */
	_abortController;

	/**
	 * @param {import("../types.js").AgentOptions} [opts]
	 */
	constructor(opts = {}) {
		this._state = createState(opts.initialState);
		if (!this._state.model) {
			this._state.model = getModel("google", "gemini-2.5-flash-lite-preview-06-17");
		}

		this._events = new EventManager();
		this._queues = new QueueManager();

		this._convertToLlm = opts.convertToLlm || defaultConvertToLlm;
		this._transformContext = opts.transformContext;
		this._queues.setSteeringMode(opts.steeringMode || "one-at-a-time");
		this._queues.setFollowUpMode(opts.followUpMode || "one-at-a-time");
		this._streamFn = opts.streamFn || streamSimple;
		this._sessionId = opts.sessionId;
		this._getApiKey = opts.getApiKey;
		this._thinkingBudgets = opts.thinkingBudgets;
		this._transport = opts.transport ?? "sse";
		this._maxRetryDelayMs = opts.maxRetryDelayMs;
	}

	// ========== Session ID ==========

	get sessionId() {
		return this._sessionId;
	}

	set sessionId(value) {
		this._sessionId = value;
	}

	// ========== Thinking Budgets ==========

	get thinkingBudgets() {
		return this._thinkingBudgets;
	}

	set thinkingBudgets(value) {
		this._thinkingBudgets = value;
	}

	// ========== Transport ==========

	get transport() {
		return this._transport;
	}

	setTransport(value) {
		this._transport = value;
	}

	// ========== Max Retry Delay ==========

	get maxRetryDelayMs() {
		return this._maxRetryDelayMs;
	}

	set maxRetryDelayMs(value) {
		this._maxRetryDelayMs = value;
	}

	// ========== State ==========

	get state() {
		return this._state;
	}

	// ========== Events ==========

	subscribe(fn) {
		return this._events.subscribe(fn);
	}

	// ========== State Mutators ==========

	setSystemPrompt(v) {
		this._state.systemPrompt = v;
	}

	setModel(m) {
		this._state.model = m;
	}

	setThinkingLevel(l) {
		this._state.thinkingLevel = l;
	}

	setTools(t) {
		this._state.tools = t;
	}

	replaceMessages(ms) {
		this._state.messages = ms.slice();
	}

	appendMessage(m) {
		this._state.messages = [...this._state.messages, m];
	}

	clearMessages() {
		this._state.messages = [];
	}

	reset() {
		this._state.messages = [];
		this._state.isStreaming = false;
		this._state.streamMessage = null;
		this._state.pendingToolCalls = new Set();
		this._state.error = undefined;
		this._queues.clearAllQueues();
	}

	// ========== Queues ==========

	steer(m) {
		this._queues.steer(m);
	}

	followUp(m) {
		this._queues.followUp(m);
	}

	clearSteeringQueue() {
		this._queues.clearSteeringQueue();
	}

	clearFollowUpQueue() {
		this._queues.clearFollowUpQueue();
	}

	clearAllQueues() {
		this._queues.clearAllQueues();
	}

	hasQueuedMessages() {
		return this._queues.hasQueuedMessages();
	}

	getSteeringMode() {
		return this._queues.getSteeringMode();
	}

	setSteeringMode(mode) {
		this._queues.setSteeringMode(mode);
	}

	getFollowUpMode() {
		return this._queues.getFollowUpMode();
	}

	setFollowUpMode(mode) {
		this._queues.setFollowUpMode(mode);
	}

	// ========== Control ==========

	abort() {
		this._abortController?.abort();
	}

	waitForIdle() {
		return this._runningPrompt ?? Promise.resolve();
	}

	// ========== Prompting ==========

	/**
	 * Send a prompt
	 * @param {string | import("../types.js").AgentMessage | import("../types.js").AgentMessage[]} input
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
	 * Continue from current context
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
			const queuedSteering = this._queues.dequeueSteeringMessages();
			if (queuedSteering.length > 0) {
				await this._runLoop(queuedSteering, { skipInitialSteeringPoll: true });
				return;
			}

			const queuedFollowUp = this._queues.dequeueFollowUpMessages();
			if (queuedFollowUp.length > 0) {
				await this._runLoop(queuedFollowUp);
				return;
			}

			throw new Error("Cannot continue from message role: assistant");
		}

		await this._runLoop(undefined);
	}

	// ========== Internal ==========

	/**
	 * Run the agent loop
	 * @param {import("../types.js").AgentMessage[]} [messages]
	 * @param {{ skipInitialSteeringPoll?: boolean }} [options]
	 */
	async _runLoop(messages, options) {
		const model = this._state.model;
		if (!model) throw new Error("No model configured");

		this._runningPrompt = new Promise((resolve) => {
			this._resolveRunningPrompt = resolve;
		});

		this._abortController = new AbortController();
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
			convertToLlm: this._convertToLlm,
			transformContext: this._transformContext,
			getApiKey: this._getApiKey,
			getSteeringMessages: async () => {
				if (skipInitialSteeringPoll) {
					skipInitialSteeringPoll = false;
					return [];
				}
				return this._queues.dequeueSteeringMessages();
			},
			getFollowUpMessages: async () => this._queues.dequeueFollowUpMessages(),
		};

		let partial = null;

		try {
			const stream = messages
				? agentLoop(messages, context, config, this._abortController.signal, this._streamFn)
				: agentLoopContinue(context, config, this._abortController.signal, this._streamFn);

			for await (const event of stream) {
				// Update internal state based on events
				switch (event.type) {
					case "message_start":
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
				this._events.emit(event);
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
					if (this._abortController?.signal.aborted) {
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
				stopReason: this._abortController?.signal.aborted ? "aborted" : "error",
				errorMessage: err?.message || String(err),
				timestamp: Date.now(),
			};

			this.appendMessage(errorMsg);
			this._state.error = err?.message || String(err);
			this._events.emit({ type: "agent_end", messages: [errorMsg] });
		} finally {
			this._state.isStreaming = false;
			this._state.streamMessage = null;
			this._state.pendingToolCalls = new Set();
			this._abortController = undefined;
			this._resolveRunningPrompt?.();
			this._runningPrompt = undefined;
			this._resolveRunningPrompt = undefined;
		}
	}
}
