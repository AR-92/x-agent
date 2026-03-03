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
let systemPrompt = 'You are a helpful AI assistant. Be concise but thorough. When asked to perform calculations or use tools, show your work clearly.';
let thinkingLevel = 'medium';

// Current message being built
let currentStreamingMessage = null;
let pendingBadges = [];
let pendingCodeBlocks = [];
let pendingAlerts = [];
let pendingTerminal = null;
let pendingReasoning = null;

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
    log.debug('Resized to:', width);
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
      break;

    case 'message_update':
      if (event.assistantMessageEvent) {
        processMessageUpdate(event.assistantMessageEvent);
      }
      break;

    case 'message_end':
      if (event.message.role === 'assistant') {
        finalizeAssistantMessage(event.message);
      } else if (event.message.role === 'toolResult') {
        addToolResultMessage(event.message);
      }
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
      break;

    case 'tool_execution_end':
      log.info('Tool execution ended:', event.toolName, 'isError:', event.isError);
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
}

// Process streaming message update
function processMessageUpdate(event) {
  if (!event.partial?.content) return;

  // Get the latest text content
  const textBlock = event.partial.content.find(block => block.type === 'text');
  if (!textBlock) return;

  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];

  // Check if we have a streaming message placeholder
  if (lastMessage && lastMessage.isStreaming) {
    // Update existing streaming message
    lastMessage.content = textBlock.text;
    
    // Process other block types
    for (const block of event.partial.content) {
      if (block.type === 'thinking') {
        pendingReasoning = {
          type: 'reasoning',
          title: 'Thinking Process',
          steps: [{ text: block.thinking, loading: true }],
        };
      } else if (block.type === 'toolCall') {
        pendingBadges.push({
          type: 'badge',
          variant: 'primary',
          icon: 'loader-2',
          text: `Calling ${block.name}...`,
          animated: true,
        });
      }
    }

    // Update items
    const items = [];
    if (pendingBadges.length > 0) items.push(...pendingBadges);
    if (pendingCodeBlocks.length > 0) items.push(...pendingCodeBlocks);
    if (pendingAlerts.length > 0) items.push(...pendingAlerts);
    if (pendingTerminal) items.push(pendingTerminal);
    if (pendingReasoning) items.push(pendingReasoning);
    
    lastMessage.items = items;
    chatMessages.refresh();
  } else {
    // Create new streaming message
    currentStreamingMessage = {
      type: 'response',
      content: textBlock.text,
      items: [],
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

    // Convert pending reasoning from loading to complete
    if (pendingReasoning) {
      pendingReasoning.steps = pendingReasoning.steps.map(step => ({
        ...step,
        loading: false,
        icon: step.icon || 'check-circle-2',
      }));
      lastMessage.items = lastMessage.items.map(item => {
        if (item.type === 'reasoning') {
          return pendingReasoning;
        }
        return item;
      });
    }

    // Convert tool call badges to completed
    lastMessage.items = lastMessage.items.map(item => {
      if (item.type === 'badge' && item.animated && item.text.includes('Calling')) {
        return {
          ...item,
          variant: 'success',
          icon: 'check-circle-2',
          animated: false,
          text: item.text.replace('Calling', 'Completed'),
        };
      }
      return item;
    });

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
  const content = message.content
    ?.map(block => block.type === 'text' ? block.text : '')
    .join('\n') || 'No content';

  chatMessages.addMessage({
    type: 'response',
    content: content,
    assistantName: 'Tool Result',
    items: [
      {
        type: 'badge',
        variant: 'success',
        icon: 'check-circle-2',
        text: 'Tool execution completed',
      },
    ],
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

  pendingBadges.push({
    type: 'badge',
    variant: 'primary',
    icon: 'loader-2',
    text: `${toolName} executing`,
    animated: true,
  });

  updateMessageItems();
}

function addErrorMessage(error) {
  chatMessages.addMessage({
    type: 'response',
    content: 'An error occurred while processing your request.',
    items: [
      {
        type: 'alert',
        variant: 'error',
        title: 'Error',
        message: error,
      },
    ],
  });
}

function updateStatus(status) {
  chatInput.setEnabled(status !== 'running');

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

  // Reset streaming state and create placeholder
  resetStreamingState();
  chatMessages.addMessage({
    type: 'response',
    content: '...',
    isStreaming: true,
  });

  // Add task
  const taskText = message.substring(0, 50) + (message.length > 50 ? '...' : '');
  chatInput.addTask(taskText, 'pending');

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
