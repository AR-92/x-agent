/**
 * ChatMessages Component
 * A theme-aware component for displaying AI conversation responses.
 * Supports various content types: text, badges, code blocks, alerts, terminal, reasoning.
 * Enhanced with Manus agent-style task cards and progress tracking.
 * 
 * Usage:
 *   import { ChatMessages } from './components/ChatMessages.js';
 *   
 *   const chatMessages = new ChatMessages({
 *     container: document.getElementById('messagesContainer'),
 *     messages: [
 *       {
 *         type: 'response',
 *         content: 'I\'ve analyzed your request...',
 *         items: [
 *           { type: 'badge', variant: 'success', icon: 'check', text: 'Analyzing...' },
 *           { type: 'badge', variant: 'primary', icon: 'loader-2', text: 'Processing...', animated: true },
 *         ],
 *         tasks: [
 *           { id: 'task1', title: 'Initialize web project', status: 'completed', icon: 'check-circle' },
 *           { id: 'task2', title: 'Create design document', status: 'in_progress', icon: 'loader-2', steps: [
 *             { text: 'Creating file: project/src/App.tsx', status: 'completed' },
 *             { text: 'Updating styles', status: 'in_progress' }
 *           ]},
 *         ],
 *       },
 *       {
 *         type: 'response',
 *         content: 'Here\'s the code...',
 *         items: [
 *           { type: 'code', language: 'javascript', code: '...' },
 *         ],
 *       },
 *     ],
 *   });
 *   
 *   // Add new message
 *   chatMessages.addMessage({ type: 'response', content: 'New message...' });
 *   
 *   // Update task progress in real-time
 *   chatMessages.updateTask('task2', { status: 'completed', steps: [...] });
 */

export class ChatMessages {
  constructor(options = {}) {
    this.options = {
      container: null,
      messages: [],
      logoIcon: 'hexagon',
      logoAlt: 'Logo',
      assistantName: 'Accelerator',
      onItemAction: null,
      ...options,
    };

    this.element = null;
    
    this.render();
  }

  render() {
    const container = document.createElement('div');
    container.className = 'max-w-[820px] mx-auto px-3 py-3 space-y-4 ';
    
    container.innerHTML = this.options.messages.map((message, index) => this.renderMessage(message, index)).join('');
    
    this.options.container.appendChild(container);
    this.element = container;
    
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderMessage(message, index) {
    if (message.type === 'response') {
      const renderedContent = this.renderMarkdown(message.content);
      return `
        <div data-message-index="${index}" class="response-item">
          <div class="flex items-center gap-2 mb-2">
            ${this.renderLogo()}
            <span class="text-xs font-medium text-base-content">${message.assistantName || this.options.assistantName}</span>
          </div>
          <div class="ps-10 flex flex-col gap-2">
            <div class="text-xs leading-relaxed text-base-content markdown-content">${renderedContent}</div>
            ${message.items ? this.renderItems(message.items) : ''}
            ${message.tasks ? this.renderTasks(message.tasks) : ''}
          </div>
        </div>
      `;
    }
    
    if (message.type === 'user') {
      return `
        <div data-message-index="${index}" class="response-item">
          <div class="flex items-center justify-end gap-2 mb-2">
            <span class="text-xs font-medium text-base-content">You</span>
            <div class="w-6 h-6 rounded-box flex items-center justify-center bg-primary/20">
              <i data-lucide="user" class="w-3.5 h-3.5 text-primary"></i>
            </div>
          </div>
          <div class="pr-10">
            <div class="bg-primary text-primary-content rounded-box px-2.5 py-1.5 max-w-[80%] ml-auto">
              <p class="text-xs leading-relaxed">${this.escapeHtml(message.content)}</p>
            </div>
          </div>
        </div>
      `;
    }
    
    return '';
  }

  renderMarkdown(content) {
    if (!content) return '';
    
    // Check if marked library is available
    if (typeof window.marked !== 'undefined' && window.marked.parse) {
      try {
        // Configure marked for safe rendering
        window.marked.setOptions({
          breaks: true,
          gfm: true,
        });
        const rendered = window.marked.parse(content);
        return rendered;
      } catch (e) {
        console.warn('Markdown parsing error:', e);
        return this.escapeHtml(content);
      }
    }
    
    // Fallback: escape HTML
    return this.escapeHtml(content);
  }

  // Render markdown for streaming - handles incomplete markdown safely
  renderStreamingMarkdown(content) {
    if (!content) return '';
    
    // For streaming, we try to render markdown but handle errors gracefully
    if (typeof window.marked !== 'undefined' && window.marked.parse) {
      try {
        window.marked.setOptions({
          breaks: true,
          gfm: true,
          async: false,
        });
        return window.marked.parse(content);
      } catch (e) {
        // During streaming, incomplete markdown might cause errors
        // Return escaped text as fallback
        return this.escapeHtml(content);
      }
    }
    
    return this.escapeHtml(content);
  }

  renderLogo() {
    if (this.options.logoIcon) {
      return `
        <div class="logo-container">
          <div class="w-6 h-6 rounded-box flex items-center justify-center bg-base-200">
            <i data-lucide="${this.options.logoIcon}" class="w-4 h-4"></i>
          </div>
        </div>
      `;
    }

    return '';
  }

  renderItems(items) {
    if (!items || items.length === 0) return '';
    
    const badges = items.filter(item => item.type === 'badge' && item.text);
    const codeBlocks = items.filter(item => item.type === 'code');
    const alerts = items.filter(item => item.type === 'alert');
    const terminal = items.find(item => item.type === 'terminal');
    const reasoning = items.find(item => item.type === 'reasoning');
    
    let html = '';
    
    // Only render badges that have valid text
    if (badges.length > 0) {
      html += `<div class="flex flex-wrap gap-1.5 w-fit">`;
      html += badges.map(badge => this.renderBadge(badge)).join('');
      html += `</div>`;
    }
    
    // Render code blocks (deduped by content)
    if (codeBlocks.length > 0) {
      const seen = new Set();
      codeBlocks.forEach(code => {
        const key = code.code?.substring(0, 50);
        if (!seen.has(key)) {
          seen.add(key);
          html += this.renderCodeBlock(code);
        }
      });
    }
    
    // Render alerts
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        html += this.renderAlert(alert);
      });
    }
    
    // Render terminal
    if (terminal) {
      html += this.renderTerminal(terminal);
    }
    
    // Render reasoning (only if it has steps)
    if (reasoning && reasoning.steps && reasoning.steps.length > 0) {
      html += this.renderReasoning(reasoning);
    }
    
    return html;
  }

  renderBadge(badge) {
    const variants = {
      success: 'badge-success',
      primary: 'badge-primary',
      info: 'badge-info',
      warning: 'badge-warning',
      error: 'badge-error',
    };
    
    const icons = {
      check: 'check',
      'check-circle-2': 'check-circle-2',
      'loader-2': 'loader-2',
      'file-code': 'file-code',
      'file-type': 'file-type',
      'package-plus': 'package-plus',
      brain: 'brain',
    };
    
    const variantClass = variants[badge.variant] || 'badge-primary';
    const iconName = icons[badge.icon] || 'circle';
    const animated = badge.animated ? 'animate-spin' : badge.pulse ? 'animate-pulse' : '';
    
    return `
      <div class="badge ${variantClass} gap-1 rounded-btn text-[10px] py-0.5">
        <i data-lucide="${iconName}" class="w-2.5 h-2.5 ${animated}"></i>
        ${badge.text}
      </div>
    `;
  }

  renderCodeBlock(code) {
    const { language = '', code: content = '', title = '' } = code;
    
    return `
      <div class="mockup-code bg-base-200 text-xs rounded-box">
        <pre class="px-2 overflow-x-auto"><code>${this.escapeHtml(content)}</code></pre>
      </div>
    `;
  }

  renderTerminal(terminal) {
    const { lines = [], footer = '' } = terminal;
    
    return `
      <div class="mockup-terminal bg-base-200 rounded-box p-2 font-mono text-[10px] text-base-content">
        ${lines.map(line => `<p class="${line.variant || ''}">${this.escapeHtml(line.text)}</p>`).join('')}
        ${footer ? `<p class="text-base-content/40 mt-1">${this.escapeHtml(footer)}</p>` : ''}
      </div>
    `;
  }

  renderReasoning(reasoning) {
    const { title = 'Reasoning Process', steps = [] } = reasoning;

    return `
      <div class="bg-base-200 rounded-box p-2 text-xs text-base-content">
        <p class="font-medium mb-1 flex items-center gap-1.5">
          <i data-lucide="brain" class="w-3 h-3"></i>
          ${title}
        </p>
        <ul class="space-y-1">
          ${steps.map(step => `
            <li class="flex items-center gap-1.5">
              ${step.loading
                ? '<span class="loading loading-spinner loading-xs text-primary"></span>'
                : `<i data-lucide="${step.icon || 'check-circle-2'}" class="w-3 h-3 ${step.variant || 'text-success'}"></i>`
              }
              ${step.text}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // Render Manus-style task cards
  renderTasks(tasks) {
    if (!tasks || tasks.length === 0) return '';
    
    const taskIconMap = {
      'check-circle': 'check-circle',
      'check': 'check-circle',
      'loader-2': 'loader-2',
      'circle': 'circle',
      'file-code': 'file-code',
      'file-type': 'file-text',
      'globe': 'globe',
      'image': 'image',
      'sparkles': 'sparkles',
      'terminal': 'terminal',
      'package-plus': 'package-plus',
      'brain': 'brain',
    };
    
    return `
      <div class="flex flex-col gap-2 mt-2 w-full">
        ${tasks.map((task, taskIndex) => {
          const iconName = taskIconMap[task.icon] || 'circle';
          const isExpanded = task.expanded !== false;
          const statusColors = {
            'completed': 'text-success',
            'in_progress': 'text-primary',
            'pending': 'text-base-content/50',
            'error': 'text-error',
          };
          const statusBg = {
            'completed': 'bg-success/10',
            'in_progress': 'bg-primary/10',
            'pending': 'bg-base-300',
            'error': 'bg-error/10',
          };
          const statusColor = statusColors[task.status] || 'text-base-content';
          const bgColor = statusBg[task.status] || 'bg-base-300';
          
          return `
            <div class="task-card w-full" data-task-id="${task.id || taskIndex}">
              <div class="text-sm w-full clickable flex gap-2 justify-between group/header truncate text-base-content ${isExpanded ? '' : ''}" data-task-header>
                <div class="flex flex-row gap-2 justify-center items-center truncate">
                  <div class="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full ${task.status === 'completed' ? 'bg-success text-success-content' : task.status === 'in_progress' ? 'bg-primary text-primary-content' : 'bg-base-300'}">
                    ${task.status === 'completed' 
                      ? '<i data-lucide="check" class="w-2.5 h-2.5"></i>'
                      : task.status === 'in_progress'
                        ? '<i data-lucide="loader-2" class="w-2.5 h-2.5 animate-spin"></i>'
                        : '<i data-lucide="circle" class="w-2 h-2"></i>'
                    }
                  </div>
                  <div class="truncate font-medium" title="${task.title}">${task.title}</div>
                  ${task.badge ? `<span class="flex-shrink-0 flex text-[10px] px-1.5 py-0.5 rounded-[6px] border border-base-300 ${bgColor} ${statusColor}">${task.badge}</span>` : ''}
                  <span class="flex-shrink-0 flex">
                    <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}"></i>
                  </span>
                </div>
                <div class="float-right transition text-[12px] text-base-content/50 invisible group-hover/header:visible">
                  ${task.timestamp || ''}
                </div>
              </div>
              <div class="flex">
                <div class="w-[24px] relative"></div>
                <div class="flex flex-col gap-2 flex-1 min-w-0 overflow-hidden pt-2 transition-[max-height,opacity] duration-150 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}" data-task-content>
                  ${task.description ? `<p class="text-base-content/70 text-[14px]">${task.description}</p>` : ''}
                  ${task.steps && task.steps.length > 0 ? `
                    <div class="flex flex-col gap-2 w-full">
                      ${task.steps.map((step, stepIndex) => {
                        const stepIcon = step.status === 'completed' ? 'check-circle' : step.status === 'in_progress' ? 'loader-2' : 'circle';
                        const stepVariant = step.status === 'completed' ? 'text-success' : step.status === 'in_progress' ? 'text-primary' : step.status === 'error' ? 'text-error' : 'text-base-content/50';
                        const stepAnimated = step.status === 'in_progress' ? 'animate-spin' : '';
                        
                        return `
                          <div class="flex items-center group gap-2 w-full" data-step="${stepIndex}">
                            <div class="flex-1 min-w-0 h-[28px]">
                              <div class="rounded-[15px] px-[10px] py-[3px] border border-base-300 bg-base-200 inline-flex max-w-full gap-[4px] items-center relative h-full overflow-hidden hover:bg-base-300/50 ${step.status === 'in_progress' ? 'border-primary/30' : ''}" data-step-content>
                                <div class="w-[21px] inline-flex items-center flex-shrink-0 text-base-content">
                                  <i data-lucide="${step.icon || stepIcon}" class="w-4 h-4 ${stepVariant} ${stepAnimated}"></i>
                                </div>
                                <div class="text-[13px] text-base-content/80 max-w-full truncate" title="${step.text}">${step.text}</div>
                              </div>
                            </div>
                            <div class="float-right transition text-[12px] text-base-content/50 invisible group-hover:visible">
                              ${step.timestamp || ''}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : ''}
                  ${task.files && task.files.length > 0 ? `
                    <div class="flex flex-col gap-1 mt-2">
                      ${task.files.map(file => `
                        <div class="flex items-center gap-2 text-xs text-base-content/70">
                          <i data-lucide="file-text" class="w-3 h-3"></i>
                          <span>${file}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <script>
        document.querySelectorAll('.task-card [data-task-header]').forEach(header => {
          header.addEventListener('click', function() {
            const card = this.closest('.task-card');
            const content = card.querySelector('[data-task-content]');
            const chevron = this.querySelector('[data-lucide="chevron-down"]');
            
            if (content.classList.contains('max-h-0')) {
              content.classList.remove('max-h-0', 'opacity-0');
              content.classList.add('max-h-[5000px]', 'opacity-100');
              if (chevron) chevron.classList.add('rotate-180');
            } else {
              content.classList.remove('max-h-[5000px]', 'opacity-100');
              content.classList.add('max-h-0', 'opacity-0');
              if (chevron) chevron.classList.remove('rotate-180');
            }
          });
        });
      </script>
    `;
  }

  // Update a specific task by ID
  updateTask(taskId, updates) {
    const messages = this.options.messages;
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.tasks) {
        const taskIndex = message.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          message.tasks[taskIndex] = { ...message.tasks[taskIndex], ...updates };
          this.refresh();
          return;
        }
      }
    }
  }

  // Add a new step to a task
  addTaskStep(taskId, step) {
    const messages = this.options.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.tasks) {
        const task = message.tasks.find(t => t.id === taskId);
        if (task) {
          if (!task.steps) task.steps = [];
          task.steps.push(step);
          this.refresh();
          return;
        }
      }
    }
  }

  simpleSyntaxHighlight(code, language) {
    const escaped = this.escapeHtml(code);
    let highlighted = escaped;
    
    const keywords = ['import', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw'];
    keywords.forEach(keyword => {
      const regex = new RegExp(`(&lt;/?\\b${keyword}\\b|&lt;\\b${keyword}\\b)`, 'g');
      highlighted = highlighted.replace(regex, `<span class="text-primary">$1</span>`);
    });
    
    highlighted = highlighted.replace(/(&quot;.*?&quot;|'.*?'|`.*?`)/g, '<span class="text-success">$1</span>');
    
    return highlighted;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  addMessage(message) {
    this.options.messages.push(message);
    const messageHtml = this.renderMessage(message, this.options.messages.length - 1);
    this.element.insertAdjacentHTML('beforeend', messageHtml);
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    // Scroll to bottom
    this.element.scrollTop = this.element.scrollHeight;
  }

  clearMessages() {
    this.options.messages = [];
    this.element.innerHTML = '';
  }

  updateMessage(index, message) {
    if (index >= 0 && index < this.options.messages.length) {
      this.options.messages[index] = message;
      this.refresh();
    }
  }

  // Efficiently update content of last message during streaming
  updateLastMessageContent(content) {
    const messages = this.options.messages;
    if (messages.length === 0) return;
    
    const lastIndex = messages.length - 1;
    messages[lastIndex].content = content;
    
    // Find and update the content element directly
    const messageElements = this.element.querySelectorAll('[data-message-index]');
    if (messageElements[lastIndex]) {
      const contentDiv = messageElements[lastIndex].querySelector('.markdown-content');
      if (contentDiv) {
        contentDiv.innerHTML = this.renderStreamingMarkdown(content);
      }
    }
    
    // Scroll to bottom
    this.element.scrollTop = this.element.scrollHeight;
  }

  // Update items for last message during streaming
  updateLastMessageItems(items) {
    const messages = this.options.messages;
    if (messages.length === 0) return;
    
    const lastIndex = messages.length - 1;
    messages[lastIndex].items = items;
    
    // Find and update the items element
    const messageElements = this.element.querySelectorAll('[data-message-index]');
    if (messageElements[lastIndex]) {
      const itemsContainer = messageElements[lastIndex].querySelector('.pl-12');
      if (itemsContainer) {
        const itemsHtml = this.renderItems(items);
        // Remove old items and add new ones
        const existingItems = itemsContainer.querySelectorAll('.flex.flex-col.gap-2, .mockup-code, .alert, .mockup-terminal, .bg-base-200.rounded-box');
        existingItems.forEach(el => el.remove());
        itemsContainer.insertAdjacentHTML('beforeend', itemsHtml);
        
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    }
    
    this.element.scrollTop = this.element.scrollHeight;
  }

  // Update tasks for last message during streaming
  updateLastMessageTasks(tasks) {
    const messages = this.options.messages;
    if (messages.length === 0) return;
    
    const lastIndex = messages.length - 1;
    messages[lastIndex].tasks = tasks;
    
    // Find and update the tasks element
    const messageElements = this.element.querySelectorAll('[data-message-index]');
    if (messageElements[lastIndex]) {
      // Check if tasks container exists, if not add it
      let tasksContainer = messageElements[lastIndex].querySelector('.task-cards-container');
      if (!tasksContainer) {
        const contentDiv = messageElements[lastIndex].querySelector('.flex.flex-col.gap-2');
        if (contentDiv) {
          const tasksHtml = this.renderTasks(tasks);
          contentDiv.insertAdjacentHTML('beforeend', `<div class="task-cards-container mt-2">${tasksHtml}</div>`);
          
          if (window.lucide) {
            window.lucide.createIcons();
          }
        }
      } else {
        // Update existing tasks
        const tasksHtml = this.renderTasks(tasks);
        tasksContainer.innerHTML = tasksHtml;
        
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    }
    
    this.element.scrollTop = this.element.scrollHeight;
  }

  // Add or update a task in the last message
  upsertTask(task) {
    const messages = this.options.messages;
    if (messages.length === 0) return;
    
    const lastIndex = messages.length - 1;
    if (!messages[lastIndex].tasks) {
      messages[lastIndex].tasks = [];
    }
    
    // Find existing task or add new one
    const existingIndex = messages[lastIndex].tasks.findIndex(t => t.id === task.id);
    if (existingIndex !== -1) {
      messages[lastIndex].tasks[existingIndex] = { ...messages[lastIndex].tasks[existingIndex], ...task };
    } else {
      messages[lastIndex].tasks.push(task);
    }
    
    // Refresh the display
    const messageElements = this.element.querySelectorAll('[data-message-index]');
    if (messageElements[lastIndex]) {
      let tasksContainer = messageElements[lastIndex].querySelector('.task-cards-container');
      const contentDiv = messageElements[lastIndex].querySelector('.flex.flex-col.gap-2');
      
      if (contentDiv) {
        const tasksHtml = this.renderTasks(messages[lastIndex].tasks);
        if (tasksContainer) {
          tasksContainer.innerHTML = tasksHtml;
        } else {
          contentDiv.insertAdjacentHTML('beforeend', `<div class="task-cards-container mt-2">${tasksHtml}</div>`);
        }
        
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    }
    
    this.element.scrollTop = this.element.scrollHeight;
  }

  removeMessage(index) {
    if (index >= 0 && index < this.options.messages.length) {
      this.options.messages.splice(index, 1);
      this.refresh();
    }
  }

  refresh() {
    this.element.innerHTML = this.options.messages.map((message, index) => this.renderMessage(message, index)).join('');
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  destroy() {
    this.element?.remove();
  }
}

// Export default for convenience
export default ChatMessages;
