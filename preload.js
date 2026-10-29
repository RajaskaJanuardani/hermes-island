const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('islandAPI', {
  onMediaUpdate: (callback) => {
    ipcRenderer.on('media-update', (_event, data) => callback(data));
  },
  onOsdUpdate: (callback) => {
    ipcRenderer.on('osd-update', (_event, data) => callback(data));
  },
  onNotification: (callback) => {
    ipcRenderer.on('notification-update', (_event, data) => callback(data));
  },
  onSystemUpdate: (callback) => {
    ipcRenderer.on('system-update', (_event, data) => callback(data));
  },
  onCursorPos: (callback) => {
    ipcRenderer.on('cursor-pos', (_event, data) => callback(data));
  },
  sendMediaCommand: (action, value) => {
    return ipcRenderer.invoke('media-command', action, value);
  },
  getLyrics: (meta) => {
    return ipcRenderer.invoke('get-lyrics', meta);
  },
  setMousePassthrough: (ignore) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  focusWindow: () => {
    ipcRenderer.send('focus-island-window');
  },
  askHermes: (messages) => {
    return ipcRenderer.invoke('ask-hermes', messages);
  },
  getSettings: () => {
    return ipcRenderer.invoke('get-settings');
  },
  setTheme: (theme) => {
    return ipcRenderer.invoke('set-theme', theme);
  },
  setLanguage: (lang) => {
    return ipcRenderer.invoke('set-language', lang);
  },
  onDeviceUpdate: (callback) => {
    ipcRenderer.on('device-update', (_event, data) => callback(data));
  },
  onSystemModeUpdate: (callback) => {
    ipcRenderer.on('system-mode-update', (_event, data) => callback(data));
  },
  setAutoStart: (enabled) => {
    return ipcRenderer.invoke('set-autostart', enabled);
  },
  setAiProfile: (profile) => {
    return ipcRenderer.invoke('set-ai-profile', profile);
  },
  setAiEnabled: (enabled) => {
    return ipcRenderer.invoke('set-ai-enabled', enabled);
  },
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (_event, data) => callback(data));
  },

  // File helper for Electron 33+
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (_e) {
      return (file && file.path) || '';
    }
  },

  // Multi-Agent Platform APIs
  bootstrapAgents: () => ipcRenderer.invoke('agent:bootstrap'),
  selectAgent: (agentId) => ipcRenderer.invoke('agent:select', agentId),
  getAgentDetail: (agentId) => ipcRenderer.invoke('agent:get-detail', agentId),
  saveAgent: (payload) => ipcRenderer.invoke('agent:save', payload),
  deleteAgent: (agentId) => ipcRenderer.invoke('agent:delete', agentId),
  clearAgentHistory: (agentId, sessionId) => ipcRenderer.invoke('agent:clear-history', { agentId, sessionId }),
  createChatSession: (agentId) => ipcRenderer.invoke('agent:new-session', agentId),
  selectChatSession: (agentId, sessionId) => ipcRenderer.invoke('agent:select-session', { agentId, sessionId }),
  deleteChatSession: (agentId, sessionId) => ipcRenderer.invoke('agent:delete-session', { agentId, sessionId }),
  saveGlobalMemory: (content) => ipcRenderer.invoke('agent:save-global-memory', content),
  importCustomAvatar: (payload) => ipcRenderer.invoke('agent:import-avatar', payload),
  stageAttachment: (payload) => ipcRenderer.invoke('agent:stage-attachment', payload),
  chatWithAgent: (payload) => ipcRenderer.invoke('agent:chat', payload),
  toggleProactive: (enabled) => ipcRenderer.invoke('agent:proactive-toggle', enabled),
  runProactiveNow: (agentId) => ipcRenderer.invoke('agent:proactive-now', agentId),

  // Skills APIs
  listSkills: (force) => ipcRenderer.invoke('agent:list-skills', force),
  readSkill: (skillName) => ipcRenderer.invoke('agent:read-skill', skillName),
  createSkill: (payload) => ipcRenderer.invoke('agent:create-skill', payload),

  // Connectors APIs
  getConnectors: () => ipcRenderer.invoke('agent:get-connectors'),
  updateConnector: (id, patch) => ipcRenderer.invoke('agent:update-connector', { id, patch }),
  testConnector: (id, action, params) => ipcRenderer.invoke('agent:test-connector', { id, action, params }),

  // Cronjobs APIs
  listCrons: () => ipcRenderer.invoke('agent:list-crons'),
  createCron: (payload) => ipcRenderer.invoke('agent:create-cron', payload),
  toggleCron: (id, enabled) => ipcRenderer.invoke('agent:toggle-cron', { id, enabled }),
  deleteCron: (id) => ipcRenderer.invoke('agent:delete-cron', id),
  runCronNow: (id) => ipcRenderer.invoke('agent:run-cron-now', id),

  // Activity Log APIs
  listActivities: (payload) => ipcRenderer.invoke('agent:list-activities', payload),
  clearActivities: (agentId) => ipcRenderer.invoke('agent:clear-activities', agentId),
  deleteActivity: (agentId, activityId) => ipcRenderer.invoke('agent:delete-activity', { agentId, activityId }),

  // AI Gateway & Model APIs
  getGateway: () => ipcRenderer.invoke('gateway:get'),
  setGateway: (cfg) => ipcRenderer.invoke('gateway:set', cfg),
  fetchGatewayModels: (override) => ipcRenderer.invoke('gateway:models', override),
  testGateway: (override) => ipcRenderer.invoke('gateway:test', override),

  // Real-time Agent Events
  onAgentStep: (cb) => ipcRenderer.on('agent-step', (_e, data) => cb(data)),
  onActivityUpdated: (cb) => ipcRenderer.on('activity-updated', (_e, data) => cb(data)),
  onCronUpdated: (cb) => ipcRenderer.on('cron-updated', (_e, data) => cb(data)),
  onConnectorsUpdated: (cb) => ipcRenderer.on('connectors-updated', (_e, data) => cb(data)),
  onProactiveMessage: (cb) => ipcRenderer.on('proactive-message', (_e, data) => cb(data)),
  onMemoryUpdated: (cb) => ipcRenderer.on('memory-updated', (_e, data) => cb(data)),

  // Smart Hub: Clipboard, Drop Tray & Quick Command (Alt+Space)
  listClipboard: () => ipcRenderer.invoke('clipboard:list'),
  copyClipboard: (text) => ipcRenderer.invoke('clipboard:copy', text),
  pinClipboard: (id) => ipcRenderer.invoke('clipboard:pin', id),
  deleteClipboard: (id) => ipcRenderer.invoke('clipboard:delete', id),
  clearClipboard: () => ipcRenderer.invoke('clipboard:clear'),
  aiTransformClipboard: (payload) => ipcRenderer.invoke('clipboard:ai-transform', payload),
  onClipboardUpdated: (cb) => ipcRenderer.on('clipboard-updated', (_e, data) => cb(data)),

  listTray: () => ipcRenderer.invoke('tray:list'),
  addTrayItem: (payload) => ipcRenderer.invoke('tray:add', payload),
  removeTrayItem: (id) => ipcRenderer.invoke('tray:remove', id),
  clearTray: () => ipcRenderer.invoke('tray:clear'),
  revealTrayFile: (filePath) => ipcRenderer.invoke('tray:reveal', filePath),
  convertTrayImage: (id) => ipcRenderer.invoke('tray:convert-image', id),
  startTrayDrag: (filePath) => ipcRenderer.send('tray:start-drag', filePath),

  onQuickCommandToggle: (cb) => ipcRenderer.on('quick-command-toggle', (_e, data) => cb(data))
});
