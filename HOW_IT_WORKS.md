# How X-Agent Works

A clear, structured explanation of **how X-Agent works** — the internal reasoning & execution mechanism and how the UI is used / updated by the agent.

---

## 1. Core Architecture — How the Agent "Thinks" and Acts

X-Agent is a **stateful AI agent framework** with tool execution and event streaming. It follows the classic ReAct pattern with modern enhancements:

```
User input (prompt, images, or message)
    ↓
Agent.prompt() or Agent.continue()
    ↓
Agent Loop (Reason → Act → Observe → Repeat)
    ├─→ Convert messages to LLM format
    ├─→ Stream LLM response (text, thinking, tool calls)
    ├─→ Execute tools if needed
    └─→ Append results to context → loop
    ↓ (until no more tool calls)
Agent End → Final message added to history
```

### Key Patterns Used by X-Agent

| Pattern | Description | Used in X-Agent |
|---------|-------------|-----------------|
| **ReAct** | Reason → Act → Observe loop | Core loop in `loop.js` |
| **Tool Calling** | JSON tool definitions + execution | Built-in via `executeToolCalls()` |
| **Streaming** | Real-time token-by-token delivery | Via `EventManager` + async iterators |
| **Stateful** | Maintains message history across turns | `Agent.state.messages[]` |
| **Steering** | Interrupt agent mid-execution | `agent.steer()` method |
| **Follow-up** | Queue messages after agent finishes | `agent.followUp()` method |

### X-Agent Specifics

- **Runs in JavaScript/Bun/Node.js** — not a cloud sandbox like other agent systems
- **Event-driven** — emits structured events that UI can subscribe to
- **OpenRouter integration** — supports 300+ models (Claude, GPT, Gemini, Llama, etc.)
- **Zero dependencies** — fully self-contained
- **Browser-ready** — works via CDN with no build step

---

## 2. Typical Agent Loop Step-by-Step

Example: you called `agent.prompt("What's 15 * 23?")`

### Step 1: Message Creation

```javascript
// Agent.prompt() converts input to AgentMessage[]
const messages = [{
  role: "user",
  content: [{ type: "text", text: "What's 15 * 23?" }],
  timestamp: 1699123456789
}];
```

### Step 2: Context Building

The agent builds a context object with:
- `systemPrompt` — instructions for the model
- `messages` — conversation history
- `tools` — available tools

```javascript
const context = {
  systemPrompt: "You are a helpful assistant.",
  messages: [...existingHistory, newUserMessage],
  tools: [calculatorTool, timeTool, ...]
};
```

### Step 3: Message Conversion

The `convertToLlm` function transforms AgentMessages to LLM-compatible format:

```javascript
// Default: keeps only user, assistant, toolResult
const llmMessages = messages.filter(m => 
  m.role === "user" || m.role === "assistant" || m.role === "toolResult"
);
```

### Step 4: LLM Streaming

The agent calls `streamFn` (typically OpenRouter) and receives events:

```
start → text_start → text_delta → ... → text_end → done
```

Each token is streamed to subscribers in real-time via `message_update` events.

### Step 5: Tool Detection & Execution

If the LLM returns tool calls:

```javascript
// Assistant message might contain:
{
  role: "assistant",
  content: [
    { type: "toolCall", name: "calculator", arguments: { expr: "15 * 23" } }
  ]
}
```

The agent:
1. Finds the matching tool in `context.tools`
2. Validates arguments against tool schema
3. Calls `tool.execute(id, args, signal, onUpdate)`
4. Captures result and appends as `toolResult` message

```javascript
// Tool result message:
{
  role: "toolResult",
  toolCallId: "call_abc123",
  toolName: "calculator",
  content: [{ type: "text", text: "345" }],
  timestamp: 1699123456800
}
```

### Step 6: Loop Continuation

The agent appends the tool result to context and loops back to Step 3 — the LLM now sees:
- User question
- Assistant's tool call
- Tool result

The LLM reasons about the result and produces a final text response.

### Step 7: Completion

When no more tool calls exist:
- `agent_end` event emitted
- Final assistant message appended to `state.messages`
- UI receives final answer

---

## 3. How the UI Uses X-Agent

X-Agent is designed to **drive UIs in real-time** via event subscription. The beautiful UI you see is actively controlled by the agent system.

### Event Subscription

```javascript
const agent = new Agent({ ... });

agent.subscribe((event) => {
  switch (event.type) {
    // Handle each event type
  }
});
```

### Event Types and UI Mappings

| Event | What It Means | UI Action |
|-------|---------------|-----------|
| `agent_start` | Agent begins processing | Show "thinking" indicator, start timer |
| `turn_start` | New turn (LLM call + tools) | Update turn counter |
| `message_start` | Assistant message begins | Create new chat bubble |
| `message_update` | **Streaming tokens** | Append text/thinking in real-time |
| `message_end` | Message completes | Finalize bubble, stop streaming |
| `tool_execution_start` | Tool starts | Show tool loading state |
| `tool_execution_update` | Tool streams progress | Show progress bar / partial result |
| `tool_execution_end` | Tool completes | Hide loading, show result |
| `turn_end` | Turn completes | Update timeline, check for more tools |
| `agent_end` | All done | Show completion, enable input |

### Typical React/UI Integration

```javascript
function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentText, setCurrentText] = useState("");

  useEffect(() => {
    return agent.subscribe((event) => {
      switch (event.type) {
        case "agent_start":
          setIsStreaming(true);
          break;

        case "message_update":
          if (event.assistantMessageEvent.type === "text_delta") {
            setCurrentText(prev => prev + event.assistantMessageEvent.delta);
          }
          if (event.assistantMessageEvent.type === "thinking_delta") {
            // Show thinking/thoughts expanding
          }
          break;

        case "message_end":
          setMessages(prev => [...prev, event.message]);
          setCurrentText("");
          break;

        case "tool_execution_start":
          // Show "Running calculator..." indicator

        case "tool_execution_end":
          // Show result, hide indicator

        case "agent_end":
          setIsStreaming(false);
          break;
      }
    });
  }, []);

  return <ChatUI messages={messages} currentText={currentText} />;
}
```

### Why Events Matter

The agent does NOT render the UI itself. It **emits structured events** → **frontend receives them** → **React/Vue/Svelte components update the DOM**.

This is why you see:
- Text appearing letter-by-letter (via `text_delta`)
- Thinking/thoughts expanding (via `thinking_delta`)
- Tools running with progress (via `tool_execution_*`)
- Steps completing in timeline (via `turn_end`)

---

## 4. Steering & Follow-up — Interactive Control

X-Agent supports **interrupting** the agent mid-execution for dynamic interaction.

### Steering — Interrupt Mid-Execution

```javascript
// While agent is running:
agent.steer({ 
  role: "user", 
  content: "Stop! Use a different approach instead.",
  timestamp: Date.now() 
});
```

**What happens:**
1. Steering message is queued
2. Agent checks for steering after each tool completes
3. If found, agent injects the message into context immediately
4. Agent continues with new instructions
5. Remaining tool calls are skipped (optional)

This is useful for:
- Correcting mistakes
- Changing approach
- Cancelling operations

### Follow-up — Queue After Completion

```javascript
// After agent finishes:
agent.followUp({ 
  role: "user", 
  content: "Also summarize the result.",
  timestamp: Date.now() 
});
```

**What happens:**
1. Follow-up message is queued
2. Agent checks for follow-ups when it would normally stop
3. If found, agent continues processing with queued message
4. Loop continues until truly done

This is useful for:
- Building on previous responses
- Multi-step workflows
- User refinement

### Modes

- **`one-at-a-time`** (default): Process messages sequentially
- **`all`**: Process all queued messages in parallel

---

## 5. State Management

X-Agent maintains full conversation state:

```javascript
agent.state = {
  systemPrompt: "You are helpful.",
  model: { provider: "google", api: "gemini-2.5-flash", ... },
  thinkingLevel: "medium",
  tools: [tool1, tool2, ...],
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi!" },
    { role: "user", content: "What's 2+2?" },
    { role: "toolResult", toolName: "calculator", content: "4" },
    { role: "assistant", content: "The answer is 4." }
  ],
  isStreaming: false,
  streamMessage: null,        // Current partial message
  pendingToolCalls: Set([]), // Tools currently running
  error: undefined
};
```

### State Mutations

```javascript
agent.setSystemPrompt("New instructions");
agent.setModel(getModel("anthropic/claude-sonnet-4"));
agent.setThinkingLevel("high");
agent.setTools([myTool]);

agent.appendMessage({ role: "user", content: "Hello" });
agent.replaceMessages(newMessages);
agent.clearMessages();
agent.reset();  // Clear everything
```

---

## 6. Thinking / Reasoning

X-Agent supports **thinking budgets** for models that support reasoning tokens:

```javascript
thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
```

```javascript
thinkingBudgets: {
  minimal: 128,   // Tokens for minimal reasoning
  low: 512,
  medium: 1024,
  high: 2048,
}
```

When enabled, thinking is streamed via `thinking_delta` events and displayed in UI.

---

## 7. Tool Definition

Tools are simple objects with schema and execution:

```javascript
const calculatorTool = {
  name: "calculator",
  label: "Calculator",
  description: "Evaluate a mathematical expression",
  parameters: {
    type: "object",
    properties: {
      expr: { type: "string", description: "Expression like 2 + 2" }
    },
    required: ["expr"]
  },
  execute: async (toolCallId, params, signal, onUpdate) => {
    // Optional: stream progress
    onUpdate?.({ content: [{ type: "text", text: "Computing..." }] });

    const result = eval(params.expr); // Simple example

    return {
      content: [{ type: "text", text: String(result) }],
      details: { expression: params.expr, result }
    };
  }
};
```

### Tool Error Handling

**Throw errors** when tools fail. Do not return error messages as content:

```javascript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // Return content only on success
  return { content: [{ type: "text", text: "..." }] };
}
```

Thrown errors are caught and reported to the LLM as tool errors with `isError: true`.

---

## 8. Low-Level API — agentLoop

For direct control without the Agent class:

```javascript
import { agentLoop, agentLoopContinue } from "@ranag/x-agent";

const context = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [myTool],
};

const config = {
  model: getModel("anthropic/claude-sonnet-4"),
  convertToLlm: (msgs) => msgs.filter(m => 
    ["user", "assistant", "toolResult"].includes(m.role)
  ),
};

const userMessage = { 
  role: "user", 
  content: [{ type: "text", text: "Hello" }], 
  timestamp: Date.now() 
};

for await (const event of agentLoop([userMessage], context, config)) {
  console.log(event.type);
  // Handle events manually
}
```

---

## Quick Summary

| Component | Purpose |
|-----------|---------|
| `Agent` class | Main entry point — handles prompting, state, events |
| `agentLoop` | Low-level — runs ReAct loop manually |
| `EventManager` | Emits structured events for UI |
| `QueueManager` | Handles steering/follow-up queuing |
| `executeToolCalls` | Runs tools and returns results |
| `openRouterStream` | Connects to 300+ LLM models |

### Agent vs UI Responsibility

| Part | Done by Agent | Done by UI |
|------|--------------|------------|
| Deciding what to do | LLM + loop | — |
| Executing tools | Tool executor | — |
| Writing final answer | LLM | Renders markdown |
| Showing thinking | Streams thinking | Animated box |
| Showing tool progress | Tool execution events | Progress bars |
| Completion | agent_end event | Green badge, enable input |

---

For more details, see:
- [API Reference](./README.md#api-reference)
- [Tools Documentation](./README.md#tools)
- [OpenRouter Integration](./README.md#openrouter-integration)
- [Examples](./examples/)
