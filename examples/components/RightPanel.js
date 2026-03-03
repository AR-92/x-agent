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
        <!-- Minimal Navbar -->
        <div class="
          flex items-center justify-between
          px-4 py-2
          border-b border-base-300
          bg-base-100
          flex-shrink-0
          h-12
        ">
          <span class="text-sm font-medium text-base-content">${this.options.title}</span>
          <button id="closePanel" class="
            btn btn-ghost btn-sm btn-circle
            h-8 w-8 min-h-0 rounded-full
            hover:bg-base-300 transition-colors
          ">
            <i data-lucide="x" class="w-4 h-4 text-base-content"></i>
          </button>
        </div>

        <!-- Content (empty state) -->
        <div class="flex-1 overflow-y-auto p-4 flex items-center justify-center">
          <p class="text-base-content/50 text-sm">No content</p>
        </div>
      </div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    this.resizeHandle = container.querySelector('#resizeHandle');
    this.panelContent = container.querySelector('.border-l');
    this.closeBtn = container.querySelector('#closePanel');

    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
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
