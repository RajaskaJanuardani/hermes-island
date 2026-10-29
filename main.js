const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, shell, clipboard, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn, execFileSync } = require('child_process');
const { AgentPlatform } = require('./agent-manager');

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(
      path.join(app.getPath('userData'), 'main-errors.log'),
      `[${new Date().toISOString()}] uncaughtException: ${err && (err.stack || err.message || err)}\n`
    );
  } catch (_e) {}
});

process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(
      path.join(app.getPath('userData'), 'main-errors.log'),
      `[${new Date().toISOString()}] unhandledRejection: ${reason && (reason.stack || reason.message || reason)}\n`
    );
  } catch (_e) {}
});

let mainWindow = null;
let tray = null;
let mediaProcess = null;
let agentPlatform = null;
let lastCpuInfo = os.cpus();
const lyricsCache = new Map();

const liveContext = {
  cpu: 0,
  ramPercent: 0,
  media: null
};

const WINDOW_WIDTH = 780;
const WINDOW_HEIGHT = 580;
let topOffset = 8;
let userSettings = {
  theme: 'island', // 'island' | 'notch'
  language: 'id', // 'id' | 'en'
  aiAvatar: 'hancow', // 'pipo' | 'wana' | 'hancow' | custom
  aiName: 'Hancow',
  aiEnabled: true,
  autoStart: true
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'user-settings.json');
}

function loadUserSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && (parsed.theme === 'island' || parsed.theme === 'notch')) {
        userSettings.theme = parsed.theme;
      }
      if (parsed && (parsed.language === 'id' || parsed.language === 'en')) {
        userSettings.language = parsed.language;
      }
      if (parsed && typeof parsed.aiAvatar === 'string' && parsed.aiAvatar.trim()) {
        userSettings.aiAvatar = parsed.aiAvatar.trim();
      }
      if (parsed && typeof parsed.aiName === 'string' && parsed.aiName.trim()) {
        userSettings.aiName = parsed.aiName.trim().slice(0, 28);
      }
      if (parsed && typeof parsed.aiEnabled === 'boolean') {
        userSettings.aiEnabled = parsed.aiEnabled;
      }
      if (parsed && typeof parsed.topOffset === 'number') {
        topOffset = parsed.topOffset;
      }
      if (parsed && typeof parsed.powerMode === 'string') {
        userSettings.powerMode = parsed.powerMode;
      }
      if (parsed && typeof parsed.visualMode === 'string') {
        userSettings.visualMode = parsed.visualMode;
      }
    }
  } catch (_e) {}
  userSettings.autoStart = isAutoStartEnabled();
  return userSettings;
}

function saveUserSettings() {
  try {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify(
        {
          theme: userSettings.theme,
          language: userSettings.language,
          aiAvatar: userSettings.aiAvatar,
          aiName: userSettings.aiName,
          aiEnabled: userSettings.aiEnabled !== false,
          powerMode: userSettings.powerMode || 'balanced',
          visualMode: userSettings.visualMode || 'standard',
          topOffset
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (_e) {}
}

function buildSettingsPayload() {
  return {
    theme: userSettings.theme,
    language: userSettings.language || 'id',
    aiAvatar: userSettings.aiAvatar,
    aiName: userSettings.aiName,
    aiEnabled: userSettings.aiEnabled !== false,
    powerMode: userSettings.powerMode || 'balanced',
    visualMode: userSettings.visualMode || 'standard',
    autoStart: isAutoStartEnabled()
  };
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function getCpuUsagePercent() {
  const currentCpus = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = lastCpuInfo[i] ? lastCpuInfo[i].times : currentCpus[i].times;
    const curr = currentCpus[i].times;

    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;

    idleDiff += curr.idle - prev.idle;
    totalDiff += currTotal - prevTotal;
  }

  lastCpuInfo = currentCpus;
  if (totalDiff <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100)));
}

function getTargetDisplay() {
  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint) || screen.getPrimaryDisplay();
}

function positionWindowAtTopCenter(targetDisplay) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const display = targetDisplay || getTargetDisplay();
  const { x: dispX, y: dispY, width: screenWidth } = display.bounds;
  const x = Math.round(dispX + (screenWidth - WINDOW_WIDTH) / 2);
  const effectiveOffset = userSettings.theme === 'notch' ? 0 : topOffset;
  const y = dispY + effectiveOffset;
  mainWindow.setBounds({
    x,
    y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT
  });
}

function createTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);
  for (let y = 4; y < 12; y++) {
    for (let x = 1; x < 15; x++) {
      const idx = (y * size + x) * 4;
      buf[idx] = 128;     // B
      buf[idx + 1] = 222; // G
      buf[idx + 2] = 74;  // R (#4ade80)
      buf[idx + 3] = 255; // A
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function applyThemeChoice(theme) {
  userSettings.theme = theme === 'notch' ? 'notch' : 'island';
  saveUserSettings();
  positionWindowAtTopCenter();
  rebuildTrayMenu();
  sendToRenderer('settings-updated', buildSettingsPayload());
}

function rebuildTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Dynamic Island · Multi-Agent OS',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Tema: Dynamic Island (Mengambang)',
      type: 'radio',
      checked: userSettings.theme === 'island',
      click: () => applyThemeChoice('island')
    },
    {
      label: 'Tema: Poni / Notch (Menempel Atas)',
      type: 'radio',
      checked: userSettings.theme === 'notch',
      click: () => applyThemeChoice('notch')
    },
    { type: 'separator' },
    {
      label: 'Posisi Island: Mengambang (8px)',
      type: 'radio',
      enabled: userSettings.theme === 'island',
      checked: topOffset === 8,
      click: () => {
        topOffset = 8;
        saveUserSettings();
        positionWindowAtTopCenter();
      }
    },
    {
      label: 'Posisi Island: Dekat Atas (2px)',
      type: 'radio',
      enabled: userSettings.theme === 'island',
      checked: topOffset === 2,
      click: () => {
        topOffset = 2;
        saveUserSettings();
        positionWindowAtTopCenter();
      }
    },
    { type: 'separator' },
    {
      label: 'Jalankan otomatis saat Windows menyala',
      type: 'checkbox',
      checked: isAutoStartEnabled(),
      click: (item) => {
        setAutoStart(item.checked);
        sendToRenderer('settings-updated', buildSettingsPayload());
      }
    },
    { type: 'separator' },
    {
      label: 'Reset Posisi Tengah',
      click: () => positionWindowAtTopCenter()
    },
    {
      label: 'Keluar (Quit)',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  const image = createTrayIcon();
  tray = new Tray(image);
  tray.setToolTip('Windows Dynamic Island · Agent Platform');
  rebuildTrayMenu();
}

function runMediaBridgeAction(action, value = '') {
  const valStr = value !== undefined && value !== null ? String(value) : '';
  const jsonActions = ['listWhatsAppChats', 'sendWhatsApp', 'takeScreenshot'];

  if (!jsonActions.includes(action) && mediaProcess && mediaProcess.stdin && !mediaProcess.stdin.destroyed) {
    try {
      mediaProcess.stdin.write(`${action}|${valStr}\n`);
      return Promise.resolve({ ok: true });
    } catch (_e) {}
  }

  const scriptPath = path.join(__dirname, 'media-bridge.ps1');
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', action];
  if (valStr !== '') {
    args.push('-Value', valStr);
  }

  return new Promise((resolve) => {
    let out = '';
    const proc = spawn('powershell.exe', args, { windowsHide: true });
    if (proc.stdout) {
      proc.stdout.on('data', (d) => { out += d.toString('utf8'); });
    }
    proc.on('close', () => {
      const trimmed = out.trim();
      const lastBrace = trimmed.split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
      if (lastBrace) {
        try {
          return resolve(JSON.parse(lastBrace.trim()));
        } catch (_e) {}
      }
      resolve({ ok: true, raw: trimmed });
    });
    proc.on('error', (err) => resolve({ ok: false, error: err.message }));
  });
}

function resolveWhatsAppBodyFromGatewayLog(sender) {
  const needle = String(sender || '').trim().toLowerCase();
  if (!needle) return '';
  try {
    const gwLogPath = path.join(process.env.LOCALAPPDATA || '', 'hermes', 'logs', 'gateway.log');
    if (!fs.existsSync(gwLogPath)) return '';
    const stat = fs.statSync(gwLogPath);
    const readSize = Math.min(stat.size, 24576);
    if (readSize <= 0) return '';
    const fd = fs.openSync(gwLogPath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const ln = lines[i];
      const m = ln.match(/inbound message:\s*platform=whatsapp\s+user=(.+?)\s+chat=\S+\s+msg='(.*)'\s+reply_to_id=/i);
      if (m) {
        const usr = String(m[1] || '').trim();
        const msg = String(m[2] || '').trim();
        const usrLow = usr.toLowerCase();
        if (msg && !/^(message|pesan)$/i.test(msg)) {
          if (usrLow === needle || usrLow.includes(needle) || needle.includes(usrLow)) {
            return msg;
          }
        }
      }
    }
  } catch (_e) {}
  return '';
}

function startMediaBridge() {
  const scriptPath = path.join(__dirname, 'media-bridge.ps1');
  mediaProcess = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', 'loop'],
    { windowsHide: true }
  );
  mediaProcess.on('error', () => {});
  if (mediaProcess.stdin) {
    mediaProcess.stdin.on('error', () => {});
  }

  let buffer = '';
  mediaProcess.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.type === 'osd') {
          sendToRenderer('osd-update', parsed);
        } else if (parsed && parsed.type === 'thermal') {
          liveContext.cpuTemp = parsed.cpuTemp;
          liveContext.gpuTemp = parsed.gpuTemp;
          liveContext.gpuLoad = parsed.gpuLoad;
          liveContext.cpuName = parsed.cpuName;
          liveContext.gpuName = parsed.gpuName;
        } else if (parsed && parsed.type === 'device') {
          sendToRenderer('device-update', parsed);
        } else if (parsed && parsed.type === 'systemModeUpdate') {
          if (parsed.powerMode) userSettings.powerMode = parsed.powerMode;
          if (parsed.visualMode) userSettings.visualMode = parsed.visualMode;
          saveUserSettings();
          sendToRenderer('system-mode-update', parsed);
        } else if (parsed && (parsed.type === 'notification' || parsed.type === 'callEnded')) {
          const isWa = /whatsapp/i.test(`${parsed.appName || ''} ${parsed.aumid || ''}`);
          const isGenericBody = !parsed.body || /^(message|pesan|new\s+message|pesan\s+baru|\d+\s+(unread\s+)?messages?|\d+\s+pesan.*)$/i.test(String(parsed.body).trim());
          if (parsed.type === 'notification' && isWa && !parsed.isCall && isGenericBody) {
            const resolved = resolveWhatsAppBodyFromGatewayLog(parsed.title);
            if (resolved) {
              parsed.body = resolved;
            } else {
              [400, 1000, 2000].forEach((delayMs) => {
                setTimeout(() => {
                  const lateResolved = resolveWhatsAppBodyFromGatewayLog(parsed.title);
                  if (lateResolved) {
                    sendToRenderer('notification-update', { ...parsed, body: lateResolved });
                  }
                }, delayMs);
              });
            }
          }
          sendToRenderer('notification-update', parsed);
        } else {
          liveContext.media = parsed.hasMedia ? { title: parsed.title, artist: parsed.artist, status: parsed.status } : null;
          sendToRenderer('media-update', parsed);
        }
      } catch (_err) {}
    }
  });

  mediaProcess.on('exit', () => {
    if (!app.isQuitting) {
      setTimeout(startMediaBridge, 2000);
    }
  });
}

function startSystemPoller() {
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cpu = getCpuUsagePercent();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);
    const usedGb = (usedMem / (1024 ** 3)).toFixed(1);
    const totalGb = (totalMem / (1024 ** 3)).toFixed(0);
    const uptimeHours = (os.uptime() / 3600).toFixed(1);

    liveContext.cpu = cpu;
    liveContext.ramPercent = ramPercent;

    sendToRenderer('system-update', {
      cpu,
      ramPercent,
      usedGb,
      totalGb,
      uptimeHours,
      cpuTemp: liveContext.cpuTemp ?? null,
      gpuTemp: liveContext.gpuTemp ?? null,
      gpuLoad: liveContext.gpuLoad ?? 0,
      cpuName: liveContext.cpuName || 'CPU',
      gpuName: liveContext.gpuName || 'GPU'
    });
  }, 1500);
}

function createWindow() {
  const display = getTargetDisplay();
  const { x: dispX, y: dispY, width: screenWidth } = display.bounds;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: Math.round(dispX + (screenWidth - WINDOW_WIDTH) / 2),
    y: dispY + (userSettings.theme === 'notch' ? 0 : topOffset),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.blur();
    }
  });

  mainWindow.webContents.on('render-process-gone', () => {
    if (!app.isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 600);
    }
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 3) {
      try {
        fs.appendFileSync(
          path.join(app.getPath('userData'), 'renderer-errors.log'),
          `[${new Date().toISOString()}] L${level} ${sourceId}:${line} -> ${message}\n`
        );
      } catch (_e) {}
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    positionWindowAtTopCenter();
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    try {
      fs.writeFileSync(
        path.join(__dirname, 'status.log'),
        JSON.stringify({
          status: 'shown',
          bounds: mainWindow.getBounds(),
          isVisible: mainWindow.isVisible(),
          display: getTargetDisplay().bounds
        })
      );
    } catch (_e) {}
  });

  screen.on('display-metrics-changed', () => {
    positionWindowAtTopCenter();
  });
}

// ==================== CORE ISLAND & MEDIA IPC ====================

ipcMain.on('set-ignore-mouse-events', (_event, ignore) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (ignore) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('focus-island-window', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.focus();
});

ipcMain.handle('get-settings', async () => {
  return buildSettingsPayload();
});

ipcMain.handle('set-theme', async (_event, theme) => {
  applyThemeChoice(theme);
  return buildSettingsPayload();
});

ipcMain.handle('set-autostart', async (_event, enabled) => {
  setAutoStart(Boolean(enabled));
  rebuildTrayMenu();
  const payload = buildSettingsPayload();
  sendToRenderer('settings-updated', payload);
  return payload;
});

ipcMain.handle('set-ai-profile', async (_event, profile) => {
  if (profile && typeof profile === 'object') {
    if (typeof profile.aiAvatar === 'string' && profile.aiAvatar.trim()) {
      userSettings.aiAvatar = profile.aiAvatar.trim();
    }
    if (typeof profile.aiName === 'string' && profile.aiName.trim()) {
      userSettings.aiName = profile.aiName.trim().slice(0, 28);
    }
    saveUserSettings();
  }
  const payload = buildSettingsPayload();
  sendToRenderer('settings-updated', payload);
  return payload;
});

ipcMain.handle('set-ai-enabled', async (_event, enabled) => {
  userSettings.aiEnabled = Boolean(enabled);
  saveUserSettings();
  if (!userSettings.aiEnabled && global.gc) {
    try { global.gc(); } catch (_e) {}
  }
  const payload = buildSettingsPayload();
  sendToRenderer('settings-updated', payload);
  return payload;
});

ipcMain.handle('media-command', async (_event, action, value) => {
  if (!['playPause', 'next', 'prev', 'seek', 'shuffle', 'repeat', 'setVolume', 'toggleMute', 'setBrightness', 'focusApp', 'acceptCall', 'declineCall', 'prepareReply', 'replyNotif', 'setPowerMode', 'setVisualMode', 'getSystemModes'].includes(action)) {
    return { ok: false };
  }
  return runMediaBridgeAction(action, value);
});

// ==================== LYRICS IPC ====================

function fetchHttpsJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'WindowsDynamicIsland/2.0 (https://github.com)'
        },
        timeout: 8000
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(e);
            }
          } else {
            resolve(null);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function cleanTrackQuery(str) {
  return String(str || '')
    .replace(/\((?:official|lyric|audio|video|visualizer|remaster|feat|ft)[^)]*\)/gi, '')
    .replace(/\[(?:official|lyric|audio|video|visualizer|remaster|feat|ft)[^\]]*\]/gi, '')
    .replace(/\s+-\s+(?:remastered|single|live|mono|stereo).*$/i, '')
    .trim();
}

ipcMain.handle('get-lyrics', async (_event, { title, artist, duration }) => {
  const rawTitle = String(title || '').trim();
  const rawArtist = String(artist || '').trim();
  if (!rawTitle) return { ok: false, error: 'Belum ada lagu yang diputar' };

  const cacheKey = `${rawTitle.toLowerCase()}|${rawArtist.toLowerCase()}`;
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey);
  }

  try {
    const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(rawTitle)}&artist_name=${encodeURIComponent(rawArtist)}`;
    const exact = await fetchHttpsJson(getUrl).catch(() => null);
    if (exact && (exact.syncedLyrics || exact.plainLyrics)) {
      const out = {
        ok: true,
        syncedLyrics: exact.syncedLyrics || '',
        plainLyrics: exact.plainLyrics || '',
        trackName: exact.trackName || rawTitle,
        artistName: exact.artistName || rawArtist
      };
      lyricsCache.set(cacheKey, out);
      return out;
    }

    const cleanedTitle = cleanTrackQuery(rawTitle) || rawTitle;
    const cleanedArtist = rawArtist.split(',')[0].trim();
    const queries = [`${cleanedArtist} ${cleanedTitle}`.trim(), cleanedTitle];

    for (const q of queries) {
      if (!q) continue;
      const list = await fetchHttpsJson(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`).catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        const withLyrics = list.filter((item) => item && (item.syncedLyrics || item.plainLyrics));
        if (withLyrics.length > 0) {
          withLyrics.sort((a, b) => {
            const aSynced = a.syncedLyrics ? 1 : 0;
            const bSynced = b.syncedLyrics ? 1 : 0;
            if (aSynced !== bSynced) return bSynced - aSynced;
            if (duration > 0 && a.duration && b.duration) {
              return Math.abs(a.duration - duration) - Math.abs(b.duration - duration);
            }
            return 0;
          });
          const best = withLyrics[0];
          const out = {
            ok: true,
            syncedLyrics: best.syncedLyrics || '',
            plainLyrics: best.plainLyrics || '',
            trackName: best.trackName || rawTitle,
            artistName: best.artistName || rawArtist
          };
          lyricsCache.set(cacheKey, out);
          return out;
        }
      }
    }

    return { ok: false, error: 'Lirik belum tersedia untuk lagu ini' };
  } catch (_err) {
    return { ok: false, error: 'Gagal memuat lirik (cek koneksi internet)' };
  }
});

// ==================== MULTI-AGENT PLATFORM & GATEWAY IPC ====================

function syncActiveAgentToUserSettings(agentDetail) {
  if (!agentDetail) return;
  userSettings.aiAvatar = agentDetail.avatar || 'hancow';
  userSettings.aiName = agentDetail.name || 'Hancow';
  saveUserSettings();
}

ipcMain.handle('agent:bootstrap', async () => {
  const agents = agentPlatform.listAgents();
  const state = agentPlatform.getPlatformState();
  const activeAgent = agentPlatform.getAgentDetail(state.activeAgentId) || agentPlatform.getAgentDetail('hancow');
  syncActiveAgentToUserSettings(activeAgent);
  const connectors = await agentPlatform.getConnectorsStatus();
  const skills = agentPlatform.discoverSkills();
  const cronjobs = agentPlatform.listCronjobs();
  const gateway = agentPlatform.getGatewayConfig();
  const activities = agentPlatform.listActivities({
    agentId: activeAgent ? activeAgent.id : 'hancow',
    scope: 'agent'
  });

  return {
    ok: true,
    agents,
    activeAgent,
    proactiveEnabled: state.proactiveEnabled !== false,
    connectors,
    skills,
    cronjobs,
    activities,
    gateway,
    settings: buildSettingsPayload()
  };
});

ipcMain.handle('agent:select', async (_event, agentId) => {
  const res = agentPlatform.setActiveAgent(agentId);
  if (res.ok && res.agent) {
    syncActiveAgentToUserSettings(res.agent);
  }
  return res;
});

ipcMain.handle('agent:get-detail', async (_event, agentId) => {
  const detail = agentPlatform.getAgentDetail(agentId);
  return detail ? { ok: true, agent: detail } : { ok: false, error: 'Agent tidak ditemukan' };
});

ipcMain.handle('agent:save', async (_event, payload) => {
  const res = agentPlatform.saveAgent(payload || {});
  if (res.ok && res.agent && res.agent.id === agentPlatform.getPlatformState().activeAgentId) {
    syncActiveAgentToUserSettings(res.agent);
  }
  return res;
});

ipcMain.handle('agent:delete', async (_event, agentId) => {
  const res = agentPlatform.deleteAgent(agentId);
  if (res.ok && res.activeAgent) {
    syncActiveAgentToUserSettings(res.activeAgent);
  }
  return res;
});

ipcMain.handle('agent:clear-history', async (_event, payload) => {
  if (typeof payload === 'string') {
    return agentPlatform.clearAgentHistory(payload);
  }
  return agentPlatform.clearAgentHistory(payload?.agentId, payload?.sessionId);
});

ipcMain.handle('agent:new-session', async (_event, agentId) => {
  return agentPlatform.createChatSession(agentId);
});

ipcMain.handle('agent:select-session', async (_event, { agentId, sessionId }) => {
  return agentPlatform.selectChatSession(agentId, sessionId);
});

ipcMain.handle('agent:delete-session', async (_event, { agentId, sessionId }) => {
  return agentPlatform.deleteChatSession(agentId, sessionId);
});

ipcMain.handle('agent:save-global-memory', async (_event, content) => {
  return agentPlatform.saveGlobalMemory(content);
});

ipcMain.handle('agent:import-avatar', async (_event, payload) => {
  return agentPlatform.importCustomAvatar(payload || {});
});

ipcMain.handle('agent:stage-attachment', async (_event, payload) => {
  return agentPlatform.stageAttachment(payload || {});
});

ipcMain.handle('agent:chat', async (_event, payload) => {
  return agentPlatform.chatWithAgent({
    agentId: payload?.agentId,
    sessionId: payload?.sessionId,
    userText: payload?.text || '',
    attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
    isBackgroundTask: false
  });
});

// Legacy fallback compatibility
ipcMain.handle('ask-hermes', async (_event, chatMessages) => {
  const lastMsg = Array.isArray(chatMessages) && chatMessages.length > 0
    ? chatMessages[chatMessages.length - 1].content
    : '';
  return agentPlatform.chatWithAgent({
    agentId: agentPlatform.getPlatformState().activeAgentId,
    userText: String(lastMsg || ''),
    attachments: []
  });
});

ipcMain.handle('agent:proactive-toggle', async (_event, enabled) => {
  const st = agentPlatform.savePlatformState({ proactiveEnabled: Boolean(enabled) });
  return { ok: true, proactiveEnabled: st.proactiveEnabled };
});

ipcMain.handle('agent:proactive-now', async (_event, agentId) => {
  return agentPlatform.runProactiveBriefingNow(agentId);
});

ipcMain.handle('agent:list-skills', async (_event, force) => {
  return { ok: true, skills: agentPlatform.discoverSkills(Boolean(force)) };
});

ipcMain.handle('agent:read-skill', async (_event, skillName) => {
  return agentPlatform.readSkillContent(skillName);
});

ipcMain.handle('agent:create-skill', async (_event, payload) => {
  return agentPlatform.createCustomSkill(payload || {});
});

ipcMain.handle('agent:get-connectors', async () => {
  return agentPlatform.getConnectorsStatus();
});

ipcMain.handle('agent:update-connector', async (_event, { id, patch }) => {
  return agentPlatform.updateConnector(id, patch || {});
});

ipcMain.handle('agent:test-connector', async (_event, { id, action, params }) => {
  if (action && action !== 'test') {
    return agentPlatform.executeConnector(id, action, params || {});
  }
  const testMap = {
    whatsapp: ['list', {}],
    github: ['status', {}],
    gmail: ['list', { unreadOnly: true }],
    google_calendar: ['list', {}],
    notion: ['search', { query: '' }],
    web_search: ['search', { query: 'OpenAI API' }],
    bsi_mybest: ['list', {}],
    telegram: ['list', {}]
  };
  const [act, prm] = testMap[id] || ['test', {}];
  return agentPlatform.executeConnector(id, act, prm);
});

ipcMain.handle('agent:list-crons', async () => {
  return { ok: true, jobs: agentPlatform.listCronjobs() };
});

ipcMain.handle('agent:create-cron', async (_event, payload) => {
  return agentPlatform.createCronjob(payload || {});
});

ipcMain.handle('agent:toggle-cron', async (_event, { id, enabled }) => {
  return agentPlatform.toggleCronjob(id, enabled);
});

ipcMain.handle('agent:delete-cron', async (_event, id) => {
  return agentPlatform.deleteCronjob(id);
});

ipcMain.handle('agent:run-cron-now', async (_event, id) => {
  return agentPlatform.runCronjobNow(id);
});

ipcMain.handle('agent:list-activities', async (_event, payload) => {
  return {
    ok: true,
    activities: agentPlatform.listActivities(payload || {})
  };
});

ipcMain.handle('agent:clear-activities', async (_event, agentId) => {
  return agentPlatform.clearActivities(agentId);
});

ipcMain.handle('agent:delete-activity', async (_event, payload) => {
  return agentPlatform.deleteActivity(payload?.agentId, payload?.activityId);
});

ipcMain.handle('gateway:get', async () => {
  return agentPlatform.getGatewayConfig();
});

ipcMain.handle('gateway:set', async (_event, cfg) => {
  return agentPlatform.setGatewayConfig(cfg || {});
});

ipcMain.handle('gateway:models', async (_event, override) => {
  return agentPlatform.fetchGatewayModels(override || null);
});

ipcMain.handle('gateway:test', async (_event, override) => {
  return agentPlatform.testGatewayConnection(override || null);
});

// ==================== SMART CLIPBOARD + DROP TRAY + QUICK COMMAND ====================

let clipboardHistory = [];
let lastSeenClipboardText = '';
let dropTrayItems = [];

function getClipboardStorePath() {
  return path.join(app.getPath('userData'), 'clipboard-history.json');
}

function getDropTrayStorePath() {
  return path.join(app.getPath('userData'), 'drop-tray.json');
}

function loadSmartHubStores() {
  try {
    const cp = getClipboardStorePath();
    if (fs.existsSync(cp)) {
      const parsed = JSON.parse(fs.readFileSync(cp, 'utf8'));
      if (Array.isArray(parsed)) clipboardHistory = parsed.slice(0, 25);
    }
  } catch (_e) {}
  try {
    const tp = getDropTrayStorePath();
    if (fs.existsSync(tp)) {
      const parsed = JSON.parse(fs.readFileSync(tp, 'utf8'));
      if (Array.isArray(parsed)) {
        dropTrayItems = parsed.filter((it) => it && it.filePath && fs.existsSync(it.filePath)).slice(0, 24);
      }
    }
  } catch (_e) {}
}

function saveClipboardStore() {
  try {
    fs.writeFileSync(getClipboardStorePath(), JSON.stringify(clipboardHistory, null, 2), 'utf8');
  } catch (_e) {}
}

function saveDropTrayStore() {
  try {
    fs.writeFileSync(getDropTrayStorePath(), JSON.stringify(dropTrayItems, null, 2), 'utf8');
  } catch (_e) {}
}

function startClipboardWatcher() {
  try {
    lastSeenClipboardText = (clipboard.readText() || '').trim();
  } catch (_e) {}

  setInterval(() => {
    try {
      const raw = clipboard.readText() || '';
      const trimmed = raw.trim();
      if (!trimmed || trimmed === lastSeenClipboardText || trimmed.length > 12000) return;
      lastSeenClipboardText = trimmed;

      const nowIso = new Date().toISOString();
      const existingIdx = clipboardHistory.findIndex((c) => c.text === trimmed);
      let pinned = false;
      if (existingIdx !== -1) {
        pinned = Boolean(clipboardHistory[existingIdx].pinned);
        clipboardHistory.splice(existingIdx, 1);
      }
      clipboardHistory.unshift({
        id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        text: trimmed,
        pinned,
        updatedAt: nowIso
      });

      const pinnedList = clipboardHistory.filter((c) => c.pinned);
      const unpinnedList = clipboardHistory.filter((c) => !c.pinned).slice(0, 20);
      clipboardHistory = [...pinnedList, ...unpinnedList];
      saveClipboardStore();
      sendToRenderer('clipboard-updated', { items: clipboardHistory, latest: clipboardHistory[0] });
    } catch (_e) {}
  }, 1200);
}

ipcMain.handle('clipboard:list', async () => {
  return { ok: true, items: clipboardHistory };
});

ipcMain.handle('clipboard:copy', async (_event, text) => {
  const str = String(text || '');
  if (!str) return { ok: false };
  lastSeenClipboardText = str.trim();
  clipboard.writeText(str);
  return { ok: true };
});

ipcMain.handle('clipboard:pin', async (_event, id) => {
  const item = clipboardHistory.find((c) => c.id === id);
  if (item) {
    item.pinned = !item.pinned;
    saveClipboardStore();
  }
  return { ok: true, items: clipboardHistory };
});

ipcMain.handle('clipboard:delete', async (_event, id) => {
  clipboardHistory = clipboardHistory.filter((c) => c.id !== id);
  saveClipboardStore();
  return { ok: true, items: clipboardHistory };
});

ipcMain.handle('clipboard:clear', async () => {
  clipboardHistory = clipboardHistory.filter((c) => c.pinned);
  saveClipboardStore();
  return { ok: true, items: clipboardHistory };
});

ipcMain.handle('clipboard:ai-transform', async (_event, { text, mode }) => {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, error: 'Teks kosong' };
  const sysPrompt =
    mode === 'translate'
      ? 'Kamu adalah penerjemah instan. Jika teks berbahasa Inggris/asing, terjemahkan ke Bahasa Indonesia yang natural. Jika teks berbahasa Indonesia, terjemahkan ke Bahasa Inggris yang natural. Berikan HANYA hasil terjemahannya tanpa pengantar.'
      : 'Kamu adalah asisten editor instan. Rapikan tata bahasa, ejaan, dan struktur teks berikut agar jelas, rapi, dan siap tempel (paste). Berikan HANYA hasil teks yang sudah dirapikan tanpa pengantar.';
  try {
    const res = await agentPlatform._rawChatCompletion({
      gateway: agentPlatform.getGatewayConfig(),
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: raw }
      ],
      timeoutMs: 35000
    });
    const out = String((res && res.content) || '').trim();
    if (!out) return { ok: false, error: (res && res.error) || 'Gagal memproses teks' };
    lastSeenClipboardText = out;
    clipboard.writeText(out);

    const nowIso = new Date().toISOString();
    clipboardHistory.unshift({
      id: `clip-${Date.now().toString(36)}`,
      text: out,
      pinned: false,
      updatedAt: nowIso
    });
    clipboardHistory = clipboardHistory.slice(0, 22);
    saveClipboardStore();
    sendToRenderer('clipboard-updated', { items: clipboardHistory });
    return { ok: true, resultText: out, items: clipboardHistory };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Drop Tray (File Shelf) Handlers
function buildTrayItemFromPath(filePath, displayName) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  const name = displayName || path.basename(filePath);
  const ext = path.extname(name).toLowerCase();
  const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(ext);
  let thumbDataUrl = '';
  if (isImage && stat.size <= 12 * 1024 * 1024) {
    try {
      const img = nativeImage.createFromPath(filePath);
      if (!img.isEmpty()) {
        const resized = img.resize({ width: 96 });
        thumbDataUrl = resized.toDataURL();
      }
    } catch (_e) {}
  }
  return {
    id: `tray-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    filePath,
    sizeBytes: stat.size,
    ext: ext.replace('.', '').toUpperCase() || 'FILE',
    isImage,
    thumbDataUrl,
    addedAt: new Date().toISOString()
  };
}

ipcMain.handle('tray:list', async () => {
  dropTrayItems = dropTrayItems.filter((it) => it && it.filePath && fs.existsSync(it.filePath));
  return { ok: true, items: dropTrayItems };
});

ipcMain.handle('tray:add', async (_event, payload) => {
  try {
    let targetPath = payload && payload.filePath;
    const origName = (payload && payload.fileName) || (targetPath ? path.basename(targetPath) : `tray-${Date.now()}.png`);
    if ((!targetPath || !fs.existsSync(targetPath)) && payload && payload.base64Data) {
      const trayDir = path.join(app.getPath('userData'), 'tray-files');
      fs.mkdirSync(trayDir, { recursive: true });
      const safeName = origName.replace(/[^a-zA-Z0-9._-]/g, '_');
      targetPath = path.join(trayDir, `${Date.now()}_${safeName}`);
      const rawB64 = String(payload.base64Data).replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(targetPath, Buffer.from(rawB64, 'base64'));
    }
    if (!targetPath || !fs.existsSync(targetPath)) {
      return { ok: false, error: 'File tidak ditemukan' };
    }
    dropTrayItems = dropTrayItems.filter((it) => it.filePath !== targetPath);
    const item = buildTrayItemFromPath(targetPath, origName);
    if (item) {
      dropTrayItems.unshift(item);
      dropTrayItems = dropTrayItems.slice(0, 24);
      saveDropTrayStore();
    }
    return { ok: true, items: dropTrayItems, added: item };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tray:remove', async (_event, id) => {
  dropTrayItems = dropTrayItems.filter((it) => it.id !== id);
  saveDropTrayStore();
  return { ok: true, items: dropTrayItems };
});

ipcMain.handle('tray:clear', async () => {
  dropTrayItems = [];
  saveDropTrayStore();
  return { ok: true, items: dropTrayItems };
});

ipcMain.handle('tray:reveal', async (_event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('tray:convert-image', async (_event, id) => {
  const item = dropTrayItems.find((it) => it.id === id);
  if (!item || !item.filePath || !fs.existsSync(item.filePath)) {
    return { ok: false, error: 'File tidak ditemukan' };
  }
  try {
    const img = nativeImage.createFromPath(item.filePath);
    if (img.isEmpty()) return { ok: false, error: 'Bukan gambar yang didukung' };
    const jpgBuf = img.toJPEG(80);
    const parsed = path.parse(item.filePath);
    const outPath = path.join(parsed.dir, `${parsed.name}-compressed.jpg`);
    fs.writeFileSync(outPath, jpgBuf);
    const newItem = buildTrayItemFromPath(outPath, `${parsed.name}-compressed.jpg`);
    if (newItem) {
      dropTrayItems = dropTrayItems.filter((it) => it.filePath !== outPath);
      dropTrayItems.unshift(newItem);
      saveDropTrayStore();
    }
    return { ok: true, items: dropTrayItems, converted: newItem };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.on('tray:start-drag', (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;
    let dragIcon = createTrayIcon();
    if (/\.(png|jpe?g|webp|bmp)$/i.test(filePath)) {
      const loaded = nativeImage.createFromPath(filePath);
      if (!loaded.isEmpty()) {
        dragIcon = loaded.resize({ width: 48 });
      }
    }
    event.sender.startDrag({
      file: filePath,
      icon: dragIcon
    });
  } catch (_e) {}
});

// ==================== AUTOSTART & LIFECYCLE ====================

const AUTOSTART_REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const AUTOSTART_REG_NAME = 'Windows Dynamic Island';

function isAutoStartEnabled() {
  try {
    execFileSync('reg.exe', ['query', AUTOSTART_REG_KEY, '/v', AUTOSTART_REG_NAME], {
      windowsHide: true,
      stdio: 'ignore'
    });
    return true;
  } catch (_e) {
    return false;
  }
}

function setAutoStart(enabled) {
  try {
    if (enabled) {
      const cmdValue = `"${process.execPath}" "${app.getAppPath()}"`;
      execFileSync(
        'reg.exe',
        ['add', AUTOSTART_REG_KEY, '/v', AUTOSTART_REG_NAME, '/t', 'REG_SZ', '/d', cmdValue, '/f'],
        { windowsHide: true, stdio: 'ignore' }
      );
    } else {
      execFileSync(
        'reg.exe',
        ['delete', AUTOSTART_REG_KEY, '/v', AUTOSTART_REG_NAME, '/f'],
        { windowsHide: true, stdio: 'ignore' }
      );
    }
  } catch (_e) {}
  userSettings.autoStart = isAutoStartEnabled();
}

ipcMain.handle('set-language', (_event, lang) => {
  userSettings.language = lang === 'en' ? 'en' : 'id';
  saveUserSettings();
  sendToRenderer('settings-updated', buildSettingsPayload());
  return buildSettingsPayload();
});

function startCursorWatcher() {
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const b = mainWindow.getBounds();
    const relX = p.x - b.x;
    const relY = p.y - b.y;
    // Instant magnetic wake for OLE File Drag-and-Drop near the top center of the screen
    if (relX >= b.width / 2 - 195 && relX <= b.width / 2 + 195 && relY >= -12 && relY <= 68) {
      mainWindow.setIgnoreMouseEvents(false);
    }
    mainWindow.webContents.send('cursor-pos', { x: relX, y: relY });
  }, 45);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.commandLine.appendSwitch('js-flags', '--expose-gc');

app.whenReady().then(() => {
  const flagPath = path.join(app.getPath('userData'), 'autostart-initialized');
  if (!fs.existsSync(flagPath)) {
    setAutoStart(true);
    try { fs.writeFileSync(flagPath, '1'); } catch (_e) {}
  }

  loadUserSettings();
  loadSmartHubStores();

  agentPlatform = new AgentPlatform({
    userDataDir: app.getPath('userData'),
    appDir: __dirname,
    sendToRenderer,
    runMediaBridgeAction,
    getLiveContext: () => liveContext,
    openExternalUrl: (targetUrl) => shell.openExternal(targetUrl)
  });

  const activeAgent = agentPlatform.getAgentDetail(agentPlatform.getPlatformState().activeAgentId);
  if (activeAgent) {
    syncActiveAgentToUserSettings(activeAgent);
  }

  createWindow();
  createTray();
  startMediaBridge();
  startSystemPoller();
  startCursorWatcher();
  startClipboardWatcher();
  agentPlatform.startBackgroundEngines();

  try {
    globalShortcut.register('Alt+Space', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.focus();
        sendToRenderer('quick-command-toggle', {});
      }
    });
  } catch (_e) {}
});

app.on('before-quit', () => {
  app.isQuitting = true;
  try {
    globalShortcut.unregisterAll();
  } catch (_e) {}
  if (agentPlatform) {
    agentPlatform.stopBackgroundEngines();
  }
  if (mediaProcess) {
    try {
      mediaProcess.kill();
    } catch (_e) {}
  }
});
