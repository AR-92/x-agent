import { EventStream } from "@mariozechner/pi-ai";
import { describe, expect, it } from "bun:test";
import { agentLoop, agentLoopContinue } from "../src/agent-loop.js";

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

function createUsage() {
	return {
		input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function createModel() {
	return {
		id: "mock", name: "mock", api: "openai-responses", provider: "openai",
		baseUrl: "https://example.invalid", reasoning: false, input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192, maxTokens: 2048,
	};
}

function createAssistantMessage(content, stopReason = "stop") {
	return {
		role: "assistant", content, api: "openai-responses", provider: "openai",
		model: "mock", usage: createUsage(), stopReason, timestamp: Date.now(),
	};
}

function createUserMessage(text) {
	return { role: "user", content: text, timestamp: Date.now() };
}

function identityConverter(messages) {
	return messages.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult");
}

describe("agentLoop", () => {
	it("should emit events with AgentMessage types", async () => {
		const context = { systemPrompt: "You are helpful.", messages: [], tools: [] };
		const userPrompt = createUserMessage("Hello");
		const config = { model: createModel(), convertToLlm: identityConverter };

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({ type: "done", reason: "stop", message: createAssistantMessage([{ type: "text", text: "Hi!" }]) });
			});
			return stream;
		};

		const events = [];
		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);

		for await (const event of stream) {
			events.push(event);
		}

		const messages = await stream.result();
		expect(messages.length).toBe(2);
		expect(messages[0].role).toBe("user");
		expect(messages[1].role).toBe("assistant");

		const eventTypes = events.map((e) => e.type);
		expect(eventTypes).toContain("agent_start");
		expect(eventTypes).toContain("turn_start");
		expect(eventTypes).toContain("message_start");
		expect(eventTypes).toContain("message_end");
		expect(eventTypes).toContain("turn_end");
		expect(eventTypes).toContain("agent_end");
	});

	it("should handle custom message types via convertToLlm", async () => {
		const notification = { role: "notification", text: "Notification", timestamp: Date.now() };
		const context = { systemPrompt: "You are helpful.", messages: [notification], tools: [] };
		const userPrompt = createUserMessage("Hello");

		let convertedMessages = [];
		const config = {
			model: createModel(),
			convertToLlm: (messages) => {
				convertedMessages = messages.filter((m) => m.role !== "notification");
				return convertedMessages;
			},
		};

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({ type: "done", reason: "stop", message: createAssistantMessage([{ type: "text", text: "Response" }]) });
			});
			return stream;
		};

		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const _ of stream) {}

		expect(convertedMessages.length).toBe(1);
		expect(convertedMessages[0].role).toBe("user");
	});

	it("should apply transformContext before convertToLlm", async () => {
		const context = {
			systemPrompt: "You are helpful.",
			messages: [
				createUserMessage("msg1"),
				createAssistantMessage([{ type: "text", text: "resp1" }]),
				createUserMessage("msg2"),
				createAssistantMessage([{ type: "text", text: "resp2" }]),
			],
			tools: [],
		};
		const userPrompt = createUserMessage("new");

		let transformedMessages = [];
		const config = {
			model: createModel(),
			transformContext: async (messages) => {
				transformedMessages = messages.slice(-2);
				return transformedMessages;
			},
			convertToLlm: (messages) => messages.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult"),
		};

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({ type: "done", reason: "stop", message: createAssistantMessage([{ type: "text", text: "Response" }]) });
			});
			return stream;
		};

		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const _ of stream) {}

		expect(transformedMessages.length).toBe(2);
	});
});

describe("agentLoopContinue", () => {
	it("should throw when context has no messages", () => {
		const context = { systemPrompt: "You are helpful.", messages: [], tools: [] };
		const config = { model: createModel(), convertToLlm: identityConverter };
		expect(() => agentLoopContinue(context, config)).toThrow("Cannot continue: no messages in context");
	});

	it("should continue from existing context", async () => {
		const userMessage = createUserMessage("Hello");
		const context = { systemPrompt: "You are helpful.", messages: [userMessage], tools: [] };
		const config = { model: createModel(), convertToLlm: identityConverter };

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({ type: "done", reason: "stop", message: createAssistantMessage([{ type: "text", text: "Response" }]) });
			});
			return stream;
		};

		const events = [];
		const stream = agentLoopContinue(context, config, undefined, streamFn);

		for await (const event of stream) {
			events.push(event);
		}

		const messages = await stream.result();
		expect(messages.length).toBe(1);
		expect(messages[0].role).toBe("assistant");

		const messageEndEvents = events.filter((e) => e.type === "message_end");
		expect(messageEndEvents.length).toBe(1);
		expect(messageEndEvents[0].message.role).toBe("assistant");
	});

	it("should handle error response", async () => {
		const context = { systemPrompt: "You are helpful.", messages: [createUserMessage("Hello")], tools: [] };
		const config = { model: createModel(), convertToLlm: identityConverter };

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				const message = createAssistantMessage([{ type: "text", text: "" }], "error");
				message.errorMessage = "Something went wrong";
				stream.push({ type: "error", reason: "error", error: message });
			});
			return stream;
		};

		const events = [];
		const stream = agentLoopContinue(context, config, undefined, streamFn);

		for await (const event of stream) {
			events.push(event);
		}

		const turnEnd = events.find((e) => e.type === "turn_end");
		expect(turnEnd).toBeDefined();
		expect(turnEnd.message.errorMessage).toBe("Something went wrong");
	});
});
