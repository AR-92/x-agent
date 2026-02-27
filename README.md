# X-Agent

Stateful AI agent with tool execution and event streaming. Built on `@mariozechner/pi-ai`.

## Installation

### npm/Node.js

```bash
npm install @mariozechner/x-agent
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

## Features

- **Stateful conversations** - Maintains message history across turns
- **Tool execution** - Call external tools with streaming progress
- **Event streaming** - Real-time UI updates via event subscription
- **Steering & Follow-up** - Interrupt or extend agent workflows
- **Browser ready** - Works via CDN with no build step

## API

### Agent Options

```javascript
const agent = new Agent({
  initialState: {
    systemPrompt: "You are helpful.",
    model: getModel("openai", "gpt-4o"),
    thinkingLevel: "off",
    tools: [myTool],
    messages: [],
  },
  convertToLlm: (messages) => messages.filter(...),
  transformContext: async (messages, signal) => messages,
  steeringMode: "one-at-a-time",
  followUpMode: "one-at-a-time",
  streamFn: streamProxy,
  sessionId: "session-123",
  getApiKey: async (provider) => refreshToken(),
  thinkingBudgets: { minimal: 128, low: 512 },
});
```

### Methods

```javascript
// Prompting
await agent.prompt("Hello");
await agent.prompt("What's in this image?", [{ type: "image", data: base64Data }]);
await agent.continue();

// State management
agent.setSystemPrompt("New prompt");
agent.setModel(getModel("openai", "gpt-4o"));
agent.setThinkingLevel("medium");
agent.setTools([myTool]);
agent.replaceMessages(newMessages);
agent.appendMessage(message);
agent.clearMessages();
agent.reset();

// Steering & Follow-up
agent.steer({ role: "user", content: "Stop!", timestamp: Date.now() });
agent.followUp({ role: "user", content: "Also do this", timestamp: Date.now() });
agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();

// Control
agent.abort();
await agent.waitForIdle();

// Events
const unsubscribe = agent.subscribe((event) => {
  console.log(event.type);
});
unsubscribe();
```

### Event Types

| Event | Description |
|-------|-------------|
| `agent_start` | Agent begins processing |
| `agent_end` | Agent completes |
| `turn_start` | New turn begins |
| `turn_end` | Turn completes |
| `message_start` | Message begins |
| `message_update` | Assistant streaming chunk |
| `message_end` | Message completes |
| `tool_execution_start` | Tool begins |
| `tool_execution_update` | Tool streams progress |
| `tool_execution_end` | Tool completes |

## Building

```bash
# Install dependencies
bun install

# Build for production
bun run build

# Development watch mode
bun run dev

# Run tests
bun test
```

## Output Files

| File | Description |
|------|-------------|
| `dist/x-agent.min.js` | Minified ESM bundle |
| `dist/x-agent.umd.min.js` | Minified UMD bundle |

## License

MIT
