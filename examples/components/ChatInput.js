/**
 * ChatInput Component
 * A theme-aware chat input component with task list, attachments, and voice input.
 * Extracted from examples/example.html
 * 
 * Usage:
 *   import { ChatInput } from './components/ChatInput.js';
 *   
 *   const chatInput = new ChatInput({
 *     container: document.body,
 *     placeholder: 'Send message to Accelerator...',
 *     tasks: [
 *       { text: 'Task 1', status: 'completed' },
 *       { text: 'Task 2', status: 'active' },
 *     ],
 *     onSend: (message) => { console.log('Sent:', message); },
 *     onAttachment: () => { console.log('Attachment clicked'); },
 *     onVoice: () => { console.log('Voice clicked'); },
 *     onPlus: () => { console.log('Plus clicked'); },
 *   });
 */

export class ChatInput {
  constructor(options = {}) {
    this.options = {
      container: null,
      placeholder: 'Send message...',
      tasks: [],
      maxTextareaHeight: 200,
      onSend: null,
      onAttachment: null,
      onVoice: null,
      onPlus: null,
      ...options,
    };

    this.tasks = this.options.tasks;
    this.isTasksVisible = false;
    this.element = null;
    
    this.render();
    this.attachEvents();
    
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'p-4 z-20';
    
    // Get initial task data
    const completedCount = this.tasks.filter(t => t.status === 'completed').length;
    const totalCount = this.tasks.length;
    const activeTask = this.tasks.find(t => t.status === 'active') || this.tasks[this.tasks.length - 1];
    const taskCountText = `${completedCount} / ${totalCount}`;
    const activeTaskText = activeTask ? activeTask.text : '';

    container.innerHTML = `
      <div class="max-w-[820px] mx-auto">
        <div class="bg-base-200 rounded-box border border-base-300 shadow-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <!-- Tasks List -->
          <div id="tasksList" class="hidden px-4 pt-3 pb-2 border-b border-base-300">
            <div class="space-y-2 max-h-48 overflow-y-auto" id="tasksContent">
              ${this.renderTasksHTML()}
            </div>
          </div>

          <!-- Toggle Tasks Button -->
          <button id="toggleTasks" class="w-full flex items-center gap-2 px-4 py-3 hover:bg-base-300 transition-colors rounded-t-box">
            <i data-lucide="check" class="w-4 h-4 text-success"></i>
            <span id="activeTaskText" class="text-sm truncate flex-1 text-left text-base-content">${this.escapeHtml(activeTaskText)}</span>
            <span id="taskCount" class="text-xs text-base-content/40">${taskCountText}</span>
            <i data-lucide="chevron-up" id="chevronIcon" class="w-4 h-4 text-base-content/40 transition-transform"></i>
          </button>

          <div class="divider divider-horizontal mx-4"></div>

          <!-- Input Area -->
          <div class="flex items-end gap-2 p-3">
            <div class="flex items-center gap-1 flex-shrink-0">
              <button id="plusBtn" class="btn btn-circle btn-ghost btn-sm rounded-btn hover:bg-base-300" title="Add task">
                <i data-lucide="plus" class="w-5 h-5"></i>
              </button>
              <button id="attachmentBtn" class="btn btn-circle btn-ghost btn-sm rounded-btn hover:bg-base-300" title="Attach file">
                <i data-lucide="paperclip" class="w-4 h-4"></i>
              </button>
            </div>

            <div class="flex-1 min-h-[40px] max-h-[200px] overflow-y-auto">
              <textarea
                id="chatTextarea"
                placeholder="${this.options.placeholder}"
                class="textarea textarea-ghost w-full resize-none focus:outline-none text-sm bg-transparent py-2.5 text-base-content placeholder-base-content/30"
                rows="1"
              ></textarea>
            </div>

            <div class="flex items-center gap-1 flex-shrink-0">
              <button id="voiceBtn" class="btn btn-circle btn-ghost btn-sm rounded-btn hover:bg-base-300" title="Voice input">
                <i data-lucide="mic" class="w-5 h-5"></i>
              </button>
              <button id="sendBtn" class="btn btn-primary btn-circle btn-sm rounded-btn hover:bg-primary/90" title="Send message">
                <i data-lucide="arrow-up" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    
    // Cache DOM elements
    this.tasksList = container.querySelector('#tasksList');
    this.tasksContent = container.querySelector('#tasksContent');
    this.toggleTasks = container.querySelector('#toggleTasks');
    this.activeTaskText = container.querySelector('#activeTaskText');
    this.taskCount = container.querySelector('#taskCount');
    this.chevronIcon = container.querySelector('#chevronIcon');
    this.textarea = container.querySelector('#chatTextarea');
    this.plusBtn = container.querySelector('#plusBtn');
    this.attachmentBtn = container.querySelector('#attachmentBtn');
    this.voiceBtn = container.querySelector('#voiceBtn');
    this.sendBtn = container.querySelector('#sendBtn');
  }

  renderTasksHTML() {
    return this.tasks.map(task => {
      const isCompleted = task.status === 'completed';
      const isPending = task.status === 'pending';
      
      return `
        <div class="flex items-center gap-2 text-sm">
          ${isCompleted 
            ? '<i data-lucide="check" class="w-3.5 h-3.5 text-success"></i>'
            : isPending
              ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 text-primary animate-spin"></i>'
              : '<i data-lucide="circle" class="w-3.5 h-3.5 text-base-content/40"></i>'
          }
          <span class="${isCompleted ? 'line-through text-base-content/40' : 'text-base-content'}">${this.escapeHtml(task.text)}</span>
        </div>
      `;
    }).join('');
  }

  attachEvents() {
    // Auto-resize textarea
    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, this.options.maxTextareaHeight) + 'px';
    });

    // Toggle tasks
    this.toggleTasks.addEventListener('click', () => {
      this.toggleTasksList();
    });

    // Send message
    this.sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Send on Enter (Shift+Enter for new line)
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Plus button
    this.plusBtn.addEventListener('click', () => {
      this.options.onPlus?.();
    });

    // Attachment button
    this.attachmentBtn.addEventListener('click', () => {
      this.options.onAttachment?.();
    });

    // Voice button
    this.voiceBtn.addEventListener('click', () => {
      this.options.onVoice?.();
    });
  }

  toggleTasksList() {
    this.isTasksVisible = !this.isTasksVisible;
    
    if (this.isTasksVisible) {
      this.tasksList.classList.remove('hidden');
      this.chevronIcon.style.transform = 'rotate(180deg)';
    } else {
      this.tasksList.classList.add('hidden');
      this.chevronIcon.style.transform = 'rotate(0deg)';
    }
  }

  setTasks(tasks) {
    this.tasks = tasks;
    this.renderTasks();
  }

  renderTasks() {
    const completedCount = this.tasks.filter(t => t.status === 'completed').length;
    const totalCount = this.tasks.length;
    const activeTask = this.tasks.find(t => t.status === 'active') || this.tasks[this.tasks.length - 1];

    // Update task count
    this.taskCount.textContent = `${completedCount} / ${totalCount}`;

    // Update active task text
    if (activeTask) {
      this.activeTaskText.textContent = activeTask.text;
    }

    // Render tasks list
    this.tasksContent.innerHTML = this.renderTasksHTML();

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  sendMessage() {
    const message = this.textarea.value.trim();
    if (!message) return;

    this.options.onSend?.(message);
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
  }

  addTask(text, status = 'pending') {
    this.tasks.push({ text, status });
    this.renderTasks();
  }

  updateTask(index, updates) {
    if (index >= 0 && index < this.tasks.length) {
      this.tasks[index] = { ...this.tasks[index], ...updates };
      this.renderTasks();
    }
  }

  clearTasks() {
    this.tasks = [];
    this.renderTasks();
  }

  getValue() {
    return this.textarea.value.trim();
  }

  setValue(value) {
    this.textarea.value = value;
    this.textarea.style.height = 'auto';
    this.textarea.style.height = Math.min(this.textarea.scrollHeight, this.options.maxTextareaHeight) + 'px';
  }

  focus() {
    this.textarea.focus();
  }

  setPlaceholder(text) {
    this.textarea.placeholder = text;
  }

  setEnabled(enabled) {
    this.textarea.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
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
export default ChatInput;
