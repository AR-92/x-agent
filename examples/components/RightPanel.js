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

        <!-- Content (empty state) -->
        <div style="flex: 1; overflow-y: auto; padding: 16px; display: flex; align-items: center; justify-content: center;">
          <p style="color: var(--bc, #666); opacity: 0.5; font-size: 14px;">No content</p>
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
    return '';
  }

  renderProjectStructure() {
    return '';
  }

  renderStats() {
    return '';
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
