/**
 * Sidebar Component
 * A modern, theme-aware sidebar with navigation, collapsible sections, and user profile.
 * Inspired by modern dashboard designs.
 * 
 * Usage:
 *   import { Sidebar } from './components/Sidebar.js';
 *   
 *   const sidebar = new Sidebar({
 *     container: document.body,
 *     logo: { src: '/logo.svg', alt: 'Logo', version: '1.0' },
 *     navigation: [
 *       { label: 'New Task', icon: 'plus', href: '/', active: true },
 *       { label: 'Explore', icon: 'compass', href: '/explore' },
 *       { label: 'Dashboard', icon: 'chart-no-axes-column-increasing', href: '/dashboard' },
 *       { label: 'Portfolio', icon: 'briefcase', href: '/portfolio' },
 *     ],
 *     user: {
 *       name: 'Ahmed Rana',
 *       avatar: 'https://example.com/avatar.jpg',
 *       plan: 'Enterprise',
 *       credits: 1479,
 *     },
 *     onNavigate: (item) => { console.log('Navigated to:', item); },
 *   });
 */

export class Sidebar {
  constructor(options = {}) {
    this.options = {
      container: null,
      logo: null,
      navigation: [],
      user: null,
      onNavigate: null,
      onCollapse: null,
      width: 'w-52 sm:w-56',
      ...options,
    };

    this.isCollapsed = false;
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
    container.className = 'hidden lg:block sticky top-0 self-start h-screen';
    
    container.innerHTML = `
      <aside class="sidebar bg-base-100 border-base-300 z-[55] flex h-screen flex-col overflow-hidden border-e shadow-md transition-all duration-300 ease-in-out ${this.options.width}" dir="ltr">
        <div class="flex h-full min-h-0 flex-col transition-all duration-300">
          <!-- Header with Logo -->
          <div class="relative flex flex-shrink-0 items-center justify-between gap-1 px-2 py-2">
            <div class="flex cursor-pointer items-center">
              ${this.options.logo ? `
                <img alt="${this.options.logo.alt || 'Logo'}" src="${this.options.logo.src}" class="h-7 m-4 ms-3">
              ` : `
                <div class="h-7 w-7 m-4 ms-3 rounded-box bg-primary flex items-center justify-center">
                  <i data-lucide="zap" class="w-4 h-4 text-white"></i>
                </div>
              `}
              ${this.options.logo?.version ? `
                <span class="text-base-content/40 self-end px-1 py-0.5 text-[10px]">${this.options.logo.version}</span>
              ` : ''}
            </div>
            <button id="collapseSidebar" class="hover:bg-base-200 flex cursor-pointer rounded-lg p-1 transition-colors">
              <i data-lucide="chevron-left" class="lucide-chevron-left w-4 h-4 text-base-content/60"></i>
            </button>
          </div>

          <!-- Navigation Menu -->
          <div class="scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <ul class="menu w-full mb-5 gap-2 px-1">
              ${this.options.navigation.map((item, index) => `
                <li>
                  <a href="${item.href || '#'}" 
                     class="group flex items-center rounded-lg px-2 py-2 transition-colors justify-start ${item.active ? 'active bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content inactive'}"
                     data-index="${index}">
                    ${this.renderIcon(item.icon || 'circle', item.active)}
                    <span class="text-sm ms-2">${item.label}</span>
                  </a>
                </li>
              `).join('')}
            </ul>

            ${this.options.tasksSection ? `
            <div class="w-full px-1">
              <ul class="w-full gap-1">
                <li>
                  <details open="">
                    <summary class="text-base-content/50 flex cursor-pointer items-center rounded-lg px-2 py-1.5 text-sm transition-colors ltr:justify-between rtl:justify-between leading-normal">
                      <div class="flex w-full items-center gap-1.5">
                        <span>All Tasks</span>
                        <span class="badge badge-xs badge-primary flex-shrink-0 border-none ltr:ms-auto rtl:me-auto">${this.options.tasksSection.taskCount || 0}</span>
                      </div>
                    </summary>
                    <div class="py-1 pe-2 ps-2">
                      <div class="relative">
                        <input type="text" id="taskSearch" class="input input-bordered input-xs w-full pe-6 text-sm h-6" placeholder="Search tasks">
                        <i data-lucide="search" class="lucide-search text-base-content/40 absolute end-1.5 top-1/2 h-3 w-3 -translate-y-1/2"></i>
                      </div>
                    </div>
                    <div class="mt-0.5 space-y-0.5 overflow-y-auto pt-2" id="tasksList">
                      ${this.options.tasksSection.tasks ? this.options.tasksSection.tasks.map(task => `
                        <div class="relative group flex items-center gap-1.5 rounded-md px-2 py-2 text-sm transition-colors cursor-pointer text-base-content/80 hover:bg-base-200 hover:text-base-content">
                          <i data-lucide="folder" class="lucide-folder h-3 w-3 text-warning shrink-0"></i>
                          <span class="truncate flex-1">${task.name}</span>
                        </div>
                      `).join('') : ''}
                    </div>
                  </details>
                </li>
              </ul>
            </div>
            ` : ''}
          </div>

          <!-- User Profile Footer -->
          ${this.options.user ? `
          <footer class="border-t border-base-300 flex-shrink-0">
            <div class="relative">
              <div class="flex items-center gap-2 px-2 py-2 hover:bg-base-200/60 transition-colors cursor-pointer relative group">
                <div class="relative flex items-center justify-center h-7 w-7 rounded-full bg-primary/20 flex-shrink-0">
                  ${this.options.user.avatar ? `
                    <img alt="" class="h-7 w-7 rounded-full object-cover" src="${this.options.user.avatar}">
                  ` : `
                    <span class="text-xs font-medium text-primary">${this.getInitials(this.options.user.name)}</span>
                  `}
                  ${this.options.user.online !== false ? `
                    <span class="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success border border-base-100"></span>
                  ` : ''}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-base-content truncate">${this.options.user.name}</div>
                  <div class="flex items-center gap-1.5 text-xs text-base-content/60 mt-0.5">
                    ${this.options.user.plan ? `
                      <span class="badge badge-primary badge-xs">${this.options.user.plan}</span>
                    ` : ''}
                    ${this.options.user.credits ? `
                      <span class="flex items-center gap-0.5">
                        <i data-lucide="zap" class="lucide-zap w-2.5 h-2.5"></i>
                        ${this.formatNumber(this.options.user.credits)}
                      </span>
                    ` : ''}
                  </div>
                </div>
                <i data-lucide="chevron-up" class="lucide-chevron-up w-4 h-4 text-base-content/50 transition-transform duration-200"></i>
              </div>
            </div>
          </footer>
          ` : ''}
        </div>
      </aside>
    `;

    this.options.container.appendChild(container);
    this.element = container;
    
    // Cache DOM elements
    this.collapseBtn = container.querySelector('#collapseSidebar');
    this.sidebar = container.querySelector('aside');
    this.navItems = container.querySelectorAll('.menu a');
    this.taskSearch = container.querySelector('#taskSearch');
  }

  renderIcon(iconName, isActive) {
    const iconClass = isActive 
      ? 'w-4 h-4 transition-colors text-primary' 
      : 'w-4 h-4 transition-colors text-base-content/60 group-hover:text-base-content';
    
    return `<i data-lucide="${iconName}" class="lucide-${iconName} ${iconClass}"></i>`;
  }

  attachEvents() {
    // Collapse sidebar
    this.collapseBtn?.addEventListener('click', () => {
      this.toggleCollapse();
    });

    // Navigation items
    this.navItems.forEach((item, index) => {
      item.addEventListener('click', (e) => {
        const navItem = this.options.navigation[index];
        if (navItem?.href === '#') {
          e.preventDefault();
        }
        this.setActiveItem(index);
        this.options.onNavigate?.(navItem, index);
      });
    });

    // Task search
    this.taskSearch?.addEventListener('input', (e) => {
      this.filterTasks(e.target.value);
    });
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.sidebar.classList.remove(this.options.width);
      this.sidebar.classList.add('w-0', 'opacity-0');
    } else {
      this.sidebar.classList.remove('w-0', 'opacity-0');
      this.sidebar.classList.add(this.options.width);
    }
    
    this.options.onCollapse?.(this.isCollapsed);
  }

  setActiveItem(index) {
    this.navItems.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active', 'bg-primary/10', 'text-primary');
        item.classList.remove('inactive', 'hover:bg-base-200', 'text-base-content');
      } else {
        item.classList.remove('active', 'bg-primary/10', 'text-primary');
        item.classList.add('inactive', 'hover:bg-base-200', 'text-base-content');
      }
    });
  }

  filterTasks(searchTerm) {
    const tasksList = this.element.querySelector('#tasksList');
    if (!tasksList) return;

    const tasks = tasksList.querySelectorAll('div');
    const term = searchTerm.toLowerCase();

    tasks.forEach(task => {
      const text = task.textContent.toLowerCase();
      task.style.display = text.includes(term) ? '' : 'none';
    });
  }

  getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  formatNumber(num) {
    return num.toLocaleString();
  }

  updateTasks(tasks) {
    const tasksList = this.element.querySelector('#tasksList');
    if (!tasksList) return;

    tasksList.innerHTML = tasks.map(task => `
      <div class="relative group flex items-center gap-1.5 rounded-md px-2 py-2 text-sm transition-colors cursor-pointer text-base-content/80 hover:bg-base-200 hover:text-base-content">
        <i data-lucide="folder" class="lucide-folder h-3 w-3 text-warning shrink-0"></i>
        <span class="truncate flex-1">${task.name}</span>
      </div>
    `).join('');

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateUser(user) {
    this.options.user = { ...this.options.user, ...user };
    // Re-render footer
    const footer = this.element.querySelector('footer');
    if (footer && this.options.user) {
      footer.outerHTML = `
        <footer class="border-t border-base-300 flex-shrink-0">
          <div class="relative">
            <div class="flex items-center gap-2 px-2 py-2 hover:bg-base-200/60 transition-colors cursor-pointer relative group">
              <div class="relative flex items-center justify-center h-7 w-7 rounded-full bg-primary/20 flex-shrink-0">
                ${this.options.user.avatar ? `
                  <img alt="" class="h-7 w-7 rounded-full object-cover" src="${this.options.user.avatar}">
                ` : `
                  <span class="text-xs font-medium text-primary">${this.getInitials(this.options.user.name)}</span>
                `}
                ${this.options.user.online !== false ? `
                  <span class="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success border border-base-100"></span>
                ` : ''}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-base-content truncate">${this.options.user.name}</div>
                <div class="flex items-center gap-1.5 text-xs text-base-content/60 mt-0.5">
                  ${this.options.user.plan ? `
                    <span class="badge badge-primary badge-xs">${this.options.user.plan}</span>
                  ` : ''}
                  ${this.options.user.credits ? `
                    <span class="flex items-center gap-0.5">
                      <i data-lucide="zap" class="lucide-zap w-2.5 h-2.5"></i>
                      ${this.formatNumber(this.options.user.credits)}
                    </span>
                  ` : ''}
                </div>
              </div>
              <i data-lucide="chevron-up" class="lucide-chevron-up w-4 h-4 text-base-content/50 transition-transform duration-200"></i>
            </div>
          </div>
        </footer>
      `;
      
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  destroy() {
    this.element?.remove();
  }
}

// Export default for convenience
export default Sidebar;
