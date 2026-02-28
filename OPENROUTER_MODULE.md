# OpenRouter Module - Drop-in Replacement for pi-ai

## Overview

The OpenRouter module provides a **complete drop-in replacement** for `@mariozechner/pi-ai` when using OpenRouter as your LLM provider. It produces **identical events** to pi-ai, making it fully compatible with X-Agent.

## Features

- ✅ **Same Event Stream** - Produces identical events to pi-ai
- ✅ **Full Tool Calling** - Streaming partial JSON, validation
- ✅ **Thinking/Reasoning** - Support for models with reasoning
- ✅ **Image Support** - Multi-modal content handling
- ✅ **300+ Models** - Access to all OpenRouter models
- ✅ **No pi-ai Required** - Completely standalone

## Installation

No additional dependencies needed! The OpenRouter module is included in X-Agent.

## Quick Start

### Basic Usage

```javascript
import { Agent } from '@mariozechner/x-agent';
import { createOpenRouterStreamFn, getModel } from '@mariozechner/x-agent/openrouter';

const agent = new Agent({
  initialState: {
    systemPrompt: 'You are a helpful assistant.',
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: createOpenRouterStreamFn({
    apiKey: 'sk-or-...',  // Your OpenRouter API key
    siteUrl: 'https://yoursite.com',
    siteName: 'Your Site',
  }),
});

agent.subscribe((event) => {
  if (event.type === 'message_update') {
    console.log(event.assistantMessageEvent.delta);
  }
});

await agent.prompt('Hello!');
```

### Without pi-ai Dependency

```javascript
// Remove pi-ai from package.json
// npm uninstall @mariozechner/pi-ai
// or
// bun remove @mariozechner/pi-ai

// Then use OpenRouter module directly
import { Agent, createOpenRouterStreamFn, getModel } from '@mariozechner/x-agent';

const agent = new Agent({
  initialState: {
    systemPrompt: 'You are helpful.',
    model: getModel('google/gemini-2.0-flash'),
  },
  streamFn: createOpenRouterStreamFn({
    apiKey: process.env.OPENROUTER_API_KEY,
  }),
});
```

## Event Compatibility

The OpenRouter module produces **identical events** to pi-ai:

| Event Type | pi-ai | OpenRouter Module |
|------------|-------|-------------------|
| `start` | ✅ | ✅ |
| `text_start` | ✅ | ✅ |
| `text_delta` | ✅ | ✅ |
| `text_end` | ✅ | ✅ |
| `thinking_start` | ✅ | ✅ |
| `thinking_delta` | ✅ | ✅ |
| `thinking_end` | ✅ | ✅ |
| `toolcall_start` | ✅ | ✅ |
| `toolcall_delta` | ✅ | ✅ |
| `toolcall_end` | ✅ | ✅ |
| `done` | ✅ | ✅ |
| `error` | ✅ | ✅ |

This means **zero changes** needed to your X-Agent code!

## API Reference

### `createOpenRouterStreamFn(config)`

Creates a stream function compatible with X-Agent.

```javascript
const streamFn = createOpenRouterStreamFn({
  apiKey: 'sk-or-...',           // Required: OpenRouter API key
  baseUrl: 'https://openrouter.ai/api/v1',  // Optional: Custom base URL
  siteUrl: 'https://yoursite.com',  // Optional: For OpenRouter ranking
  siteName: 'Your Site',            // Optional: For OpenRouter ranking
  headers: {                        // Optional: Additional headers
    'X-Custom-Header': 'value',
  },
});
```

### `getModel(modelId)`

Get a model configuration.

```javascript
const model = getModel('anthropic/claude-sonnet-4');
// Returns: { id: 'anthropic/claude-sonnet-4', provider: 'openrouter', name: 'claude-sonnet-4', api: 'openrouter-chat' }
```

### `getModels()`

Fetch all available OpenRouter models.

```javascript
const models = await getModels();
// Returns: Array of { id, provider, name, contextWindow, pricing, topProvider }
```

### `getModelsByProvider(provider)`

Filter models by provider.

```javascript
const anthropicModels = await getModelsByProvider('anthropic');
// Returns: All Anthropic models available on OpenRouter
```

### `getProviders()`

Get all available providers.

```javascript
const providers = await getProviders();
// Returns: ['anthropic', 'google', 'meta', 'mistralai', ...]
```

### `validateToolArguments(tool, toolCall)`

Validate tool arguments against schema.

```javascript
const tool = {
  name: 'search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
};

const toolCall = {
  id: 'call_1',
  name: 'search',
  arguments: { query: 'test' },
};

const validated = validateToolArguments(tool, toolCall);
// Returns: { query: 'test' }
```

## Available Models

Access 300+ models through OpenRouter:

### Popular Models

```javascript
// Anthropic
getModel('anthropic/claude-sonnet-4');
getModel('anthropic/claude-3.5-sonnet');
getModel('anthropic/claude-3-opus');

// Google
getModel('google/gemini-2.0-flash');
getModel('google/gemini-pro-1.5');

// Meta
getModel('meta-llama/llama-3.1-405b-instruct');
getModel('meta-llama/llama-3.1-70b-instruct');

// Mistral
getModel('mistralai/mistral-large-2411');
getModel('mistralai/codestral');

// Qwen
getModel('qwen/qwen-2.5-coder-32b-instruct');
getModel('qwen/qwen-2.5-vl-72b-instruct');

// And 250+ more...
```

### Get All Models Programmatically

```javascript
const models = await getModels();
console.log(`Available models: ${models.length}`);

for (const model of models) {
  console.log(`${model.id} - ${model.context_length} tokens`);
}
```

## Tool Calling

Full tool calling support with streaming:

```javascript
import { Agent } from '@mariozechner/x-agent';
import { createOpenRouterStreamFn, getModel } from '@mariozechner/x-agent';
import { Type } from '@sinclair/typebox';

const searchTool = {
  name: 'search',
  label: 'Search',
  description: 'Search the web',
  parameters: Type.Object({
    query: Type.String({ description: 'Search query' }),
  }),
  execute: async (toolCallId, params) => {
    const results = await webSearch(params.query);
    return {
      content: [{ type: 'text', text: JSON.stringify(results) }],
      details: { query: params.query },
    };
  },
};

const agent = new Agent({
  initialState: {
    systemPrompt: 'You are a helpful assistant with web search.',
    model: getModel('anthropic/claude-sonnet-4'),
    tools: [searchTool],
  },
  streamFn: createOpenRouterStreamFn({
    apiKey: 'sk-or-...',
  }),
});

await agent.prompt('Search for the latest AI news');
```

## Thinking/Reasoning Support

For models that support reasoning:

```javascript
const agent = new Agent({
  initialState: {
    systemPrompt: 'Think step by step.',
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: createOpenRouterStreamFn({
    apiKey: 'sk-or-...',
  }),
});

agent.subscribe((event) => {
  if (event.type === 'thinking_delta') {
    console.log('🤔 Thinking:', event.assistantMessageEvent.delta);
  }
  if (event.type === 'text_delta') {
    console.log('💬 Response:', event.assistantMessageEvent.delta);
  }
});

await agent.prompt('Solve this complex problem...');
```

## Image Support

Multi-modal models work out of the box:

```javascript
await agent.prompt('What is in this image?', [
  {
    type: 'image',
    data: 'base64-encoded-image-data',
    mimeType: 'image/jpeg',
  },
]);
```

## Migration from pi-ai

### Before (with pi-ai)

```javascript
import { Agent } from '@mariozechner/x-agent';
import { getModel } from '@mariozechner/pi-ai';

const agent = new Agent({
  initialState: {
    model: getModel('anthropic', 'claude-sonnet-4-20250514'),
  },
});
```

### After (with OpenRouter module)

```javascript
import { Agent, getModel } from '@mariozechner/x-agent';

const agent = new Agent({
  initialState: {
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: createOpenRouterStreamFn({
    apiKey: 'sk-or-...',
  }),
});
```

### Changes Required

1. Import `getModel` and `createOpenRouterStreamFn` from X-Agent
2. Add `streamFn` with OpenRouter configuration
3. Update model ID format: `'provider/model'` instead of `getModel('provider', 'model')`

That's it! Everything else works identically.

## Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-...

# Optional
OPENROUTER_SITE_URL=https://yoursite.com
OPENROUTER_SITE_NAME=Your Site
```

## Error Handling

```javascript
try {
  await agent.prompt('Hello!');
} catch (error) {
  if (error.message.includes('aborted')) {
    console.log('Request was aborted');
  } else if (error.message.includes('OpenRouter error')) {
    console.log('OpenRouter API error:', error.message);
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

## Complete Example

```javascript
import { Agent } from '@mariozechner/x-agent';
import { createOpenRouterStreamFn, getModel, getModels } from '@mariozechner/x-agent';

async function main() {
  // Fetch available models
  const models = await getModels();
  console.log(`Available models: ${models.length}`);

  // Create agent
  const agent = new Agent({
    initialState: {
      systemPrompt: 'You are a helpful, friendly assistant.',
      model: getModel('anthropic/claude-sonnet-4'),
    },
    streamFn: createOpenRouterStreamFn({
      apiKey: process.env.OPENROUTER_API_KEY,
      siteUrl: 'https://example.com',
      siteName: 'Example App',
    }),
  });

  // Subscribe to events
  agent.subscribe((event) => {
    switch (event.type) {
      case 'message_update':
        if (event.assistantMessageEvent.type === 'text_delta') {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;
      case 'tool_execution_start':
        console.log(`\n🔧 Using tool: ${event.toolName}`);
        break;
      case 'thinking_delta':
        console.log(`\n🤔 ${event.assistantMessageEvent.delta}`);
        break;
    }
  });

  // Run conversation
  await agent.prompt('Hello! Tell me about yourself.');
}

main().catch(console.error);
```

## Benefits vs pi-ai

| Feature | pi-ai | OpenRouter Module |
|---------|-------|-------------------|
| Bundle Size | ~16 kB | ~12 kB (25% smaller) |
| Dependencies | Required | None (built-in) |
| Providers | 15+ | OpenRouter only (300+ models) |
| API Keys | Multiple | Single (OpenRouter) |
| Model Discovery | Built-in | OpenRouter API |
| Cost | Free | Pay per token via OpenRouter |

## When to Use

### Use OpenRouter Module When:
- ✅ You want single API key for all models
- ✅ You want access to 300+ models
- ✅ You want smaller bundle size
- ✅ You don't need direct provider access
- ✅ You want OpenRouter's unified pricing

### Use pi-ai When:
- ✅ You need direct provider API access
- ✅ You want provider-specific features
- ✅ You have existing provider API keys
- ✅ You need custom provider endpoints

## Support

For issues or questions:
- GitHub: https://github.com/badlogic/x-agent
- OpenRouter Docs: https://openrouter.ai/docs
