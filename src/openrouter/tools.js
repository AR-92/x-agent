/**
 * OpenRouter Tool Validation
 * Validates tool calls from OpenRouter API
 */

/**
 * Validate tool arguments against tool schema
 * This is a simplified version - pi-ai uses TypeBox for full validation
 * 
 * @param {import("../types.js").AgentTool<any>} tool - Tool definition
 * @param {any} toolCall - Tool call from OpenRouter
 * @returns {any} Validated arguments
 */
export function validateToolArguments(tool, toolCall) {
	const args = toolCall.arguments || {};

	// If no parameters defined, return empty object
	if (!tool.parameters) {
		return {};
	}

	// Basic validation
	const validatedArgs = {};
	const properties = tool.parameters.properties || {};
	const required = tool.parameters.required || [];

	// Check required parameters
	for (const req of required) {
		if (!(req in args)) {
			throw new Error(`Missing required parameter: ${req}`);
		}
	}

	// Validate each parameter
	for (const [key, value] of Object.entries(args)) {
		const schema = properties[key];
		if (schema) {
			validatedArgs[key] = validateValue(value, schema);
		} else {
			// Pass through unknown parameters
			validatedArgs[key] = value;
		}
	}

	return validatedArgs;
}

/**
 * Validate a value against a JSON schema
 * @param {any} value - Value to validate
 * @param {any} schema - JSON schema
 * @returns {any} Validated value
 */
function validateValue(value, schema) {
	const type = schema.type;

	if (type === 'string') {
		if (typeof value !== 'string') {
			throw new Error(`Expected string, got ${typeof value}`);
		}
		return value;
	}

	if (type === 'number' || type === 'integer') {
		if (typeof value !== 'number') {
			throw new Error(`Expected number, got ${typeof value}`);
		}
		if (type === 'integer' && !Number.isInteger(value)) {
			throw new Error(`Expected integer, got ${value}`);
		}
		return value;
	}

	if (type === 'boolean') {
		if (typeof value !== 'boolean') {
			throw new Error(`Expected boolean, got ${typeof value}`);
		}
		return value;
	}

	if (type === 'array') {
		if (!Array.isArray(value)) {
			throw new Error(`Expected array, got ${typeof value}`);
		}
		if (schema.items) {
			return value.map((item) => validateValue(item, schema.items));
		}
		return value;
	}

	if (type === 'object') {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			throw new Error(`Expected object, got ${typeof value}`);
		}
		return value;
	}

	// Enum validation
	if (schema.enum) {
		if (!schema.enum.includes(value)) {
			throw new Error(`Value must be one of: ${schema.enum.join(', ')}`);
		}
	}

	return value;
}
