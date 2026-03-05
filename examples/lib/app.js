/**
 * Main App - Full Agent Integration with OpenRouter
 * Combines the modern UI with full agent functionality
 * Uses all ChatMessages UI features: badges, code, alerts, terminal, reasoning
 */

import { ChatInput } from '../components/ChatInput.js';
import { SettingsModal } from '../components/SettingsModal.js';
import { Sidebar } from '../components/Sidebar.js';
import { RightPanel } from '../components/RightPanel.js';
import { ChatMessages } from '../components/ChatMessages.js';

// Import Agent and OpenRouter modules
import { Agent } from '../assets/js/x-agent.min.js';
import {
  openRouterStream,
  getModel,
  getModels,
  createLogger,
  setLogLevel,
  LogLevel,
} from '../assets/js/x-agent-openrouter.min.js';

// Enable DEBUG logging
setLogLevel(LogLevel.DEBUG);
const log = createLogger('App');

// App State
let agent = null;
let abortController = null;
let currentModelId = 'mistralai/mistral-small-3.1-24b-instruct:free';
let allModels = [];
let systemPrompt = `You are a highly capable, helpful, and professional AI assistant. Your goal is to assist users effectively while maintaining clear, transparent communication.

## Communication Style

### 1. Acknowledge & Confirm
- Start by acknowledging the user's request
- Confirm your understanding of what they want
- Briefly outline your approach before taking action

**Example:** "Understood! I'll create a professional landing page for your AI company. Let me start by setting up the project structure and then design a modern, responsive layout."

### 2. Show Your Work
- Explain what you're doing as you do it
- Break complex tasks into clear steps
- Mention files you're creating or modifying
- Share decisions and reasoning for important choices

**Example:** "I'm creating the following files:
- \`index.html\` - Main landing page with hero section
- \`styles.css\` - Custom styles with modern design tokens
- \`app.js\` - Interactive components and animations"

### 3. Structured Updates
- Use clear formatting (bold, lists, sections)
- Organize information logically
- Highlight important details
- Keep updates concise but informative

### 4. Summarize Completion
- Provide a clear summary when tasks are complete
- List what was created/accomplished
- Highlight key features or decisions
- Mention any next steps or recommendations

**Example:** "✓ Task Complete! I've built the landing page with:
- **Hero Section** with animated background
- **Features Showcase** with 6 core capabilities
- **Responsive Design** for all devices
- **Smooth Animations** and hover effects"

### 5. Offer Follow-ups
- Suggest related next steps
- Ask if the user needs anything else
- Provide options for extending the work

**Example:** "Would you like me to:
- Add a contact form section?
- Create a blog page?
- Add testimonials from clients?"

## Formatting Guidelines

- Use **bold** for important terms, file names, and features
- Use bullet lists for multiple items
- Use numbered lists for sequential steps
- Use sections with clear headings for complex responses
- Keep paragraphs short and scannable
- Use code formatting for technical terms, paths, and commands

## Tone

- **Professional** but friendly
- **Confident** but not arrogant
- **Clear** and concise
- **Helpful** and proactive
- **Transparent** about what you're doing

## Example Response Structure

1. **Acknowledgment**: "Understood! I'll help you with [task]."
2. **Plan**: "Here's what I'll do: [brief outline]"
3. **Execution**: [Perform the task with updates]
4. **Summary**: "✓ Complete! Here's what I created: [list]"
5. **Follow-up**: "Would you like me to [suggestion]?"

## Remember

- Always be helpful and solution-oriented
- Communicate clearly and proactively
- Show your work and explain your decisions
- Make it easy for users to understand and extend your work
- Offer relevant follow-up options`;
let thinkingLevel = 'medium';

// Current message being built
let currentStreamingMessage = null;
let pendingBadges = [];
let pendingCodeBlocks = [];
let pendingAlerts = [];
let pendingTerminal = null;
let pendingReasoning = null;

// Narration → Action → Result → Next Step flow
let currentNarration = '';
let actionSteps = [];
let completedResults = [];
let nextSteps = [];
let currentPhase = 'planning'; // planning, action, result

// Tools
const calculatorTool = {
  name: 'calculator',
  label: 'Calculator',
  description: 'Perform mathematical calculations. Use this for any math problems.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate (e.g., "25 * 47")',
      },
    },
    required: ['expression'],
  },
  execute: async (toolCallId, params, signal, onUpdate) => {
    onUpdate?.({
      content: [{ type: 'text', text: `Calculating: ${params.expression}...` }],
      details: { expression: params.expression },
    });

    try {
      const result = evaluateMath(params.expression);
      return {
        content: [{ type: 'text', text: `Result: ${result}` }],
        details: { expression: params.expression, result },
      };
    } catch (error) {
      throw new Error(`Calculation error: ${error.message}`);
    }
  },
};

const currentTimeTool = {
  name: 'get_current_time',
  label: 'Get Current Time',
  description: 'Get the current date and time',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    const now = new Date();
    return {
      content: [{ type: 'text', text: `Current time: ${now.toLocaleString()}` }],
      details: { timestamp: now.toISOString() },
    };
  },
};

function evaluateMath(expression) {
  if (!/^[\d\s+\-*/().%^]+$/.test(expression)) {
    throw new Error('Invalid characters in expression');
  }
  return Function('"use strict"; return (' + expression + ')')();
}

// Initialize Components
const chatMessages = new ChatMessages({
  container: document.getElementById('chatMessagesContainer'),
  assistantName: 'Accelerator',
  messages: [],
});

const sidebar = new Sidebar({
  container: document.getElementById('sidebarContainer'),
  logo: {
    icon: 'hexagon',
    alt: 'X-Agent',
    version: '1.0'
  },
  navigation: [
    { label: 'New Task', icon: 'plus', href: '#', active: true },
    { label: 'Explore', icon: 'compass', href: '#' },
    { label: 'Dashboard', icon: 'chart-no-axes-column-increasing', href: '#' },
    { label: 'Portfolio', icon: 'briefcase', href: '#' },
  ],
  tasksSection: {
    taskCount: 0,
    tasks: [],
  },
  user: {
    name: 'User',
    avatar: null,
    plan: 'Pro',
    credits: 1479,
  },
  onNavigate: (item, index) => {
    log.info('Navigated to:', item.label);
  },
  onSettings: () => {
    settingsModal.open();
  },
});

const rightPanel = new RightPanel({
  container: document.getElementById('rightPanelContainer'),
  title: 'Response Details',
  width: 400,
  minWidth: 250,
  maxWidth: 800,
  isOpen: false,
  onClose: () => {
    log.info('Right panel closed');
  },
  onOpen: () => {
    log.info('Right panel opened');
  },
  onResize: (width) => {
  },
});

const chatInput = new ChatInput({
  container: document.getElementById('chatInputContainer'),
  placeholder: 'Send message to Accelerator...',
  tasks: [],
  onSend: (message) => {
    sendMessage(message);
  },
  onAttachment: () => {
    log.info('Attachment clicked');
  },
  onVoice: () => {
    log.info('Voice clicked');
  },
  onPlus: () => {
    log.info('Plus clicked');
  },
  onStop: () => {
    log.info('Stop clicked');
    abortRequest();
  },
  onSteer: (message) => {
    log.info('Steer clicked:', message);
    steerAgent(message);
  },
});

const settingsModal = new SettingsModal({
  container: document.getElementById('settingsModalContainer'),
  currentTheme: 'Light',
  onThemeChange: (theme, themeName) => {
    document.documentElement.setAttribute('data-theme', theme);
    log.info('Theme changed:', themeName);
  },
  onApiKeyChange: (apiKey) => {
    log.info('API key updated');
    resetAgent();
  },
  onModelChange: (modelId) => {
    log.info('Model changed:', modelId);
    currentModelId = modelId;
    resetAgent();
  },
  onSystemPromptChange: (prompt) => {
    log.info('System prompt changed');
    systemPrompt = prompt;
    resetAgent();
  },
  onThinkingLevelChange: (level) => {
    log.info('Thinking level changed:', level);
    thinkingLevel = level;
    resetAgent();
  },
  onLanguageChange: (lang) => {
    log.info('Language changed:', lang);
  },
  onTimeFormatChange: (format) => {
    log.info('Time format changed:', format);
  },
  onDateFormatChange: (format) => {
    log.info('Date format changed:', format);
  },
  onTimezoneChange: (timezone) => {
    log.info('Timezone changed:', timezone);
  },
});

// Wire up panel toggle
document.getElementById('panelToggle')?.addEventListener('click', () => {
  rightPanel.open();
});

document.getElementById('menuBtn')?.addEventListener('click', () => {
  log.info('Menu button clicked');
});

// Agent Functions
function initAgent() {
  const apiKey = getApiKey();
  if (!apiKey) {
    showApiKeyPrompt();
    return null;
  }

  if (!currentModelId) {
    alert('Please select a model');
    return null;
  }

  log.info('Initializing agent with model:', currentModelId);

  agent = new Agent({
    initialState: {
      systemPrompt: systemPrompt,
      model: getModel(currentModelId),
      thinkingLevel: thinkingLevel,
      tools: [calculatorTool, currentTimeTool],
    },
    streamFn: async (model, context, options) => {
      log.info('OpenRouter stream called with model:', currentModelId);

      return openRouterStream({
        ...options,
        apiKey: apiKey,
        modelId: currentModelId,
        siteUrl: window.location.origin,
        siteName: 'Manus Lite',
      }, context);
    },
  });

  agent.subscribe(handleAgentEvent);

  return agent;
}

function handleAgentEvent(event) {
  log.debug('Received event:', event.type, event);

  switch (event.type) {
    case 'agent_start':
      log.info('Agent started');
      updateStatus('running');
      resetStreamingState();
      break;

    case 'agent_end':
      log.info('Agent completed');
      updateStatus('idle');
      finalizeCurrentMessage();
      // Complete any remaining pending tasks
      if (chatInput.hasPendingTasks()) {
        const progress = chatInput.getProgress();
        if (progress.completed < progress.total) {
          // Mark remaining as completed
          chatInput.tasks.forEach((task, index) => {
            if (task.status === 'pending' || task.status === 'active') {
              chatInput.completeTask(index);
            }
          });
        }
      }
      break;

    case 'message_update':
      if (event.assistantMessageEvent) {
        processMessageUpdate(event.assistantMessageEvent);
      }
      break;

    case 'message_start':
      if (event.message?.role === 'assistant') {
        const messages = chatMessages.options.messages;
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || !lastMessage.isStreaming) {
          chatMessages.addMessage({
            type: 'response',
            content: '',
            items: [],
            isStreaming: true,
          });
        }
      }
      break;

    case 'message_end':
      if (event.message.role === 'assistant') {
        finalizeAssistantMessage(event.message);
      } else if (event.message.role === 'toolResult') {
        addToolResultMessage(event.message);
      }
      break;

    case 'content_block_start':
      if (event.contentBlock?.type === 'tool_use') {
        // Model is calling a tool - add to action steps
        addToolCallBadge(event.contentBlock.name || event.contentBlock.id);
      } else if (event.contentBlock?.type === 'code') {
        // Code block starting - add to results
        completedResults.push({
          type: 'code',
          language: event.contentBlock.language || 'text',
          code: '',
        });
      }
      break;

    case 'content_block_delta':
      if (event.delta?.type === 'tool_use') {
        const text = event.delta.content?.[0]?.text || '';
        if (text) {
          const messages = chatMessages.options.messages;
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.isStreaming) {
            // Update the action step badge with input
            const actionStep = actionSteps.find(a => a.text.includes('Calling'));
            if (actionStep) {
              actionStep.text = `Calling with: ${text.substring(0, 50)}...`;
            }
            chatMessages.refresh();
          }
        }
      } else if (event.delta?.type === 'tool_result') {
        // Tool result content from model - add to results
        const resultText = event.delta.content?.[0]?.text || '';
        if (resultText) {
          if (resultText.includes('\n') || resultText.length > 80) {
            completedResults.push({
              type: 'code',
              language: 'text',
              code: resultText,
            });
          }
          updateMessageItems();
        }
      } else if (event.delta?.type === 'code_block_delta') {
        const text = event.delta.content?.[0]?.text || '';
        if (text && completedResults.length > 0) {
          const lastResult = completedResults[completedResults.length - 1];
          if (lastResult.type === 'code') {
            lastResult.code = (lastResult.code || '') + text;
          }
        }
      }
      break;

    case 'content_block_stop':
      break;

    case 'done':
      if (event.message?.usage) {
        showUsageInPanel(event.message.usage);
      }
      if (event.message?.content?.length === 0) {
        log.warn('Empty response from model');
        addErrorMessage('Model returned empty response. Try a different model.');
        updateStatus('error');
      }
      break;

    case 'turn_end':
      finalizeCurrentMessage();
      break;

    case 'tool_execution_start':
      log.info('Tool execution started:', event.toolName);
      addToolCallBadge(event.toolName);
      // Claim a task when tool starts
      if (chatInput.hasPendingTasks()) {
        claimNextTask();
      }
      break;

    case 'tool_execution_end':
      log.info('Tool execution ended:', event.toolName, 'isError:', event.isError);
      
      // Move from action to result
      actionSteps = actionSteps.filter(a => !a.text.includes(event.toolName));
      completedResults.push({
        type: 'badge',
        variant: 'success',
        icon: 'check-circle-2',
        text: `${event.toolName} completed`,
      });
      
      // Complete the current task on success
      if (!event.isError) {
        completeCurrentTask();
        // Claim next task if available
        if (chatInput.hasPendingTasks()) {
          claimNextTask();
        }
      } else {
        failCurrentTask(event.error?.message || 'Tool execution failed');
      }

      if (event.result) {
        const resultText = typeof event.result === 'string' ? event.result : JSON.stringify(event.result, null, 2);
        
        if (resultText.includes('\n') || resultText.length > 80) {
          completedResults.push({
            type: 'code',
            language: 'json',
            code: resultText,
          });
        }

        if (event.isError) {
          pendingAlerts.push({
            type: 'alert',
            variant: 'warning',
            title: 'Tool Warning',
            message: resultText,
          });
        }
      }
      
      // Refresh the UI to show tool results
      updateMessageItems();
      break;

    case 'error':
      updateStatus('error');
      const errorMsg = event.error?.errorMessage || event.error?.message || 'An error occurred';
      log.error('Agent error:', event.error);
      addErrorMessage(errorMsg);
      break;
  }
}

// Reset streaming state for new message
function resetStreamingState() {
  currentStreamingMessage = null;
  pendingBadges = [];
  pendingCodeBlocks = [];
  pendingAlerts = [];
  pendingTerminal = null;
  pendingReasoning = null;
  currentNarration = '';
  actionSteps = [];
  completedResults = [];
  nextSteps = [];
  currentPhase = 'planning'; // planning, action, result
}

// Parse content into structured sections
function parseStructuredContent(content) {
  const sections = {
    planning: [],
    action: [],
    result: [],
  };
  
  if (!content) return sections;
  
  const lines = content.split('\n');
  let currentSection = 'planning';
  let currentItems = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    if (lowerLine.includes('## planning') || lowerLine.includes('**planning**') || lowerLine.includes('planning:')) {
      currentSection = 'planning';
      continue;
    }
    if (lowerLine.includes('## action') || lowerLine.includes('**action**') || lowerLine.includes('action:')) {
      currentSection = 'action';
      continue;
    }
    if (lowerLine.includes('## result') || lowerLine.includes('**result**') || lowerLine.includes('result:')) {
      currentSection = 'result';
      continue;
    }
    if (lowerLine.includes('## ') || lowerLine.startsWith('**')) {
      continue; // Skip other headers
    }
    
    if (line.trim()) {
      sections[currentSection].push(line.trim());
    }
  }
  
  // If no sections found, put everything in result
  if (sections.planning.length === 0 && sections.action.length === 0 && sections.result.length === 0) {
    sections.result = [content];
  }
  
  return sections;
}

// Extract steps from content
function extractStepsFromContent(content) {
  const steps = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Match numbered lists, bullets, or dashes
    const match = line.match(/^[\d\-\*\.]+\s*(.+)/);
    if (match) {
      steps.push({
        text: match[1].replace(/^[-*\d.]+\s*/, '').trim(),
        loading: false,
        icon: 'circle',
      });
    }
  }
  
  return steps;
}

// Process streaming message update
function processMessageUpdate(event) {
  if (!event.partial?.content) return;

  const textBlock = event.partial.content.find(block => block.type === 'text');
  const content = textBlock?.text || '';
  
  // Update narration (main text content)
  if (content) {
    currentNarration = content;
  }

  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];

  // Parse content into structured sections
  const structured = parseStructuredContent(content);
  
  // Update phase based on content
  if (structured.planning.length > 0 && !currentPhase) {
    currentPhase = 'planning';
  }
  
  // Build reasoning from structured content
  if (structured.planning.length > 0) {
    pendingReasoning = {
      type: 'reasoning',
      title: '📋 Planning',
      steps: structured.planning.map((text, i) => ({
        text: text,
        loading: i === structured.planning.length - 1 && currentPhase === 'planning',
        icon: i < structured.planning.length - 1 ? 'check-circle-2' : 'circle',
      })),
    };
  }
  
  if (structured.action.length > 0) {
    currentPhase = 'action';
    // Add action steps
    for (const text of structured.action) {
      if (!actionSteps.find(a => a.text === text)) {
        actionSteps.push({
          type: 'badge',
          variant: 'primary',
          icon: 'loader-2',
          text: text,
          animated: true,
        });
      }
    }
  }
  
  if (structured.result.length > 0) {
    currentPhase = 'result';
    // Add result as completed
    for (const text of structured.result) {
      if (text.length > 100 || text.includes('```')) {
        // Likely code output
        completedResults.push({
          type: 'code',
          language: 'text',
          code: text,
        });
      } else {
        completedResults.push({
          type: 'badge',
          variant: 'success',
          icon: 'check-circle-2',
          text: text,
        });
      }
    }
  }

  // Process all block types from the event
  for (const block of event.partial.content) {
    if (block.type === 'thinking') {
      // Action: Reasoning - shows thinking process
      pendingReasoning = {
        type: 'reasoning',
        title: 'Reasoning Process',
        steps: [{ text: block.thinking, loading: true, icon: 'brain' }],
      };
    } else if (block.type === 'toolCall') {
      // Action: Tool being called
      const existingAction = actionSteps.find(a => a.text.includes(block.name));
      if (!existingAction) {
        actionSteps.push({
          type: 'badge',
          variant: 'primary',
          icon: 'loader-2',
          text: `Calling ${block.name}...`,
          animated: true,
        });
      }
    } else if (block.type === 'toolResult') {
      // Result: Tool execution completed
      const toolResultText = block.content?.[0]?.text || '';
      
      // Move from action to result
      actionSteps = actionSteps.filter(a => !a.text.includes('Calling'));
      completedResults.push({
        type: 'badge',
        variant: 'success',
        icon: 'check-circle-2',
        text: `${block.name} completed`,
      });
      
      if (toolResultText.includes('\n') || toolResultText.length > 100) {
        completedResults.push({
          type: 'code',
          language: 'text',
          code: toolResultText,
        });
      }
    } else if (block.type === 'code') {
      // Result: Code generated
      completedResults.push({
        type: 'code',
        language: block.language || 'text',
        code: block.code || block.text || '',
      });
    } else if (block.type === 'error' || block.type === 'alert') {
      // Result: Error occurred
      pendingAlerts.push({
        type: 'alert',
        variant: 'error',
        title: block.title || 'Error',
        message: block.message || block.text || 'An error occurred',
      });
    } else if (block.type === 'terminal' || block.type === 'output') {
      // Result: Terminal output
      const lines = block.lines || [{ text: block.content || block.text || '', variant: 'text-base-content' }];
      completedResults.push({
        type: 'terminal',
        lines: lines,
        footer: block.footer || '',
      });
    } else if (block.type === 'nextStep') {
      // Next step: What's coming next
      nextSteps.push({
        type: 'badge',
        variant: 'info',
        icon: 'arrow-right',
        text: block.text || block.content || 'Next step',
      });
    }
  }

  // Build items in order: Action → Result → Next Step
  const items = [];
  
  // Action: Reasoning (if thinking)
  if (pendingReasoning) {
    items.push(pendingReasoning);
  }
  
  // Action: Steps in progress
  if (actionSteps.length > 0) {
    items.push(...actionSteps);
  }
  
  // Result: Completed items
  if (completedResults.length > 0) {
    items.push(...completedResults);
  }
  
  // Alerts (errors)
  if (pendingAlerts.length > 0) {
    items.push(...pendingAlerts);
  }
  
  // Next Step: What's coming
  if (nextSteps.length > 0) {
    items.push(...nextSteps);
  }

  // Check if we have a streaming message placeholder
  if (lastMessage && lastMessage.isStreaming) {
    lastMessage.content = currentNarration;
    lastMessage.items = items;
    // Use efficient streaming update
    chatMessages.updateLastMessageContent(currentNarration);
    chatMessages.updateLastMessageItems(items);
  } else {
    currentStreamingMessage = {
      type: 'response',
      content: currentNarration,
      items: items,
      isStreaming: true,
    };
    chatMessages.addMessage(currentStreamingMessage);
  }

  // Scroll to bottom
  const container = document.getElementById('chatMessagesContainer');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }

  // Update usage stats if available
  if (event.partial?.usage) {
    showUsageInPanel(event.partial.usage);
  }
}

function finalizeCurrentMessage() {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];

  if (lastMessage && lastMessage.isStreaming) {
    lastMessage.isStreaming = false;

    // Finalize items in order: Planning → Action → Result
    const finalizedItems = [];

    // Planning section: Convert reasoning from loading to complete
    if (pendingReasoning) {
      finalizedItems.push({
        type: 'reasoning',
        title: '📋 Planning',
        steps: pendingReasoning.steps.map((step, i) => ({
          ...step,
          loading: false,
          icon: step.icon === 'loader-2' ? 'check-circle-2' : (step.icon || 'check-circle-2'),
        })),
      });
    }

    // Action section: Convert tool calls from "Calling..." to completed
    for (const action of actionSteps) {
      if (action.animated && action.text.includes('Calling')) {
        finalizedItems.push({
          ...action,
          variant: 'success',
          icon: 'check-circle-2',
          animated: false,
          text: action.text.replace('Calling', 'Completed'),
        });
      } else if (action.animated) {
        finalizedItems.push({
          ...action,
          variant: 'success',
          icon: 'check-circle-2',
          animated: false,
        });
      } else {
        finalizedItems.push(action);
      }
    }

    // Result section: Add completed results
    for (const result of completedResults) {
      finalizedItems.push(result);
    }

    // Alerts: Add any errors
    for (const alert of pendingAlerts) {
      finalizedItems.push(alert);
    }

    // Next Step: Mark as ready
    for (const step of nextSteps) {
      finalizedItems.push({
        ...step,
        variant: 'info',
      });
    }

    // If no items yet, check pendingCodeBlocks and pendingTerminal
    if (finalizedItems.length === 0) {
      if (pendingCodeBlocks.length > 0) {
        finalizedItems.push(...pendingCodeBlocks);
      }
      if (pendingTerminal) {
        finalizedItems.push(pendingTerminal);
      }
    }

    lastMessage.items = finalizedItems;
    chatMessages.refresh();
  }

  resetStreamingState();
}

function finalizeAssistantMessage(message) {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.isStreaming) {
    lastMessage.isStreaming = false;
    chatMessages.refresh();
  }
}

function addToolResultMessage(message) {
  const textContent = message.content
    ?.map(block => block.type === 'text' ? block.text : '')
    .join('\n') || 'No content';

  const items = [
    {
      type: 'badge',
      variant: 'success',
      icon: 'check-circle-2',
      text: 'Tool execution completed',
    },
  ];

  // Add code block for longer output
  if (textContent.includes('\n') || textContent.length > 80) {
    items.push({
      type: 'code',
      language: 'text',
      code: textContent,
    });
  }

  // Add terminal-style output for command results
  if (textContent.startsWith('$ ') || textContent.startsWith('> ')) {
    const lines = textContent.split('\n').map(line => ({
      text: line,
      variant: line.startsWith('$ ') || line.startsWith('> ') ? 'text-success' : 'text-base-content',
    }));
    items.push({
      type: 'terminal',
      lines: lines,
      footer: 'Command executed',
    });
  }

  chatMessages.addMessage({
    type: 'response',
    content: textContent.length <= 80 && !textContent.includes('\n') ? textContent : 'Tool result:',
    assistantName: 'Tool Result',
    items: items,
  });
}

function addToolCallBadge(toolName) {
  if (!currentStreamingMessage) {
    currentStreamingMessage = {
      type: 'response',
      content: 'Processing your request...',
      items: [],
      isStreaming: true,
    };
  }

  // Add to action steps (things in progress)
  actionSteps.push({
    type: 'badge',
    variant: 'primary',
    icon: 'loader-2',
    text: `${toolName} executing`,
    animated: true,
  });

  updateMessageItems();
}

function updateMessageItems() {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage && lastMessage.isStreaming) {
    const items = [];
    
    // Action: Reasoning
    if (pendingReasoning) {
      items.push(pendingReasoning);
    }
    
    // Action: Steps in progress
    if (actionSteps.length > 0) {
      items.push(...actionSteps);
    }
    
    // Result: Completed items
    if (completedResults.length > 0) {
      items.push(...completedResults);
    }
    
    // Alerts
    if (pendingAlerts.length > 0) items.push(...pendingAlerts);
    
    // Next steps
    if (nextSteps.length > 0) items.push(...nextSteps);
    
    lastMessage.items = items;
    chatMessages.refresh();
  }
}

function addErrorMessage(error) {
  const isLongError = error.includes('\n') || error.length > 100;
  
  const items = [
    {
      type: 'alert',
      variant: 'error',
      title: 'Error',
      message: isLongError ? error.substring(0, 100) + '...' : error,
    },
  ];

  if (isLongError) {
    items.push({
      type: 'code',
      language: 'text',
      code: error,
    });
  }

  chatMessages.addMessage({
    type: 'response',
    content: 'An error occurred while processing your request.',
    items: items,
  });
}

function updateStatus(status) {
  chatInput.setEnabled(status !== 'running');
  chatInput.setRunning(status === 'running');

  // Update tasks to show status
  const currentTasks = chatInput.tasks || [];
  if (currentTasks.length > 0) {
    const lastTask = currentTasks[currentTasks.length - 1];
    if (status === 'running' && lastTask.status !== 'pending') {
      chatInput.updateTask(currentTasks.length - 1, { status: 'pending' });
    } else if (status === 'idle' && lastTask.status === 'pending') {
      chatInput.updateTask(currentTasks.length - 1, { status: 'completed' });
    }
  }
}

// Task breakdown and tracking
let taskBreakdown = [];
let currentTaskIndex = -1;

function analyzeAndBreakdownTask(message) {
  const lowerMessage = message.toLowerCase();
  const tasks = [];
  
  // Common task patterns
  if (lowerMessage.includes('calculate') || lowerMessage.includes('math') || lowerMessage.includes('compute')) {
    tasks.push({ text: 'Understand the calculation request', status: 'pending' });
    tasks.push({ text: 'Perform the calculation', status: 'pending' });
    tasks.push({ text: 'Present the result', status: 'pending' });
  } 
  else if (lowerMessage.includes('create') || lowerMessage.includes('build') || lowerMessage.includes('make') || lowerMessage.includes('generate')) {
    tasks.push({ text: 'Analyze requirements', status: 'pending' });
    tasks.push({ text: 'Plan the implementation', status: 'pending' });
    tasks.push({ text: 'Generate the code/content', status: 'pending' });
    tasks.push({ text: 'Review and present results', status: 'pending' });
  }
  else if (lowerMessage.includes('explain') || lowerMessage.includes('what is') || lowerMessage.includes('how does')) {
    tasks.push({ text: 'Understand the question', status: 'pending' });
    tasks.push({ text: 'Research/analyze the topic', status: 'pending' });
    tasks.push({ text: 'Provide explanation', status: 'pending' });
  }
  else if (lowerMessage.includes('compare') || lowerMessage.includes('difference')) {
    tasks.push({ text: 'Identify items to compare', status: 'pending' });
    tasks.push({ text: 'Analyze each item', status: 'pending' });
    tasks.push({ text: 'Present comparison', status: 'pending' });
  }
  else if (lowerMessage.includes('write') || lowerMessage.includes('code') || lowerMessage.includes('program')) {
    tasks.push({ text: 'Understand requirements', status: 'pending' });
    tasks.push({ text: 'Write the code', status: 'pending' });
    tasks.push({ text: 'Verify the solution', status: 'pending' });
  }
  else if (lowerMessage.includes('debug') || lowerMessage.includes('fix') || lowerMessage.includes('error')) {
    tasks.push({ text: 'Identify the problem', status: 'pending' });
    tasks.push({ text: 'Analyze the error', status: 'pending' });
    tasks.push({ text: 'Implement fix', status: 'pending' });
    tasks.push({ text: 'Verify the fix', status: 'pending' });
  }
  else if (lowerMessage.includes('test')) {
    tasks.push({ text: 'Identify test cases', status: 'pending' });
    tasks.push({ text: 'Run tests', status: 'pending' });
    tasks.push({ text: 'Report results', status: 'pending' });
  }
  else {
    // Default single task
    tasks.push({ text: 'Process your request', status: 'pending' });
  }
  
  return tasks;
}

function initializeTaskBreakdown(message) {
  taskBreakdown = analyzeAndBreakdownTask(message);
  
  if (taskBreakdown.length > 0) {
    // Add tasks to ChatInput
    chatInput.clearTasks();
    chatInput.addTasks(taskBreakdown);
    
    // Claim first task
    currentTaskIndex = 0;
    chatInput.claimTask(0);
    
    // Update UI with initial breakdown
    const progress = chatInput.getProgress();
    log.info('Task breakdown:', taskBreakdown.length, 'steps');
  }
  
  return taskBreakdown;
}

function claimNextTask() {
  const nextTask = chatInput.getNextPendingTask();
  if (nextTask) {
    const taskIndex = chatInput.tasks.findIndex(t => t.status === 'pending');
    if (taskIndex !== -1) {
      currentTaskIndex = taskIndex;
      chatInput.claimTask(taskIndex);
      log.info('Claimed task:', nextTask.text);
      return true;
    }
  }
  return false;
}

function completeCurrentTask() {
  if (currentTaskIndex !== -1) {
    chatInput.completeTask(currentTaskIndex);
    const progress = chatInput.getProgress();
    log.info('Task completed:', progress.completed, '/', progress.total);
    
    // Check if all tasks are done
    if (!chatInput.hasPendingTasks()) {
      log.info('All tasks completed');
    }
    
    return true;
  }
  return false;
}

function failCurrentTask(error) {
  if (currentTaskIndex !== -1) {
    chatInput.failTask(currentTaskIndex, error);
    log.error('Task failed:', error);
    return true;
  }
  return false;
}

async function sendMessage(message) {
  if (!agent) {
    agent = initAgent();
    if (!agent) return;
  }

  // Add user message
  chatMessages.addMessage({
    type: 'user',
    content: message,
  });

  // Initialize task breakdown for this message
  initializeTaskBreakdown(message);

  // Reset streaming state and create placeholder
  resetStreamingState();
  chatMessages.addMessage({
    type: 'response',
    content: 'Analyzing your request and breaking it down into steps...',
    items: [
      {
        type: 'reasoning',
        title: 'Task Breakdown',
        steps: taskBreakdown.map((t, i) => ({
          text: t.text,
          loading: i === 0,
          icon: i === 0 ? 'loader-2' : 'circle',
        })),
      },
    ],
    isStreaming: true,
  });

  try {
    abortController = new AbortController();
    await agent.prompt(message, undefined, { signal: abortController.signal });
  } catch (error) {
    if (error.message !== 'Request aborted by user') {
      log.error('Error:', error);
      addErrorMessage(error.message);
    }
  } finally {
    abortController = null;
  }
}

function abortRequest() {
  if (abortController) {
    abortController.abort();
    abortController = null;
    updateStatus('idle');
    finalizeCurrentMessage();
  }
}

function steerAgent(message) {
  if (!agent) {
    log.warn('No agent initialized');
    return;
  }

  const lowerMessage = message.toLowerCase();
  
  // Handle stop command
  if (lowerMessage === 'stop' || lowerMessage === 'abort' || lowerMessage === 'cancel') {
    abortRequest();
    chatMessages.addMessage({
      type: 'response',
      content: 'Agent stopped by user.',
      items: [
        {
          type: 'badge',
          variant: 'warning',
          icon: 'square',
          text: 'Stopped by user',
        },
      ],
    });
    return;
  }

  // Handle pause command
  if (lowerMessage === 'pause' || lowerMessage === 'wait') {
    // For now, just acknowledge
    chatMessages.addMessage({
      type: 'response',
      content: 'Agent paused. Send another message to continue.',
      items: [
        {
          type: 'badge',
          variant: 'info',
          icon: 'pause',
          text: 'Paused',
        },
      ],
    });
    return;
  }

  // Handle continue/resume
  if (lowerMessage === 'continue' || lowerMessage === 'resume' || lowerMessage === 'go on') {
    chatMessages.addMessage({
      type: 'response',
      content: 'Resuming...',
      items: [
        {
          type: 'badge',
          variant: 'success',
          icon: 'play',
          text: 'Continuing',
        },
      ],
    });
    return;
  }

  // Handle skip command
  if (lowerMessage.startsWith('skip')) {
    completeCurrentTask();
    if (chatInput.hasPendingTasks()) {
      claimNextTask();
      chatMessages.addMessage({
        type: 'response',
        content: 'Skipped current step. Moving to next task.',
        items: [
          {
            type: 'badge',
            variant: 'info',
            icon: 'skip-forward',
            text: 'Skipped',
          },
        ],
      });
    }
    return;
  }

  // Default: steer the agent with the message
  log.info('Steering agent with:', message);
  
  // Add steering message to chat
  chatMessages.addMessage({
    type: 'user',
    content: `[Steering] ${message}`,
  });

  // Reset streaming state
  resetStreamingState();
  chatMessages.addMessage({
    type: 'response',
    content: 'Processing your guidance...',
    isStreaming: true,
  });

  // Use agent's steer method
  agent.steer({
    role: 'user',
    content: message,
    timestamp: Date.now(),
  });

  // Update tasks
  if (chatInput.hasPendingTasks()) {
    claimNextTask();
  }
}

function clearChat() {
  chatMessages.clearMessages();
  chatInput.clearTasks();
  resetStreamingState();
  if (agent) {
    agent.reset();
  }
}

function resetAgent() {
  agent = null;
  abortController = null;
  clearChat();
  updateStatus('idle');
}

// API Key Management
function getApiKey() {
  return window.OPENROUTER_API_KEY || localStorage.getItem('openrouter_api_key') || '';
}

function setApiKey(key) {
  localStorage.setItem('openrouter_api_key', key);
}

function showApiKeyPrompt() {
  const apiKey = prompt('Please enter your OpenRouter API key:');
  if (apiKey) {
    setApiKey(apiKey);
    initAgent();
  }
}

// Show usage stats in right panel
function showUsageInPanel(usage) {
  if (!usage) return;

  const usageHtml = `
    <div class="p-4 space-y-3">
      <h4 class="font-medium text-base-content mb-2">Token Usage</h4>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-base-content/60">Input:</span>
          <span class="text-base-content">${usage.input.toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-base-content/60">Output:</span>
          <span class="text-base-content">${usage.output.toLocaleString()}</span>
        </div>
        <div class="flex justify-between font-medium">
          <span class="text-base-content">Total:</span>
          <span class="text-base-content">${usage.totalTokens.toLocaleString()}</span>
        </div>
      </div>
    </div>
  `;

  rightPanel.element.querySelector('.flex-1')?.insertAdjacentHTML('beforeend', usageHtml);
}

// Load models
async function loadModels() {
  try {
    allModels = await getModels();
    log.info('Loaded', allModels.length, 'models');

    if (allModels.length > 0) {
      // Set default model
      const freeModel = allModels.find(m => m.id.includes(':free'));
      if (freeModel) {
        currentModelId = freeModel.id;
      } else {
        currentModelId = allModels[0].id;
      }
    }
  } catch (error) {
    log.error('Failed to load models:', error);
  }
}

// Initialize
loadModels();

// Export for external access
export default {
  chatMessages,
  sidebar,
  rightPanel,
  chatInput,
  settingsModal,
  sendMessage,
  abortRequest,
  clearChat,
  resetAgent,
  loadModels,
};
