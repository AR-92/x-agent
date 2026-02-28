# X-Agent Without pi-ai: Using Proxy Mode

## Yes, You Can Remove pi-ai!

If you use **proxy mode**, X-Agent can work **without pi-ai**. The proxy backend handles all LLM communication, and X-Agent just needs to send/receive data from your proxy.

---

## How It Works

### With pi-ai (Current Setup)

```
X-Agent → pi-ai → LLM Provider (OpenAI, Anthropic, etc.)
```

**pi-ai responsibilities:**
- Model discovery (`getModel()`)
- API authentication
- Request formatting
- Streaming response parsing
- Tool call validation
- Event emission

### With Proxy (No pi-ai)

```
X-Agent → Your Proxy → LLM Provider
```

**Proxy responsibilities:**
- Model routing
- API authentication
- Request formatting
- Streaming response parsing
- Tool call handling
- Event formatting

**X-Agent responsibilities:**
- Agent state management
- Tool execution
- Event streaming to UI
- Steering/follow-up queues

---

## Implementation: Custom streamFn

The key is implementing a custom `streamFn` that talks to your proxy:

```javascript
import { Agent } from '@mariozechner/x-agent';

// Custom stream function that calls your proxy
async function proxyStream(model, context, options) {
  const response = await fetch(`${options.proxyUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.authToken}`,
    },
    body: JSON.stringify({
      model: model.id,  // Your proxy's model identifier
      messages: context.messages,
      tools: context.tools,
      systemPrompt: context.systemPrompt,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Proxy error: ${response.status}`);
  }

  // Create event stream for X-Agent
  const stream = new EventStream();
  
  // Read SSE stream from proxy
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6));
        
        // Convert proxy events to X-Agent events
        switch (event.type) {
          case 'start':
            stream.push({ type: 'start', partial: event.message });
            break;
          case 'text_delta':
            stream.push({ 
              type: 'text_delta', 
              contentIndex: event.contentIndex,
              delta: event.delta,
              partial: event.partial 
            });
            break;
          case 'toolcall_start':
            stream.push({ 
              type: 'toolcall_start',
              contentIndex: event.contentIndex,
              partial: event.partial
            });
            break;
          case 'toolcall_delta':
            stream.push({
              type: 'toolcall_delta',
              contentIndex: event.contentIndex,
              delta: event.delta,
              partial: event.partial
            });
            break;
          case 'toolcall_end':
            stream.push({
              type: 'toolcall_end',
              contentIndex: event.contentIndex,
              toolCall: event.toolCall,
              partial: event.partial
            });
            break;
          case 'done':
            stream.push({ type: 'done', reason: event.reason, message: event.message });
            break;
          case 'error':
            stream.push({ type: 'error', reason: event.reason, error: event.error });
            break;
        }
      }
    }
  }

  return stream;
}

// Use with Agent
const agent = new Agent({
  initialState: {
    systemPrompt: 'You are a helpful assistant.',
    model: { id: 'gpt-4o' },  // Simple model object
  },
  streamFn: proxyStream,
});
```

---

## Minimal X-Agent Without pi-ai

### Step 1: Remove pi-ai Dependency

```bash
npm uninstall @mariozechner/pi-ai
# or
bun remove @mariozechner/pi-ai
```

### Step 2: Update src/types.js

Remove pi-ai type imports:

```javascript
// Instead of importing from pi-ai, define locally

/**
 * @typedef {Object} Message
 * @property {'user' | 'assistant' | 'toolResult'} role
 * @property {any} content
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} Model
 * @property {string} id
 * @property {string} [provider]
 * @property {string} [baseUrl]
 */

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {any} parameters
 */

/**
 * @typedef {Object} TextContent
 * @property {'text'} type
 * @property {string} text
 */

/**
 * @typedef {Object} ImageContent
 * @property {'image'} type
 * @property {string} data
 * @property {string} mimeType
 */

/**
 * @typedef {Object} ToolResultMessage
 * @property {'toolResult'} role
 * @property {string} toolCallId
 * @property {string} toolName
 * @property {any[]} content
 * @property {boolean} [isError]
 * @property {number} timestamp
 */

/**
 * @typedef {Object} AssistantMessageEvent
 * @property {'text_start' | 'text_delta' | 'text_end' | 'thinking_start' | 'thinking_delta' | 'thinking_end' | 'toolcall_start' | 'toolcall_delta' | 'toolcall_end'} type
 * @property {any} partial
 */

/**
 * @typedef {Object} SimpleStreamOptions
 * @property {string} [apiKey]
 * @property {AbortSignal} [signal]
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {string} [reasoning]
 * @property {string} [sessionId]
 * @property {string} [transport]
 */
```

### Step 3: Update src/loop/loop.js

Remove pi-ai import and use local streamSimple or proxy:

```javascript
// Remove this import
// import { streamSimple } from '@mariozechner/pi-ai';

// Use streamFn passed from Agent (proxy or custom)
const streamFunction = streamFn;  // Use provided streamFn directly
```

### Step 4: Update src/loop/tools.js

Remove pi-ai import:

```javascript
// Remove this import
// import { validateToolArguments } from '@mariozechner/pi-ai';

// Simple validation (or skip if proxy handles it)
function validateToolArguments(tool, toolCall) {
  // Basic validation or return as-is
  return toolCall.arguments;
}
```

### Step 5: Update src/agent/agent.js

Remove pi-ai imports:

```javascript
// Remove these imports
// import { getModel, streamSimple } from '@mariozechner/pi-ai';

// Provide default streamFn (proxy)
constructor(opts = {}) {
  // ...
  this._streamFn = opts.streamFn || proxyStream;  // Your proxy function
  // ...
  
  // Default model without pi-ai
  if (!this._state.model) {
    this._state.model = { id: 'default-model' };
  }
}
```

---

## Proxy API Format

Your proxy should emit events in this format:

```javascript
// Server-Sent Events (SSE) format
data: {"type":"start","message":{"role":"assistant","content":[],"timestamp":1234567890}}

data: {"type":"text_start","contentIndex":0,"partial":{...}}

data: {"type":"text_delta","contentIndex":0,"delta":"Hello","partial":{...}}

data: {"type":"text_end","contentIndex":0,"content":"Hello","partial":{...}}

data: {"type":"toolcall_start","contentIndex":0,"id":"call_1","toolName":"search","partial":{...}}

data: {"type":"toolcall_delta","contentIndex":0,"delta":"{\"query\":\"","partial":{...}}

data: {"type":"toolcall_end","contentIndex":0,"toolCall":{"id":"call_1","name":"search","arguments":{"query":"test"}},"partial":{...}}

data: {"type":"done","reason":"stop","message":{...},"usage":{...}}

data: {"type":"error","reason":"error","error":{...},"usage":{...}}
```

---

## Complete Example: Browser + Proxy

```html
<!DOCTYPE html>
<html>
<head>
  <title>X-Agent with Proxy</title>
</head>
<body>
  <div id="output"></div>
  <input id="prompt" placeholder="Type...">
  <button id="send">Send</button>

  <script type="module">
    import { Agent } from 'https://cdn.jsdelivr.net/npm/@mariozechner/x-agent@1.0.0/dist/x-agent.min.js';

    // Custom proxy stream function
    async function proxyStream(model, context, options) {
      const response = await fetch('https://your-proxy.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages: context.messages,
          tools: context.tools,
          system: context.systemPrompt,
        }),
        signal: options.signal,
      });

      if (!response.ok) throw new Error(`Proxy error: ${response.status}`);

      const stream = new EventStream();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event = JSON.parse(line.slice(6));
            stream.push(event);
          }
        }
      }

      return stream;
    }

    // Create agent with proxy
    const agent = new Agent({
      initialState: {
        systemPrompt: 'You are a helpful assistant.',
        model: { id: 'gpt-4o' },
      },
      streamFn: proxyStream,
    });

    // Subscribe to events
    agent.subscribe((event) => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        document.getElementById('output').textContent += event.assistantMessageEvent.delta;
      }
    });

    // Handle prompts
    document.getElementById('send').addEventListener('click', async () => {
      const prompt = document.getElementById('prompt').value;
      await agent.prompt(prompt);
    });
  </script>
</body>
</html>
```

---

## Package Size Comparison

| Setup | Dependencies | Bundle Size |
|-------|-------------|-------------|
| With pi-ai | `@mariozechner/pi-ai` | ~16 kB (minified) |
| Without pi-ai | None | ~12 kB (minified) |

**Savings:** ~4 kB (25% smaller)

---

## When to Use Each Approach

### Use pi-ai When:
- ✅ You want direct LLM provider access
- ✅ You need multi-provider support
- ✅ You want built-in model discovery
- ✅ You want automatic tool validation
- ✅ You're building server-side apps

### Use Proxy (No pi-ai) When:
- ✅ You have a backend proxy already
- ✅ You want to hide API keys from clients
- ✅ You need custom auth/rate limiting
- ✅ You want to reduce bundle size
- ✅ You're building browser-only apps
- ✅ You need custom LLM routing logic

---

## Migration Checklist

To remove pi-ai and use proxy:

- [ ] Remove `@mariozechner/pi-ai` from dependencies
- [ ] Update `src/types.js` with local type definitions
- [ ] Update `src/loop/loop.js` to use custom streamFn
- [ ] Update `src/loop/tools.js` with local validation (or skip)
- [ ] Update `src/agent/agent.js` default model and streamFn
- [ ] Update `src/index.js` exports
- [ ] Update `src/proxy.js` if using (optional)
- [ ] Implement proxy backend API
- [ ] Test all functionality
- [ ] Rebuild bundles

---

## Conclusion

**Yes, you can use X-Agent without pi-ai if you use a proxy!**

The proxy handles all LLM communication, and X-Agent focuses on:
- Agent state management
- Tool execution
- Event streaming
- Steering/follow-up

This is actually the **recommended approach for browser apps** where you don't want to expose API keys.

### Trade-offs:

| With pi-ai | With Proxy |
|------------|------------|
| Direct provider access | Need proxy backend |
| Built-in model discovery | Manual model management |
| Automatic tool validation | Proxy handles validation |
| ~16 kB bundle | ~12 kB bundle |
| API keys in client | API keys hidden |

Choose based on your use case!
