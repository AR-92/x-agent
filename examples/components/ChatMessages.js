/**
 * ChatMessages Component
 * A theme-aware component for displaying AI conversation responses.
 * Supports various content types: text, badges, code blocks, alerts, terminal, reasoning.
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
    container.className = 'max-w-[820px] mx-auto px-6 py-12 space-y-8 ';
    
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
      return `
        <div data-message-index="${index}" class="response-item">
          <div class="flex items-center gap-3 mb-3">
            ${this.renderLogo()}
            <span class="font-medium text-base-content">${message.assistantName || this.options.assistantName}</span>
          </div>
          <div class="pl-12 flex flex-col gap-3">
            <p class="text-sm leading-relaxed text-base-content">${message.content}</p>
            ${message.items ? this.renderItems(message.items) : ''}
          </div>
        </div>
      `;
    }
    
    if (message.type === 'user') {
      return `
        <div data-message-index="${index}" class="response-item">
          <div class="flex items-center justify-end gap-3 mb-3">
            <span class="font-medium text-base-content">You</span>
            <div class="w-8 h-8 rounded-box flex items-center justify-center bg-primary/20">
              <i data-lucide="user" class="w-5 h-5 text-primary"></i>
            </div>
          </div>
          <div class="pr-12">
            <div class="bg-primary text-primary-content rounded-box px-4 py-2 max-w-[80%] ml-auto">
              <p class="text-sm leading-relaxed">${message.content}</p>
            </div>
          </div>
        </div>
      `;
    }
    
    return '';
  }

  renderLogo() {
    if (this.options.logoIcon) {
      return `
        <div class="logo-container">
          <div class="w-8 h-8 rounded-box flex items-center justify-center bg-base-200">
            <i data-lucide="${this.options.logoIcon}" class="w-6 h-6"></i>
          </div>
        </div>
      `;
    }

    return '';
  }

  renderItems(items) {
    if (!items || items.length === 0) return '';
    
    const badges = items.filter(item => item.type === 'badge');
    const codeBlocks = items.filter(item => item.type === 'code');
    const alerts = items.filter(item => item.type === 'alert');
    const terminal = items.find(item => item.type === 'terminal');
    const reasoning = items.find(item => item.type === 'reasoning');
    
    let html = '';
    
    // Render badges
    if (badges.length > 0) {
      html += `<div class="flex flex-col gap-2 w-fit">`;
      html += badges.map(badge => this.renderBadge(badge)).join('');
      html += `</div>`;
    }
    
    // Render code blocks
    if (codeBlocks.length > 0) {
      codeBlocks.forEach(code => {
        html += this.renderCodeBlock(code);
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
    
    // Render reasoning
    if (reasoning) {
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
      <div class="badge ${variantClass} gap-2 rounded-btn">
        <i data-lucide="${iconName}" class="w-3.5 h-3.5 ${animated}"></i>
        ${badge.text}
      </div>
    `;
  }

  renderCodeBlock(code) {
    const { language = '', code: content = '', title = '' } = code;
    
    // Escape HTML
    const escaped = this.escapeHtml(content);
    
    // Simple syntax highlighting (can be enhanced with Prism.js or Highlight.js)
    const highlighted = this.simpleSyntaxHighlight(escaped, language);
    
    return `
      <div class="mockup-code bg-base-200 text-sm rounded-box">
        <pre class="px-4"><code>${highlighted}</code></pre>
      </div>
    `;
  }

  renderAlert(alert) {
    const { variant = 'error', title = 'Alert', message = '', icon = 'alert-circle' } = alert;
    
    const variants = {
      success: 'alert-success',
      info: 'alert-info',
      warning: 'alert-warning',
      error: 'alert-error',
    };
    
    const variantClass = variants[variant] || 'alert-error';
    
    return `
      <div class="alert ${variantClass} rounded-box">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <div>
          <h4 class="font-medium text-base-content">${title}</h4>
          <p class="text-sm text-base-content/70">${message}</p>
        </div>
      </div>
    `;
  }

  renderTerminal(terminal) {
    const { lines = [], footer = '' } = terminal;
    
    return `
      <div class="mockup-terminal bg-base-200 rounded-box p-4 font-mono text-xs">
        ${lines.map(line => `<p class="${line.variant || 'text-base-content'}">${this.escapeHtml(line.text)}</p>`).join('')}
        ${footer ? `<p class="text-base-content/40 mt-2">${this.escapeHtml(footer)}</p>` : ''}
      </div>
    `;
  }

  renderReasoning(reasoning) {
    const { title = 'Reasoning Process', steps = [] } = reasoning;
    
    return `
      <div class="bg-base-200 rounded-box p-4 text-sm">
        <p class="font-medium mb-2 flex items-center gap-2 text-base-content">
          <i data-lucide="brain" class="w-4 h-4"></i>
          ${title}
        </p>
        <ul class="space-y-2">
          ${steps.map(step => `
            <li class="flex items-center gap-2 text-base-content">
              ${step.loading 
                ? '<span class="loading loading-spinner loading-xs text-primary"></span>'
                : `<i data-lucide="${step.icon || 'check-circle-2'}" class="w-4 h-4 ${step.variant || 'text-success'}"></i>`
              }
              ${step.text}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  simpleSyntaxHighlight(code, language) {
    // Very basic syntax highlighting
    let highlighted = code;
    
    // Keywords
    const keywords = ['import', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw'];
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
      highlighted = highlighted.replace(regex, '<span class="text-primary">$1</span>');
    });
    
    // Strings
    highlighted = highlighted.replace(/(['"`])(.*?)\1/g, '<span class="text-success">$1$2$1</span>');
    
    // Function names
    highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, '<span class="text-secondary">$1</span>');
    
    // Comments
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-base-content/50">$1</span>');
    
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
