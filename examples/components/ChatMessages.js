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
      logoSrc: null,
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
    container.className = 'max-w-[820px] mx-auto px-6 py-12 space-y-8 mb-32';
    
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
            <span class="font-medium text-base-content">${this.options.assistantName}</span>
          </div>
          <div class="pl-12 flex flex-col gap-3">
            <p class="text-sm leading-relaxed text-base-content">${message.content}</p>
            ${message.items ? this.renderItems(message.items) : ''}
          </div>
        </div>
      `;
    }
    return '';
  }

  renderLogo() {
    if (this.options.logoSrc) {
      return `
        <div class="logo-container">
          <div class="w-8 h-8 rounded-box flex items-center justify-center bg-base-200">
            <img src="${this.options.logoSrc}" alt="${this.options.logoAlt}" class="w-6 h-6">
          </div>
        </div>
      `;
    }
    
    // Default SVG logo
    return `
      <div class="logo-container">
        <div class="w-8 h-8 rounded-box flex items-center justify-center bg-base-200">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="130 245 230 230" width="20" height="20" class="w-6 h-6 text-primary">
            <g>
              <path fill="currentColor" d="M 118.928 304.856 L 87.648 296.786 C 86.708 296.546 85.718 296.546 84.768 296.786 L -7.532 320.776 C -8.502 320.016 -9.722 319.566 -11.052 319.566 C -14.222 319.566 -16.792 322.136 -16.792 325.306 L -16.792 344.486 C -16.792 346.266 -15.972 347.936 -14.562 349.026 C -13.542 349.816 -12.312 350.226 -11.052 350.226 C -10.572 350.226 -10.082 350.166 -9.612 350.046 L 110.528 318.836 C 113.558 318.056 116.658 316.996 119.728 315.696 C 121.988 314.736 123.398 312.446 123.208 309.986 C 123.028 307.536 121.298 305.466 118.918 304.856 Z M 155.398 189.906 C 152.108 188.136 148.188 188.186 144.958 189.996 L 120.018 198.236 C 119.518 198.406 119.038 198.636 118.598 198.936 C 114.228 201.896 111.618 206.876 111.618 212.246 L 111.618 261.076 C 111.618 268.826 109.338 276.236 105.038 282.516 C 100.178 289.596 93.058 294.646 85.038 296.716 L 84.818 296.776 C 82.268 297.416 80.478 299.696 80.468 302.316 C 80.458 304.936 82.228 307.236 84.768 307.896 L 116.048 315.966 C 116.518 316.086 116.998 316.146 117.478 316.146 C 118.238 316.146 118.998 315.996 119.718 315.696 C 127.918 312.226 135.258 307.176 141.528 300.696 C 154.238 287.636 161.228 270.196 161.228 251.606 L 161.228 199.696 C 161.228 195.556 158.968 191.796 155.378 189.906 Z"></path>
            </g>
          </svg>
        </div>
      </div>
    `;
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
