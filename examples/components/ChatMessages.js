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
    container.className = 'max-w-[820px] mx-auto px-3 py-3 space-y-4';

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
      const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleString() : new Date().toLocaleString();
      
      return `
        <div data-message-index="${index}" class="flex flex-col gap-2 w-full group mt-3">
          <div class="flex items-center justify-between h-[26px] group">
            <div class="flex items-center gap-[3px] -ms-[2px]">
              ${this.renderLogo()}
              <svg height="10" width="59" fill="none" viewBox="0 0 59 10" xmlns="http://www.w3.org/2000/svg">
                <path d="M52.481 9.37181H51.9695V6.36881H52.6625C52.8495 7.16081 53.119 7.73831 53.471 8.10131C53.823 8.46431 54.2795 8.64581 54.8405 8.64581C55.2475 8.64581 55.561 8.56331 55.781 8.39831C56.012 8.22231 56.1275 7.98581 56.1275 7.68881C56.1275 7.38081 55.99 7.08381 55.715 6.79781C55.44 6.50081 54.9945 6.18731 54.3785 5.85731C53.5425 5.40631 52.943 4.96081 52.58 4.52081C52.217 4.06981 52.0355 3.56381 52.0355 3.00281C52.0355 2.63981 52.1015 2.30431 52.2335 1.99631C52.3765 1.67731 52.5635 1.40231 52.7945 1.17131C53.0365 0.940313 53.3225 0.764313 53.6525 0.643312C53.9825 0.511313 54.34 0.445312 54.725 0.445312C55.066 0.445312 55.4015 0.494812 55.7315 0.593812C56.0725 0.692812 56.3695 0.830313 56.6225 1.00631L56.9195 0.610313H57.3485V3.10181H56.705C56.452 2.47481 56.188 2.02381 55.913 1.74881C55.649 1.47381 55.3245 1.33631 54.9395 1.33631C54.6315 1.33631 54.384 1.41881 54.197 1.58381C54.021 1.74881 53.933 1.96881 53.933 2.24381C53.933 2.55181 54.065 2.84331 54.329 3.11831C54.604 3.39331 55.055 3.69581 55.682 4.02581C56.122 4.26781 56.5015 4.50431 56.8205 4.73531C57.1395 4.96631 57.398 5.20281 57.596 5.44481C57.794 5.67581 57.937 5.92331 58.025 6.18731C58.124 6.44031 58.1735 6.71531 58.1735 7.01231C58.1735 7.39731 58.102 7.74381 57.959 8.05181C57.816 8.35981 57.6125 8.62381 57.3485 8.84381C57.0845 9.06381 56.7655 9.23431 56.3915 9.35531C56.0285 9.47631 55.6215 9.53681 55.1705 9.53681C54.6975 9.53681 54.2575 9.47631 53.8505 9.35531C53.4435 9.22331 53.108 9.03631 52.844 8.79431L52.481 9.37181Z" fill="currentColor" class="text-base-content"></path>
              </svg>
              <span class="text-[var(--text-tertiary)] text-xs flex h-5 py-0.5 px-1.5 items-center gap-1 rounded-[6px] border border-[var(--border-dark)] flex-shrink-0 ml-[3px]">Lite</span>
            </div>
            <div class="flex items-center gap-[2px] invisible group-hover:visible">
              <div class="float-right transition text-[12px] text-[var(--text-tertiary)] invisible group-hover:visible">${timestamp}</div>
            </div>
          </div>
          <div class="flex"><div class="w-[24px] relative"></div><div class="flex flex-col gap-2 flex-1 min-w-0 overflow-hidden pt-2">
            <div dir="auto" class="max-w-none p-0 m-0 text-[16px] leading-[1.5] text-[var(--text-primary)] markdown-content group [&gt;*:first-child]:mt-0 [&gt;*:last-child]:mb-0">${renderedContent}</div>
            ${message.items ? this.renderItems(message.items) : ''}
            ${message.tasks ? this.renderTasks(message.tasks) : ''}
          </div></div>
        </div>
      `;
    }

    if (message.type === 'user') {
      const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleString() : new Date().toLocaleString();
      
      return `
        <div data-message-index="${index}" class="flex w-full flex-col items-end justify-end group mt-3">
          <div class="flex flex-col items-end max-w-[90%]">
            <div class="mb-[8px]">
              <div class="flex gap-[4px] items-center">
                <span class="text-[var(--text-secondary)] text-sm leading-[22px] truncate"></span>
              </div>
            </div>
            <div class="flex relative flex-col gap-2 items-end max-w-full">
              <div class="relative rounded-[12px] overflow-hidden bg-[var(--fill-white)] dark:bg-[var(--fill-tsp-white-main)] p-3 ltr:rounded-br-none rtl:rounded-bl-none border border-[var(--border-main)] dark:border-0">
                <div class="transition-all duration-300">
                  <span class="text-[var(--text-primary)] u-break-words whitespace-pre-wrap text-xs leading-relaxed">${this.escapeHtml(message.content)}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-end gap-[2px] overflow-hidden invisible group-hover:visible">
              <div class="flex h-7 w-7 items-center justify-center cursor-pointer rounded-md hover:bg-[var(--fill-tsp-white-light)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy size-5 w-4 h-4 text-[var(--icon-secondary)]" aria-hidden="true">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                </svg>
              </div>
              <div class="float-right transition text-[12px] text-[var(--text-tertiary)] whitespace-nowrap">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }
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
