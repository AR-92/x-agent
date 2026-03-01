/**
 * OpenRouter Model Helpers
 * Provides model discovery and configuration
 */

import { createLogger } from '../logger.js';

const log = createLogger('OpenRouter.Models');

/**
 * Get a model configuration for OpenRouter
 *
 * @param {string} modelId - OpenRouter model ID (e.g., 'anthropic/claude-sonnet-4')
 * @returns {any} Model object for X-Agent
 */
export function getModel(modelId) {
	return {
		id: modelId,
		provider: 'openrouter',
		name: modelId.split('/')[1] || modelId,
		api: 'openrouter-chat',
	};
}

/**
 * Get all available OpenRouter models
 * Fetches from OpenRouter API
 *
 * @returns {Promise<any[]>} List of available models
 */
export async function getModels() {
	try {
		const response = await fetch('https://openrouter.ai/api/v1/models');
		const data = await response.json();
		return data.data?.map((model) => ({
			id: model.id,
			provider: 'openrouter',
			name: model.name,
			contextWindow: model.context_length,
			pricing: model.pricing,
			topProvider: model.top_provider,
		})) || [];
	} catch (e) {
		log.error('Failed to fetch OpenRouter models:', e);
		return [];
	}
}

/**
 * Get models by provider
 * 
 * @param {string} provider - Provider name (e.g., 'anthropic', 'google', 'meta')
 * @returns {Promise<any[]>} Filtered list of models
 */
export async function getModelsByProvider(provider) {
	const allModels = await getModels();
	return allModels.filter((model) => model.id.startsWith(provider + '/'));
}

/**
 * Get available providers
 * 
 * @returns {Promise<string[]>} List of provider names
 */
export async function getProviders() {
	const allModels = await getModels();
	const providers = new Set();
	
	for (const model of allModels) {
		const provider = model.id.split('/')[0];
		providers.add(provider);
	}
	
	return Array.from(providers);
}
