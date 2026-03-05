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
      onStop: null,
      onSteer: null,
      ...options,
    };

    this.tasks = this.options.tasks;
    this.isTasksVisible = false;
    this.isRunning = false;
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
    const hasTasks = totalCount > 0;
    const tasksSectionClass = hasTasks ? '' : 'hidden';

    container.innerHTML = `
      <div class="max-w-[820px] mx-auto">
        <div class="bg-base-200 rounded-box border border-base-300 shadow-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <!-- Tasks List -->
          <div id="tasksList" class="hidden px-3 py-1.5 border-b border-base-300">
            <div class="space-y-1 max-h-32 overflow-y-auto" id="tasksContent">
              ${this.renderTasksHTML()}
            </div>
          </div>

          <!-- Toggle Tasks Button (hidden when no tasks) -->
          <div id="taskBarContainer" class="${tasksSectionClass}">
            <button id="toggleTasks" class="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-base-300 transition-colors rounded-t-box">
              <i data-lucide="check-circle-2" class="w-3 h-3 text-success"></i>
              <span id="activeTaskText" class="text-xs truncate flex-1 text-left text-base-content">${this.escapeHtml(activeTaskText)}</span>
              <span id="taskCount" class="text-[10px] text-base-content/40">${taskCountText}</span>
              <i data-lucide="chevron-up" id="chevronIcon" class="w-3 h-3 text-base-content/40 transition-transform"></i>
            </button>

            <!-- Completed Task Pills -->
            <div id="completedPills" class="px-3 pb-1.5 flex flex-wrap gap-1">
              ${this.renderCompletedPillsHTML()}
            </div>
          </div>

          <!-- Input Area -->
          <div class="flex items-center gap-2 px-2 py-1.5">
            <div class="flex items-center gap-0.5 flex-shrink-0">
              <button id="plusBtn" class="btn btn-circle btn-ghost btn-xs rounded-btn hover:bg-base-300" title="Add task">
                <i data-lucide="plus" class="w-3 h-3"></i>
              </button>
              <button id="attachmentBtn" class="btn btn-circle btn-ghost btn-xs rounded-btn hover:bg-base-300" title="Attach file">
                <i data-lucide="paperclip" class="w-3 h-3"></i>
              </button>
            </div>

<textarea
              id="chatTextarea"
              placeholder="Send message to Accelerator..."
              class="textarea textarea-ghost flex-1 resize-none focus:outline-none text-xs bg-transparent py-1 text-base-content placeholder-base-content/30 border-none"
              rows="1"
              style="max-height: 60px; min-height: 28px; height: 28px; overflow: hidden; scrollbar-width: none; -ms-overflow-style: none;"
            ></textarea>

            <div class="flex items-center gap-0.5 flex-shrink-0">
              <button id="voiceBtn" class="btn btn-circle btn-ghost btn-xs rounded-btn hover:bg-base-300" title="Voice input">
                <i data-lucide="mic" class="w-3 h-3"></i>
              </button>
              <button id="stopBtn" class="btn btn-error btn-circle btn-xs rounded-btn hidden" title="Stop agent">
                <i data-lucide="square" class="w-3 h-3"></i>
              </button>
              <button id="steerBtn" class="btn btn-warning btn-circle btn-xs rounded-btn hidden" title="Steer agent">
                <i data-lucide="shuffle" class="w-3 h-3"></i>
              </button>
              <button id="sendBtn" class="btn btn-primary btn-circle btn-xs rounded-btn hover:bg-primary/90" title="Send message">
                <i data-lucide="arrow-up" class="w-3 h-3"></i>
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
    this.stopBtn = container.querySelector('#stopBtn');
    this.steerBtn = container.querySelector('#steerBtn');
    this.steerContainer = container.querySelector('#steerContainer');
    this.steerInput = container.querySelector('#steerInput');
    this.steerSendBtn = container.querySelector('#steerSendBtn');
    this.steerCancelBtn = container.querySelector('#steerCancelBtn');
    this.completedPills = container.querySelector('#completedPills');
    this.taskBarContainer = container.querySelector('#taskBarContainer');
  }

  renderCompletedPillsHTML() {
    const completedTasks = this.tasks.filter(t => t.status === 'completed');
    const activeTasks = this.tasks.filter(t => t.status === 'active');
    const failedTasks = this.tasks.filter(t => t.status === 'failed');
    
    let pills = '';
    
    for (const task of activeTasks) {
      pills += `
        <div class="badge badge-primary gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] animate-pulse">
          <i data-lucide="loader-2" class="w-2.5 h-2.5 animate-spin"></i>
          <span class="truncate max-w-[100px]">${this.escapeHtml(task.text)}</span>
        </div>
      `;
    }
    
    for (const task of completedTasks) {
      pills += `
        <div class="badge badge-success gap-0.5 px-1.5 py-0.5 rounded-full text-[10px]">
          <i data-lucide="check" class="w-2.5 h-2.5"></i>
          <span class="truncate max-w-[100px]">${this.escapeHtml(task.text)}</span>
        </div>
      `;
    }
    
    for (const task of failedTasks) {
      pills += `
        <div class="badge badge-error gap-0.5 px-1.5 py-0.5 rounded-full text-[10px]" title="${this.escapeHtml(task.error || '')}">
          <i data-lucide="x" class="w-2.5 h-2.5"></i>
          <span class="truncate max-w-[100px]">${this.escapeHtml(task.text)}</span>
        </div>
      `;
    }
    
    return pills;
  }

  renderTasksHTML() {
    return this.tasks.map((task, index) => {
      const isCompleted = task.status === 'completed';
      const isActive = task.status === 'active';
      const isPending = task.status === 'pending';
      const isFailed = task.status === 'failed';
      
      let icon = '';
      let iconClass = '';
      let textClass = '';
      
      if (isCompleted) {
        icon = 'check';
        iconClass = 'text-success';
        textClass = 'line-through text-base-content/40';
      } else if (isActive) {
        icon = 'loader-2';
        iconClass = 'text-primary animate-spin';
        textClass = 'text-base-content font-medium';
      } else if (isFailed) {
        icon = 'x';
        iconClass = 'text-error';
        textClass = 'text-base-content/40';
      } else {
        icon = 'circle';
        iconClass = 'text-base-content/40';
        textClass = 'text-base-content';
      }
      
      return `
        <div class="flex items-center gap-1.5 text-xs" data-task-index="${index}">
          <i data-lucide="${icon}" class="w-3 h-3 ${iconClass}"></i>
          <span class="${textClass} flex-1">${this.escapeHtml(task.text)}</span>
          ${isActive ? '<span class="text-[10px] text-primary">(working)</span>' : ''}
          ${isFailed && task.error ? `<span class="text-[10px] text-error" title="${this.escapeHtml(task.error)}">failed</span>` : ''}
        </div>
      `;
    }).join('');
  }

  attachEvents() {
    // Auto-resize textarea
    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 60) + 'px';
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

    // Stop button
    this.stopBtn?.addEventListener('click', () => {
      this.options.onStop?.();
    });

    // Steer button
    this.steerBtn?.addEventListener('click', () => {
      this.showSteerInput();
    });

    // Steer send button
    this.steerSendBtn?.addEventListener('click', () => {
      this.sendSteer();
    });

    // Steer cancel button
    this.steerCancelBtn?.addEventListener('click', () => {
      this.hideSteerInput();
    });

    // Steer input enter key
    this.steerInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendSteer();
      } else if (e.key === 'Escape') {
        this.hideSteerInput();
      }
    });
  }

  showSteerInput() {
    this.steerContainer?.classList.remove('hidden');
    this.steerInput?.focus();
  }

  hideSteerInput() {
    this.steerContainer?.classList.add('hidden');
    if (this.steerInput) {
      this.steerInput.value = '';
    }
  }

  sendSteer() {
    const message = this.steerInput?.value?.trim();
    if (message) {
      this.options.onSteer?.(message);
      this.hideSteerInput();
    }
  }

  toggleTasksList() {
    this.isTasksVisible = !this.isTasksVisible;

    if (this.isTasksVisible) {
      this.tasksList.classList.remove('hidden');
      this.chevronIcon.classList.add('rotate-180');
    } else {
      this.tasksList.classList.add('hidden');
      this.chevronIcon.classList.remove('rotate-180');
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
    const hasTasks = totalCount > 0;

    // Show/hide task bar container
    if (this.taskBarContainer) {
      if (hasTasks) {
        this.taskBarContainer.classList.remove('hidden');
      } else {
        this.taskBarContainer.classList.add('hidden');
      }
    }

    // Update task count
    if (this.taskCount) {
      this.taskCount.textContent = `${completedCount} / ${totalCount}`;
    }

    // Update active task text
    if (this.activeTaskText && activeTask) {
      this.activeTaskText.textContent = activeTask.text;
    }

    // Render tasks list
    if (this.tasksContent) {
      this.tasksContent.innerHTML = this.renderTasksHTML();
    }

    // Render completed pills
    if (this.completedPills) {
      this.completedPills.innerHTML = this.renderCompletedPillsHTML();
    }

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
    // Auto-show tasks when a task is added
    if (!this.isTasksVisible) {
      this.toggleTasksList();
    }
    return this.tasks.length - 1;
  }

  addTasks(taskList) {
    // Add multiple tasks at once
    const startIndex = this.tasks.length;
    taskList.forEach(task => {
      const text = typeof task === 'string' ? task : task.text;
      const status = task.status || 'pending';
      this.tasks.push({ text, status });
    });
    this.renderTasks();
    // Auto-show tasks when tasks are added
    if (!this.isTasksVisible) {
      this.toggleTasksList();
    }
    return startIndex;
  }

  updateTask(index, updates) {
    if (index >= 0 && index < this.tasks.length) {
      this.tasks[index] = { ...this.tasks[index], ...updates };
      this.renderTasks();
    }
  }

  claimTask(index) {
    // Mark a task as in progress (active)
    if (index >= 0 && index < this.tasks.length) {
      this.tasks[index].status = 'active';
      this.renderTasks();
    }
  }

  completeTask(index) {
    // Mark a task as completed
    if (index >= 0 && index < this.tasks.length) {
      this.tasks[index].status = 'completed';
      this.renderTasks();
    }
  }

  failTask(index, error = null) {
    // Mark a task as failed
    if (index >= 0 && index < this.tasks.length) {
      this.tasks[index].status = 'failed';
      if (error) {
        this.tasks[index].error = error;
      }
      this.renderTasks();
    }
  }

  getActiveTask() {
    return this.tasks.find(t => t.status === 'active');
  }

  getPendingTasks() {
    return this.tasks.filter(t => t.status === 'pending');
  }

  getCompletedTasks() {
    return this.tasks.filter(t => t.status === 'completed');
  }

  getNextPendingTask() {
    return this.tasks.find(t => t.status === 'pending');
  }

  hasPendingTasks() {
    return this.tasks.some(t => t.status === 'pending');
  }

  getProgress() {
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const total = this.tasks.length;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
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

  setRunning(running) {
    this.isRunning = running;
    
    if (running) {
      // Show stop and steer buttons, hide send button
      this.sendBtn?.classList.add('hidden');
      this.stopBtn?.classList.remove('hidden');
      this.steerBtn?.classList.remove('hidden');
      this.voiceBtn?.classList.add('hidden');
      this.plusBtn?.classList.add('hidden');
      this.attachmentBtn?.classList.add('hidden');
      this.textarea.placeholder = 'Agent is working...';
      this.textarea.disabled = true;
    } else {
      // Show send button, hide stop and steer buttons
      this.stopBtn?.classList.add('hidden');
      this.steerBtn?.classList.add('hidden');
      this.sendBtn?.classList.remove('hidden');
      this.voiceBtn?.classList.remove('hidden');
      this.plusBtn?.classList.remove('hidden');
      this.attachmentBtn?.classList.remove('hidden');
      this.textarea.placeholder = this.options.placeholder;
      this.textarea.disabled = false;
    }
  }

  isAgentRunning() {
    return this.isRunning;
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
