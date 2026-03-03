/**
 * SettingsModal Component
 * A theme-aware settings modal with sidebar navigation and general settings.
 * Extracted from examples/example.html
 * 
 * Usage:
 *   import { SettingsModal } from './components/SettingsModal.js';
 *   
 *   const settingsModal = new SettingsModal({
 *     container: document.body,
 *     themes: ['light', 'dark', 'cupcake'],
 *     onThemeChange: (theme) => { console.log('Theme changed:', theme); },
 *     onLanguageChange: (lang) => { console.log('Language changed:', lang); },
 *     // ... other callbacks
 *   });
 *   
 *   // Open modal
 *   settingsModal.open();
 *   
 *   // Close modal
 *   settingsModal.close();
 */

export class SettingsModal {
  constructor(options = {}) {
    this.options = {
      container: null,
      themes: [
        'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
        'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween',
        'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
        'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn',
        'business', 'acid', 'lemonade', 'night', 'coffee', 'winter'
      ],
      currentTheme: 'Light',
      onThemeChange: null,
      onLanguageChange: null,
      onTimeFormatChange: null,
      onDateFormatChange: null,
      onTimezoneChange: null,
      onApiKeyChange: null,
      onModelChange: null,
      onSystemPromptChange: null,
      onThinkingLevelChange: null,
      ...options,
    };

    this.isOpen = false;
    this.element = null;
    this.apiKey = '';
    this.models = [];
    this.selectedModel = '';
    this.systemPrompt = '';
    this.thinkingLevel = 'medium';

    this.render();
    this.attachEvents();

    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'fixed inset-0 z-[100] flex items-center justify-center p-0 hidden';
    
    container.innerHTML = `
      <div class="fixed inset-0 bg-base-300/10 backdrop-blur-[2px]"></div>
      <div class="relative w-full h-[100dvh] md:h-[90vh] md:max-h-[560px] md:max-w-[720px] lg:max-w-[820px] bg-base-100 rounded-box md:rounded-box shadow-2xl border-t md:border border-base-300 flex overflow-hidden">
        <!-- Sidebar -->
        <aside class="
          fixed md:relative left-0 top-0 bottom-0 h-full w-[180px] flex flex-col gap-1 border-r border-base-300 bg-base-100 z-20
          md:translate-x-0 transition-transform duration-300 ease-in-out
          translate-x-0
        ">
          <div class="px-3 pt-3 pb-2 m-2 rounded-box">
            <div class="logo-container w-7 h-7"></div>
          </div>
          <div class="flex-1 overflow-y-auto px-1.5 py-2">
            <ul class="menu w-full gap-0.5 p-0">
              <li>
                <button class="flex gap-2 items-center text-sm hover:bg-base-300 rounded-btn text-base-content">
                  <i data-lucide="user" class="w-4 h-4"></i>
                  <span>Account</span>
                </button>
              </li>
              <li>
                <button class="flex gap-2 items-center text-sm active bg-primary/10 text-primary rounded-btn">
                  <i data-lucide="settings" class="w-4 h-4 text-primary"></i>
                  <span>Settings</span>
                </button>
              </li>
              <li>
                <button class="flex gap-2 items-center text-sm hover:bg-base-300 rounded-btn text-base-content">
                  <i data-lucide="shield-check" class="w-4 h-4"></i>
                  <span>Permissions</span>
                </button>
              </li>
              <li>
                <button class="flex gap-2 items-center text-sm hover:bg-base-300 rounded-btn text-base-content">
                  <i data-lucide="bell" class="w-4 h-4"></i>
                  <span>Notifications</span>
                </button>
              </li>
              <li>
                <button class="flex gap-2 items-center text-sm hover:bg-base-300 rounded-btn text-base-content">
                  <i data-lucide="calendar-days" class="w-4 h-4"></i>
                  <span>Plans & Billing</span>
                </button>
              </li>
              <li>
                <button class="flex gap-2 items-center text-sm hover:bg-base-300 rounded-btn text-base-content">
                  <i data-lucide="credit-card" class="w-4 h-4"></i>
                  <span>Buy Credits</span>
                </button>
              </li>
              <li>
                <button class="flex gap-2 items-center text-sm hover:bg-base-300 rounded-btn text-base-content">
                  <i data-lucide="database" class="w-4 h-4"></i>
                  <span>Data Control</span>
                </button>
              </li>
              <li>
                <button class="flex gap-2 items-center text-sm hover:bg-base-300 rounded-btn text-base-content">
                  <i data-lucide="shield" class="w-4 h-4"></i>
                  <span>Security</span>
                </button>
              </li>
            </ul>
          </div>
        </aside>
        
        <!-- Main Content -->
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-base-300 shrink-0">
            <div class="flex items-center gap-2">
              <button id="mobileMenuBtn" class="btn btn-ghost btn-xs btn-circle md:hidden h-6 w-6 min-h-0 rounded-btn hover:bg-base-300">
                <i data-lucide="text-align-start" class="w-4 h-4"></i>
              </button>
              <span class="text-base font-medium text-base-content">Settings</span>
            </div>
            <button id="closeModal" class="btn btn-ghost btn-sm btn-circle z-10 h-7 w-7 min-h-0 rounded-btn hover:bg-base-300">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          
          <main class="flex-1 overflow-y-auto px-4 pb-3">
            <div class="p-3">
              <!-- API Configuration Section -->
              <h3 class="text-base font-medium text-base-content mb-3">API Configuration</h3>
              <div class="divide-y divide-base-300 mb-4">
                <!-- API Key -->
                <div class="form-control flex flex-col justify-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">OpenRouter API Key</label>
                    <p class="text-xs text-base-content/50">Your OpenRouter API key for accessing models</p>
                  </div>
                  <div class="flex gap-2">
                    <input type="password" id="apiKeyInput" placeholder="sk-or-..." class="input input-bordered input-sm flex-1 rounded-btn" />
                    <button id="saveApiKeyBtn" class="btn btn-primary btn-sm rounded-btn">Save</button>
                  </div>
                  <div id="apiKeyStatus" class="text-xs mt-1"></div>
                </div>

                <!-- Model Selection -->
                <div class="form-control flex flex-col justify-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">Model</label>
                    <p class="text-xs text-base-content/50">Select the AI model to use</p>
                  </div>
                  <select id="modelSelect" class="select select-bordered select-sm w-full rounded-btn">
                    <option value="">Loading models...</option>
                  </select>
                </div>

                <!-- Thinking Level -->
                <div class="form-control flex flex-col justify-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">Thinking Level</label>
                    <p class="text-xs text-base-content/50">How much the model should think before responding</p>
                  </div>
                  <select id="thinkingLevelSelect" class="select select-bordered select-sm w-full rounded-btn">
                    <option value="off">Off</option>
                    <option value="minimal">Minimal</option>
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="xhigh">Extra High</option>
                  </select>
                </div>

                <!-- System Prompt -->
                <div class="form-control flex flex-col justify-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">System Prompt</label>
                    <p class="text-xs text-base-content/50">Instructions for how the AI should behave</p>
                  </div>
                  <textarea id="systemPromptTextarea" class="textarea textarea-bordered w-full min-h-[80px] text-xs" rows="3"></textarea>
                  <button id="saveSystemPromptBtn" class="btn btn-primary btn-sm rounded-btn self-end">Save</button>
                </div>
              </div>

              <!-- General Settings -->
              <h3 class="text-base font-medium text-base-content mb-3">General</h3>
              <div class="divide-y divide-base-300">
                <!-- Language -->
                <div class="form-control flex flex-row xs:flex-row justify-between items-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">Language</label>
                    <p class="text-xs text-base-content/50">Select the language for the interface</p>
                  </div>
                  <div class="relative">
                    <button class="btn btn-ghost font-normal flex gap-1.5 items-center btn-xs h-7 min-h-0 rounded-btn hover:bg-base-300 text-base-content" id="languageBtn">
                      <span class="font-normal text-xs">English</span>
                      <i data-lucide="chevron-down" class="w-3 h-3 transition-transform"></i>
                    </button>
                  </div>
                </div>
                
                <!-- Theme -->
                <div class="form-control flex flex-row xs:flex-row justify-between items-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">Theme</label>
                    <p class="text-xs text-base-content/50">Choose between light, dark, and system themes</p>
                  </div>
                  <div class="dropdown dropdown-end">
                    <div tabindex="0" role="button" class="btn btn-ghost font-normal flex gap-1.5 items-center btn-xs h-7 min-h-0 rounded-btn hover:bg-base-300 text-base-content" id="themeBtn">
                      <span class="font-normal text-xs" id="currentTheme">${this.options.currentTheme}</span>
                      <i data-lucide="chevron-down" class="w-3 h-3 transition-transform"></i>
                    </div>
                    <ul tabindex="0" class="dropdown-content z-[101] menu p-2 shadow-lg bg-base-200 rounded-box w-40 border border-base-300 max-h-48 overflow-y-auto theme-dropdown-list">
                      ${this.options.themes.map(theme => `<li><a class="theme-option text-base-content hover:bg-base-300" data-theme="${theme}">${this.capitalizeFirst(theme)}</a></li>`).join('')}
                    </ul>
                  </div>
                </div>
                
                <!-- Time Format -->
                <div class="form-control flex flex-row xs:flex-row justify-between items-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">Time Format</label>
                    <p class="text-xs text-base-content/50">Select your preferred time format</p>
                  </div>
                  <div class="relative">
                    <button class="btn btn-ghost font-normal flex gap-1.5 items-center btn-xs h-7 min-h-0 rounded-btn hover:bg-base-300 text-base-content" id="timeFormatBtn">
                      <span class="font-normal text-xs">12-hour</span>
                      <i data-lucide="chevron-down" class="w-3 h-3 transition-transform"></i>
                    </button>
                  </div>
                </div>
                
                <!-- Date Format -->
                <div class="form-control flex flex-row xs:flex-row justify-between items-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">Date Format</label>
                    <p class="text-xs text-base-content/50">Select your preferred date format</p>
                  </div>
                  <div class="relative">
                    <button class="btn btn-ghost font-normal flex gap-1.5 items-center btn-xs h-7 min-h-0 rounded-btn hover:bg-base-300 text-base-content" id="dateFormatBtn">
                      <span class="font-normal text-xs">MM/DD/YYYY</span>
                      <i data-lucide="chevron-down" class="w-3 h-3 transition-transform"></i>
                    </button>
                  </div>
                </div>
                
                <!-- Timezone -->
                <div class="form-control flex flex-row xs:flex-row justify-between items-start py-2 border-b border-base-300 gap-2">
                  <div>
                    <label class="text-xs text-base-content/70 mb-0.5">Timezone</label>
                    <p class="text-xs text-base-content/50">Set your local timezone</p>
                  </div>
                  <select class="select select-bordered select-sm rounded-btn w-32 text-base-content hover:bg-base-300 focus:border-primary" id="timezoneSelect">
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Asia/Shanghai">Shanghai</option>
                  </select>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    
    // Cache DOM elements
    this.closeModal = container.querySelector('#closeModal');
    this.mobileMenuBtn = container.querySelector('#mobileMenuBtn');
    this.themeBtn = container.querySelector('#themeBtn');
    this.currentThemeSpan = container.querySelector('#currentTheme');
    this.languageBtn = container.querySelector('#languageBtn');
    this.timeFormatBtn = container.querySelector('#timeFormatBtn');
    this.dateFormatBtn = container.querySelector('#dateFormatBtn');
    this.timezoneSelect = container.querySelector('#timezoneSelect');
    this.themeOptions = container.querySelectorAll('.theme-option');
  }

  attachEvents() {
    // Close modal
    this.closeModal.addEventListener('click', () => {
      this.close();
    });

    // Close on backdrop click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element.querySelector('.fixed.inset-0')) {
        this.close();
      }
    });

    // API Key input and save button
    const apiKeyInput = this.element.querySelector('#apiKeyInput');
    const saveApiKeyBtn = this.element.querySelector('#saveApiKeyBtn');
    const apiKeyStatus = this.element.querySelector('#apiKeyStatus');

    // Load saved API key
    const savedApiKey = localStorage.getItem('openrouter_api_key') || '';
    if (apiKeyInput) {
      apiKeyInput.value = savedApiKey;
      this.apiKey = savedApiKey;
    }

    saveApiKeyBtn?.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (key) {
        localStorage.setItem('openrouter_api_key', key);
        this.apiKey = key;
        if (apiKeyStatus) {
          apiKeyStatus.textContent = '✓ API key saved';
          apiKeyStatus.className = 'text-xs mt-1 text-success';
        }
        this.options.onApiKeyChange?.(key);
        setTimeout(() => {
          if (apiKeyStatus) apiKeyStatus.textContent = '';
        }, 3000);
      }
    });

    // Model select
    const modelSelect = this.element.querySelector('#modelSelect');
    if (modelSelect) {
      this.loadModels(modelSelect);
      modelSelect.addEventListener('change', (e) => {
        this.selectedModel = e.target.value;
        this.options.onModelChange?.(e.target.value);
      });
    }

    // Thinking level select
    const thinkingLevelSelect = this.element.querySelector('#thinkingLevelSelect');
    if (thinkingLevelSelect) {
      thinkingLevelSelect.value = this.thinkingLevel;
      thinkingLevelSelect.addEventListener('change', (e) => {
        this.thinkingLevel = e.target.value;
        this.options.onThinkingLevelChange?.(e.target.value);
      });
    }

    // System prompt textarea
    const systemPromptTextarea = this.element.querySelector('#systemPromptTextarea');
    const saveSystemPromptBtn = this.element.querySelector('#saveSystemPromptBtn');
    if (systemPromptTextarea) {
      systemPromptTextarea.value = this.systemPrompt || 'You are a helpful AI assistant. Be concise but thorough.';
    }
    saveSystemPromptBtn?.addEventListener('click', () => {
      this.systemPrompt = systemPromptTextarea.value.trim();
      this.options.onSystemPromptChange?.(this.systemPrompt);
      if (apiKeyStatus) {
        apiKeyStatus.textContent = '✓ System prompt saved';
        apiKeyStatus.className = 'text-xs mt-1 text-success';
        setTimeout(() => {
          if (apiKeyStatus) apiKeyStatus.textContent = '';
        }, 3000);
      }
    });

    // Theme options
    this.themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const themeName = option.textContent.trim();
        const theme = option.dataset.theme;
        this.options.onThemeChange?.(theme, themeName);
        this.currentThemeSpan.textContent = themeName;
      });
    });

    // Language button (placeholder)
    this.languageBtn.addEventListener('click', () => {
      this.options.onLanguageChange?.('English');
    });

    // Time format button (placeholder)
    this.timeFormatBtn.addEventListener('click', () => {
      this.options.onTimeFormatChange?.('12-hour');
    });

    // Date format button (placeholder)
    this.dateFormatBtn.addEventListener('click', () => {
      this.options.onDateFormatChange?.('MM/DD/YYYY');
    });

    // Timezone select
    this.timezoneSelect.addEventListener('change', (e) => {
      this.options.onTimezoneChange?.(e.target.value);
    });
  }

  open() {
    this.isOpen = true;
    this.element.classList.remove('hidden');

    // Populate settings from localStorage
    const apiKey = localStorage.getItem('openrouter_api_key') || '';
    const apiKeyInput = this.element.querySelector('#apiKeyInput');
    if (apiKeyInput) {
      apiKeyInput.value = apiKey;
    }
  }

  close() {
    this.isOpen = false;
    this.element.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setCurrentTheme(themeName) {
    this.currentThemeSpan.textContent = themeName;
  }

  async loadModels(modelSelect) {
    try {
      const { getModels } = await import('../assets/js/x-agent-openrouter.min.js');
      const models = await getModels();
      this.models = models;

      if (models.length > 0) {
        modelSelect.innerHTML = '';

        // Group by provider
        const providers = {};
        for (const model of models) {
          const provider = model.id.split('/')[0] || 'other';
          if (!providers[provider]) {
            providers[provider] = [];
          }
          providers[provider].push(model);
        }

        // Popular models first
        const popularIds = [
          'anthropic/claude-sonnet-4',
          'anthropic/claude-3-5-sonnet',
          'openai/gpt-4o',
          'google/gemini-2.5-flash',
          'meta-llama/llama-3.1-405b-instruct',
          'mistralai/mistral-small-3.1-24b-instruct:free',
        ];

        const popularModels = models.filter(m => popularIds.includes(m.id));
        if (popularModels.length > 0) {
          const popularGroup = document.createElement('optgroup');
          popularGroup.label = '⭐ Popular';
          for (const model of popularModels) {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name || model.id;
            popularGroup.appendChild(option);
          }
          modelSelect.appendChild(popularGroup);
        }

        // Add other providers
        const sortedProviders = Object.keys(providers).sort();
        for (const provider of sortedProviders) {
          const providerModels = providers[provider].filter(m => !popularIds.includes(m.id));
          if (providerModels.length === 0) continue;

          const providerGroup = document.createElement('optgroup');
          providerGroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);
          for (const model of providerModels) {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name || model.id.split('/')[1] || model.id;
            providerGroup.appendChild(option);
          }
          modelSelect.appendChild(providerGroup);
        }

        // Restore selection
        if (this.selectedModel && models.some(m => m.id === this.selectedModel)) {
          modelSelect.value = this.selectedModel;
        } else if (popularModels.length > 0) {
          this.selectedModel = popularModels[0].id;
          modelSelect.value = this.selectedModel;
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      modelSelect.innerHTML = '<option value="">Failed to load models</option>';
    }
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  destroy() {
    this.element?.remove();
  }
}

// Export default for convenience
export default SettingsModal;
