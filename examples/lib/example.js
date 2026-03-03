/**
 * Example App Initialization
 * Demonstrates usage of all X-Agent UI components
 */

import { ChatInput } from '../components/ChatInput.js';
import { SettingsModal } from '../components/SettingsModal.js';
import { Sidebar } from '../components/Sidebar.js';
import { RightPanel } from '../components/RightPanel.js';
import { ChatMessages } from '../components/ChatMessages.js';

// Initialize Lucide icons
if (window.lucide) {
  window.lucide.createIcons();
}

// Initialize ChatMessages component
export const chatMessages = new ChatMessages({
  container: document.getElementById('chatMessagesContainer'),
  assistantName: 'Accelerator',
  messages: [
    {
      type: 'response',
      content: "I've carefully analyzed your request to build a comprehensive task management application.",
      items: [
        { type: 'badge', variant: 'success', icon: 'check', text: 'Analyzing project requirements' },
        { type: 'badge', variant: 'primary', icon: 'loader-2', text: 'Setting up React + TypeScript', animated: true },
      ],
    },
    {
      type: 'response',
      content: "I've designed a complete landing page with a modern aesthetic.",
      items: [
        { type: 'code', language: 'typescript', code: `interface HeroProps {\n  title: string;\n}` },
      ],
    },
    {
      type: 'response',
      content: "I've generated the complete project structure with all necessary files.",
      items: [
        { type: 'badge', variant: 'info', icon: 'file-code', text: 'src/components/Hero.tsx' },
        { type: 'badge', variant: 'info', icon: 'file-code', text: 'src/components/Navbar.tsx' },
        { type: 'badge', variant: 'warning', icon: 'file-type', text: 'tailwind.config.js' },
      ],
    },
    {
      type: 'response',
      content: "I encountered an issue during the build process.",
      items: [
        { type: 'alert', variant: 'error', title: 'Build Failed', message: 'Error: Module not found' },
        { type: 'badge', variant: 'primary', icon: 'package-plus', text: 'Installing react-router-dom', pulse: true },
      ],
    },
    {
      type: 'response',
      content: 'Let me analyze the requirements and determine the optimal architecture.',
      items: [
        {
          type: 'reasoning',
          title: 'Reasoning Process',
          steps: [
            { text: 'Evaluating data fetching strategy', loading: true },
            { text: 'Performance requirements assessed', icon: 'check-circle-2' },
          ],
        },
      ],
    },
    {
      type: 'response',
      content: 'Test suite completed successfully.',
      items: [
        {
          type: 'terminal',
          lines: [
            { text: '✓ PASS src/utils/format.test.ts', variant: 'text-success' },
            { text: '✓ PASS src/utils/date.test.ts', variant: 'text-success' },
            { text: '✓ PASS src/components/Button.test.tsx', variant: 'text-success' },
          ],
          footer: 'Tests: 12 passed, 0 failed',
        },
      ],
    },
    {
      type: 'response',
      content: "All tasks completed successfully!",
      items: [
        { type: 'badge', variant: 'success', icon: 'check-circle-2', text: 'Hero section completed' },
        { type: 'badge', variant: 'success', icon: 'check-circle-2', text: 'All tests passing' },
      ],
    },
  ],
});

// Initialize SettingsModal component
export const settingsModal = new SettingsModal({
  container: document.getElementById('settingsModalContainer'),
  currentTheme: 'Light',
  onThemeChange: (theme, themeName) => {
    document.documentElement.setAttribute('data-theme', theme);
    console.log('Theme changed:', themeName);
  },
  onLanguageChange: (lang) => {
    console.log('Language changed:', lang);
  },
  onTimeFormatChange: (format) => {
    console.log('Time format changed:', format);
  },
  onDateFormatChange: (format) => {
    console.log('Date format changed:', format);
  },
  onTimezoneChange: (timezone) => {
    console.log('Timezone changed:', timezone);
  },
});

// Initialize Sidebar component
export const sidebar = new Sidebar({
  container: document.getElementById('sidebarContainer'),
  logo: {
    icon: 'hexagon',
    alt: 'X-Agent',
    version: '1.0'
  },
  navigation: [
    { label: 'New Task', icon: 'plus', href: '#', active: true },
    { label: 'Explore', icon: 'compass', href: '#' },
    { label: 'Dashboard', icon: 'chart-no-axes-column-increasing', href: '#' },
    { label: 'Portfolio', icon: 'briefcase', href: '#' },
  ],
  tasksSection: {
    taskCount: 3,
    tasks: [
      { name: 'Project Alpha' },
      { name: 'Website Redesign' },
      { name: 'Mobile App' },
    ],
  },
  user: {
    name: 'User',
    avatar: null,
    plan: 'Pro',
    credits: 1479,
  },
  onNavigate: (item, index) => {
    console.log('Navigated to:', item.label);
  },
  onSettings: () => {
    settingsModal.open();
  },
});

// Initialize RightPanel component
export const rightPanel = new RightPanel({
  container: document.getElementById('rightPanelContainer'),
  title: 'Response Details',
  width: 400,
  minWidth: 250,
  maxWidth: 800,
  isOpen: true,
  onClose: () => {
    console.log('Right panel closed');
  },
  onOpen: () => {
    console.log('Right panel opened');
  },
  onResize: (width) => {
    console.log('Resized to:', width);
  },
});

// Wire up panel toggle button (in navbar)
document.getElementById('panelToggle')?.addEventListener('click', () => {
  rightPanel.open();
});

// Mobile menu button (placeholder for future mobile sidebar toggle)
document.getElementById('menuBtn')?.addEventListener('click', () => {
  console.log('Menu button clicked');
});

// Initialize ChatInput component
export const chatInput = new ChatInput({
  container: document.getElementById('chatInputContainer'),
  placeholder: 'Send message to Accelerator...',
  tasks: [
    { text: 'Analyze project requirements', status: 'completed' },
    { text: 'Set up React + TypeScript', status: 'completed' },
    { text: 'Deploy and present the landing page', status: 'active' },
  ],
  onSend: (message) => {
    console.log('Sent:', message);
    // Add your send logic here
  },
  onAttachment: () => {
    console.log('Attachment clicked');
  },
  onVoice: () => {
    console.log('Voice clicked');
  },
  onPlus: () => {
    console.log('Plus clicked');
  },
});

// Export all components for external access
export default {
  chatMessages,
  sidebar,
  rightPanel,
  chatInput,
  settingsModal,
};
