import { EventStream } from "../openrouter/index.js";

/**
 * Create an agent event stream
 * @returns {EventStream<any, any>}
 */
export function createAgentStream() {
	return new EventStream(
		(event) => event.type === "agent_end",
		(event) => (event.type === "agent_end" ? event.messages : []),
	);
}
