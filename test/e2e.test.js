import { EventStream, getModel } from "@mariozechner/pi-ai";
import { describe, expect, it } from "bun:test";
import { Agent } from "../src/index.js";
import { calculateTool } from "./utils/calculate.js";
import { getCurrentTimeTool } from "./utils/get-current-time.js";

// Mock stream that mimics AssistantMessageEventStream
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
			input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
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
			input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp: Date.now(),
	};
}

function createToolResult(toolCallId, toolName, text, isError = false) {
	return {
		role: "toolResult",
		toolCallId,
		toolName,
		content: [{ type: "text", text }],
		isError,
		timestamp: Date.now(),
	};
}

describe("Agent E2E Tests", () => {
	it("should handle basic text prompt", async () => {
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("google", "gemini-2.5-flash"),
				thinkingLevel: "off",
				tools: [],
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("4") });
				});
				return stream;
			},
		});

		await agent.prompt("What is 2+2? Answer with just the number.");

		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.messages.length).toBe(2);
		expect(agent.state.messages[0].role).toBe("user");
		expect(agent.state.messages[1].role).toBe("assistant");
		expect(agent.state.messages[1].content[0].text).toContain("4");
	});

	it("should execute calculate tool correctly", async () => {
		let callCount = 0;
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("google", "gemini-2.5-flash"),
				thinkingLevel: "off",
				tools: [calculateTool],
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (callCount === 0) {
						stream.push({
							type: "done", reason: "toolUse",
							message: createAssistantMessageWithToolCall("calculate", "calc-1", { expression: "123 * 456" }),
						});
					} else {
						stream.push({ type: "done", reason: "stop", message: createAssistantMessage("The result is 56088") });
					}
					callCount++;
				});
				return stream;
			},
		});

		await agent.prompt("Calculate 123 * 456.");

		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.messages.length).toBeGreaterThanOrEqual(3);
		expect(agent.state.messages.some((m) => m.role === "toolResult")).toBe(true);
	});

	it("should handle abort during execution", async () => {
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("google", "gemini-2.5-flash"),
				thinkingLevel: "off",
				tools: [],
			},
			streamFn: (_model, _context, options) => {
				const stream = new MockAssistantStream();
				const onAbort = () => {
					const errorMsg = createAssistantMessage("", "aborted");
					errorMsg.errorMessage = "Aborted by user";
					stream.push({ type: "error", reason: "aborted", error: errorMsg });
				};
				if (options?.signal) {
					options.signal.addEventListener("abort", onAbort);
				}
				return stream;
			},
		});

		const promptPromise = agent.prompt("Calculate something.");
		setTimeout(() => agent.abort(), 50);
		await promptPromise.catch(() => {});

		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.error).toBeDefined();
	});

	it("should emit state updates during streaming", async () => {
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("google", "gemini-2.5-flash"),
				thinkingLevel: "off",
				tools: [],
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					stream.push({ type: "text_delta", contentIndex: 0, delta: "Hello", partial: createAssistantMessage("Hello") });
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Hello") });
				});
				return stream;
			},
		});

		const events = [];
		agent.subscribe((event) => events.push(event.type));

		await agent.prompt("Say hello.");

		expect(events).toContain("agent_start");
		expect(events).toContain("agent_end");
		expect(events).toContain("message_start");
		expect(events).toContain("message_end");
		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.messages.length).toBe(2);
	});

	it("should maintain context across multiple turns", async () => {
		let turnCount = 0;
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("google", "gemini-2.5-flash"),
				thinkingLevel: "off",
				tools: [],
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (turnCount === 0) {
						stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Nice to meet you, Alice!") });
					} else {
						stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Your name is Alice") });
					}
					turnCount++;
				});
				return stream;
			},
		});

		await agent.prompt("My name is Alice.");
		expect(agent.state.messages.length).toBe(2);

		await agent.prompt("What is my name?");
		expect(agent.state.messages.length).toBe(4);
		expect(agent.state.messages[3].content[0].text.toLowerCase()).toContain("alice");
	});

	it("should execute get_current_time tool", async () => {
		let callCount = 0;
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("google", "gemini-2.5-flash"),
				thinkingLevel: "off",
				tools: [getCurrentTimeTool],
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (callCount === 0) {
						stream.push({
							type: "done", reason: "toolUse",
							message: createAssistantMessageWithToolCall("get_current_time", "time-1", {}),
						});
					} else {
						stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Time retrieved.") });
					}
					callCount++;
				});
				return stream;
			},
		});

		await agent.prompt("What time is it?");

		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.messages.some((m) => m.role === "toolResult")).toBe(true);
	});
});

describe("Agent.continue()", () => {
	describe("validation", () => {
		it("should throw when no messages in context", async () => {
			const agent = new Agent({
				initialState: { systemPrompt: "Test", model: getModel("anthropic", "claude-haiku-4-5") },
			});

			try {
				await agent.continue();
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).toBe("No messages to continue from");
			}
		});

		it("should throw when last message is assistant", async () => {
			const agent = new Agent({
				initialState: { systemPrompt: "Test", model: getModel("anthropic", "claude-haiku-4-5") },
			});

			agent.replaceMessages([{
				role: "assistant",
				content: [{ type: "text", text: "Hello" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-haiku-4-5",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
				stopReason: "stop",
				timestamp: Date.now(),
			}]);

			try {
				await agent.continue();
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).toBe("Cannot continue from message role: assistant");
			}
		});
	});

	it("should continue from user message", async () => {
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("anthropic", "claude-haiku-4-5"),
				thinkingLevel: "off",
				tools: [],
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("HELLO WORLD") });
				});
				return stream;
			},
		});

		agent.replaceMessages([{
			role: "user",
			content: [{ type: "text", text: "Say: HELLO WORLD" }],
			timestamp: Date.now(),
		}]);

		await agent.continue();

		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.messages.length).toBe(2);
		expect(agent.state.messages[1].content[0].text.toUpperCase()).toContain("HELLO WORLD");
	});

	it("should continue from tool result", async () => {
		const agent = new Agent({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: getModel("anthropic", "claude-haiku-4-5"),
				thinkingLevel: "off",
				tools: [calculateTool],
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("The answer is 8") });
				});
				return stream;
			},
		});

		agent.replaceMessages([
			{ role: "user", content: [{ type: "text", text: "What is 5 + 3?" }], timestamp: Date.now() },
			{
				role: "assistant",
				content: [{ type: "text", text: "Calculating..." }, { type: "toolCall", id: "calc-1", name: "calculate", arguments: { expression: "5 + 3" } }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-haiku-4-5",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
				stopReason: "toolUse",
				timestamp: Date.now(),
			},
			createToolResult("calc-1", "calculate", "5 + 3 = 8", false),
		]);

		await agent.continue();

		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.messages.length).toBeGreaterThanOrEqual(4);
		expect(agent.state.messages[agent.state.messages.length - 1].content[0].text).toMatch(/8/);
	});
});
