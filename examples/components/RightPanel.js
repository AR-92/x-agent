/**
 * RightPanel Component
 * A theme-aware resizable right panel drawer.
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
    this.isResizing = false;
    
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
      <div id="resizeHandle" style="
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        cursor: col-resize;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        visibility: ${this.isOpen ? 'visible' : 'hidden'};
      ">
        <div style="
          width: 1px;
          height: 48px;
          background: var(--bc, #666);
          opacity: 0.5;
          border-radius: 1px;
          transition: all 0.2s;
        "></div>
      </div>
      
      <!-- Panel Content -->
      <div style="
        height: 100%;
        overflow: hidden;
        background: var(--b1, #fff);
        border-left: 1px solid var(--b3, #ddd);
        box-shadow: -2px 0 8px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--b3, #ddd);
          background: var(--b2, #f5f5f5);
          flex-shrink: 0;
        ">
          <h3 style="font-size: 18px; font-weight: 700; color: var(--bc, #333);">${this.options.title}</h3>
          <button id="closePanel" style="
            width: 28px;
            height: 28px;
            border-radius: 9999px;
            border: none;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div style="flex: 1; overflow-y: auto; padding: 16px;">
          ${this.options.codePreview ? this.renderCodePreview() : ''}
          ${this.options.projectStructure ? this.renderProjectStructure() : ''}
          ${this.options.stats ? this.renderStats() : ''}
        </div>
      </div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    this.resizeHandle = container.querySelector('#resizeHandle');
    this.panelContent = container.querySelector('div[style*="background: var(--b1)"]');
    this.closeBtn = container.querySelector('#closePanel');
  }

  renderCodePreview() {
    const { code = '', title = 'Code Preview' } = this.options.codePreview;
    const escaped = this.escapeHtml(code);
    
    return `
      <div style="background: var(--b2, #f5f5f5); border-radius: 0.5rem; padding: 16px; margin-bottom: 16px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>
          </svg>
          ${title}
        </h4>
        <pre style="background: var(--b3, #ddd); padding: 8px; border-radius: 0.5rem; overflow-x: auto; font-size: 12px;"><code>${escaped}</code></pre>
      </div>
    `;
  }

  renderProjectStructure() {
    const { title = 'Project Structure', files = [] } = this.options.projectStructure;
    
    return `
      <div style="background: var(--b2, #f5f5f5); border-radius: 0.5rem; padding: 16px; margin-bottom: 16px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
          </svg>
          ${title}
        </h4>
        <div style="font-family: monospace; font-size: 12px;">
          ${files.map(file => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; padding-left: ${file.indent ? (file.indent * 16 + 8) : 8}px; border-radius: 0.375rem; cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: ${file.type === 'folder' ? '#d97706' : '#3b82f6'};">
                ${file.type === 'folder' 
                  ? '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'
                  : '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>'
                }
              </svg>
              <span>${file.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderStats() {
    const { items = [] } = this.options.stats;
    
    return `
      <div style="background: var(--b2, #f5f5f5); border-radius: 0.5rem; padding: 16px;">
        ${items.map(stat => `
          <div style="padding: 8px 0; border-bottom: 1px solid var(--b3, #ddd);">
            <div style="font-size: 12px; color: var(--bc, #666); opacity: 0.7;">${stat.label}</div>
            <div style="font-size: 24px; font-weight: 700; color: var(--p, #6366f1);">${stat.value}</div>
          </div>
        `).join('')}
      </div>
    `;
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
