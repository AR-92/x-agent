# System Prompt Presets

X-Agent includes pre-built system prompt presets that define different agent personalities and communication styles. Use these to customize how your agent responds and behaves.

## Available Presets

### 1. HELPFUL_ASSISTANT (Manaus Style)

**Best for:** General-purpose assistants, customer support, task completion

The `HELPFUL_ASSISTANT` preset creates a professional, proactive agent that:
- Acknowledges requests clearly before acting
- Explains what it's about to do step-by-step
- Shows progress with structured updates
- Summarizes completed work clearly
- Uses professional, friendly language
- Offers follow-up suggestions

**Example behavior:**
```
User: "Make me a landing page for an AI company"

Agent: "Understood! I'll create a professional landing page for your AI company. 
Let me start by setting up the project structure and then design a modern, 
responsive layout.

I'm creating the following files:
- `index.html` - Main landing page with hero section
- `styles.css` - Custom styles with modern design tokens
- `app.js` - Interactive components and animations

Task Complete! I've built the landing page with:
- **Hero Section** with animated background
- **Features Showcase** with 6 core capabilities
- **Responsive Design** for all devices
- **Smooth Animations** and hover effects

Would you like me to:
- Add a contact form section?
- Create a blog page?
- Add testimonials from clients?"
```

### 2. CODE_EXPERT

**Best for:** Software development, code review, technical tasks

The `CODE_EXPERT` preset creates a technical coding assistant that:
- Focuses on code quality and best practices
- Explains technical decisions clearly
- Includes error handling and edge cases
- Provides working, tested code
- Uses precise technical terminology

### 3. CREATIVE_PARTNER

**Best for:** Design projects, UX work, creative tasks

The `CREATIVE_PARTNER` preset creates a design-focused assistant that:
- Discusses visual hierarchy and aesthetics
- Considers user experience and accessibility
- Uses descriptive, evocative language
- Thinks from the user's perspective
- References design principles

### 4. DATA_ANALYST

**Best for:** Data analysis, visualization, insights

The `DATA_ANALYST` preset creates an analytics-focused assistant that:
- Bases conclusions on data evidence
- Explains statistical methods used
- Chooses appropriate chart types
- Highlights patterns and trends
- Provides actionable insights

### 5. RESEARCH_ASSISTANT

**Best for:** Information gathering, synthesis, fact-checking

The `RESEARCH_ASSISTANT` preset creates a thorough research assistant that:
- Cites sources when possible
- Explores multiple angles of a topic
- Cross-references information
- Distinguishes between facts and opinions
- Notes confidence levels

## Usage

### Basic Usage

```javascript
import { Agent, getPreset } from "@ranag/x-agent";

// Get a preset by name
const systemPrompt = getPreset('helpful-assistant');

const agent = new Agent({
  initialState: {
    systemPrompt: systemPrompt,
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: async (model, context, options) => {
    // Your streaming function
  },
});
```

### Available Preset Names

```javascript
import { getPresetNames } from "@ranag/x-agent";

const names = getPresetNames();
// ['helpful', 'helpful-assistant', 'manaus', 'code', 'code-expert', 
//  'creative', 'creative-partner', 'data', 'data-analyst', 
//  'research', 'research-assistant']
```

### Custom Instructions

You can combine a preset with custom instructions:

```javascript
import { createCustomPrompt } from "@ranag/x-agent";

const systemPrompt = createCustomPrompt('helpful-assistant', `

## Domain-Specific Instructions

You are specialized in web development. When creating web pages:
- Always use semantic HTML5 elements
- Include proper meta tags for SEO
- Ensure WCAG 2.1 AA accessibility compliance
- Use modern CSS (Flexbox, Grid, custom properties)
- Include responsive breakpoints for mobile, tablet, and desktop
`);

const agent = new Agent({
  initialState: {
    systemPrompt: systemPrompt,
    model: getModel('anthropic/claude-sonnet-4'),
  },
  streamFn: async (model, context, options) => {
    // Your streaming function
  },
});
```

### Using in HTML Examples

```html
<script type="module">
  import { Agent, getPreset } from './assets/js/x-agent.min.js';

  const agent = new Agent({
    initialState: {
      systemPrompt: getPreset('helpful-assistant'),
      model: getModel('mistralai/mistral-small-3.1-24b-instruct:free'),
      thinkingLevel: 'medium',
      tools: [myTool],
    },
    streamFn: async (model, context, options) => {
      // Your streaming function
    },
  });
</script>
```

## Communication Style Guide

The `HELPFUL_ASSISTANT` preset follows this communication pattern:

### 1. Acknowledge & Confirm
Start by acknowledging the request and confirming understanding.

> "Understood! I'll help you with [task]."

### 2. Plan
Briefly outline your approach.

> "Here's what I'll do: [brief outline]"

### 3. Execute
Perform the task with structured updates.

> "I'm creating the following files:..."

### 4. Summarize
Provide a clear completion summary.

> "✓ Complete! Here's what I created: [list]"

### 5. Follow-up
Offer relevant next steps.

> "Would you like me to [suggestion]?"

## Formatting Guidelines

All presets follow these formatting guidelines:

- **Bold** for important terms, file names, and features
- Bullet lists for multiple items
- Numbered lists for sequential steps
- Sections with clear headings for complex responses
- Short, scannable paragraphs
- Code formatting for technical terms, paths, and commands

## Tips for Best Results

1. **Choose the right preset** for your use case
2. **Add domain-specific instructions** for specialized tasks
3. **Keep the system prompt visible** in your UI for transparency
4. **Test different presets** to find the best fit
5. **Combine presets** with custom instructions for fine-tuning

## API Reference

### `getPreset(name: string): string | undefined`

Get a preset by name (case-insensitive).

```javascript
const prompt = getPreset('helpful'); // Returns HELPFUL_ASSISTANT
const prompt = getPreset('manaus');  // Also returns HELPFUL_ASSISTANT
```

### `getPresetNames(): string[]`

Get all available preset names.

```javascript
const names = getPresetNames();
// ['helpful', 'helpful-assistant', 'manaus', ...]
```

### `createCustomPrompt(presetName: string, customInstructions: string): string`

Create a custom system prompt by combining a preset with additional instructions.

```javascript
const prompt = createCustomPrompt('code-expert', `
## Project Conventions
- Use TypeScript for all new code
- Follow ESLint rules
- Write tests for all functions
`);
```

## Migration Guide

If you're updating from an older system prompt, here's how to migrate:

### Before
```javascript
const systemPrompt = "You are a helpful assistant. Be concise but thorough.";
```

### After
```javascript
import { getPreset } from "@ranag/x-agent";

const systemPrompt = getPreset('helpful-assistant');
```

### With Custom Instructions
```javascript
import { createCustomPrompt } from "@ranag/x-agent";

const systemPrompt = createCustomPrompt('helpful-assistant', `
## Additional Context
You are helping users build web applications. Focus on:
- Clean, semantic HTML
- Accessible components
- Responsive design
`);
```
