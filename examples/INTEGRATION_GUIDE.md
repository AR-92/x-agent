# X-Agent Full Integration Guide

## Overview
This guide shows you how to use `examples/example.html` with full Agent + OpenRouter functionality while maintaining 100% of the modern UI.

## What's Been Done

### Files Created/Modified:
1. **`examples/lib/app.js`** - New main app file with full Agent integration
2. **`examples/example.html`** - Updated to use `app.js` instead of `example.js`
3. **`examples/components/ChatMessages.js`** - Added user message support

## Features Included

✅ **Full Agent Integration**
- Agent initialization with OpenRouter
- Streaming responses
- Tool execution (Calculator + Current Time)
- Event handling (agent_start, message_update, tool_execution, etc.)

✅ **UI Components**
- ChatMessages - Display conversation with user/assistant messages
- ChatInput - Message input with task tracking
- Sidebar - Navigation with user profile dropdown
- RightPanel - Collapsible details panel
- SettingsModal - Theme and settings configuration

✅ **OpenRouter Integration**
- Model loading from OpenRouter API
- API key management (localStorage)
- Streaming with `openRouterStream`
- Usage tracking

✅ **Tools**
- Calculator - Safe mathematical expression evaluation
- Get Current Time - Returns current date/time

## How to Use

### 1. Start the Dev Server
```bash
npm run dev
```

### 2. Open in Browser
Navigate to: `http://localhost:3000/examples/example.html`

### 3. Enter API Key
On first use, you'll be prompted for your OpenRouter API key.
- Format: `sk-or-...`
- The key is saved in localStorage for future sessions

### 4. Chat with the Agent
Type a message and press Enter or click the send button.

**Example prompts:**
- "Calculate 25 * 47"
- "What is the current time?"
- "What is the capital of France?"

## Architecture

```
example.html (UI Structure)
    ↓
app.js (Main Application)
    ├── Components (ChatMessages, ChatInput, Sidebar, etc.)
    ├── Agent (x-agent.min.js)
    └── OpenRouter (x-agent-openrouter.min.js)
```

## Key Functions

### `initAgent()`
Initializes the Agent with:
- API key from localStorage
- Selected model
- System prompt
- Tools (calculator, currentTime)

### `sendMessage(message)`
1. Adds user message to chat
2. Creates streaming placeholder
3. Calls `agent.prompt()`
4. Handles streaming updates

### `handleAgentEvent(event)`
Processes agent events:
- `agent_start` → Update status to "running"
- `message_update` → Stream content to UI
- `tool_execution_start` → Show tool call badge
- `error` → Display error alert

### `loadModels()`
Fetches available models from OpenRouter API and sets default model.

## Customization

### Change Default Model
```javascript
// In app.js
let currentModelId = 'anthropic/claude-sonnet-4';
```

### Add More Tools
```javascript
const myTool = {
  name: 'my_tool',
  label: 'My Tool',
  description: 'What it does',
  parameters: { /* JSON Schema */ },
  execute: async (toolCallId, params, signal, onUpdate) => {
    // Implementation
  },
};

// Add to agent initialization
tools: [calculatorTool, currentTimeTool, myTool],
```

### Customize System Prompt
```javascript
// In app.js
let systemPrompt = 'You are a specialized assistant for...';
```

### Change Thinking Level
```javascript
// Options: 'off', 'minimal', 'low', 'medium', 'high', 'xhigh'
let thinkingLevel = 'high';
```

## API Key Management

### Get API Key
```javascript
function getApiKey() {
  return window.OPENROUTER_API_KEY || localStorage.getItem('openrouter_api_key') || '';
}
```

### Set API Key
```javascript
function setApiKey(key) {
  localStorage.setItem('openrouter_api_key', key);
}
```

### Auto-inject from Dev Server
If using the dev server with `.env` file:
```
OPENROUTER_API_KEY=sk-or-...
```

The key will be available as `window.OPENROUTER_API_KEY`.

## Troubleshooting

### "Please enter your OpenRouter API key"
- API key is missing or empty
- Check localStorage or enter key when prompted

### "Failed to load models"
- Check network connection
- Verify API key is valid
- Check browser console for errors

### Empty responses
- Try a different model
- Check if model supports streaming
- Verify system prompt isn't too restrictive

## Next Steps

1. **Add Configuration UI** - Add settings modal for model selection, system prompt, etc.
2. **Enhance RightPanel** - Show token usage, model info, conversation stats
3. **Add Conversation History** - Load/save conversations
4. **Improve Streaming** - Better parsing of streaming JSON for badges, code, etc.
5. **Add Mobile Support** - Implement mobile menu toggle

## File Structure

```
examples/
├── example.html          # Main HTML (modern UI)
├── lib/
│   ├── app.js           # Main app with Agent integration ⭐
│   └── example.js       # Original example (still available)
├── components/
│   ├── ChatMessages.js  # Conversation display
│   ├── ChatInput.js     # Message input
│   ├── Sidebar.js       # Navigation sidebar
│   ├── RightPanel.js    # Collapsible panel
│   └── SettingsModal.js # Settings dialog
└── assets/
    ├── js/
    │   ├── x-agent.min.js
    │   └── x-agent-openrouter.min.js
    └── css/
        └── custom.css
```

## Comparison: example.html vs index.html

| Feature | example.html | index.html |
|---------|-------------|------------|
| UI | Modern dashboard | Simple test page |
| Components | Reusable JS components | Inline HTML |
| Agent | Full integration | Full integration |
| Tools | ✅ | ✅ |
| Streaming | ✅ | ✅ |
| Model Selection | Via API | Manual dropdown |
| Settings | Theme modal | Basic form |
| Responsive | ✅ | ❌ |

**Recommendation:** Use `example.html` as the base for production, `index.html` for quick testing.
