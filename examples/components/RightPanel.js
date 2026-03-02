/**
 * RightPanel Component
 * A theme-aware resizable right panel drawer.
 * 
 * Usage:
 *   import { RightPanel } from './components/RightPanel.js';
 *   
 *   const rightPanel = new RightPanel({
 *     container: document.getElementById('rightPanelContainer'),
 *     title: 'Response Details',
 *     width: 400,
 *     minWidth: 250,
 *     maxWidth: 800,
 *     isOpen: true,
 *     codePreview: { ... },
 *     projectStructure: { ... },
 *     stats: { ... },
 *   });
 */

export class RightPanel {
  constructor(options = {}) {
    this.options = {
      container: null,
      title: 'Response Details',
      width: 400,
      minWidth: 250,
      maxWidth: 800,
      isOpen: true,
      codePreview: null,
      projectStructure: null,
      stats: null,
      onClose: null,
      onOpen: null,
      onResize: null,
      ...options,
    };

    this.isOpen = this.options.isOpen;
    this.currentWidth = this.options.width;
    this.element = null;
    this.resizeHandle = null;
    this.panelContent = null;
    this.isResizing = false;
    
    this.render();
    this.attachEvents();
    
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'flex flex-row-reverse';
    container.style.width = this.isOpen ? `${this.currentWidth}px` : '0';
    container.style.transition = 'width 0.3s ease-in-out';
    container.style.overflow = 'hidden';
    container.style.flexShrink = '0';
    container.style.height = '100vh';
    
    container.innerHTML = `
      <!-- Resize Handle (on left edge of panel) -->
      <div id="resizeHandle" class="w-2 cursor-col-resize z-50 hover:bg-primary/20 transition-colors flex-shrink-0 flex items-center justify-center" style="height: 100%;">
        <div class="w-0.5 h-12 bg-base-content/50 rounded-full hover:bg-primary transition-colors"></div>
      </div>
      
      <!-- Panel Content -->
      <div class="h-full overflow-hidden bg-base-100 border-s border-base-300 shadow-lg flex flex-col" style="width: ${this.currentWidth}px; flex-shrink: 0;">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-base-300 bg-base-200 shrink-0">
          <h3 class="text-lg font-bold text-base-content">${this.options.title}</h3>
          <button id="closePanel" class="btn btn-sm btn-circle btn-ghost rounded-btn hover:bg-base-300">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          ${this.options.codePreview ? this.renderCodePreview() : ''}
          ${this.options.projectStructure ? this.renderProjectStructure() : ''}
          ${this.options.stats ? this.renderStats() : ''}
        </div>
      </div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    this.resizeHandle = container.firstElementChild;
    this.panelContent = container.lastElementChild;
    
    // Cache DOM elements
    this.closeBtn = container.querySelector('#closePanel');
    
    // Set initial visibility
    this.resizeHandle.style.visibility = this.isOpen ? 'visible' : 'hidden';
  }

  renderCodePreview() {
    const { code = '', title = 'Code Preview' } = this.options.codePreview;
    const escaped = this.escapeHtml(code);
    const highlighted = this.simpleSyntaxHighlight(escaped);
    
    return `
      <div class="card bg-base-200 rounded-box shadow-md">
        <div class="card-body p-4">
          <h4 class="card-title text-sm flex items-center gap-2 text-base-content">
            <i data-lucide="code-2" class="w-4 h-4"></i>
            ${title}
          </h4>
          <div class="mockup-code bg-base-300 text-xs mt-2 rounded-box">
            <pre class="px-2"><code>${highlighted}</code></pre>
          </div>
        </div>
      </div>
    `;
  }

  renderProjectStructure() {
    const { title = 'Project Structure', files = [] } = this.options.projectStructure;
    
    return `
      <div class="card bg-base-200 rounded-box shadow-md">
        <div class="card-body p-4">
          <h4 class="card-title text-sm flex items-center gap-2 text-base-content">
            <i data-lucide="folder-tree" class="w-4 h-4"></i>
            ${title}
          </h4>
          <div class="text-xs font-mono mt-2 space-y-1">
            ${files.map(file => `
              <div class="flex items-center gap-2 hover:bg-base-300 rounded-btn px-2 py-1 cursor-pointer text-base-content" style="padding-left: ${file.indent ? (file.indent * 16 + 8) : 8}px">
                <i data-lucide="${file.type === 'folder' ? 'folder' : 'file-code'}" 
                   class="w-3.5 h-3.5 ${file.type === 'folder' ? 'text-warning' : 'text-info'} shrink-0"></i>
                <span class="truncate">${file.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderStats() {
    const { items = [] } = this.options.stats;
    
    return `
      <div class="stats stats-vertical bg-base-200 rounded-box shadow-md w-full">
        ${items.map(stat => `
          <div class="stat">
            <div class="stat-title text-base-content/70">${stat.label}</div>
            <div class="stat-value ${stat.color || 'text-primary'}">${stat.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  attachEvents() {
    // Close button
    this.closeBtn.addEventListener('click', () => {
      this.close();
    });

    // Resize handle - mousedown
    this.resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    // Mouse move on document
    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;
      
      // Calculate width: distance from right edge of viewport to mouse
      const newWidth = window.innerWidth - e.clientX;
      
      // Clamp to min/max
      const clampedWidth = Math.max(
        this.options.minWidth,
        Math.min(this.options.maxWidth, newWidth)
      );
      
      // Update width
      this.setWidth(clampedWidth);
      this.options.onResize?.(clampedWidth);
    });

    // Mouse up on document
    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setWidth(width) {
    this.currentWidth = width;
    this.element.style.width = `${width}px`;
    this.panelContent.style.width = `${width}px`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  simpleSyntaxHighlight(code) {
    let highlighted = code;
    const keywords = ['import', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw'];
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
      highlighted = highlighted.replace(regex, '<span class="text-primary">$1</span>');
    });
    highlighted = highlighted.replace(/(['"`])(.*?)\1/g, '<span class="text-success">$1$2$1</span>');
    highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, '<span class="text-secondary">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-base-content/50">$1</span>');
    return highlighted;
  }

  destroy() {
    this.element?.remove();
  }
}

export default RightPanel;
