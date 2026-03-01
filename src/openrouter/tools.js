/**
 * OpenRouter Tool Validation
 * Complete implementation matching pi-ai with TypeBox-like validation
 */

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} label
 * @property {string} description
 * @property {any} parameters
 * @property {(toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any) => Promise<any>} execute
 */

/**
 * Validate tool arguments against tool schema
 * Matches pi-ai validateToolCall functionality
 *
 * @param {Tool} tool - Tool definition
 * @param {any} toolCall - Tool call from OpenRouter
 * @returns {any} Validated arguments
 * @throws {Error} If validation fails
 */
export function validateToolArguments(tool, toolCall) {
	if (!tool.parameters) {
		return {};
	}

	const args = toolCall.arguments || {};
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
			validatedArgs[key] = validateValue(value, schema, key);
		} else {
			// Pass through unknown parameters
			validatedArgs[key] = value;
		}
	}

	return validatedArgs;
}

/**
 * Validate a value against JSON schema with full type checking
 */
function validateValue(value, schema, path) {
	const type = schema.type;

	// Handle null
	if (value === null) {
		if (schema.type !== 'null') {
			throw new Error(`${path}: Expected non-null value`);
		}
		return null;
	}

	// String validation
	if (type === 'string') {
		if (typeof value !== 'string') {
			throw new Error(`${path}: Expected string, got ${typeof value}`);
		}
		if (schema.minLength !== undefined && value.length < schema.minLength) {
			throw new Error(`${path}: String length ${value.length} is less than minimum ${schema.minLength}`);
		}
		if (schema.maxLength !== undefined && value.length > schema.maxLength) {
			throw new Error(`${path}: String length ${value.length} exceeds maximum ${schema.maxLength}`);
		}
		if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
			throw new Error(`${path}: String does not match pattern ${schema.pattern}`);
		}
		if (schema.enum && !schema.enum.includes(value)) {
			throw new Error(`${path}: Value must be one of: ${schema.enum.join(', ')}`);
		}
		return value;
	}

	// Number validation
	if (type === 'number') {
		if (typeof value !== 'number') {
			throw new Error(`${path}: Expected number, got ${typeof value}`);
		}
		if (schema.minimum !== undefined && value < schema.minimum) {
			throw new Error(`${path}: Value ${value} is less than minimum ${schema.minimum}`);
		}
		if (schema.maximum !== undefined && value > schema.maximum) {
			throw new Error(`${path}: Value ${value} exceeds maximum ${schema.maximum}`);
		}
		if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
			throw new Error(`${path}: Value ${value} must be greater than ${schema.exclusiveMinimum}`);
		}
		if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
			throw new Error(`${path}: Value ${value} must be less than ${schema.exclusiveMaximum}`);
		}
		if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
			throw new Error(`${path}: Value ${value} is not a multiple of ${schema.multipleOf}`);
		}
		return value;
	}

	// Integer validation
	if (type === 'integer') {
		if (typeof value !== 'number' || !Number.isInteger(value)) {
			throw new Error(`${path}: Expected integer, got ${value}`);
		}
		if (schema.minimum !== undefined && value < schema.minimum) {
			throw new Error(`${path}: Value ${value} is less than minimum ${schema.minimum}`);
		}
		if (schema.maximum !== undefined && value > schema.maximum) {
			throw new Error(`${path}: Value ${value} exceeds maximum ${schema.maximum}`);
		}
		if (schema.enum && !schema.enum.includes(value)) {
			throw new Error(`${path}: Value must be one of: ${schema.enum.join(', ')}`);
		}
		return value;
	}

	// Boolean validation
	if (type === 'boolean') {
		if (typeof value !== 'boolean') {
			throw new Error(`${path}: Expected boolean, got ${typeof value}`);
		}
		return value;
	}

	// Array validation
	if (type === 'array') {
		if (!Array.isArray(value)) {
			throw new Error(`${path}: Expected array, got ${typeof value}`);
		}
		if (schema.minItems !== undefined && value.length < schema.minItems) {
			throw new Error(`${path}: Array length ${value.length} is less than minimum ${schema.minItems}`);
		}
		if (schema.maxItems !== undefined && value.length > schema.maxItems) {
			throw new Error(`${path}: Array length ${value.length} exceeds maximum ${schema.maxItems}`);
		}
		if (schema.uniqueItems && new Set(value).size !== value.length) {
			throw new Error(`${path}: Array items must be unique`);
		}
		if (schema.items) {
			return value.map((item, index) => validateValue(item, schema.items, `${path}[${index}]`));
		}
		return value;
	}

	// Object validation
	if (type === 'object') {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			throw new Error(`${path}: Expected object, got ${typeof value}`);
		}
		
		const validatedObj = {};
		const objProperties = schema.properties || {};
		const objRequired = schema.required || [];

		// Check required properties
		for (const req of objRequired) {
			if (!(req in value)) {
				throw new Error(`${path}: Missing required property: ${req}`);
			}
		}

		// Validate each property
		for (const [key, val] of Object.entries(value)) {
			const propSchema = objProperties[key];
			if (propSchema) {
				validatedObj[key] = validateValue(val, propSchema, `${path}.${key}`);
			} else if (schema.additionalProperties === false) {
				throw new Error(`${path}: Unknown property: ${key}`);
			} else {
				validatedObj[key] = val;
			}
		}

		return validatedObj;
	}

	// Enum validation (standalone)
	if (schema.enum) {
		if (!schema.enum.includes(value)) {
			throw new Error(`${path}: Value must be one of: ${schema.enum.join(', ')}`);
		}
	}

	// AnyOf / OneOf validation
	if (schema.anyOf) {
		for (const subSchema of schema.anyOf) {
			try {
				return validateValue(value, subSchema, path);
			} catch (e) {
				// Try next schema
			}
		}
		throw new Error(`${path}: Value does not match any of the allowed schemas`);
	}

	if (schema.oneOf) {
		let validCount = 0;
		let result;
		for (const subSchema of schema.oneOf) {
			try {
				result = validateValue(value, subSchema, path);
				validCount++;
			} catch (e) {
				// Try next schema
			}
		}
		if (validCount !== 1) {
			throw new Error(`${path}: Value must match exactly one schema`);
		}
		return result;
	}

	// AllOf validation
	if (schema.allOf) {
		let result = value;
		for (const subSchema of schema.allOf) {
			result = validateValue(result, subSchema, path);
		}
		return result;
	}

	// Default: pass through
	return value;
}

/**
 * Create tool result message
 */
export function createToolResult(toolCallId, toolName, content, isError = false) {
	return {
		role: 'toolResult',
		toolCallId,
		toolName,
		content: typeof content === 'string' 
			? [{ type: 'text', text: content }]
			: content,
		isError,
		timestamp: Date.now(),
	};
}

/**
 * Create tool call from validated arguments
 */
export function createToolCall(id, name, argumentsObj) {
	return {
		id,
		type: 'function',
		name,
		arguments: argumentsObj,
	};
}
