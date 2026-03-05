/**
 * RightPanel Component
 * A theme-aware resizable right panel drawer.
 * Displays LLM response details, tool execution info, and tokens.
 */

export class RightPanel {
  constructor(options = {}) {
    this.options = {
      container: null,
      title: 'Response Details',
      width: 400,
      minWidth: 280,
      maxWidth: 800,
      isOpen: false,
      currentMessage: null,
      onClose: null,
      onOpen: null,
      onResize: null,
      onItemClick: null,
      ...options,
    };

    this.isOpen = this.options.isOpen;
    this.currentWidth = this.options.width;
    this.element = null;
    this.resizeHandle = null;
    this.isResizing = false;
    this.content = null;
    
    this.render();
    this.attachEvents();
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  render() {
    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      width: ${this.isOpen ? this.currentWidth : 0}px;
      height: 100vh;
      flex-shrink: 0;
      transition: width 0.3s ease-in-out;
      overflow: hidden;
    `;

    container.innerHTML = `
      <!-- Resize Handle (LEFT edge of panel) -->
      <div id="resizeHandle" class="
        absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50
        flex items-center justify-center
        ${this.isOpen ? 'visible' : 'invisible'}
        hover:w-1.5 transition-all duration-150
      ">
        <div class="
          w-px h-full bg-base-content/30 rounded
          hover:bg-base-content/60 hover:w-0.5
          transition-all duration-150
        "></div>
      </div>

      <!-- Panel Content -->
      <div class="
        h-full overflow-hidden
        bg-base-100
        border-l border-base-300
        shadow-[-2px_0_8px_rgba(0,0,0,0.1)]
        flex flex-col
      ">
        <!-- Header -->
        <div class="
          flex items-center justify-between
          px-3 py-2
          border-b border-base-300
          bg-base-100
          flex-shrink-0
          h-10
        ">
          <div class="flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4 text-primary"></i>
            <span class="text-xs font-semibold text-base-content">Response Details</span>
          </div>
          <button id="closePanel" class="
            btn btn-ghost btn-xs btn-circle
            h-6 w-6 min-h-0 rounded-full
            hover:bg-base-300 transition-colors
          ">
            <i data-lucide="x" class="w-3 h-3 text-base-content"></i>
          </button>
        </div>

        <!-- Content Area -->
        <div id="panelContent" class="flex-1 overflow-y-auto p-3 space-y-3">
          ${this.renderEmptyState()}
        </div>
      </div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    this.resizeHandle = container.querySelector('#resizeHandle');
    this.panelContent = container.querySelector('#panelContent');
    this.closeBtn = container.querySelector('#closePanel');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderEmptyState() {
    return `
      <div class="flex flex-col items-center justify-center h-full text-center p-4">
        <div class="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mb-3">
          <i data-lucide="message-square" class="w-6 h-6 text-base-content/30"></i>
        </div>
        <p class="text-xs text-base-content/50 mb-2">No response selected</p>
        <p class="text-[10px] text-base-content/30 max-w-[180px]">Click on any agent response to view details</p>
      </div>
    `;
  }

  renderMessageDetails(message) {
    if (!message) return this.renderEmptyState();

    let html = '';

    // Header with agent info
    html += `
      <div class="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3 mb-3 border border-primary/20">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <i data-lucide="bot" class="w-5 h-5 text-primary"></i>
          </div>
          <div>
            <div class="text-sm font-bold text-base-content">x-agent</div>
            <div class="text-[10px] text-base-content/50">AI Assistant Response</div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-[10px]">
          <span class="badge badge-sm badge-success gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
            ${message.isStreaming ? 'Streaming' : 'Completed'}
          </span>
          ${message.timestamp ? `<span class="text-base-content/50">${new Date(message.timestamp).toLocaleString()}</span>` : ''}
        </div>
      </div>
    `;

    // Full LLM Response
    if (message.content) {
      const contentLength = message.content.length;
      const wordCount = message.content.split(/\s+/).filter(w => w).length;

      html += this.renderSection('📝 Full LLM Response', `
        <div class="space-y-2 text-[11px]">
          <div class="flex justify-between items-center">
            <div class="flex gap-2">
              <span class="text-base-content/50">Characters: <span class="text-base-content font-medium">${contentLength.toLocaleString()}</span></span>
              <span class="text-base-content/50">|</span>
              <span class="text-base-content/50">Words: <span class="text-base-content font-medium">${wordCount.toLocaleString()}</span></span>
            </div>
          </div>
        </div>
        <div class="mt-2 p-3 bg-base-200 rounded-lg text-[11px] text-base-content max-h-80 overflow-y-auto markdown-content prose prose-sm">
          ${message.content}
        </div>
      `);
    }

    // Tasks Section
    if (message.tasks && message.tasks.length > 0) {
      html += this.renderSection('📋 Task Execution', `
        <div class="space-y-2">
          ${message.tasks.map(task => {
            const statusColors = {
              'completed': 'text-success bg-success/10 border-success/20',
              'in_progress': 'text-primary bg-primary/10 border-primary/20',
              'pending': 'text-base-content/50 bg-base-300 border-base-300',
              'error': 'text-error bg-error/10 border-error/20',
            };
            const statusIcons = {
              'completed': 'check-circle',
              'in_progress': 'loader-2',
              'pending': 'circle',
              'error': 'x-circle',
            };
            const statusClass = statusColors[task.status] || statusColors.pending;
            const icon = statusIcons[task.status] || statusIcons.pending;
            const isAnimated = task.status === 'in_progress';

            return `
              <div class="border rounded-lg ${statusClass} p-2 space-y-2">
                <div class="flex items-center gap-2">
                  <i data-lucide="${icon}" class="w-4 h-4 ${isAnimated ? 'animate-spin' : ''}"></i>
                  <span class="text-xs font-medium">${this.escapeHtml(task.title || 'Untitled Task')}</span>
                </div>
                ${task.description ? `<p class="text-[10px] text-base-content/70 pl-6">${this.escapeHtml(task.description)}</p>` : ''}
                ${task.steps && task.steps.length > 0 ? `
                  <div class="space-y-1 pl-6 mt-2">
                    ${task.steps.map(step => {
                      const stepStatusColors = {
                        'completed': 'text-success',
                        'in_progress': 'text-primary',
                        'pending': 'text-base-content/50',
                        'error': 'text-error',
                      };
                      const stepIcon = step.status === 'completed' ? 'check' : step.status === 'in_progress' ? 'loader-2' : step.status === 'error' ? 'x' : 'circle';
                      const stepColor = stepStatusColors[step.status] || stepStatusColors.pending;
                      const stepAnimated = step.status === 'in_progress';

                      return `
                        <div class="flex items-center gap-2 text-[10px]">
                          <i data-lucide="${stepIcon}" class="w-3 h-3 ${stepColor} ${stepAnimated ? 'animate-spin' : ''}"></i>
                          <span class="${stepColor}">${this.escapeHtml(step.text || '')}</span>
                          ${step.timestamp ? `<span class="text-base-content/30 ml-auto">${step.timestamp}</span>` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `);
    }

    // Items/Badges
    if (message.items && message.items.length > 0) {
      const badges = message.items.filter(i => i.type === 'badge');
      const codeBlocks = message.items.filter(i => i.type === 'code');
      const alerts = message.items.filter(i => i.type === 'alert');
      const terminal = message.items.find(i => i.type === 'terminal');
      const reasoning = message.items.find(i => i.type === 'reasoning');

      if (badges.length > 0) {
        html += this.renderSection('Actions & Steps', `
          <div class="flex flex-wrap gap-1">
            ${badges.map(badge => `
              <button class="badge badge-sm ${this.getBadgeVariant(badge.variant)} gap-1 cursor-pointer hover:opacity-80 transition-opacity" data-item-type="badge" data-item='${this.escapeHtml(JSON.stringify(badge))}'>
                <i data-lucide="${badge.icon || 'circle'}" class="w-2.5 h-2.5 ${badge.animated ? 'animate-spin' : ''}"></i>
                ${this.escapeHtml(badge.text || '').substring(0, 30)}
              </button>
            `).join('')}
          </div>
        `);
      }

      if (codeBlocks.length > 0) {
        html += this.renderSection('Code Blocks', `
          <div class="space-y-2">
            ${codeBlocks.map((code, i) => `
              <div class="p-2 bg-base-200 rounded text-[10px]">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-base-content/50">${code.language || 'text'}</span>
                  <span class="text-base-content/30">${(code.code || '').length} chars</span>
                </div>
                <pre class="text-[9px] text-base-content/70 max-h-16 overflow-hidden">${this.escapeHtml((code.code || '').substring(0, 200))}</pre>
              </div>
            `).join('')}
          </div>
        `);
      }

      if (alerts.length > 0) {
        html += this.renderSection('Alerts', `
          <div class="space-y-2">
            ${alerts.map(alert => `
              <div class="alert alert-sm ${this.getAlertVariant(alert.variant)} p-2">
                <i data-lucide="${alert.variant === 'error' ? 'alert-circle' : alert.variant === 'warning' ? 'alert-triangle' : 'info'}" class="w-3 h-3"></i>
                <span class="text-[10px]">${this.escapeHtml(alert.title || 'Alert')}</span>
              </div>
            `).join('')}
          </div>
        `);
      }

      if (reasoning) {
        html += this.renderSection('Reasoning', `
          <div class="p-2 bg-base-200 rounded">
            <div class="flex items-center gap-1 mb-1">
              <i data-lucide="brain" class="w-3 h-3 text-primary"></i>
              <span class="text-[10px] font-medium">${reasoning.title || 'Reasoning Process'}</span>
            </div>
            ${reasoning.steps ? `
              <div class="space-y-1">
                ${reasoning.steps.map(step => `
                  <div class="flex items-center gap-1.5 text-[9px]">
                    ${step.loading 
                      ? '<span class="loading loading-spinner loading-xs text-primary"></span>'
                      : `<i data-lucide="${step.icon || 'check'}" class="w-2.5 h-2.5 text-success"></i>`
                    }
                    <span class="text-base-content/60">${this.escapeHtml(step.text || '').substring(0, 60)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `);
      }
    }

    // Tasks
    if (message.tasks && message.tasks.length > 0) {
      html += this.renderSection('Tasks', `
        <div class="space-y-1.5">
          ${message.tasks.map(task => `
            <div class="flex items-center gap-2 p-1.5 rounded bg-base-200 text-[10px]">
              <div class="w-3 h-3 rounded-full flex items-center justify-center ${task.status === 'completed' ? 'bg-success' : task.status === 'in_progress' ? 'bg-primary' : 'bg-base-300'}">
                ${task.status === 'completed' 
                  ? '<i data-lucide="check" class="w-2 h-2 text-success-content"></i>'
                  : task.status === 'in_progress'
                    ? '<i data-lucide="loader-2" class="w-2 h-2 animate-spin"></i>'
                    : '<i data-lucide="circle" class="w-1.5 h-1.5"></i>'
                }
              </div>
              <span class="flex-1 text-base-content ${task.status === 'completed' ? 'line-through opacity-50' : ''}">${this.escapeHtml(task.title || '')}</span>
              ${task.badge ? `<span class="badge badge-xs ${task.status === 'completed' ? 'badge-success' : 'badge-primary'}">${task.badge}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    return html;
  }

  renderToolExecution(toolName, args, result, isError) {
    return `
      <div class="space-y-3">
        ${this.renderSection('Tool Execution', `
          <div class="flex items-center gap-2 p-2 rounded ${isError ? 'bg-error/10' : 'bg-success/10'}">
            <div class="w-6 h-6 rounded-full flex items-center justify-center ${isError ? 'bg-error' : 'bg-success'}">
              <i data-lucide="${isError ? 'x' : 'check'}" class="w-4 h-4 ${isError ? 'text-error-content' : 'text-success-content'}"></i>
            </div>
            <div>
              <div class="text-xs font-medium text-base-content">${this.escapeHtml(toolName || 'Unknown Tool')}</div>
              <div class="text-[10px] text-base-content/50">${isError ? 'Execution failed' : 'Completed successfully'}</div>
            </div>
          </div>
        `)}

        ${args ? this.renderSection('Arguments', `
          <div class="p-2 bg-base-200 rounded text-[10px] font-mono max-h-24 overflow-y-auto">
            ${this.escapeHtml(JSON.stringify(args, null, 2))}
          </div>
        `) : ''}

        ${result ? this.renderSection('Result', `
          <div class="p-2 bg-base-200 rounded text-[10px] font-mono max-h-32 overflow-y-auto">
            ${this.escapeHtml(typeof result === 'string' ? result : JSON.stringify(result, null, 2))}
          </div>
        `) : ''}
      </div>
    `;
  }

  renderUsage(usage) {
    if (!usage) return '';
    
    return this.renderSection('Token Usage', `
      <div class="space-y-2">
        <div class="flex justify-between text-[11px]">
          <span class="text-base-content/50">Input</span>
          <span class="text-base-content font-mono">${(usage.input || 0).toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-[11px]">
          <span class="text-base-content/50">Output</span>
          <span class="text-base-content font-mono">${(usage.output || 0).toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-[11px] font-medium border-t border-base-300 pt-2">
          <span class="text-base-content">Total</span>
          <span class="text-primary font-mono">${(usage.totalTokens || 0).toLocaleString()}</span>
        </div>
        ${usage.promptTokens ? `
        <div class="text-[9px] text-base-content/40 mt-1">
          Prompt: ${usage.promptTokens.toLocaleString()} | Completion: ${usage.completionTokens.toLocaleString()}
        </div>
        ` : ''}
      </div>
    `);
  }

  renderSection(title, content) {
    return `
      <div class="bg-base-200/50 rounded-lg p-2.5">
        <div class="flex items-center gap-1.5 mb-2">
          <i data-lucide="chevron-right" class="w-3 h-3 text-primary"></i>
          <span class="text-[10px] font-semibold text-base-content uppercase tracking-wide">${title}</span>
        </div>
        ${content}
      </div>
    `;
  }

  getBadgeVariant(variant) {
    const variants = {
      success: 'badge-success',
      primary: 'badge-primary',
      info: 'badge-info',
      warning: 'badge-warning',
      error: 'badge-error',
    };
    return variants[variant] || 'badge-ghost';
  }

  getAlertVariant(variant) {
    const variants = {
      success: 'alert-success',
      error: 'alert-error',
      warning: 'alert-warning',
      info: 'alert-info',
    };
    return variants[variant] || 'alert-info';
  }

  attachEvents() {
    this.closeBtn.addEventListener('click', () => this.close());

    this.resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(this.options.minWidth, Math.min(this.options.maxWidth, newWidth));
      this.setWidth(clampedWidth);
      this.options.onResize?.(clampedWidth);
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });

    // Handle item clicks in the panel
    this.panelContent.addEventListener('click', (e) => {
      const badgeBtn = e.target.closest('[data-item-type="badge"]');
      if (badgeBtn) {
        try {
          const itemData = JSON.parse(badgeBtn.dataset.item);
          this.options.onItemClick?.(itemData);
        } catch (err) {
          console.warn('Failed to parse item data:', err);
        }
      }
    });
  }

  open() {
    this.isOpen = true;
    this.element.style.width = `${this.currentWidth}px`;
    this.resizeHandle.style.visibility = 'visible';
    this.options.onOpen?.();
  }

  close() {
    this.isOpen = false;
    this.element.style.width = '0';
    this.resizeHandle.style.visibility = 'hidden';
    this.options.onClose?.();
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  setWidth(width) {
    this.currentWidth = width;
    this.element.style.width = `${width}px`;
  }

  showMessage(message) {
    this.options.currentMessage = message;
    if (this.panelContent) {
      this.panelContent.innerHTML = this.renderMessageDetails(message);
      // Render markdown in the content
      const markdownContent = this.panelContent.querySelector('.markdown-content');
      if (markdownContent && window.marked) {
        markdownContent.innerHTML = window.marked.parse(message.content || '');
      }
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
    if (!this.isOpen) {
      this.open();
    }
  }

  showToolExecution(toolName, args, result, isError) {
    if (this.panelContent) {
      this.panelContent.innerHTML = this.renderToolExecution(toolName, args, result, isError);
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
    if (!this.isOpen) {
      this.open();
    }
  }

  showUsage(usage) {
    if (this.panelContent) {
      const currentHtml = this.panelContent.innerHTML;
      this.panelContent.innerHTML = currentHtml + this.renderUsage(usage);
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  clear() {
    this.options.currentMessage = null;
    if (this.panelContent) {
      this.panelContent.innerHTML = this.renderEmptyState();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  destroy() {
    this.element?.remove();
  }
}

export default RightPanel;
