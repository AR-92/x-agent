import { EventStream, getModel } from "@mariozechner/pi-ai";
import { describe, expect, it, beforeEach } from "bun:test";
import { Agent } from "../src/index.js";

// Mock stream for testing
class MockAssistantStream extends EventStream {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") return event.message;
				if (event.type === "error") return event.error;
				throw new Error("Unexpected event type");
			},
		);
	}
}

function createAssistantMessage(text, stopReason = "stop") {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai",
		model: "mock",
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

function createAssistantMessageWithToolCall(toolName, toolId, args) {
	return {
		role: "assistant",
		content: [{ type: "toolCall", id: toolId, name: toolName, arguments: args }],
		api: "openai-responses",
		provider: "openai",
		model: "mock",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp: Date.now(),
	};
}

describe("Agent", () => {
	let agent;

	beforeEach(() => {
		agent = null;
	});

	it("should create an agent instance with default state", () => {
		const agent = new Agent();

		expect(agent.state).toBeDefined();
		expect(agent.state.systemPrompt).toBe("");
		expect(agent.state.model).toBeDefined();
		expect(agent.state.thinkingLevel).toBe("off");
		expect(agent.state.tools).toEqual([]);
		expect(agent.state.messages).toEqual([]);
		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.streamMessage).toBe(null);
		expect(agent.state.pendingToolCalls.size).toBe(0);
		expect(agent.state.error).toBeUndefined();
	});

	it("should create an agent instance with custom initial state", () => {
		const customModel = getModel("openai", "gpt-4o-mini");
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: customModel,
				thinkingLevel: "low",
			},
		});

		expect(agent.state.systemPrompt).toBe("You are a helpful assistant.");
		expect(agent.state.model).toBe(customModel);
		expect(agent.state.thinkingLevel).toBe("low");
	});

	it("should subscribe to events", () => {
		const agent = new Agent();

		let eventCount = 0;
		const unsubscribe = agent.subscribe((_event) => {
			eventCount++;
		});

		expect(eventCount).toBe(0);

		agent.setSystemPrompt("Test prompt");
		expect(eventCount).toBe(0);
		expect(agent.state.systemPrompt).toBe("Test prompt");

		unsubscribe();
		agent.setSystemPrompt("Another prompt");
		expect(eventCount).toBe(0);
	});

	it("should update state with mutators", () => {
		const agent = new Agent();

		agent.setSystemPrompt("Custom prompt");
		expect(agent.state.systemPrompt).toBe("Custom prompt");

		const newModel = getModel("google", "gemini-2.5-flash");
		agent.setModel(newModel);
		expect(agent.state.model).toBe(newModel);

		agent.setThinkingLevel("high");
		expect(agent.state.thinkingLevel).toBe("high");

		const tools = [{ name: "test", description: "test tool" }];
		agent.setTools(tools);
		expect(agent.state.tools).toBe(tools);

		const messages = [{ role: "user", content: "Hello", timestamp: Date.now() }];
		agent.replaceMessages(messages);
		expect(agent.state.messages).toEqual(messages);

		const newMessage = { role: "assistant", content: [{ type: "text", text: "Hi" }] };
		agent.appendMessage(newMessage);
		expect(agent.state.messages).toHaveLength(2);
		expect(agent.state.messages[1]).toBe(newMessage);

		agent.clearMessages();
		expect(agent.state.messages).toEqual([]);
	});

	it("should support steering message queue", () => {
		const agent = new Agent();
		const message = { role: "user", content: "Steering message", timestamp: Date.now() };
		agent.steer(message);
		expect(agent.state.messages).not.toContainEqual(message);
	});

	it("should support follow-up message queue", () => {
		const agent = new Agent();
		const message = { role: "user", content: "Follow-up message", timestamp: Date.now() };
		agent.followUp(message);
		expect(agent.state.messages).not.toContainEqual(message);
	});

	it("should handle abort controller", () => {
		const agent = new Agent();
		expect(() => agent.abort()).not.toThrow();
	});

	it("should clear steering queue", () => {
		const agent = new Agent();
		agent.steer({ role: "user", content: "test", timestamp: Date.now() });
		agent.clearSteeringQueue();
		expect(agent.hasQueuedMessages()).toBe(false);
	});

	it("should clear follow-up queue", () => {
		const agent = new Agent();
		agent.followUp({ role: "user", content: "test", timestamp: Date.now() });
		agent.clearFollowUpQueue();
		expect(agent.hasQueuedMessages()).toBe(false);
	});

	it("should clear all queues", () => {
		const agent = new Agent();
		agent.steer({ role: "user", content: "test1", timestamp: Date.now() });
		agent.followUp({ role: "user", content: "test2", timestamp: Date.now() });
		agent.clearAllQueues();
		expect(agent.hasQueuedMessages()).toBe(false);
	});

	it("should reset agent state", () => {
		const agent = new Agent();
		agent.appendMessage({ role: "user", content: "test", timestamp: Date.now() });
		agent.reset();
		expect(agent.state.messages).toEqual([]);
		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.streamMessage).toBe(null);
		expect(agent.state.pendingToolCalls.size).toBe(0);
		expect(agent.state.error).toBeUndefined();
	});

	it("should set and get transport", () => {
		const agent = new Agent();
		expect(agent.transport).toBe("sse");
		agent.setTransport("http");
		expect(agent.transport).toBe("http");
	});

	it("should set and get maxRetryDelayMs", () => {
		const agent = new Agent();
		expect(agent.maxRetryDelayMs).toBeUndefined();
		agent.maxRetryDelayMs = 5000;
		expect(agent.maxRetryDelayMs).toBe(5000);
	});

	it("should set and get thinkingBudgets", () => {
		const agent = new Agent();
		expect(agent.thinkingBudgets).toBeUndefined();
		agent.thinkingBudgets = { minimal: 100, low: 200 };
		expect(agent.thinkingBudgets).toEqual({ minimal: 100, low: 200 });
	});

	it("should get steering mode", () => {
		const agent = new Agent();
		expect(agent.getSteeringMode()).toBe("one-at-a-time");
		agent.setSteeringMode("all");
		expect(agent.getSteeringMode()).toBe("all");
	});

	it("should get follow-up mode", () => {
		const agent = new Agent();
		expect(agent.getFollowUpMode()).toBe("one-at-a-time");
		agent.setFollowUpMode("all");
		expect(agent.getFollowUpMode()).toBe("all");
	});

	it("should dequeue steering messages in one-at-a-time mode", () => {
		const agent = new Agent({ steeringMode: "one-at-a-time" });
		agent.steer({ role: "user", content: "msg1", timestamp: Date.now() });
		agent.steer({ role: "user", content: "msg2", timestamp: Date.now() });
		
		const first = agent.dequeueSteeringMessages();
		expect(first).toHaveLength(1);
		
		const second = agent.dequeueSteeringMessages();
		expect(second).toHaveLength(1);
		
		const empty = agent.dequeueSteeringMessages();
		expect(empty).toHaveLength(0);
	});

	it("should dequeue steering messages in all mode", () => {
		const agent = new Agent({ steeringMode: "all" });
		agent.steer({ role: "user", content: "msg1", timestamp: Date.now() });
		agent.steer({ role: "user", content: "msg2", timestamp: Date.now() });
		
		const all = agent.dequeueSteeringMessages();
		expect(all).toHaveLength(2);
	});

	it("should dequeue follow-up messages in one-at-a-time mode", () => {
		const agent = new Agent({ followUpMode: "one-at-a-time" });
		agent.followUp({ role: "user", content: "msg1", timestamp: Date.now() });
		agent.followUp({ role: "user", content: "msg2", timestamp: Date.now() });
		
		const first = agent.dequeueFollowUpMessages();
		expect(first).toHaveLength(1);
		
		const second = agent.dequeueFollowUpMessages();
		expect(second).toHaveLength(1);
		
		const empty = agent.dequeueFollowUpMessages();
		expect(empty).toHaveLength(0);
	});

	it("should dequeue follow-up messages in all mode", () => {
		const agent = new Agent({ followUpMode: "all" });
		agent.followUp({ role: "user", content: "msg1", timestamp: Date.now() });
		agent.followUp({ role: "user", content: "msg2", timestamp: Date.now() });
		
		const all = agent.dequeueFollowUpMessages();
		expect(all).toHaveLength(2);
	});

	it("should throw when no model configured", async () => {
		const agent = new Agent({ initialState: { model: undefined } });
		try {
			await agent.prompt("test");
			throw new Error("Should have thrown");
		} catch (err) {
			expect(err.message).toBe("No model configured");
		}
	});

	it("should throw when continue with no messages", async () => {
		const agent = new Agent();
		try {
			await agent.continue();
			throw new Error("Should have thrown");
		} catch (err) {
			expect(err.message).toBe("No messages to continue from");
		}
	});

	it("should throw when continue from assistant message", async () => {
		const agent = new Agent();
		agent.appendMessage({ role: "assistant", content: [{ type: "text", text: "Hi" }], timestamp: Date.now() });
		try {
			await agent.continue();
			throw new Error("Should have thrown");
		} catch (err) {
			expect(err.message).toBe("Cannot continue from message role: assistant");
		}
	});

	it("should throw when prompt called while streaming", async () => {
		let streamResolve;
		const streamPromise = new Promise((resolve) => {
			streamResolve = resolve;
		});

		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				streamPromise.then(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("OK") });
				});
				return stream;
			},
		});

		const firstPrompt = agent.prompt("First message");
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(agent.state.isStreaming).toBe(true);

		try {
			await agent.prompt("Second message");
			throw new Error("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("Agent is already processing");
		}

		streamResolve();
		await firstPrompt;
	});

	it("should throw when continue called while streaming", async () => {
		let streamResolve;
		const streamPromise = new Promise((resolve) => {
			streamResolve = resolve;
		});

		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				streamPromise.then(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("OK") });
				});
				return stream;
			},
		});

		const firstPrompt = agent.prompt("First message");
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(agent.state.isStreaming).toBe(true);

		try {
			await agent.continue();
			throw new Error("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("Agent is already processing");
		}

		streamResolve();
		await firstPrompt;
	});

	it("should handle prompt with array of messages", async () => {
		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("OK") });
				});
				return stream;
			},
		});

		const messages = [
			{ role: "user", content: "msg1", timestamp: Date.now() },
			{ role: "user", content: "msg2", timestamp: Date.now() },
		];
		await agent.prompt(messages);
		expect(agent.state.messages).toHaveLength(3);
	});

	it("should handle prompt with images", async () => {
		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("OK") });
				});
				return stream;
			},
		});

		await agent.prompt("What's in this image?", [
			{ type: "image", data: "base64data", mimeType: "image/jpeg" },
		]);
		expect(agent.state.messages[0].content).toHaveLength(2);
	});

	it("should handle prompt with AgentMessage directly", async () => {
		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("OK") });
				});
				return stream;
			},
		});

		await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });
		expect(agent.state.messages[0].content).toBe("Hello");
	});

	it("should handle error in stream", async () => {
		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					const errorMsg = createAssistantMessage("", "error");
					errorMsg.errorMessage = "Test error";
					stream.push({ type: "start", partial: errorMsg });
					stream.push({ type: "error", reason: "error", error: errorMsg });
				});
				return stream;
			},
		});

		await agent.prompt("test");
		expect(agent.state.error).toBeDefined();
		expect(agent.state.error).toBe("Test error");
	});

	it("should handle abort during streaming", async () => {
		const agent = new Agent({
			streamFn: (_model, _context, options) => {
				const stream = new MockAssistantStream();
				const onAbort = () => {
					const errorMsg = createAssistantMessage("", "aborted");
					errorMsg.errorMessage = "Aborted";
					stream.push({ type: "error", reason: "aborted", error: errorMsg });
				};
				if (options?.signal) {
					options.signal.addEventListener("abort", onAbort);
				}
				return stream;
			},
		});

		const promptPromise = agent.prompt("test");
		await new Promise((resolve) => setTimeout(resolve, 10));
		agent.abort();
		await promptPromise.catch(() => {});
		
		expect(agent.state.isStreaming).toBe(false);
	});

	it("should process queued follow-up messages after assistant turn", async () => {
		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Processed") });
				});
				return stream;
			},
		});

		agent.replaceMessages([
			{ role: "user", content: [{ type: "text", text: "Initial" }], timestamp: Date.now() - 10 },
			createAssistantMessage("Initial response"),
		]);

		agent.followUp({
			role: "user",
			content: [{ type: "text", text: "Queued follow-up" }],
			timestamp: Date.now(),
		});

		await agent.continue();

		const hasQueuedFollowUp = agent.state.messages.some((message) => {
			if (message.role !== "user") return false;
			if (typeof message.content === "string") return message.content === "Queued follow-up";
			return message.content.some((part) => part.type === "text" && part.text === "Queued follow-up");
		});

		expect(hasQueuedFollowUp).toBe(true);
	});

	it("should keep one-at-a-time steering semantics", async () => {
		let responseCount = 0;
		const agent = new Agent({
			streamFn: () => {
				const stream = new MockAssistantStream();
				responseCount++;
				queueMicrotask(() => {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage(`Processed ${responseCount}`),
					});
				});
				return stream;
			},
		});

		agent.replaceMessages([
			{ role: "user", content: [{ type: "text", text: "Initial" }], timestamp: Date.now() - 10 },
			createAssistantMessage("Initial response"),
		]);

		agent.steer({ role: "user", content: [{ type: "text", text: "Steering 1" }], timestamp: Date.now() });
		agent.steer({ role: "user", content: [{ type: "text", text: "Steering 2" }], timestamp: Date.now() + 1 });

		await agent.continue();

		const recentMessages = agent.state.messages.slice(-4);
		expect(recentMessages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
		expect(responseCount).toBe(2);
	});

	it("forwards sessionId to streamFn options", async () => {
		let receivedSessionId;
		const agent = new Agent({
			sessionId: "session-abc",
			streamFn: (_model, _context, options) => {
				receivedSessionId = options?.sessionId;
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("ok") });
				});
				return stream;
			},
		});

		await agent.prompt("hello");
		expect(receivedSessionId).toBe("session-abc");

		agent.sessionId = "session-def";
		expect(agent.sessionId).toBe("session-def");

		await agent.prompt("hello again");
		expect(receivedSessionId).toBe("session-def");
	});

	it("should handle tool calls and results", async () => {
		const executed = [];
		const tool = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: { type: "object", properties: { value: { type: "string" } } },
			async execute(_toolCallId, params) {
				executed.push(params.value);
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		let callCount = 0;
		const agent = new Agent({
			initialState: { tools: [tool] },
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (callCount === 0) {
						stream.push({ type: "done", reason: "toolUse", message: createAssistantMessageWithToolCall("echo", "tool-1", { value: "hello" }) });
					} else {
						stream.push({ type: "done", reason: "stop", message: createAssistantMessage("done") });
					}
					callCount++;
				});
				return stream;
			},
		});

		await agent.prompt("echo something");

		expect(executed).toEqual(["hello"]);
		expect(agent.state.messages.some((m) => m.role === "toolResult")).toBe(true);
	});
});
