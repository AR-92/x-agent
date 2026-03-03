/**
 * Main App - Full Agent Integration with OpenRouter
 * Combines the modern UI with full agent functionality
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
    // Re-initialize agent with new API key
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
      break;

    case 'agent_end':
      log.info('Agent completed');
      updateStatus('idle');
      break;

    case 'message_update':
      if (event.assistantMessageEvent) {
        updateAssistantMessage(event.assistantMessageEvent);
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
        // Could show usage in right panel
      }
      if (event.message?.content?.length === 0) {
        log.warn('Empty response from model');
        addErrorMessage('Model returned empty response. Try a different model.');
        updateStatus('error');
      }
      break;

    case 'tool_execution_start':
      log.info('Tool execution started:', event.toolName);
      addToolCallMessage(event.toolName, event.args);
      break;

    case 'tool_execution_end':
      log.info('Tool execution ended:', event.toolName);
      break;

    case 'error':
      updateStatus('error');
      const errorMsg = event.error?.errorMessage || event.error?.message || 'An error occurred';
      log.error('Agent error:', event.error);
      addErrorMessage(errorMsg);
      break;
  }
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

function updateAssistantMessage(event) {
  // For now, we'll use a simple approach
  // In a full implementation, you'd parse the streaming JSON and update the ChatMessages component
  if (event.partial?.content) {
    const textContent = event.partial.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    if (textContent) {
      // Update or add message
      const lastMessage = chatMessages.options.messages[chatMessages.options.messages.length - 1];
      if (lastMessage && lastMessage.type === 'response' && lastMessage.isStreaming) {
        lastMessage.content = textContent;
        chatMessages.refresh();
      }
    }
  }
}

function finalizeAssistantMessage(message) {
  const lastMessage = chatMessages.options.messages[chatMessages.options.messages.length - 1];
  if (lastMessage) {
    lastMessage.isStreaming = false;
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
  });
}

function addToolCallMessage(toolName, args) {
  chatMessages.addMessage({
    type: 'response',
    content: `Calling ${toolName}...`,
    items: [
      {
        type: 'badge',
        variant: 'info',
        icon: 'loader-2',
        text: `${toolName} executing`,
        animated: true,
      },
    ],
  });
}

function addErrorMessage(error) {
  chatMessages.addMessage({
    type: 'response',
    content: error,
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

  // Add streaming placeholder
  chatMessages.addMessage({
    type: 'response',
    content: '',
    isStreaming: true,
  });

  // Add task
  chatInput.addTask(message.substring(0, 50) + (message.length > 50 ? '...' : ''), 'pending');

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
  }
}

function clearChat() {
  chatMessages.clearMessages();
  chatInput.clearTasks();
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
