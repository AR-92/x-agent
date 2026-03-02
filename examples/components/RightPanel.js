/**
 * RightPanel Component
 * A theme-aware right side panel for displaying response details, code previews, and project structure.
 * Extracted from examples/example.html
 * 
 * Usage:
 *   import { RightPanel } from './components/RightPanel.js';
 *   
 *   const rightPanel = new RightPanel({
 *     container: document.body,
 *     title: 'Response Details',
 *     codePreview: {
 *       language: 'javascript',
 *       code: `import { useState } from 'react';...`,
 *     },
 *     projectStructure: [
 *       { name: 'src/', type: 'folder', children: [...] },
 *       { name: 'App.tsx', type: 'file' },
 *     ],
 *     stats: [
 *       { label: 'Files Created', value: '7' },
 *       { label: 'Lines of Code', value: '342' },
 *     ],
 *     onClose: () => { console.log('Panel closed'); },
 *   });
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
      title: 'Response Details',
      width: 400,
      minWidth: 200,
      maxWidth: 600,
      codePreview: null,
      projectStructure: null,
      stats: null,
      onClose: null,
      ...options,
    };

    this.isOpen = false;
    this.element = null;
    this.currentWidth = this.options.width;
    
    this.render();
    this.attachEvents();
    
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'fixed top-0 right-0 h-full w-0 bg-base-100 border-l border-base-300 overflow-hidden z-30 transition-all duration-300';
    
    container.innerHTML = `
      <div class="w-[${this.options.width}px] h-full flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-base-300 bg-base-200 rounded-t-box">
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
      
      <!-- Resize Handle -->
      <div id="resizeHandle" class="fixed top-0 right-0 w-1 h-full cursor-col-resize z-40 hidden hover:bg-base-content/10 rounded-l-btn"></div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    
    // Cache DOM elements
    this.closeBtn = container.querySelector('#closePanel');
    this.resizeHandle = container.querySelector('#resizeHandle');
    this.panelContent = container.querySelector('.w-\\[400px\\]');
  }

  renderCodePreview() {
    const { language = 'javascript', code = '', title = 'Code Preview' } = this.options.codePreview;
    
    return `
      <div class="card bg-base-200 rounded-box shadow-md">
        <div class="card-body p-4">
          <h4 class="card-title text-sm flex items-center gap-2 text-base-content">
            <i data-lucide="code-2" class="w-4 h-4"></i>
            ${title}
          </h4>
          <div class="mockup-code bg-base-300 text-xs mt-2 rounded-box">
            <pre class="px-2"><code>${this.escapeHtml(code)}</code></pre>
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
              <div class="flex items-center gap-2 hover:bg-base-300 rounded-btn px-2 py-1 cursor-pointer text-base-content ${file.indent ? 'pl-' + (file.indent * 4) : ''}">
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
    let isResizing = false;
    
    this.resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(
        this.options.minWidth,
        Math.min(this.options.maxWidth, newWidth)
      );
      
      const panelDiv = this.element.querySelector('div > div');
      if (panelDiv) {
        panelDiv.style.width = clampedWidth + 'px';
      }
      this.currentWidth = clampedWidth;
    });

    document.addEventListener('mouseup', () => {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

  open() {
    this.isOpen = true;
    this.element.classList.remove('w-0');
    this.element.classList.add(`w-[${this.currentWidth}px]`);
    this.resizeHandle.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.element.classList.remove(`w-[${this.currentWidth}px]`);
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
    const panelDiv = this.element.querySelector('div > div');
    if (panelDiv) {
      panelDiv.style.width = width + 'px';
    }
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
    return div.innerHTML;
  }

  destroy() {
    this.element?.remove();
  }
}

// Export default for convenience
export default RightPanel;
