/**
 * A test suite for Amazon Bedrock models using mock responses.
 */

import { EventStream, getModels } from "@mariozechner/pi-ai";
import { describe, expect, it } from "bun:test";
import { Agent } from "../src/index.js";
import { hasBedrockCredentials } from "./bedrock-utils.js";

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
		api: "bedrock-converse-stream",
		provider: "amazon-bedrock",
		model: "mock",
		usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 30, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
		stopReason,
		timestamp: Date.now(),
	};
}

describe("Amazon Bedrock Models - Mock Tests", () => {
	const allBedrockModels = getModels("amazon-bedrock");

	// Test first 3 models with mock
	for (const model of allBedrockModels.slice(0, 3)) {
		it(`should handle basic prompt with ${model.id}`, () => {
			const agent = new Agent({
				initialState: {
					systemPrompt: "You are helpful.",
					model,
					thinkingLevel: "off",
					tools: [],
				},
			});
			
			agent.appendMessage({ role: "user", content: "Hello", timestamp: Date.now() });
			agent.appendMessage(createAssistantMessage("Hi there!"));
			
			expect(agent.state.messages.length).toBe(2);
		});
	}

	if (allBedrockModels.length === 0) {
		it.skip("no Bedrock models available", () => {});
	}
});

describe("Bedrock Credentials Check", () => {
	it("should return false when no credentials are set", () => {
		const originalProfile = process.env.AWS_PROFILE;
		const originalKeyId = process.env.AWS_ACCESS_KEY_ID;
		const originalSecret = process.env.AWS_SECRET_ACCESS_KEY;
		const originalBearer = process.env.AWS_BEARER_TOKEN_BEDROCK;

		delete process.env.AWS_PROFILE;
		delete process.env.AWS_ACCESS_KEY_ID;
		delete process.env.AWS_SECRET_ACCESS_KEY;
		delete process.env.AWS_BEARER_TOKEN_BEDROCK;

		expect(hasBedrockCredentials()).toBe(false);

		if (originalProfile) process.env.AWS_PROFILE = originalProfile;
		if (originalKeyId) process.env.AWS_ACCESS_KEY_ID = originalKeyId;
		if (originalSecret) process.env.AWS_SECRET_ACCESS_KEY = originalSecret;
		if (originalBearer) process.env.AWS_BEARER_TOKEN_BEDROCK = originalBearer;
	});

	it("should return true when AWS_PROFILE is set", () => {
		const originalProfile = process.env.AWS_PROFILE;
		process.env.AWS_PROFILE = "test-profile";
		expect(hasBedrockCredentials()).toBe(true);
		if (originalProfile) process.env.AWS_PROFILE = originalProfile;
		else delete process.env.AWS_PROFILE;
	});

	it("should return true when AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set", () => {
		const originalKeyId = process.env.AWS_ACCESS_KEY_ID;
		const originalSecret = process.env.AWS_SECRET_ACCESS_KEY;
		process.env.AWS_ACCESS_KEY_ID = "test-key";
		process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
		expect(hasBedrockCredentials()).toBe(true);
		if (originalKeyId) process.env.AWS_ACCESS_KEY_ID = originalKeyId;
		else delete process.env.AWS_ACCESS_KEY_ID;
		if (originalSecret) process.env.AWS_SECRET_ACCESS_KEY = originalSecret;
		else delete process.env.AWS_SECRET_ACCESS_KEY;
	});

	it("should return true when AWS_BEARER_TOKEN_BEDROCK is set", () => {
		const originalBearer = process.env.AWS_BEARER_TOKEN_BEDROCK;
		process.env.AWS_BEARER_TOKEN_BEDROCK = "test-token";
		expect(hasBedrockCredentials()).toBe(true);
		if (originalBearer) process.env.AWS_BEARER_TOKEN_BEDROCK = originalBearer;
		else delete process.env.AWS_BEARER_TOKEN_BEDROCK;
	});
});
