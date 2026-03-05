/**
 * Main App - Full Agent Integration with OpenRouter
 * Combines the modern UI with full agent functionality
 * Uses all ChatMessages UI features: badges, code, alerts, terminal, reasoning
 *
 * x-agent style agent UI features:
 * - Streaming thinking process (expandable reasoning)
 * - Task cards with execution steps
 * - Progress timeline at bottom
 * - Workspace file browser
 * - Live event indicators
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
let systemPrompt = `You are a highly capable, helpful, and professional AI assistant with access to powerful tools. Your goal is to assist users effectively by ALWAYS using available tools when they can help accomplish a task.

## CRITICAL: Tool Usage Policy

### 1. Tools First Approach
- **ALWAYS use tools** when they are available and relevant to the task
- Do NOT ask for permission before using tools
- Do NOT explain that you're going to use a tool - just use it
- If a tool can help with ANY part of the task, use it immediately
- Only respond with text when NO tool is applicable

### 2. When No Tool is Available
- If NO tool exists for the requested task, apologize clearly
- Explain that you don't have the capability to perform that specific action
- Suggest what you CAN do instead with available tools
- Example: "I apologize, but I don't have a tool available to [requested action]. However, I can help you with [alternative actions using available tools]."

### 3. Tool Execution Transparency
- Show what you're doing as you do it (stream thinking)
- Break complex tasks into clear steps
- Mention files you're creating or modifying
- Share decisions and reasoning for important choices

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

**Example:** "Task Complete! I've built the landing page with:
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
- **Tool-focused** - always look for ways to use tools

## Example Response Structure

1. **Acknowledgment**: "Understood! I'll help you with [task]."
2. **Plan**: "Here's what I'll do: [brief outline]"
3. **Execution**: [Use tools immediately - don't wait]
4. **Summary**: "Task Complete! Here's what I created: [list]"
5. **Follow-up**: "Would you like me to [suggestion]?"

## Remember

- ALWAYS use tools when available - this is your primary way of helping
- If no tool exists for a task, apologize and explain the limitation
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

// Narration → Action → Result flow
let currentNarration = '';
let actionSteps = [];
let completedResults = [];
let currentPhase = 'planning';

// Track current tool execution for right panel
let currentToolExecution = null;
let currentUsage = null;

// Session-wide task state (persists across entire conversation)
let sessionTasks = [];           // All tasks for the session
let currentSessionTaskId = null; // Current active task ID

// Task management tool for agent
const taskManagerTool = {
  name: 'task_manager',
  label: 'Task Manager',
  description: 'Manage tasks for the current session. Add, update, claim, and complete tasks.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'claim', 'complete', 'list'],
        description: 'Action to perform: add new task, update existing, claim as active, complete, or list all',
      },
      taskId: {
        type: 'string',
        description: 'Task ID for update/claim/complete actions',
      },
      text: {
        type: 'string',
        description: 'Task description for add action',
      },
      status: {
        type: 'string',
        enum: ['pending', 'active', 'completed', 'failed'],
        description: 'New status for update action',
      },
    },
    required: ['action'],
  },
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { action, taskId, text, status } = params;
    
    onUpdate?.({
      content: [{ type: 'text', text: `Task Manager: ${action}...` }],
      details: { action, taskId, text, status },
    });

    try {
      let result;
      
      switch (action) {
        case 'add':
          if (!text) throw new Error('text is required for add action');
          const newTask = {
            id: 'task_' + Date.now(),
            text,
            status: 'pending',
            timestamp: new Date().toISOString(),
          };
          sessionTasks.push(newTask);
          result = { success: true, task: newTask, message: `Added task: ${text}` };
          break;
          
        case 'update':
          if (!taskId) throw new Error('taskId is required for update action');
          const taskIndex = sessionTasks.findIndex(t => t.id === taskId);
          if (taskIndex === -1) throw new Error(`Task ${taskId} not found`);
          if (status) sessionTasks[taskIndex].status = status;
          result = { success: true, task: sessionTasks[taskIndex], message: `Updated task ${taskId}` };
          break;
          
        case 'claim':
          if (!taskId) throw new Error('taskId is required for claim action');
          // Mark all other tasks as pending, this one as active
          sessionTasks.forEach(t => {
            t.status = t.id === taskId ? 'active' : (t.status === 'active' ? 'pending' : t.status);
          });
          currentSessionTaskId = taskId;
          result = { success: true, task: sessionTasks.find(t => t.id === taskId), message: `Claimed task ${taskId}` };
          break;
          
        case 'complete':
          if (!taskId) throw new Error('taskId is required for complete action');
          const completeIndex = sessionTasks.findIndex(t => t.id === taskId);
          if (completeIndex === -1) throw new Error(`Task ${taskId} not found`);
          sessionTasks[completeIndex].status = 'completed';
          if (currentSessionTaskId === taskId) currentSessionTaskId = null;
          result = { success: true, task: sessionTasks[completeIndex], message: `Completed task ${taskId}` };
          break;
          
        case 'list':
          result = { success: true, tasks: sessionTasks, message: `Found ${sessionTasks.length} tasks` };
          break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      // Update UI
      updateSessionTasks();
      
      return {
        content: [{ type: 'text', text: result.message }],
        details: result,
      };
    } catch (error) {
      throw new Error(`Task Manager error: ${error.message}`);
    }
  },
};

// Update session tasks in UI
function updateSessionTasks() {
  // Update ChatInput with session tasks
  const completedCount = sessionTasks.filter(t => t.status === 'completed').length;
  const activeTask = sessionTasks.find(t => t.status === 'active');
  
  // Map session tasks to ChatInput format
  const chatInputTasks = sessionTasks.map(t => ({
    text: t.text,
    status: t.status === 'active' ? 'active' : t.status === 'completed' ? 'completed' : t.status === 'failed' ? 'failed' : 'pending',
  }));
  
  chatInput.setTasks(chatInputTasks);
}

// Add a task to session
function addSessionTask(text, status = 'pending') {
  const task = {
    id: 'task_' + Date.now(),
    text,
    status,
    timestamp: new Date().toISOString(),
  };
  sessionTasks.push(task);
  updateSessionTasks();
  return task.id;
}

// Update a session task
function updateSessionTask(taskId, updates) {
  const task = sessionTasks.find(t => t.id === taskId);
  if (task) {
    Object.assign(task, updates);
    updateSessionTasks();
  }
}

// Claim a session task (mark as active)
function claimSessionTask(taskId) {
  sessionTasks.forEach(t => {
    t.status = t.id === taskId ? 'active' : (t.status === 'active' ? 'pending' : t.status);
  });
  currentSessionTaskId = taskId;
  updateSessionTasks();
}

// Complete a session task
function completeSessionTask(taskId) {
  const task = sessionTasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'completed';
    if (currentSessionTaskId === taskId) currentSessionTaskId = null;
    updateSessionTasks();
  }
}

// Fail a session task
function failSessionTask(taskId, error = null) {
  const task = sessionTasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'failed';
    if (error) task.error = error;
    updateSessionTasks();
  }
}

// Clear all session tasks
function clearSessionTasks() {
  sessionTasks = [];
  currentSessionTaskId = null;
  updateSessionTasks();
}

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
  assistantName: 'x-agent',
  logoIcon: 'hexagon',
  messages: [],
  onMessageClick: (message, index) => {
    log.info('Message clicked:', index);
    rightPanel.showMessage(message);
  },
  onTaskClick: (task, message, messageIndex) => {
    log.info('Task clicked:', task);
    log.info('Message:', message);
    log.info('Message index:', messageIndex);
    // Show the full message content in the right panel when task is clicked
    if (message) {
      rightPanel.showMessage(message);
    } else {
      log.warn('No message found for task click');
    }
  },
});

// Expose chatMessages instance on window for task click handler
window.chatMessagesInstance = chatMessages;

// Global function to close side panel
window.closeSidePanel = function() {
  rightPanel.close();
};

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
  minWidth: 280,
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
  onItemClick: (item) => {
    log.info('Item clicked in panel:', item);
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
      tools: [calculatorTool, currentTimeTool, taskManagerTool],
    },
    streamFn: async (model, context, options) => {
      log.info('OpenRouter stream called with model:', currentModelId);

      return openRouterStream({
        ...options,
        apiKey: apiKey,
        modelId: currentModelId,
        siteUrl: window.location.origin,
        siteName: 'X-Agent Lite',
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

    case 'message_start':
      if (event.message?.role === 'assistant') {
        const messages = chatMessages.options.messages;
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || !lastMessage.isStreaming) {
          chatMessages.addMessage({
            type: 'response',
            content: '',
            items: [],
            tasks: [],
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

    case 'tool_execution_start':
      log.info('Tool execution started:', event.toolName);
      currentToolExecution = {
        name: event.toolName,
        args: event.args,
        status: 'running'
      };
      rightPanel.showToolExecution(event.toolName, event.args, null, false);

      // Add task for this tool execution
      addMessageTask({
        id: 'tool_' + Date.now(),
        title: `Running ${event.toolName}`,
        status: 'in_progress',
        icon: 'loader-2',
        steps: [{
          text: `Executing ${event.toolName}...`,
          status: 'in_progress',
          icon: 'loader-2',
          timestamp: new Date().toLocaleTimeString(),
        }]
      });
      break;

    case 'tool_execution_end':
      log.info('Tool execution ended:', event.toolName, 'isError:', event.isError);

      // Update right panel with tool result
      if (currentToolExecution) {
        currentToolExecution.status = event.isError ? 'error' : 'completed';
        currentToolExecution.result = event.result;
        rightPanel.showToolExecution(event.toolName, currentToolExecution.args, event.result, event.isError);
        currentToolExecution = null;
      }

      // Update the task step
      updateLastTaskStep({
        text: `${event.toolName} ${event.isError ? 'failed' : 'completed'}`,
        status: event.isError ? 'error' : 'completed',
        icon: event.isError ? 'x-circle' : 'check-circle-2',
      });

      if (event.result) {
        const resultText = typeof event.result === 'string' ? event.result : JSON.stringify(event.result, null, 2);
        
        // Add result to workspace if it's significant
        if (resultText.length > 50) {
          // Could be file content or output
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

      // Mark last task as failed
      updateLastTaskStep({
        text: 'Task failed',
        status: 'error',
        icon: 'x-circle',
      });
      break;
  }
}

// ========== Message Task Functions ==========

// Add a task to the current message
function addMessageTask(task) {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage && lastMessage.isStreaming) {
    if (!lastMessage.tasks) {
      lastMessage.tasks = [];
    }
    lastMessage.tasks.push(task);
    currentMessageTaskId = task.id;
    chatMessages.upsertTask(task);
  }
}

// Update the last step of the last task
function updateLastTaskStep(updates) {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage && lastMessage.tasks && lastMessage.tasks.length > 0) {
    const lastTask = lastMessage.tasks[lastMessage.tasks.length - 1];
    if (lastTask.steps && lastTask.steps.length > 0) {
      const lastStep = lastTask.steps[lastTask.steps.length - 1];
      Object.assign(lastStep, updates);
      lastStep.timestamp = new Date().toLocaleTimeString();
      
      // Update task status based on step
      if (updates.status === 'completed') {
        lastTask.status = 'completed';
        lastTask.icon = 'check-circle';
      } else if (updates.status === 'error') {
        lastTask.status = 'error';
        lastTask.icon = 'x-circle';
      }
      
      chatMessages.upsertTask(lastTask);
    }
  }
}

// Complete all tasks in the last message
function finalizeMessageTasks() {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage && lastMessage.tasks) {
    lastMessage.tasks.forEach(task => {
      if (task.status === 'in_progress') {
        task.status = 'completed';
        task.icon = 'check-circle';
        if (task.steps) {
          task.steps.forEach(step => {
            if (step.status === 'in_progress') {
              step.status = 'completed';
              step.icon = 'check-circle-2';
            }
          });
        }
      }
    });
    chatMessages.refresh();
  }
}

// Reset streaming state for new message
function resetStreamingState() {
  currentStreamingMessage = null;
  pendingBadges = [];
  pendingCodeBlocks = [];
  pendingTerminal = null;
  pendingReasoning = null;
  currentNarration = '';
  actionSteps = [];
  completedResults = [];
  pendingAlerts = [];
  currentPhase = 'planning';
  currentToolExecution = null;
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

  // Process all block types from the event
  for (const block of event.partial.content) {
    if (block.type === 'thinking') {
      // Streaming thinking process
      if (block.thinking?.trim().length > 0) {
        // Add/update reasoning in the UI
        pendingReasoning = {
          type: 'reasoning',
          title: '🤔 Thinking Process',
          steps: [{
            text: block.thinking,
            loading: true,
            icon: 'brain',
          }],
        };
        updateMessageItems();
      }
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
        updateMessageItems();
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

      updateMessageItems();
    }
  }

  // Update chat messages with current content
  if (lastMessage && lastMessage.isStreaming) {
    chatMessages.updateLastMessageContent(currentNarration);
  }
}

// Update message items helper
function updateMessageItems() {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];

  if (lastMessage && lastMessage.isStreaming) {
    const items = [];

    // Add reasoning if exists
    if (pendingReasoning) {
      items.push(pendingReasoning);
    }

    // Add action badges
    if (actionSteps.length > 0) {
      items.push(...actionSteps);
    }

    // Add completed results
    if (completedResults.length > 0) {
      items.push(...completedResults);
    }

    // Add alerts
    if (pendingAlerts.length > 0) {
      items.push(...pendingAlerts);
    }

    lastMessage.items = items;
    chatMessages.updateLastMessageItems(items);
  }
}

function finalizeCurrentMessage() {
  const messages = chatMessages.options.messages;
  const lastMessage = messages[messages.length - 1];

  if (lastMessage && lastMessage.isStreaming) {
    lastMessage.isStreaming = false;
    
    // Finalize all tasks
    finalizeMessageTasks();

    // Finalize items in order: Planning → Action → Result
    const finalizedItems = [];

    // Planning section: Convert reasoning from loading to complete
    if (pendingReasoning) {
      finalizedItems.push({
        type: 'reasoning',
        title: 'Planning',
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

  // Clear right panel for new message
  rightPanel.clear();
  currentUsage = null;

  // Show timeline container for x-agent style UI
  const timelineContainer = document.getElementById('timelineContainer');
  if (timelineContainer) {
    timelineContainer.classList.remove('hidden');
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
