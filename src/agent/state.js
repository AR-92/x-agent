/**
 * Create default agent state
 * @returns {import("../types.js").AgentState}
 */
export function createDefaultState() {
	return {
		systemPrompt: "",
		model: null,
		thinkingLevel: "off",
		tools: [],
		messages: [],
		isStreaming: false,
		streamMessage: null,
		pendingToolCalls: new Set(),
		error: undefined,
	};
}

/**
 * Create agent state with initial options
 * @param {Partial<import("../types.js").AgentState>} [initialState]
 * @returns {import("../types.js").AgentState}
 */
export function createState(initialState) {
	return { ...createDefaultState(), ...initialState };
}
