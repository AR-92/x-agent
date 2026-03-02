/**
 * RightPanel Component
 * A theme-aware resizable right panel drawer for displaying response details, code previews, and project structure.
 * Sits alongside main content and can be resized.
 * 
 * Usage:
 *   import { RightPanel } from './components/RightPanel.js';
 *   
 *   const rightPanel = new RightPanel({
 *     container: document.getElementById('rightPanelContainer'),
 *     mainContent: document.getElementById('mainContent'),
 *     title: 'Response Details',
 *     width: 400,
 *     minWidth: 250,
 *     maxWidth: 800,
 *     isOpen: false,
 *     codePreview: { ... },
 *     projectStructure: { ... },
 *     stats: { ... },
 *     onClose: () => { console.log('Panel closed'); },
 *     onResize: (width) => { console.log('Resized to:', width); },
 *   });
 *   
 *   // Toggle panel
 *   rightPanel.toggle();
 *   
 *   // Open panel
 *   rightPanel.open();
 *   
 *   // Close panel
 *   rightPanel.close();
 */

export class RightPanel {
  constructor(options = {}) {
    this.options = {
      container: null,
      mainContent: null,
      title: 'Response Details',
      width: 400,
      minWidth: 250,
      maxWidth: 800,
      isOpen: false,
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
    container.className = `relative flex transition-all duration-300 ease-in-out ${this.isOpen ? '' : 'w-0'}`;
    container.style.width = this.isOpen ? `${this.currentWidth}px` : '0';
    
    container.innerHTML = `
      <!-- Resize Handle -->
      <div id="resizeHandle" class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-primary/20 transition-colors hidden">
        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 -translate-x-3.5 flex items-center justify-center">
          <div class="w-0.5 h-4 bg-base-content/30 rounded-full"></div>
        </div>
      </div>
      
      <!-- Panel Content -->
      <div class="flex-1 min-w-0 h-screen overflow-hidden bg-base-100 border-s border-base-300 shadow-lg">
        <div class="h-full flex flex-col">
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
      </div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    this.resizeHandle = container.querySelector('#resizeHandle');
    
    // Cache DOM elements
    this.closeBtn = container.querySelector('#closePanel');
    
    // Set initial state
    if (this.isOpen) {
      this.resizeHandle.classList.remove('hidden');
    }
  }

  renderCodePreview() {
    const { language = 'javascript', code = '', title = 'Code Preview' } = this.options.codePreview;
    
    // Escape HTML
    const escaped = this.escapeHtml(code);
    
    // Simple syntax highlighting
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
                <i data-lucide="${file.type === 'folder' ? 'folder' : file.type === 'tsx' || file.type === 'ts' || file.type === 'js' ? 'file-code' : 'file-type'}" 
                   class="w-3.5 h-3.5 ${file.type === 'folder' ? 'text-warning' : file.type === 'tsx' || file.type === 'ts' || file.type === 'js' ? 'text-info' : 'text-warning'} shrink-0"></i>
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

    // Resize handle
    this.resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;
      
      const newWidth = this.element.parentElement.offsetWidth - e.clientX;
      const clampedWidth = Math.max(
        this.options.minWidth,
        Math.min(this.options.maxWidth, newWidth)
      );
      
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
  }

  open() {
    this.isOpen = true;
    this.element.style.width = `${this.currentWidth}px`;
    this.element.classList.remove('w-0');
    this.resizeHandle.classList.remove('hidden');
    this.options.onOpen?.();
  }

  close() {
    this.isOpen = false;
    this.element.style.width = '0';
    this.element.classList.add('w-0');
    this.resizeHandle.classList.add('hidden');
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
  }

  updateCodePreview(codePreview) {
    this.options.codePreview = codePreview;
    const existing = this.element.querySelector('.card:has([data-lucide="code-2"])');
    if (existing) {
      existing.outerHTML = this.renderCodePreview();
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  updateProjectStructure(projectStructure) {
    this.options.projectStructure = projectStructure;
    const existing = this.element.querySelector('.card:has([data-lucide="folder-tree"])');
    if (existing) {
      existing.outerHTML = this.renderProjectStructure();
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  updateStats(stats) {
    this.options.stats = stats;
    const existing = this.element.querySelector('.stats');
    if (existing) {
      existing.outerHTML = this.renderStats();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  simpleSyntaxHighlight(code) {
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

  destroy() {
    this.element?.remove();
  }
}

// Export default for convenience
export default RightPanel;
