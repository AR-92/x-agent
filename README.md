# X-Agent

**Stateful AI agent with tool execution and event streaming.** Powered by Bun, built with OpenRouter.

[![npm version](https://img.shields.io/npm/v/@ranag/x-agent.svg)](https://www.npmjs.com/package/@ranag/x-agent)
[![License](https://img.shields.io/npm/l/@ranag/x-agent.svg)](https://github.com/AR-92/x-agent/blob/main/LICENSE)

## Features

- **Stateful conversations** - Maintains message history across turns
- **Tool execution** - Call external tools with streaming progress updates
- **Event streaming** - Real-time UI updates via event subscription
- **Steering & Follow-up** - Interrupt or extend agent workflows mid-execution
- **Browser ready** - Works via CDN with no build step
- **Bun powered** - Fast testing and building with Bun (no extra dependencies)
- **OpenRouter native** - 300+ models from all providers (Anthropic, OpenAI, Google, etc.)
- **Zero dependencies** - No runtime dependencies, fully self-contained

## Installation

### npm/Node.js

```bash
npm install @ranag/x-agent
```

### Bun

```bash
bun add @ranag/x-agent
```

### Browser (CDN / Script Tag)

```html
<!-- ESM module (recommended) -->
<script type="module">
  import { Agent, getModel } from "https://cdn.jsdelivr.net/npm/@ranag/x-agent@1.0.0/dist/x-agent.min.js";

  const agent = new Agent({
    initialState: {
      systemPrompt: "You are a helpful assistant.",
      model: getModel('anthropic/claude-sonnet-4'),
    },
  });

  agent.subscribe((event) => {
    if (event.type === "message_update") {
      console.log(event.assistantMessageEvent.delta);
    }
  });

  await agent.prompt("Hello!");
</script>
```

```html
<!-- UMD bundle (script tag, no module) -->
<script src="https://cdn.jsdelivr.net/npm/@ranag/x-agent@1.0.0/dist/x-agent.umd.min.js"></script>
<script>
  const { Agent, getModel } = window.XAgent;

  const agent = new Agent({
    initialState: {
      systemPrompt: "You are a helpful assistant.",
      model: getModel('anthropic/claude-sonnet-4'),
    },
  });
</script>
```

## Quick Start

```javascript
import { Agent, getModel } from "@ranag/x-agent";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: async (model, context, options) => {
    // Use OpenRouter module (included)
    const { openRouterStream } = await import('@ranag/x-agent/openrouter');
    return openRouterStream({
      ...options,
      apiKey: 'sk-or-...', // Your OpenRouter API key
      modelId: model.id,
    }, context);
  },
});

agent.subscribe((event) => {
  if (event.type === "message_update") {
    console.log(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## Supported Models

Via **OpenRouter**, X-Agent supports **300+ models** from all major providers:

- **Anthropic** - Claude 3/4 models (Sonnet, Opus, Haiku)
- **OpenAI** - GPT-4, GPT-4o, GPT-5, o1, o3, o4
- **Google** - Gemini 2.0, 2.5, 3, 3.1, 3.5
- **Meta** - Llama 3, 3.1, 3.2, 3.3, 4
- **Mistral AI** - Mistral, Mixtral, Codestral
- **xAI** - Grok 3, Grok 4
- **Qwen** - Qwen 2.5, 3, 3.5, Coder
- **DeepSeek** - DeepSeek V3, R1
- **NVIDIA** - Nemotron models
- **And 20+ more providers!**

## OpenRouter Integration

X-Agent includes a built-in **OpenRouter module** for direct access to 300+ models through a single API.

### Quick Start with OpenRouter

```javascript
import { Agent } from "@ranag/x-agent";
import { openRouterStream, getModel } from "@ranag/x-agent/openrouter";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: async (model, context, options) => {
    return openRouterStream({
      ...options,
      apiKey: 'sk-or-...', // Your OpenRouter API key
      modelId: model.id,
      siteUrl: 'https://yoursite.com', // Optional: for ranking
      siteName: 'Your Site', // Optional: for ranking
    }, context);
  },
});

await agent.prompt("Hello!");
```

### OpenRouter-Specific Parameters

The OpenRouter module supports all OpenRouter-specific parameters:

```javascript
const agent = new Agent({
  initialState: {
    systemPrompt: "You are helpful.",
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: async (model, context, options) => {
    return openRouterStream({
      ...options,
      apiKey: 'sk-or-...',
      modelId: model.id,

      // Sampling parameters
      temperature: 0.7,
      top_p: 0.9,
      top_k: 50,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,

      // Output control
      maxTokens: 2048,
      stop: ['END'],

      // Log probabilities
      logprobs: true,
      top_logprobs: 5,

      // Structured outputs
      response_format: { type: 'json_object' },

      // Tool calling
      tool_choice: 'auto', // or 'required', 'none', or { type: 'function', function: { name: '...' } }
      parallel_tool_calls: true,

      // OpenRouter features
      transforms: ['middle-out'], // Context compression
      include_reasoning: true, // Enable thinking/reasoning

      // Provider passthrough
      provider: { order: ['Anthropic'] },

      // Site info for ranking
      siteUrl: 'https://yoursite.com',
      siteName: 'Your Site',
    }, context);
  },
});
```

### Available OpenRouter Models

```javascript
import { getModels, getModelsByProvider, getProviders } from "@ranag/x-agent/openrouter";

// Get all available models
const allModels = await getModels();

// Get models by provider
const anthropicModels = await getModelsByProvider('anthropic');
const googleModels = await getModelsByProvider('google');

// Get all providers
const providers = await getProviders(); // ['anthropic', 'google', 'openai', ...]
```

### Features

- ✅ **All event types** - `start`, `text_*`, `thinking_*`, `toolcall_*`, `done`, `error`
- ✅ **Full tool calling** - Streaming partial JSON parsing and validation
- ✅ **Thinking/reasoning support** - Native support for reasoning models
- ✅ **Image/multi-modal support** - Vision models work out of the box
- ✅ **Context serialization** - Save/restore conversation state
- ✅ **300+ models** - Access to all OpenRouter providers
- ✅ **All OpenRouter parameters** - Full API coverage
- ✅ **Non-streaming support** - Handles both SSE and JSON responses

## API Reference

### Agent Options

```javascript
const agent = new Agent({
  // Initial state
  initialState: {
    systemPrompt: "You are helpful.",
    model: getModel("anthropic/claude-sonnet-4"),
    thinkingLevel: "off",  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
    tools: [myTool],
    messages: [],
  },

  // Convert AgentMessage[] to LLM Message[] (required for custom message types)
  convertToLlm: (messages) => messages.filter((m) => m.role === "user" || m.role === "assistant"),

  // Transform context before convertToLlm (for pruning, compaction)
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // Steering mode: "one-at-a-time" (default) or "all"
  steeringMode: "one-at-a-time",

  // Follow-up mode: "one-at-a-time" (default) or "all"
  followUpMode: "one-at-a-time",

  // Session ID for provider caching
  sessionId: "session-123",

  // Dynamic API key resolution (for expiring OAuth tokens)
  getApiKey: async (provider) => refreshToken(),

  // Custom thinking budgets for token-based providers
  thinkingBudgets: {
    minimal: 128,
    low: 512,
    medium: 1024,
    high: 2048,
  },
});
```

### Methods

#### Prompting

```javascript
// Text prompt
await agent.prompt("Hello");

// With images
await agent.prompt("What's in this image?", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// AgentMessage directly
await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });

// Continue from current context (last message must be user or toolResult)
await agent.continue();
```

#### State Management

```javascript
agent.setSystemPrompt("New prompt");
agent.setModel(getModel("anthropic", "claude-sonnet-4"));
agent.setThinkingLevel("medium");
agent.setTools([myTool]);
agent.replaceMessages(newMessages);
agent.appendMessage(message);
agent.clearMessages();
agent.reset();  // Clear everything
```

#### Steering & Follow-up

```javascript
// Queue steering message (interrupts agent mid-execution)
agent.steer({ role: "user", content: "Stop! Do this instead.", timestamp: Date.now() });

// Queue follow-up message (processed after agent finishes)
agent.followUp({ role: "user", content: "Also summarize the result.", timestamp: Date.now() });

// Clear queues
agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

#### Control

```javascript
agent.abort();           // Cancel current operation
await agent.waitForIdle(); // Wait for completion
```

#### Events

```javascript
const unsubscribe = agent.subscribe((event) => {
  console.log(event.type);
});
unsubscribe();
```

### Event Types

| Event | Description |
|-------|-------------|
| `agent_start` | Agent begins processing |
| `agent_end` | Agent completes with all new messages |
| `turn_start` | New turn begins (one LLM call + tool executions) |
| `turn_end` | Turn completes with assistant message and tool results |
| `message_start` | Any message begins (user, assistant, toolResult) |
| `message_update` | **Assistant only.** Includes `assistantMessageEvent` with delta |
| `message_end` | Message completes |
| `tool_execution_start` | Tool begins execution |
| `tool_execution_update` | Tool streams progress |
| `tool_execution_end` | Tool completes |

### Agent State

```javascript
// Access via agent.state
{
  systemPrompt: string,
  model: Model,
  thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
  tools: AgentTool[],
  messages: AgentMessage[],
  isStreaming: boolean,
  streamMessage: AgentMessage | null,  // Current partial during streaming
  pendingToolCalls: Set<string>,
  error: string | undefined,
}
```

## Tools

Define tools with a simple object:

```javascript
const readFileTool = {
  name: "read_file",
  label: "Read File",  // For UI display
  description: "Read a file's contents",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path" },
    },
    required: ["path"],
  },
  execute: async (toolCallId, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8");

    // Optional: stream progress
    onUpdate?.({ content: [{ type: "text", text: "Reading..." }], details: {} });

    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};

agent.setTools([readFileTool]);
```

### Error Handling

**Throw an error** when a tool fails. Do not return error messages as content.

```javascript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // Return content only on success
  return { content: [{ type: "text", text: "..." }] };
}
```

Thrown errors are caught by the agent and reported to the LLM as tool errors with `isError: true`.

## Building

### With Bun (Recommended)

```bash
# Install dependencies
bun install

# Build for production
bun run build

# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

### With npm

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Run tests
npm test
```

## Output Files

After building, you'll find these files in `dist/`:

| File | Description | Size |
|------|-------------|------|
| `x-agent.min.js` | Minified ESM bundle | ~33 kB (gzip: 9.7 kB) |
| `x-agent.min.js.map` | Source map for ESM | - |
| `x-agent.umd.min.js` | Minified UMD bundle | ~33 kB (gzip: 10 kB) |
| `x-agent.umd.min.js.map` | Source map for UMD | - |
| `x-agent-openrouter.min.js` | OpenRouter module (ESM) | ~21 kB (gzip: 6.8 kB) |
| `x-agent-openrouter.umd.min.js` | OpenRouter module (UMD) | ~22 kB (gzip: 7 kB) |

Built with **Bun.build()** - fast, no extra dependencies needed.

## Examples

The `examples/` folder contains ready-to-use HTML examples:

### 1. Full Test UI (`examples/index.html`)

Complete test application with:
- Model selector with search (300+ models)
- System prompt configuration
- Thinking level control
- Tool execution (calculator, time)
- Usage statistics
- Steering and follow-up controls

**Run with dev server:**
```bash
bun run dev
# Open http://localhost:3000
```

### 2. Simple Example (`examples/example.html`)

Minimal example showing basic usage:
- Single API key input
- Simple chat interface
- Basic event handling
- ~100 lines of code

**Open directly in browser:**
```bash
# Just open the file in your browser
open examples/example.html
```

## Testing

X-Agent includes a comprehensive test suite covering:

- Agent class functionality
- Agent loop behavior
- End-to-end scenarios
- Tool execution
- Steering and follow-up
- Event streaming
- Error handling

All tests use **mock responses** - no API keys required.

```bash
# Run all tests
bun test

# Run specific test file
bun test test/agent.test.js

# Run tests with coverage
bun test --coverage

# Run tests in watch mode
bun test --watch
```

### Test Files

```
test/
├── agent.test.js           # Agent class tests
├── agent-loop.test.js      # Agent loop tests
├── e2e.test.js             # End-to-end tests
├── bedrock-models.test.js  # Bedrock model tests
└── utils/
    ├── calculate.js        # Calculator tool
    └── get-current-time.js # Time tool
```

## Project Structure

```
src/
├── index.js              # Main entry point
├── types.js              # JSDoc type definitions
├── logger.js             # Logging system (colored output)
├── agent/                # Agent module
│   ├── index.js          # Module exports
│   ├── agent.js          # Main Agent class
│   ├── state.js          # State creation
│   ├── events.js         # EventManager class
│   └── queues.js         # QueueManager (steering/follow-up)
├── loop/                 # Agent loop module
│   ├── index.js          # Module exports
│   ├── loop.js           # Main loop logic
│   ├── stream.js         # Stream creation
│   └── tools.js          # Tool execution
└── openrouter/           # OpenRouter integration (pi-ai replacement)
    ├── index.js          # Module exports
    ├── client.js         # API client
    ├── stream.js         # Event stream
    ├── messages.js       # Message conversion
    ├── tools.js          # Tool validation
    └── models.js         # Model helpers
```

## Low-Level API

For direct control without the Agent class:

```javascript
import { agentLoop, agentLoopContinue } from "@ranag/x-agent";

const context = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config = {
  model: getModel("anthropic/claude-sonnet-4"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
};

const userMessage = { role: "user", content: "Hello", timestamp: Date.now() };

for await (const event of agentLoop([userMessage], context, config)) {
  console.log(event.type);
}

// Continue from existing context
for await (const event of agentLoopContinue(context, config)) {
  console.log(event.type);
}
```

## Development

### Dev Server

```bash
# Start dev server with .env support
bun run dev

# Server runs at http://localhost:3000
```

### Environment Variables

Create a `.env` file:

```bash
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
```

The dev server automatically loads this and injects the API key into the test UI.

## License

MIT

## Links

- [GitHub](https://github.com/AR-92/x-agent)
- [npm](https://www.npmjs.com/package/@ranag/x-agent)
- [OpenRouter](https://openrouter.ai/)
