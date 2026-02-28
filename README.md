# X-Agent

**Stateful AI agent with tool execution and event streaming.** Built on `@mariozechner/pi-ai`.

[![npm version](https://img.shields.io/npm/v/@mariozechner/x-agent.svg)](https://www.npmjs.com/package/@mariozechner/x-agent)
[![License](https://img.shields.io/npm/l/@mariozechner/x-agent.svg)](https://github.com/badlogic/x-agent/blob/main/LICENSE)

## Features

- **Stateful conversations** - Maintains message history across turns
- **Tool execution** - Call external tools with streaming progress updates
- **Event streaming** - Real-time UI updates via event subscription
- **Steering & Follow-up** - Interrupt or extend agent workflows mid-execution
- **Browser ready** - Works via CDN with no build step
- **Bun powered** - Fast testing and building with Bun

## Installation

### npm/Node.js

```bash
npm install @mariozechner/x-agent
```

### Bun

```bash
bun add @mariozechner/x-agent
```

### Browser (CDN / Script Tag)

```html
<!-- ESM module (recommended) -->
<script type="module">
  import { Agent } from "https://cdn.jsdelivr.net/npm/@mariozechner/x-agent@1.0.0/dist/x-agent.min.js";
  import { getModel } from "https://cdn.jsdelivr.net/npm/@mariozechner/pi-ai@0.55.0/+esm";

  const agent = new Agent({
    initialState: {
      systemPrompt: "You are a helpful assistant.",
      model: getModel("google", "gemini-2.5-flash-lite-preview-06-17"),
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
<script src="https://cdn.jsdelivr.net/npm/@mariozechner/pi-ai@0.55.0/dist/pi-ai.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mariozechner/x-agent@1.0.0/dist/x-agent.umd.min.js"></script>
<script>
  const { Agent } = window.XAgent;
  const { getModel } = window.PiAI;

  const agent = new Agent({
    initialState: {
      systemPrompt: "You are a helpful assistant.",
      model: getModel("google", "gemini-2.5-flash-lite-preview-06-17"),
    },
  });
</script>
```

## Quick Start

```javascript
import { Agent } from "@mariozechner/x-agent";
import { getModel } from "@mariozechner/pi-ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel("google", "gemini-2.5-flash-lite-preview-06-17"),
  },
});

agent.subscribe((event) => {
  if (event.type === "message_update") {
    console.log(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## Supported Providers

Via `@mariozechner/pi-ai`, X-Agent supports:

- **Google** - Gemini models
- **Anthropic** - Claude models
- **OpenAI** - GPT models
- **Mistral AI** - Mistral models
- **AWS Bedrock** - Various models
- **xAI** - Grok models
- **Groq** - Fast inference
- **Cerebras** - High-performance models

## API Reference

### Agent Options

```javascript
const agent = new Agent({
  // Initial state
  initialState: {
    systemPrompt: "You are helpful.",
    model: getModel("openai", "gpt-4o"),
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

  // Custom stream function (for proxy backends)
  streamFn: streamProxy,

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
agent.setModel(getModel("openai", "gpt-4o"));
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

# Development watch mode
bun run dev

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

# Development watch mode
npm run dev

# Run tests
npm test
```

## Output Files

After building, you'll find these files in `dist/`:

| File | Description | Size |
|------|-------------|------|
| `x-agent.min.js` | Minified ESM bundle | ~26 kB |
| `x-agent.min.js.map` | Source map for ESM | - |
| `x-agent.umd.min.js` | Minified UMD bundle | ~16 kB |
| `x-agent.umd.min.js.map` | Source map for UMD | - |

## Testing

X-Agent includes a comprehensive test suite with **37 tests** covering:

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
├── agent.test.js           # Agent class tests (12 tests)
├── agent-loop.test.js      # Agent loop tests (8 tests)
├── e2e.test.js             # End-to-end tests (10 tests)
├── bedrock-models.test.js  # Bedrock model tests (7 tests)
└── utils/
    ├── calculate.js        # Calculator tool
    └── get-current-time.js # Time tool
```

## Proxy Usage

For browser apps that proxy through a backend:

```javascript
import { Agent, streamProxy } from "@mariozechner/x-agent";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## Low-Level API

For direct control without the Agent class:

```javascript
import { agentLoop, agentLoopContinue } from "@mariozechner/x-agent";

const context = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config = {
  model: getModel("openai", "gpt-4o"),
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

## License

MIT

## Links

- [GitHub](https://github.com/badlogic/x-agent)
- [npm](https://www.npmjs.com/package/@mariozechner/x-agent)
- [pi-ai](https://github.com/badlogic/pi-mono)
