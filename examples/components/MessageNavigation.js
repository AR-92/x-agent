/**
 * MessageNavigation Component
 * A timeline-style navigation component for chat messages with prev/next buttons and message dots.
 * 
 * Usage:
 *   import { MessageNavigation } from './components/MessageNavigation.js';
 * 
 *   const navigation = new MessageNavigation({
 *     container: document.getElementById('navContainer'),
 *     currentIndex: 0,
 *     totalMessages: 5,
 *     onNavigate: (index) => { /* handle navigation *\/ },
 *   });
 * 
 *   // Update navigation state
 *   navigation.update({ currentIndex: 2, totalMessages: 5 });
 */

export class MessageNavigation {
  constructor(options = {}) {
    this.options = {
      container: null,
      currentIndex: 0,
      totalMessages: 1,
      isFirstMessage: false,
      isLastMessage: true,
      onNavigate: null,
      ...options,
    };

    this.element = null;

    this.render();
  }

  render() {
    const container = document.createElement('div');
    container.className = 'absolute right-3 top-1/2 -translate-y-1/2 z-20';
    container.innerHTML = this.renderNavigation();

    this.options.container.appendChild(container);
    this.element = container;

    this.attachEventListeners();
  }

  renderNavigation() {
    const { currentIndex, totalMessages, isFirstMessage, isLastMessage } = this.options;

    // Generate timeline dots - show up to 4 dots representing recent messages
    const timelineDots = [];
    const maxDots = 4;
    const startIndex = Math.max(0, totalMessages - maxDots);

    for (let i = startIndex; i < totalMessages; i++) {
      const isActive = i === currentIndex;
      const width = isActive ? 'w-4' : i === totalMessages - 1 ? 'w-3' : 'w-1.5';
      const activeClass = isActive 
        ? 'bg-fg-primary group-hover/timeline:bg-fg-tertiary group-hover/timeline-tick:!bg-fg-primary' 
        : 'bg-fg-tertiary';

      timelineDots.push(`
        <button 
          class="gap-2 whitespace-nowrap font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-100 [&_svg]:shrink-0 select-none text-fg-secondary hover:text-fg-primary disabled:hover:bg-transparent border border-transparent px-2.5 text-xs rounded-full group/timeline-tick relative flex items-center justify-end w-10 h-3 animate-none hover:bg-transparent" 
          type="button" 
          aria-label="Go to message ${i + 1}" 
          data-nav-message="${i}"
        >
          <div class="rounded-full transition-all group-hover/timeline-tick:bg-primary group-hover/timeline-tick:w-4 duration-150 h-[1px] opacity-50 group-hover:opacity-100 ${width} ${activeClass}"></div>
        </button>
      `);
    }

    return `
      <div class="group flex flex-col items-center gap-1">
        <button 
          class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium leading-[normal] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed [&_svg]:shrink-0 select-none text-fg-secondary hover:bg-button-ghost-hover hover:text-fg-primary disabled:hover:bg-transparent border border-transparent h-8 gap-1.5 rounded-full overflow-hidden w-8 px-1.5 py-1.5 !opacity-0 transition-all duration-200 group-hover:!opacity-100 disabled:group-hover:!opacity-60 -me-2 translate-y-1 group-hover:translate-y-0" 
          type="button" 
          aria-label="Navigate to previous message" 
          data-state="closed"
          data-nav-prev
          ${isFirstMessage ? 'disabled' : ''}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="stroke-[2]">
            <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-linecap="square"></path>
          </svg>
        </button>
        <div class="flex flex-col items-end gap-0 group/timeline">
          ${timelineDots.join('')}
        </div>
        <button 
          class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium leading-[normal] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed [&_svg]:shrink-0 select-none text-fg-secondary hover:bg-button-ghost-hover hover:text-fg-primary disabled:hover:bg-transparent border border-transparent h-8 gap-1.5 rounded-full overflow-hidden w-8 px-1.5 py-1.5 !opacity-0 transition-all duration-200 group-hover:!opacity-100 disabled:group-hover:!opacity-60 -me-2 -translate-y-1 group-hover:translate-y-0" 
          type="button" 
          aria-label="Navigate to next message" 
          data-state="closed"
          data-nav-next
          ${isLastMessage ? 'disabled' : ''}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="stroke-[2]">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-linecap="square"></path>
          </svg>
        </button>
      </div>
    `;
  }

  attachEventListeners() {
    if (!this.element) return;

    // Previous button
    const prevBtn = this.element.querySelector('[data-nav-prev]');
    if (prevBtn && !prevBtn.disabled) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = this.options.currentIndex - 1;
        if (newIndex >= 0) {
          this.navigate(newIndex);
        }
      });
    }

    // Next button
    const nextBtn = this.element.querySelector('[data-nav-next]');
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = this.options.currentIndex + 1;
        if (newIndex < this.options.totalMessages) {
          this.navigate(newIndex);
        }
      });
    }

    // Timeline dot buttons
    this.element.querySelectorAll('[data-nav-message]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = parseInt(btn.dataset.navMessage);
        this.navigate(newIndex);
      });
    });
  }

  navigate(index) {
    if (this.options.onNavigate) {
      this.options.onNavigate(index);
    }
  }

  // Update navigation state
  update(options) {
    this.options = { ...this.options, ...options };
    this.refresh();
  }

  // Re-render the navigation
  refresh() {
    if (!this.element) return;
    this.element.innerHTML = this.renderNavigation();
    this.attachEventListeners();
  }

  destroy() {
    this.element?.remove();
  }
}

// Export default for convenience
export default MessageNavigation;
