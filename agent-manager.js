const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn, execFile } = require('child_process');

const GATEWAY_PRESETS = {
  '9router': {
    label: '9router (Default)',
    baseUrl: 'http://127.0.0.1:20128/v1',
    defaultModel: 'claude-fable-5'
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o'
  },
  groq: {
    label: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile'
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.7-sonnet'
  },
  ollama: {
    label: 'Ollama (Local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5-coder:7b'
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash'
  },
  custom: {
    label: 'Custom OpenAI Gateway',
    baseUrl: 'http://127.0.0.1:20128/v1',
    defaultModel: 'claude-fable-5'
  }
};

function readEnvFileVars(filePath) {
  const out = {};
  try {
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const k = trimmed.slice(0, eq).trim();
          const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
          out[k] = v;
        }
      }
    }
  } catch (_e) {}
  return out;
}

function getHermesEnv() {
  const homeEnv = readEnvFileVars(path.join(os.homedir(), '.hermes', '.env'));
  const localEnv = readEnvFileVars(path.join(os.homedir(), 'AppData', 'Local', 'hermes', '.env'));
  return { ...localEnv, ...homeEnv };
}

function safeReadText(filePath, fallback = '') {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (_e) {}
  return fallback;
}

function safeWriteText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(content ?? ''), 'utf8');
}

function safeReadJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (_e) {}
  return fallback;
}

function safeWriteJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

function execPromise(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const timeoutMs = opts.timeoutMs || 30000;
    let stdout = '';
    let stderr = '';
    let finished = false;

    let proc;
    try {
      proc = spawn(cmd, args, {
        cwd: opts.cwd || os.homedir(),
        env: { ...process.env, ...(opts.env || {}) },
        windowsHide: true
      });
    } catch (err) {
      return resolve({ ok: false, exitCode: -1, stdout: '', stderr: err.message });
    }

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { proc.kill(); } catch (_e) {}
        resolve({
          ok: false,
          exitCode: -1,
          stdout: stdout.slice(0, 24000),
          stderr: `${stderr}\n[Timeout setelah ${Math.round(timeoutMs / 1000)} detik]`.trim()
        });
      }
    }, timeoutMs);

    if (proc.stdout) {
      proc.stdout.on('data', (d) => {
        if (stdout.length < 64000) stdout += d.toString('utf8');
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (d) => {
        if (stderr.length < 32000) stderr += d.toString('utf8');
      });
    }
    proc.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok: false, exitCode: -1, stdout, stderr: err.message });
    });
    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        exitCode: typeof code === 'number' ? code : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function httpRequestRaw(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch (err) {
      return reject(new Error(`URL tidak valid: ${urlStr}`));
    }
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyStr = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    const headers = { ...(options.headers || {}) };
    if (bodyStr && !headers['Content-Length']) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = lib.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers,
        timeout: options.timeoutMs || 60000
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (raw.length < 512000) raw += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: raw
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function parseCronField(field, min, max) {
  const f = String(field || '*').trim();
  if (f === '*') return null; // matches all
  const allowed = new Set();
  for (const part of f.split(',')) {
    const stepParts = part.split('/');
    const rangeStr = stepParts[0];
    const step = stepParts[1] ? Math.max(1, parseInt(stepParts[1], 10)) : 1;
    let start = min;
    let end = max;
    if (rangeStr !== '*') {
      if (rangeStr.includes('-')) {
        const [a, b] = rangeStr.split('-').map((n) => parseInt(n, 10));
        start = Number.isFinite(a) ? a : min;
        end = Number.isFinite(b) ? b : max;
      } else {
        const single = parseInt(rangeStr, 10);
        if (Number.isFinite(single)) {
          start = single;
          end = stepParts[1] ? max : single;
        }
      }
    }
    for (let v = start; v <= end; v += step) {
      allowed.add(v);
    }
  }
  return allowed;
}

function isCronDueNow(scheduleStr, lastRunAtIso, createdAtIso, nowDate = new Date()) {
  const raw = String(scheduleStr || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const lastMs = lastRunAtIso ? new Date(lastRunAtIso).getTime() : 0;
  const baseMs = lastMs || (createdAtIso ? new Date(createdAtIso).getTime() : 0) || 0;
  const nowMs = nowDate.getTime();

  // 1. Interval: "every 5m", "every 2h", "setiap 30 menit", "setiap 1 jam", "30m"
  const intMatch = lower.match(/^(?:every|setiap|tiap)?\s*(\d+)\s*(s|sec|detik|m|min|menit|h|hr|hour|jam|d|day|hari)$/);
  if (intMatch) {
    const val = Math.max(1, parseInt(intMatch[1], 10));
    const unit = intMatch[2];
    const mult =
      unit.startsWith('s') || unit.startsWith('det') ? 1000 :
      unit.startsWith('h') || unit.startsWith('jam') ? 3600000 :
      unit.startsWith('d') || unit.startsWith('har') ? 86400000 :
      60000;
    const intervalMs = Math.max(30000, val * mult);
    return nowMs - baseMs >= intervalMs;
  }

  // 2. Daily at HH:MM: "daily 08:00", "jam 07:30", "08:00"
  const dailyMatch = lower.match(/^(?:daily|harian|setiap\s+hari|jam|pukul)?\s*(\d{1,2})[:.](\d{2})$/);
  if (dailyMatch) {
    const hh = parseInt(dailyMatch[1], 10);
    const mm = parseInt(dailyMatch[2], 10);
    if (nowDate.getHours() === hh && nowDate.getMinutes() === mm) {
      if (!lastMs) return true;
      return nowMs - lastMs >= 65000;
    }
    return false;
  }

  // 3. One-shot relative: "in 10m", "dalam 15 menit"
  const onceMatch = lower.match(/^(?:in|dalam)\s+(\d+)\s*(m|min|menit|h|jam|s|detik)$/);
  if (onceMatch) {
    if (lastMs > 0) return false;
    const val = Math.max(1, parseInt(onceMatch[1], 10));
    const unit = onceMatch[2];
    const mult = unit.startsWith('s') || unit.startsWith('det') ? 1000 : unit.startsWith('h') || unit.startsWith('jam') ? 3600000 : 60000;
    return nowMs - baseMs >= val * mult;
  }

  // 4. Standard 5-field cron: "*/15 * * * *" or "0 8 * * 1-5"
  const parts = raw.split(/\s+/);
  if (parts.length === 5) {
    if (lastMs && nowMs - lastMs < 61000) return false;
    const minSet = parseCronField(parts[0], 0, 59);
    const hourSet = parseCronField(parts[1], 0, 23);
    const domSet = parseCronField(parts[2], 1, 31);
    const monSet = parseCronField(parts[3], 1, 12);
    const dowSet = parseCronField(parts[4], 0, 7);

    const curMin = nowDate.getMinutes();
    const curHour = nowDate.getHours();
    const curDom = nowDate.getDate();
    const curMon = nowDate.getMonth() + 1;
    const curDow = nowDate.getDay();

    if (minSet && !minSet.has(curMin)) return false;
    if (hourSet && !hourSet.has(curHour)) return false;
    if (domSet && !domSet.has(curDom)) return false;
    if (monSet && !monSet.has(curMon)) return false;
    if (dowSet && !dowSet.has(curDow) && !(curDow === 0 && dowSet.has(7))) return false;
    return true;
  }

  return false;
}

class AgentPlatform {
  constructor({ userDataDir, appDir, sendToRenderer, runMediaBridgeAction, getLiveContext, openExternalUrl }) {
    this.userDataDir = userDataDir;
    this.appDir = appDir;
    this.baseDir = path.join(userDataDir, 'agent-platform');
    this.agentsDir = path.join(this.baseDir, 'agents');
    this.uploadsDir = path.join(this.baseDir, 'uploads');
    this.customAvatarsDir = path.join(this.baseDir, 'avatars');
    this.customSkillsDir = path.join(this.baseDir, 'skills');
    this.globalMemoryPath = path.join(this.baseDir, 'global-memory.md');
    this.gatewayPath = path.join(this.baseDir, 'gateway.json');
    this.connectorsPath = path.join(this.baseDir, 'connectors.json');
    this.cronjobsPath = path.join(this.baseDir, 'cronjobs.json');
    this.platformStatePath = path.join(this.baseDir, 'state.json');

    this.sendToRenderer = sendToRenderer;
    this.runMediaBridgeAction = runMediaBridgeAction;
    this.getLiveContext = getLiveContext;
    this.openExternalUrl = openExternalUrl;

    this.skillsCache = null;
    this.skillsCacheAt = 0;
    this.runningCronIds = new Set();
    this.activeOAuthProcs = new Map();
    this.proactiveCooldowns = new Map();
    this.highCpuStreak = 0;
    this.highRamStreak = 0;
    this.lastSeenGhNotifId = '';
    this.lastSeenWaSnapshot = '';
    this.cronTimer = null;
    this.proactiveTimer = null;
    this.telegramTimer = null;
    this.isPollingTelegram = false;
    this.tgLastUpdateId = null;

    this._initStorage();
  }

  async _openBrowserUrl(targetUrl) {
    const clean = String(targetUrl || '').trim();
    if (!/^https?:\/\//i.test(clean)) return false;
    if (typeof this.openExternalUrl === 'function') {
      try {
        await this.openExternalUrl(clean);
        return true;
      } catch (_e) {}
    }
    await execPromise('explorer.exe', [clean], { timeoutMs: 5000 }).catch(() => {});
    return true;
  }

  _initStorage() {
    fs.mkdirSync(this.agentsDir, { recursive: true });
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    fs.mkdirSync(this.customAvatarsDir, { recursive: true });
    fs.mkdirSync(this.customSkillsDir, { recursive: true });

    const hermesEnv = getHermesEnv();

    // 1. Gateway config (default to Groq / Ollama / OpenAI)
    if (!fs.existsSync(this.gatewayPath)) {
      safeWriteJson(this.gatewayPath, {
        provider: hermesEnv.OPENAI_BASE_URL ? 'custom' : 'groq',
        baseUrl: hermesEnv.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1',
        apiKey: hermesEnv.OPENAI_API_KEY || hermesEnv.GROQ_API_KEY || '',
        model: hermesEnv.OPENAI_MODEL || 'llama-3.3-70b-versatile'
      });
    }

    // 2. Global Memory (seeded from Hermes MEMORY.md + USER.md on first run if available)
    if (!fs.existsSync(this.globalMemoryPath)) {
      const hermesMem = safeReadText(path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'memories', 'MEMORY.md'), '').trim();
      const hermesUser = safeReadText(path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'memories', 'USER.md'), '').trim();
      const initialGlobal = [
        '# Memori Utama (Global Memory)',
        '- Pengguna berkomunikasi dalam Bahasa Indonesia santai, ringkas, dan to-the-point.',
        `- Direktori utama pengguna: ${os.homedir()}`,
        hermesUser ? `\n## Profil & Proyek Pengguna\n${hermesUser.replace(/§/g, '\n-')}` : '',
        hermesMem ? `\n## Catatan Sistem & Workflow\n${hermesMem.replace(/§/g, '\n-')}` : ''
      ].filter(Boolean).join('\n');
      safeWriteText(this.globalMemoryPath, initialGlobal);
    }

    // 3. Connectors config
    if (!fs.existsSync(this.connectorsPath)) {
      safeWriteJson(this.connectorsPath, {
        whatsapp: {
          enabled: true,
          autoProactive: true
        },
        github: {
          enabled: true,
          token: '',
          autoProactive: true
        },
        gmail: {
          enabled: true,
          email: '',
          appPassword: '',
          useHermesOAuth: true,
          autoProactive: true
        },
        google_calendar: {
          enabled: true,
          icalUrl: '',
          useHermesOAuth: true,
          autoProactive: true
        },
        notion: {
          enabled: Boolean(hermesEnv.NOTION_API_KEY),
          apiKey: hermesEnv.NOTION_API_KEY || '',
          autoProactive: false
        },
        web_search: {
          enabled: true,
          firecrawlApiKey: hermesEnv.FIRECRAWL_API_KEY || ''
        },
        bsi_mybest: {
          enabled: true,
          statePath: path.join(os.homedir(), '.hermes', 'bsi-monitor', 'state.json'),
          autoProactive: true
        },
        telegram: {
          enabled: false,
          botToken: '',
          chatId: ''
        }
      });
    }

    // 4. Seed 3 Distinct Built-In Agents (Hancow, Wana, Winnie)
    this._seedBuiltInAgents();

    // 5. Cronjobs store
    if (!fs.existsSync(this.cronjobsPath)) {
      safeWriteJson(this.cronjobsPath, {
        jobs: [
          {
            id: 'cron-morning-brief',
            name: 'Briefing Laptop & Konektor Pagi',
            agentId: 'wana',
            schedule: 'daily 08:00',
            prompt: 'Cek kesehatan laptop (baterai, RAM, disk C:), notifikasi GitHub terbaru, chat WhatsApp yang masuk, dan agenda/tugas BSI MyBest hari ini. Berikan rangkuman proaktif yang padat.',
            enabled: false,
            createdAt: new Date().toISOString(),
            lastRunAt: null,
            lastStatus: 'idle',
            lastResult: ''
          }
        ]
      });
    }

    // 6. Platform state (activeAgentId + proactiveEnabled)
    if (!fs.existsSync(this.platformStatePath)) {
      safeWriteJson(this.platformStatePath, {
        activeAgentId: 'hancow',
        proactiveEnabled: true
      });
    }
  }

  _seedBuiltInAgents() {
    const builtIns = [
      {
        id: 'hancow',
        config: {
          id: 'hancow',
          name: 'Hancow',
          role: 'Full-Access System, Terminal & Code Agent',
          avatar: 'hancow',
          builtIn: true,
          pinnedSkills: ['computer-use', 'github-repo-management', 'systematic-debugging']
        },
        identity: `# Identity: Hancow\n- **Nama**: Hancow\n- **Avatar**: Metal Cybernetic Operator\n- **Spesialisasi**: Eksekutor otonom ala Manus & Claude Code — menguasai Terminal PowerShell, Folder Manager penuh, Git/GitHub, otomasi script, dan optimasi sistem laptop.`,
        soul: `# Soul: Hancow\nKamu lugas, tajam, teknis, dan tanpa basa-basi. Saat pengguna meminta sesuatu di komputer, jangan cuma memberi saran — langsung eksekusi lewat tool terminal, folder manager, atau konektor, verifikasi hasilnya, lalu laporkan intinya dengan gaya santai ("bre") tanpa menggunakan emoji.`,
        instructions: `# Instruksi Operasional Hancow\n1. Gunakan akses penuh ke terminal (\`run_terminal\`) dan folder manager (\`list_directory\`, \`read_file\`, \`write_file\`, \`edit_file\`, \`search_files\`, \`manage_folder\`) untuk menyelesaikan tugas secara nyata di laptop pengguna.\n2. Sebelum mengubah file penting, baca isinya terlebih dahulu.\n3. Proaktif memberi tahu jika melihat beban CPU/RAM tinggi, ruang disk menipis, atau error pada script/repo.\n4. Jangan pernah menggunakan emoji di dalam balasan.`,
        memory: `# Memori Hancow\n- Bertanggung jawab atas eksekusi perintah terminal, manajemen folder/file, debugging proyek di C:\\Users\\Kingska\\dev, dan pemantauan performa sistem.`
      },
      {
        id: 'wana',
        config: {
          id: 'wana',
          name: 'Wana',
          role: 'Personal Cue, Connectors & Research Agent',
          avatar: 'wana',
          builtIn: true,
          pinnedSkills: ['google-workspace', 'notion', 'email-inbox-triage', 'last30days']
        },
        identity: `# Identity: Wana\n- **Nama**: Wana\n- **Avatar**: Pink Muse Assistant\n- **Spesialisasi**: Asisten personal cerdas ala Cue & Muse — menghubungkan WhatsApp, Gmail, Google Calendar, Notion, GitHub, BSI/MyBest E-Learning, serta riset web mendalam.`,
        soul: `# Soul: Wana\nKamu hangat, sigap, terorganisir, dan sangat peka terhadap jadwal serta pesan penting pengguna. Kamu merangkum informasi lintas aplikasi dengan rapi, jelas, dan langsung ke poin tindakan tanpa bertele-tele dan tanpa emoji.`,
        instructions: `# Instruksi Operasional Wana\n1. Utamakan pengecekan konektor (\`use_connector\`: WhatsApp, Gmail, Google Calendar, Notion, GitHub, BSI MyBest, Web Search) ketika pengguna menanyakan pesan, email, jadwal, catatan, atau tugas kuliah.\n2. Aturan BSI/MyBest: untuk pertanyaan seputar "tugas", cek \`bsi_mybest\` pada bagian \`Tugas Semua Matkul\` (Data Penugasan vs Data Nilai Tugas), jangan tertukar dengan \`Kuis/Ujian\`.\n3. Simpan hal penting tentang preferensi atau jadwal pengguna ke memori menggunakan \`memory_manager\`.\n4. Bantu buatkan cronjob otomatis (\`cron_manager\`) bila ada rutinitas berulang.`,
        memory: `# Memori Wana\n- Fokus pada sinkronisasi komunikasi (WhatsApp, Gmail), kalender, Notion, dan pemantauan tugas kuliah BSI/MyBest.`
      },
      {
        id: 'pipo',
        config: {
          id: 'pipo',
          name: 'Winnie',
          role: 'Fast Productivity, Media & Creative Agent',
          avatar: 'pipo',
          builtIn: true,
          pinnedSkills: ['antislop', 'antislop-copywriting', 'impeccable']
        },
        identity: `# Identity: Winnie\n- **Nama**: Winnie\n- **Avatar**: Green Pipo Companion\n- **Spesialisasi**: Asisten produktivitas kilat ala Groq Bot — kontrol media/musik/volume/brightness laptop, penulisan kreatif anti-slop, organisasi file cepat, dan pengingat harian.`,
        soul: `# Soul: Winnie\nKamu responsif, kreatif, ringkas, dan praktis. Jawaban pendek untuk pertanyaan pendek, eksekusi instan untuk kontrol laptop dan pembuatan konten berkualitas tinggi tanpa klise AI dan tanpa emoji.`,
        instructions: `# Instruksi Operasional Winnie\n1. Eksekusi kontrol cepat laptop (\`system_control\` untuk musik, volume, brightness, buka aplikasi/website, screenshot) dengan sigap.\n2. Saat diminta menulis copy, konten, atau merapikan dokumen, manfaatkan skill penulisan/desain di \`skill_manager\` agar hasilnya tajam dan natural.\n3. Rapikan folder Downloads/Desktop dengan \`list_directory\` dan \`manage_folder\` bila diminta.`,
        memory: `# Memori Winnie\n- Fokus pada kontrol harian desktop, musik/media, produktivitas cepat, dan penulisan kreatif.`
      }
    ];

    for (const item of builtIns) {
      const dir = path.join(this.agentsDir, item.id);
      fs.mkdirSync(dir, { recursive: true });
      const cfgPath = path.join(dir, 'config.json');
      if (!fs.existsSync(cfgPath)) safeWriteJson(cfgPath, item.config);
      const idPath = path.join(dir, 'identity.md');
      if (!fs.existsSync(idPath)) safeWriteText(idPath, item.identity);
      const soulPath = path.join(dir, 'soul.md');
      if (!fs.existsSync(soulPath)) safeWriteText(soulPath, item.soul);
      const instPath = path.join(dir, 'instructions.md');
      if (!fs.existsSync(instPath)) safeWriteText(instPath, item.instructions);
      const memPath = path.join(dir, 'memory.md');
      if (!fs.existsSync(memPath)) safeWriteText(memPath, item.memory);
      const histPath = path.join(dir, 'history.json');
      if (!fs.existsSync(histPath)) safeWriteJson(histPath, []);
    }
  }

  // ==================== PLATFORM STATE & GATEWAY ====================

  getPlatformState() {
    return safeReadJson(this.platformStatePath, {
      activeAgentId: 'hancow',
      proactiveEnabled: true
    });
  }

  savePlatformState(patch) {
    const cur = this.getPlatformState();
    const next = { ...cur, ...patch };
    safeWriteJson(this.platformStatePath, next);
    return next;
  }

  getGatewayConfig() {
    const hermesEnv = getHermesEnv();
    const cfg = safeReadJson(this.gatewayPath, {
      provider: hermesEnv.OPENAI_BASE_URL ? 'custom' : 'groq',
      baseUrl: hermesEnv.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey: hermesEnv.OPENAI_API_KEY || hermesEnv.GROQ_API_KEY || '',
      model: hermesEnv.OPENAI_MODEL || 'llama-3.3-70b-versatile'
    });
    return {
      provider: cfg.provider || 'groq',
      baseUrl: String(cfg.baseUrl || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
      apiKey: cfg.apiKey ?? '',
      model: cfg.model || 'llama-3.3-70b-versatile',
      presets: GATEWAY_PRESETS
    };
  }

  setGatewayConfig(input) {
    const cur = this.getGatewayConfig();
    const provider = input.provider && GATEWAY_PRESETS[input.provider] ? input.provider : cur.provider;
    let baseUrl = typeof input.baseUrl === 'string' && input.baseUrl.trim()
      ? input.baseUrl.trim().replace(/\/+$/, '')
      : GATEWAY_PRESETS[provider].baseUrl;
    const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : cur.apiKey;
    const model = typeof input.model === 'string' && input.model.trim()
      ? input.model.trim()
      : (cur.model || GATEWAY_PRESETS[provider].defaultModel);

    const saved = { provider, baseUrl, apiKey, model };
    safeWriteJson(this.gatewayPath, saved);
    return { ...saved, presets: GATEWAY_PRESETS };
  }

  async _getLocal9RouterModels() {
    const models = new Set(['claude-fable-5', '9router', 'claude-otonom-max', 'claude-s', 'ubsi']);
    try {
      const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '9router', 'db', 'data.sqlite');
      if (fs.existsSync(dbPath)) {
        const py = await execPromise(
          'python',
          [
            '-c',
            `import sqlite3, json; c = sqlite3.connect(r'${dbPath}'); rows = [r[0] for r in c.execute("SELECT name FROM combos").fetchall()]; print(json.dumps(rows))`
          ],
          { timeoutMs: 3500 }
        );
        if (py.ok && py.stdout.startsWith('[')) {
          for (const m of JSON.parse(py.stdout)) {
            if (m) models.add(String(m));
          }
        }
      }
      const cachePath = path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'provider_models_cache.json');
      if (fs.existsSync(cachePath)) {
        const parsed = safeReadJson(cachePath, {});
        for (const prov of Object.values(parsed)) {
          if (prov && Array.isArray(prov.models)) {
            prov.models.slice(0, 25).forEach((m) => models.add(String(m)));
          }
        }
      }
    } catch (_e) {}
    return Array.from(models);
  }

  async fetchGatewayModels(override = null) {
    const cfg = override ? { ...this.getGatewayConfig(), ...override } : this.getGatewayConfig();
    const baseUrl = String(cfg.baseUrl || '').replace(/\/+$/, '');
    const is9Router = /127\.0\.0\.1:20128|localhost:20128/i.test(baseUrl) || cfg.provider === '9router';

    const local9 = is9Router ? await this._getLocal9RouterModels() : [];
    try {
      const headers = { 'Accept': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
      const res = await httpRequestRaw(`${baseUrl}/models`, {
        method: 'GET',
        headers,
        timeoutMs: is9Router ? 3500 : 8000
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const parsed = JSON.parse(res.body);
        const list = Array.isArray(parsed.data)
          ? parsed.data.map((x) => x.id || x.name).filter(Boolean)
          : Array.isArray(parsed.models)
          ? parsed.models.map((x) => x.id || x.name || x).filter(Boolean)
          : [];
        const merged = Array.from(new Set([...local9, ...list]));
        return { ok: true, models: merged };
      }
    } catch (err) {
      if (local9.length > 0) {
        return { ok: true, models: local9, note: 'Loaded from local 9router combos' };
      }
      return { ok: false, models: [], error: err.message };
    }
    return { ok: local9.length > 0, models: local9 };
  }

  async testGatewayConnection(override = null) {
    const cfg = override ? { ...this.getGatewayConfig(), ...override } : this.getGatewayConfig();
    const t0 = Date.now();
    const res = await this._rawChatCompletion({
      gateway: cfg,
      messages: [{ role: 'user', content: 'Balas hanya dengan kata: OK' }],
      tools: null,
      timeoutMs: 18000
    });
    const ms = Date.now() - t0;
    if (res.ok) {
      return { ok: true, latencyMs: ms, model: res.model || cfg.model, sample: (res.content || 'OK').slice(0, 60) };
    }
    return { ok: false, latencyMs: ms, error: res.error || 'Gagal terhubung ke gateway' };
  }

  // ==================== AGENTS & MEMORIES CRUD ====================

  listAgents() {
    const state = this.getPlatformState();
    const order = ['hancow', 'wana', 'pipo'];
    const entries = fs.readdirSync(this.agentsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    const agents = [];

    for (const dirent of entries) {
      const id = dirent.name;
      const dir = path.join(this.agentsDir, id);
      const cfg = safeReadJson(path.join(dir, 'config.json'), null);
      if (!cfg) continue;
      agents.push({
        ...cfg,
        id,
        isActive: state.activeAgentId === id
      });
    }

    agents.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return String(a.name).localeCompare(String(b.name));
    });

    if (!agents.some((a) => a.id === state.activeAgentId) && agents[0]) {
      this.savePlatformState({ activeAgentId: agents[0].id });
      agents[0].isActive = true;
    }

    return agents;
  }

  _loadSessionsStore(agentId) {
    const dir = path.join(this.agentsDir, agentId);
    const sessPath = path.join(dir, 'sessions.json');
    let store = safeReadJson(sessPath, null);

    if (!store || !Array.isArray(store.sessions) || store.sessions.length === 0) {
      const legacyHistPath = path.join(dir, 'history.json');
      const legacyHist = safeReadJson(legacyHistPath, []);
      const nowIso = new Date().toISOString();
      const firstUser = Array.isArray(legacyHist) ? legacyHist.find((m) => m && m.role === 'user') : null;
      const derivedTitle = firstUser
        ? String(firstUser.displayText || firstUser.content || '').replace(/\s+/g, ' ').trim().slice(0, 42) || 'Percakapan Awal'
        : 'Chat Baru';
      const initialId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      store = {
        activeSessionId: initialId,
        sessions: [
          {
            id: initialId,
            title: derivedTitle,
            createdAt: nowIso,
            updatedAt: nowIso,
            messages: Array.isArray(legacyHist) ? legacyHist : []
          }
        ]
      };
      safeWriteJson(sessPath, store);
    }

    if (!store.sessions.some((s) => s.id === store.activeSessionId)) {
      store.activeSessionId = store.sessions[0].id;
      safeWriteJson(sessPath, store);
    }

    return store;
  }

  _saveSessionsStore(agentId, store) {
    store.sessions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    safeWriteJson(path.join(this.agentsDir, agentId, 'sessions.json'), store);
  }

  _deriveActivityTitle(rawPrompt, source = 'chat') {
    let text = String(rawPrompt || '').trim();
    const cronMatch = text.match(/^\[TUGAS TERJADWAL OTOMATIS:\s*"([^"]+)"\]/i);
    if (cronMatch && cronMatch[1]) {
      return cronMatch[1].trim().slice(0, 62);
    }
    const tgMatch = text.match(/^\[TELEGRAM REMOTE[^\]]*\]:\s*([\s\S]+)$/i);
    if (tgMatch && tgMatch[1]) {
      text = tgMatch[1].trim();
    }
    text = text
      .replace(/^\[LAMPIRAN[^\]]*\]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) {
      return source === 'proactive' ? 'Pemantauan Proaktif Laptop' : 'Eksekusi Tugas Agent';
    }
    const firstSentence = text.split(/(?<=[.!?])\s+|\r?\n/)[0] || text;
    return firstSentence.length > 58 ? `${firstSentence.slice(0, 56).trim()}...` : firstSentence;
  }

  _deriveActivitySubtitle(replyText, status, steps = []) {
    if (status === 'running') {
      const last = steps[steps.length - 1];
      return last ? `Sedang menjalankan: ${last.label || last.tool}` : 'Sedang memproses instruksi...';
    }
    const clean = String(replyText || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) {
      return status === 'error' ? 'Terhenti / gagal dieksekusi' : `Selesai (${steps.length} langkah dijalankan)`;
    }
    return clean.length > 105 ? `${clean.slice(0, 102).trim()}...` : clean;
  }

  _formatToolInputPreview(fnName, args = {}) {
    try {
      switch (fnName) {
        case 'run_terminal':
          return `Command: ${args.command || ''}${args.cwd ? `\nWorking Dir: ${args.cwd}` : ''}${args.shell ? `\nShell: ${args.shell}` : ''}`;
        case 'list_directory':
          return `Folder: ${args.dirPath || ''}`;
        case 'read_file':
          return `File: ${args.filePath || ''}${args.startLine ? ` (baris ${args.startLine}-${args.endLine || 'akhir'})` : ''}`;
        case 'write_file':
          return `File: ${args.filePath || ''}\nUkuran konten: ${String(args.content || '').length} karakter`;
        case 'edit_file':
          return `File: ${args.filePath || ''}\nTarget: ${String(args.oldText || '').slice(0, 260)}`;
        case 'search_files':
          return `Folder: ${args.rootPath || ''}\nQuery / Pattern: ${args.query || args.pattern || ''}`;
        case 'manage_folder':
          return `Aksi: ${args.action || ''}\nSource: ${args.sourcePath || ''}${args.destPath ? `\nDest: ${args.destPath}` : ''}`;
        case 'system_control':
          return `Aksi: ${args.action || ''}${args.value !== undefined ? `\nNilai: ${args.value}` : ''}`;
        case 'use_connector':
          return `Konektor: ${args.connector || ''}\nAksi: ${args.action || 'status'}${args.params ? `\nParameter: ${JSON.stringify(args.params, null, 2)}` : ''}`;
        case 'skill_manager':
          return `Aksi: ${args.action || ''}${args.query ? `\nSkill / Query: ${args.query}` : ''}`;
        case 'memory_manager':
          return `Scope: ${args.scope || 'agent'} · Aksi: ${args.action || 'read'}${args.content ? `\nIsi: ${String(args.content).slice(0, 400)}` : ''}`;
        case 'cron_manager':
          return `Aksi: ${args.action || ''}${args.name ? `\nNama: ${args.name}` : ''}${args.schedule ? `\nJadwal: ${args.schedule}` : ''}${args.prompt ? `\nPrompt: ${args.prompt}` : ''}`;
        default:
          return JSON.stringify(args, null, 2).slice(0, 1000);
      }
    } catch (_e) {
      return '';
    }
  }

  _formatToolOutputPreview(fnName, resultObj) {
    if (!resultObj || typeof resultObj !== 'object') return String(resultObj || '');
    try {
      if (resultObj.ok === false && resultObj.error) {
        return `Gagal: ${resultObj.error}${resultObj.stderr ? `\n${resultObj.stderr}` : ''}`.slice(0, 3200);
      }
      if (fnName === 'run_terminal') {
        const out = [
          `Exit Code: ${resultObj.exitCode ?? 0}`,
          resultObj.stdout ? `STDOUT:\n${resultObj.stdout}` : '',
          resultObj.stderr ? `STDERR:\n${resultObj.stderr}` : ''
        ].filter(Boolean).join('\n\n');
        return out.slice(0, 3200) || 'Perintah selesai tanpa output teks.';
      }
      if (fnName === 'read_file' && typeof resultObj.content === 'string') {
        return resultObj.content.slice(0, 3200);
      }
      if (fnName === 'list_directory' && Array.isArray(resultObj.items)) {
        const list = resultObj.items.slice(0, 40).map((it) => `${it.type === 'dir' ? '[DIR]' : '[FILE]'} ${it.name}`).join('\n');
        return `Total ${resultObj.items.length} item di ${resultObj.path || ''}:\n${list}`;
      }
      if (fnName === 'skill_manager' && resultObj.skill) {
        return `Skill "${resultObj.skill.name}" (${resultObj.skill.category}) dimuat.\nDeskripsi: ${resultObj.skill.description || ''}\n\n${String(resultObj.content || '').slice(0, 1800)}`;
      }
      if (typeof resultObj.summary === 'string' && resultObj.summary) {
        return `${resultObj.summary}\n\n${JSON.stringify(resultObj, null, 2)}`.slice(0, 3200);
      }
      if (typeof resultObj.output === 'string' && resultObj.output) {
        return resultObj.output.slice(0, 3200);
      }
      return JSON.stringify(resultObj, null, 2).slice(0, 3200);
    } catch (_e) {
      return 'Langkah selesai dieksekusi.';
    }
  }

  _loadActivitiesStore(agentId) {
    const targetId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const dir = path.join(this.agentsDir, targetId);
    const actPath = path.join(dir, 'activities.json');
    const existing = safeReadJson(actPath, null);
    if (existing && Array.isArray(existing.activities)) {
      return existing.activities;
    }

    // Backfill initial activity logs from existing chat sessions on first load
    const sessStore = this._loadSessionsStore(targetId);
    const seeded = [];
    let mutatedSessions = false;

    for (const sess of sessStore.sessions || []) {
      const msgs = Array.isArray(sess.messages) ? sess.messages : [];
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (!m) continue;
        if (m.role === 'user') {
          const next = msgs[i + 1] && msgs[i + 1].role === 'assistant' ? msgs[i + 1] : null;
          const rawPrompt = m.displayText || m.content || '';
          const isCron = /^\[TUGAS TERJADWAL/i.test(m.content || '');
          const source = isCron ? 'cron' : 'chat';
          const startedAt = m.at || (next && next.at) || sess.updatedAt || new Date().toISOString();
          const completedAt = (next && next.at) || startedAt;
          const actId = (next && next.activityId) || `act-${targetId}-${ seeded.length + 1 }-${new Date(startedAt).getTime().toString(36)}`;
          const rawTools = (next && Array.isArray(next.toolsUsed)) ? next.toolsUsed : [];
          const steps = rawTools.map((t, sIdx) => ({
            id: `step-${actId}-${sIdx + 1}`,
            tool: t.tool || 'tool',
            label: t.label || t.tool || 'Langkah eksekusi',
            detailTitle: t.detailTitle || t.label || t.tool || 'Langkah eksekusi',
            status: t.ok === false ? 'error' : 'done',
            argsPreview: t.argsPreview || `Tool: ${t.tool || 'eksekusi'}`,
            outputPreview: t.outputPreview || (t.ok === false ? 'Eksekusi langkah gagal.' : `Langkah "${t.label || t.tool}" berhasil dijalankan.`),
            durationMs: t.durationMs || 0,
            at: completedAt
          }));
          const summaryText = next ? String(next.content || '') : '';
          const hasErr = /^Gagal mengeksekusi|^Error:/i.test(summaryText);
          const status = next ? (hasErr ? 'error' : 'completed') : 'error';

          if (next && !next.activityId) {
            next.activityId = actId;
            mutatedSessions = true;
          }

          seeded.push({
            id: actId,
            agentId: targetId,
            sessionId: sess.id,
            source,
            title: this._deriveActivityTitle(rawPrompt, source),
            subtitle: this._deriveActivitySubtitle(summaryText, status, steps),
            prompt: rawPrompt,
            status,
            startedAt,
            completedAt,
            durationMs: Math.max(600, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
            steps,
            summary: summaryText || (status === 'error' ? 'Eksekusi terhenti sebelum selesai.' : 'Selesai.')
          });
          if (next) i++;
        } else if (m.role === 'assistant' && m.proactive) {
          const atIso = m.at || sess.updatedAt || new Date().toISOString();
          const actId = m.activityId || `act-pro-${targetId}-${seeded.length + 1}-${new Date(atIso).getTime().toString(36)}`;
          if (!m.activityId) {
            m.activityId = actId;
            mutatedSessions = true;
          }
          seeded.push({
            id: actId,
            agentId: targetId,
            sessionId: sess.id,
            source: 'proactive',
            title: 'Pemeriksaan Proaktif Otomatis',
            subtitle: this._deriveActivitySubtitle(m.content || '', 'completed', []),
            prompt: 'Monitor kesehatan sistem laptop & konektor aktif di latar belakang.',
            status: 'completed',
            startedAt: atIso,
            completedAt: atIso,
            durationMs: 950,
            steps: [
              {
                id: `step-${actId}-1`,
                tool: 'proactive_monitor',
                label: 'Cek kondisi sistem & konektor',
                detailTitle: 'Memeriksa metrik laptop & status konektor',
                status: 'done',
                argsPreview: 'Scope: CPU, RAM, Baterai, Disk C:, WhatsApp, GitHub',
                outputPreview: String(m.content || ''),
                durationMs: 950,
                at: atIso
              }
            ],
            summary: String(m.content || '')
          });
        }
      }
    }

    if (mutatedSessions) {
      this._saveSessionsStore(targetId, sessStore);
    }

    seeded.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
    const trimmed = seeded.slice(0, 120);
    safeWriteJson(actPath, { activities: trimmed });
    return trimmed;
  }

  _saveActivitiesStore(agentId, activities) {
    const targetId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const sorted = [...(Array.isArray(activities) ? activities : [])]
      .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
      .slice(0, 120);
    safeWriteJson(path.join(this.agentsDir, targetId, 'activities.json'), { activities: sorted });
    return sorted;
  }

  _upsertActivity(agentId, activityObj) {
    const list = this._loadActivitiesStore(agentId);
    const idx = list.findIndex((a) => a.id === activityObj.id);
    if (idx !== -1) {
      list[idx] = activityObj;
    } else {
      list.unshift(activityObj);
    }
    const saved = this._saveActivitiesStore(agentId, list);
    this.sendToRenderer('activity-updated', {
      agentId,
      activity: activityObj
    });
    return saved;
  }

  listActivities({ agentId, scope = 'agent' } = {}) {
    const agents = this.listAgents();
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    const enrich = (act) => {
      const ag = agentMap.get(act.agentId);
      return {
        ...act,
        agentName: ag ? ag.name : act.agentId,
        agentAvatar: ag ? ag.avatar : 'hancow'
      };
    };

    if (scope === 'all') {
      const merged = [];
      for (const ag of agents) {
        const list = this._loadActivitiesStore(ag.id);
        for (const item of list) merged.push(enrich(item));
      }
      merged.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
      return merged.slice(0, 160);
    }

    const targetId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    return this._loadActivitiesStore(targetId).map(enrich);
  }

  clearActivities(agentId) {
    const targetId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    this._saveActivitiesStore(targetId, []);
    this.sendToRenderer('activity-updated', { agentId: targetId, cleared: true });
    return { ok: true, activities: [] };
  }

  deleteActivity(agentId, activityId) {
    const targetId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const next = this._loadActivitiesStore(targetId).filter((a) => a.id !== activityId);
    const saved = this._saveActivitiesStore(targetId, next);
    this.sendToRenderer('activity-updated', { agentId: targetId });
    return { ok: true, activities: saved };
  }

  getAgentDetail(agentId) {
    const targetId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const dir = path.join(this.agentsDir, targetId);
    const cfg = safeReadJson(path.join(dir, 'config.json'), null);
    if (!cfg) return null;

    this._syncHermesMemoriesIntoGlobal();
    this._loadActivitiesStore(targetId);
    const store = this._loadSessionsStore(targetId);
    const activeSess = store.sessions.find((s) => s.id === store.activeSessionId) || store.sessions[0];

    return {
      ...cfg,
      id: targetId,
      instructions: safeReadText(path.join(dir, 'instructions.md'), ''),
      memory: safeReadText(path.join(dir, 'memory.md'), ''),
      soul: safeReadText(path.join(dir, 'soul.md'), ''),
      identity: safeReadText(path.join(dir, 'identity.md'), ''),
      globalMemory: safeReadText(this.globalMemoryPath, ''),
      activeSessionId: activeSess ? activeSess.id : '',
      sessions: store.sessions.map((s) => ({
        id: s.id,
        title: s.title || 'Chat Baru',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: Array.isArray(s.messages) ? s.messages.length : 0
      })),
      history: activeSess && Array.isArray(activeSess.messages) ? activeSess.messages : [],
      activities: this.listActivities({ agentId: targetId, scope: 'agent' })
    };
  }

  _getHermesMemoryPaths() {
    const localDir = path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'memories');
    const homeDir = path.join(os.homedir(), '.hermes', 'memories');
    const dir = fs.existsSync(localDir) ? localDir : (fs.existsSync(homeDir) ? homeDir : localDir);
    return {
      dir,
      memoryFile: path.join(dir, 'MEMORY.md'),
      userFile: path.join(dir, 'USER.md')
    };
  }

  _syncHermesMemoriesIntoGlobal() {
    try {
      const { memoryFile, userFile } = this._getHermesMemoryPaths();
      let globalTxt = safeReadText(this.globalMemoryPath, '');
      const normalizeKey = (s) => String(s || '').replace(/^[-*•§\s]+/, '').trim().toLowerCase();
      const existingSet = new Set(
        globalTxt
          .split(/\r?\n/)
          .map(normalizeKey)
          .filter((x) => x.length > 6)
      );

      const newEntries = [];
      for (const fPath of [userFile, memoryFile]) {
        if (!fs.existsSync(fPath)) continue;
        const raw = safeReadText(fPath, '').trim();
        if (!raw) continue;
        const chunks = raw.includes('§') ? raw.split('§') : raw.split(/\r?\n/);
        for (const chunk of chunks) {
          const clean = String(chunk || '').replace(/^[-*•\s]+/, '').trim();
          if (clean.length < 8 || clean.startsWith('#')) continue;
          const k = normalizeKey(clean);
          if (!existingSet.has(k)) {
            existingSet.add(k);
            newEntries.push(`- ${clean}`);
          }
        }
      }

      if (newEntries.length > 0) {
        globalTxt = `${globalTxt.trim()}\n${newEntries.join('\n')}\n`;
        safeWriteText(this.globalMemoryPath, globalTxt);
      }
    } catch (_e) {}
  }

  _appendFactToGlobalAndHermesMemory(factLine, category = 'memory') {
    const clean = String(factLine || '').replace(/^[-*•§\s]+/, '').trim();
    if (!clean || clean.length < 6) return null;

    const normalizeKey = (s) => String(s || '').replace(/^[-*•§\s]+/, '').trim().toLowerCase();
    const targetKey = normalizeKey(clean);

    // 1. Update Dynamic Island global-memory.md (deduplicated)
    const currentGlobal = safeReadText(this.globalMemoryPath, '');
    const globalKeys = new Set(
      currentGlobal.split(/\r?\n/).map(normalizeKey).filter(Boolean)
    );
    let updatedGlobal = currentGlobal;
    if (!globalKeys.has(targetKey)) {
      updatedGlobal = `${currentGlobal.trim()}\n- ${clean}\n`;
      safeWriteText(this.globalMemoryPath, updatedGlobal);
    }

    // 2. Sync two-way into Hermes MEMORY.md / USER.md so Hermes CLI & Dynamic Island share one brain
    try {
      const { dir, memoryFile, userFile } = this._getHermesMemoryPaths();
      if (fs.existsSync(dir)) {
        const hermesTarget = category === 'user' && fs.existsSync(userFile) ? userFile : memoryFile;
        const rawHermes = safeReadText(hermesTarget, '').trim();
        const usesSectionSep = rawHermes.includes('§');
        const hermesChunks = usesSectionSep ? rawHermes.split('§') : rawHermes.split(/\r?\n/);
        const hermesKeys = new Set(hermesChunks.map(normalizeKey).filter(Boolean));
        if (!hermesKeys.has(targetKey)) {
          const nextHermes = !rawHermes
            ? clean
            : usesSectionSep
            ? `${rawHermes}§${clean}`
            : `${rawHermes}\n- ${clean}`;
          safeWriteText(hermesTarget, nextHermes);
        }
      }
    } catch (_e) {}

    return updatedGlobal;
  }

  setActiveAgent(agentId) {
    const detail = this.getAgentDetail(agentId);
    if (!detail) return { ok: false, error: 'Agent tidak ditemukan' };
    this.savePlatformState({ activeAgentId: detail.id });
    return { ok: true, agent: detail, agents: this.listAgents() };
  }

  saveAgent(payload) {
    const isNew = !payload.id;
    const rawId = payload.id || `agent-${String(payload.name || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18)}-${Date.now().toString(36).slice(-4)}`;
    const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    const dir = path.join(this.agentsDir, id);
    fs.mkdirSync(dir, { recursive: true });

    const existing = safeReadJson(path.join(dir, 'config.json'), {});
    const name = String(payload.name || existing.name || 'Agent Baru').trim().slice(0, 28);
    const role = String(payload.role ?? existing.role ?? 'Custom Autonomous Agent').trim().slice(0, 80);
    const avatar = String(payload.avatar || existing.avatar || 'hancow');

    const nextCfg = {
      ...existing,
      id,
      name,
      role,
      avatar,
      builtIn: Boolean(existing.builtIn && !isNew),
      customAvatarUrl: payload.customAvatarUrl !== undefined ? payload.customAvatarUrl : (existing.customAvatarUrl || ''),
      pinnedSkills: Array.isArray(payload.pinnedSkills) ? payload.pinnedSkills : (existing.pinnedSkills || [])
    };

    safeWriteJson(path.join(dir, 'config.json'), nextCfg);

    if (typeof payload.instructions === 'string') {
      safeWriteText(path.join(dir, 'instructions.md'), payload.instructions);
    } else if (isNew) {
      safeWriteText(path.join(dir, 'instructions.md'), `# Instruksi ${name}\n- Gunakan akses komputer, terminal, folder, skill, dan konektor secara proaktif.`);
    }

    if (typeof payload.memory === 'string') {
      safeWriteText(path.join(dir, 'memory.md'), payload.memory);
    } else if (isNew) {
      safeWriteText(path.join(dir, 'memory.md'), `# Memori ${name}\n- Belum ada catatan khusus.`);
    }

    if (typeof payload.soul === 'string') {
      safeWriteText(path.join(dir, 'soul.md'), payload.soul);
    } else if (isNew) {
      safeWriteText(path.join(dir, 'soul.md'), `# Soul: ${name}\nKamu adalah agent otonom yang jujur, ringkas, proaktif, dan langsung mengeksekusi tugas tanpa basa-basi.`);
    }

    if (typeof payload.identity === 'string') {
      safeWriteText(path.join(dir, 'identity.md'), payload.identity);
    } else if (isNew) {
      safeWriteText(path.join(dir, 'identity.md'), `# Identity: ${name}\n- **Nama**: ${name}\n- **Peran**: ${role}`);
    }

    if (typeof payload.globalMemory === 'string') {
      safeWriteText(this.globalMemoryPath, payload.globalMemory);
    }

    const histPath = path.join(dir, 'history.json');
    if (!fs.existsSync(histPath)) safeWriteJson(histPath, []);

    if (payload.makeActive || isNew) {
      this.savePlatformState({ activeAgentId: id });
    }

    return {
      ok: true,
      agent: this.getAgentDetail(id),
      agents: this.listAgents()
    };
  }

  deleteAgent(agentId) {
    if (!agentId || ['hancow', 'wana', 'pipo'].includes(agentId)) {
      return { ok: false, error: 'Agent bawaan tidak dapat dihapus, namun bisa diedit penuh.' };
    }
    const dir = path.join(this.agentsDir, agentId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const state = this.getPlatformState();
    if (state.activeAgentId === agentId) {
      this.savePlatformState({ activeAgentId: 'hancow' });
    }
    return {
      ok: true,
      activeAgent: this.getAgentDetail(this.getPlatformState().activeAgentId),
      agents: this.listAgents()
    };
  }

  createChatSession(agentId) {
    const id = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const store = this._loadSessionsStore(id);
    const current = store.sessions.find((s) => s.id === store.activeSessionId);
    if (current && (!current.messages || current.messages.length === 0)) {
      return { ok: true, agent: this.getAgentDetail(id) };
    }
    const existingEmpty = store.sessions.find((s) => !s.messages || s.messages.length === 0);
    if (existingEmpty) {
      existingEmpty.updatedAt = new Date().toISOString();
      store.activeSessionId = existingEmpty.id;
      this._saveSessionsStore(id, store);
      return { ok: true, agent: this.getAgentDetail(id) };
    }
    const nowIso = new Date().toISOString();
    const newId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    store.sessions.unshift({
      id: newId,
      title: 'Chat Baru',
      createdAt: nowIso,
      updatedAt: nowIso,
      messages: []
    });
    store.activeSessionId = newId;
    this._saveSessionsStore(id, store);
    return { ok: true, agent: this.getAgentDetail(id) };
  }

  selectChatSession(agentId, sessionId) {
    const id = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const store = this._loadSessionsStore(id);
    const target = store.sessions.find((s) => s.id === sessionId);
    if (!target) return { ok: false, error: 'Sesi riwayat chat tidak ditemukan' };
    store.activeSessionId = target.id;
    safeWriteJson(path.join(this.agentsDir, id, 'sessions.json'), store);
    return { ok: true, agent: this.getAgentDetail(id) };
  }

  deleteChatSession(agentId, sessionId) {
    const id = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const store = this._loadSessionsStore(id);
    store.sessions = store.sessions.filter((s) => s.id !== sessionId);
    if (store.sessions.length === 0) {
      const nowIso = new Date().toISOString();
      const freshId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      store.sessions.push({
        id: freshId,
        title: 'Chat Baru',
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: []
      });
      store.activeSessionId = freshId;
    } else if (!store.sessions.some((s) => s.id === store.activeSessionId)) {
      store.activeSessionId = store.sessions[0].id;
    }
    this._saveSessionsStore(id, store);
    return { ok: true, agent: this.getAgentDetail(id) };
  }

  clearAgentHistory(agentId, sessionId) {
    const id = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const store = this._loadSessionsStore(id);
    const targetId = sessionId || store.activeSessionId;
    const sess = store.sessions.find((s) => s.id === targetId) || store.sessions[0];
    if (sess) {
      sess.messages = [];
      sess.title = 'Chat Baru';
      sess.updatedAt = new Date().toISOString();
      this._saveSessionsStore(id, store);
    }
    return { ok: true, agent: this.getAgentDetail(id) };
  }

  saveGlobalMemory(content) {
    safeWriteText(this.globalMemoryPath, content);
    return { ok: true, globalMemory: content };
  }

  importCustomAvatar({ filePath, base64Data, fileName }) {
    try {
      const ext = path.extname(fileName || filePath || '.png').toLowerCase() || '.png';
      const destName = `avatar-${Date.now()}${ext}`;
      const destPath = path.join(this.customAvatarsDir, destName);
      if (filePath && fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, destPath);
      } else if (base64Data) {
        const clean = base64Data.replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(destPath, Buffer.from(clean, 'base64'));
      } else {
        return { ok: false, error: 'File avatar tidak valid' };
      }
      const fileUrl = `file:///${destPath.replace(/\\/g, '/')}`;
      return { ok: true, customAvatarUrl: fileUrl, isVideo: /\.(webm|mp4)$/i.test(ext) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ==================== FILE UPLOAD / DRAG / PASTE ====================

  stageAttachment({ filePath, base64Data, fileName, mimeType }) {
    try {
      const origName = path.basename(fileName || filePath || `paste-${Date.now()}.png`);
      const safeName = origName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const targetPath = path.join(this.uploadsDir, `${Date.now()}_${safeName}`);

      if (filePath && fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, targetPath);
      } else if (base64Data) {
        const rawB64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(targetPath, Buffer.from(rawB64, 'base64'));
      } else {
        return { ok: false, error: 'Data file kosong' };
      }

      const stat = fs.statSync(targetPath);
      const ext = path.extname(safeName).toLowerCase();
      const guessedMime = mimeType || (
        ext === '.png' ? 'image/png' :
        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
        ext === '.webp' ? 'image/webp' :
        ext === '.gif' ? 'image/gif' :
        'application/octet-stream'
      );
      const isImage = /^image\//i.test(guessedMime) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(ext);

      let previewDataUrl = '';
      if (isImage && stat.size <= 8 * 1024 * 1024) {
        const b64 = fs.readFileSync(targetPath).toString('base64');
        previewDataUrl = `data:${guessedMime};base64,${b64}`;
      }

      return {
        ok: true,
        attachment: {
          name: origName,
          localPath: targetPath,
          sourcePath: filePath || targetPath,
          size: stat.size,
          mimeType: guessedMime,
          isImage,
          previewDataUrl
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ==================== SKILLS SYSTEM ====================

  discoverSkills(force = false) {
    if (!force && this.skillsCache && Date.now() - this.skillsCacheAt < 45000) {
      return this.skillsCache;
    }

    const roots = [
      { source: 'custom', dir: this.customSkillsDir },
      { source: 'user-hermes', dir: path.join(os.homedir(), '.hermes', 'skills') },
      { source: 'hermes-bundle', dir: path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'skills') }
    ];

    const seen = new Map();

    const walk = (dir, source, depth = 0) => {
      if (depth > 3 || !fs.existsSync(dir)) return;
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (_e) {
        return;
      }
      for (const ent of entries) {
        if (ent.name.startsWith('.')) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          const skillMd = path.join(full, 'SKILL.md');
          if (fs.existsSync(skillMd)) {
            const raw = safeReadText(skillMd, '');
            const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            let name = ent.name;
            let description = '';
            if (fmMatch) {
              const nm = fmMatch[1].match(/^name:\s*(.+)$/m);
              const ds = fmMatch[1].match(/^description:\s*(.+)$/m);
              if (nm) name = nm[1].trim().replace(/^["']|["']$/g, '');
              if (ds) description = ds[1].trim().replace(/^["']|["']$/g, '');
            }
            if (!description) {
              const firstPara = raw.replace(/^---[\s\S]*?---/, '').split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'));
              description = firstPara ? firstPara.trim().slice(0, 140) : `Skill ${name}`;
            }
            const relCategory = path.basename(path.dirname(full));
            const key = name.toLowerCase();
            if (!seen.has(key)) {
              seen.set(key, {
                id: key,
                name,
                category: relCategory === 'skills' ? source : relCategory,
                description: description.slice(0, 160),
                path: skillMd,
                folder: full,
                source
              });
            }
          } else {
            walk(full, source, depth + 1);
          }
        }
      }
    };

    for (const r of roots) walk(r.dir, r.source, 0);

    this.skillsCache = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    this.skillsCacheAt = Date.now();
    return this.skillsCache;
  }

  readSkillContent(skillName) {
    const all = this.discoverSkills();
    const needle = String(skillName || '').trim().toLowerCase();
    const exact = all.find((s) => s.id === needle || s.name.toLowerCase() === needle);
    const fuzzy = exact || all.find((s) => s.id.includes(needle) || s.description.toLowerCase().includes(needle));
    if (!fuzzy) return { ok: false, error: `Skill '${skillName}' tidak ditemukan.` };
    const content = safeReadText(fuzzy.path, '');
    return {
      ok: true,
      skill: fuzzy,
      content: content.slice(0, 18000)
    };
  }

  createCustomSkill({ name, description, content }) {
    const slug = String(name || 'skill-baru').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-|-$/g, '') || `skill-${Date.now()}`;
    const folder = path.join(this.customSkillsDir, slug);
    const skillMd = path.join(folder, 'SKILL.md');
    const body = `---\nname: ${slug}\ndescription: "${String(description || name).replace(/"/g, "'")}"\n---\n\n${content || `# ${name}\nInstruksi skill.`}\n`;
    safeWriteText(skillMd, body);
    this.discoverSkills(true);
    return { ok: true, path: skillMd, skills: this.discoverSkills() };
  }

  // ==================== CONNECTORS / PLUGINS ====================

  _readHermesEnvironment() {
    const envMap = {};
    const hermesBase = path.join(os.homedir(), 'AppData', 'Local', 'hermes');
    const dotHermes = path.join(os.homedir(), '.hermes');
    const envFiles = [
      path.join(dotHermes, '.env'),
      path.join(hermesBase, '.env')
    ];
    for (const p of envFiles) {
      if (!fs.existsSync(p)) continue;
      const lines = safeReadText(p, '').split(/\r?\n/);
      for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq > 0) {
          const k = t.slice(0, eq).trim();
          const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
          if (v && !envMap[k]) envMap[k] = v;
        }
      }
    }

    const mcpServers = new Set();
    const cfgFiles = [
      path.join(dotHermes, 'config.yaml'),
      path.join(hermesBase, 'config.yaml')
    ];
    for (const cp of cfgFiles) {
      if (!fs.existsSync(cp)) continue;
      const raw = safeReadText(cp, '');
      const mcpBlock = raw.match(/^mcp_servers:\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m);
      if (mcpBlock && mcpBlock[1]) {
        const subKeys = mcpBlock[1].matchAll(/^[ \t]{2}([a-zA-Z0-9_-]+):/gm);
        for (const m of subKeys) mcpServers.add(m[1].toLowerCase());
      }
    }

    // Only mark an MCP OAuth server as connected when a real access_token / refresh_token file exists
    const mcpTokens = new Set();
    const tokenDirs = [
      path.join(hermesBase, 'mcp-tokens'),
      path.join(dotHermes, 'mcp-tokens')
    ];
    for (const td of tokenDirs) {
      if (!fs.existsSync(td)) continue;
      try {
        for (const ent of fs.readdirSync(td, { withFileTypes: true })) {
          if (!ent.isFile()) continue;
          const fn = ent.name;
          if (!fn.endsWith('.json') || fn.endsWith('.client.json') || fn.endsWith('.meta.json')) continue;
          const parsed = safeReadJson(path.join(td, fn), null);
          if (parsed && typeof parsed === 'object' && (parsed.access_token || parsed.refresh_token)) {
            const slug = fn.slice(0, -5).toLowerCase();
            mcpTokens.add(slug);
          }
        }
      } catch (_e) {}
    }

    const hermesExe = path.join(hermesBase, 'bin', 'hermes.exe');
    const hermesAgentDir = path.join(hermesBase, 'hermes-agent');
    const hermesPy = path.join(hermesAgentDir, 'venv', 'Scripts', 'python.exe');
    const hasHermesPy = fs.existsSync(hermesPy) && fs.existsSync(hermesAgentDir);

    return {
      envMap,
      mcpServers,
      mcpTokens,
      hasHermesCli: fs.existsSync(hermesExe) || hasHermesPy,
      hasHermesPy,
      hermesExe,
      hermesPy,
      hermesAgentDir,
      cfgFiles
    };
  }

  async _startMcpBrowserOAuth(connectorId, item, cfg) {
    const hermes = this._readHermesEnvironment();
    const mcpSlug = String(item.mcpSlug || '').trim();
    if (!mcpSlug) {
      return { ok: false, error: 'Konektor ini menggunakan token langsung, bukan OAuth Browser.' };
    }
    if (!hermes.hasHermesPy) {
      return { ok: false, error: 'Runtime OAuth Python Hermes tidak ditemukan di AppData\\Local\\hermes\\hermes-agent.' };
    }

    let customUrl = '';
    if (mcpSlug.toLowerCase() === 'n8n-official') {
      const rawBase = String(cfg.n8n?.baseUrl || hermes.envMap.N8N_MCP_SERVER_URL || '').trim().replace(/\/+$/, '');
      if (!rawBase) {
        return {
          ok: false,
          error: 'Isi kolom "Base URL Instance n8n" terlebih dahulu (lalu Simpan) sebelum klik Login OAuth Browser.'
        };
      }
      customUrl = /\/mcp(-server)?(\/|$)/i.test(rawBase) ? rawBase : `${rawBase}/mcp-server/http`;
    }

    const fallbackPortalUrls = {
      notion: 'https://www.notion.so/profile/integrations',
      linear: 'https://linear.app/settings/api',
      todoist: 'https://app.todoist.com/app/settings/integrations/developer',
      airtable: 'https://airtable.com/create/tokens',
      clickup: 'https://app.clickup.com/settings/apps',
      jira: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      atlassian: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      dropbox: 'https://www.dropbox.com/developers/apps',
      gitlab: 'https://gitlab.com/-/user_settings/personal_access_tokens',
      vercel: 'https://vercel.com/account/tokens',
      supabase: 'https://supabase.com/dashboard/account/tokens',
      cloudflare: 'https://dash.cloudflare.com/profile/api-tokens',
      sentry: 'https://sentry.io/settings/account/api/auth-tokens/',
      postman: 'https://web.postman.co/settings/me/api-keys',
      stripe: 'https://dashboard.stripe.com/apikeys',
      figma: 'https://www.figma.com/settings',
      huggingface: 'https://huggingface.co/settings/tokens',
      canva: 'https://www.canva.com/developers/'
    };

    const slugKey = mcpSlug.toLowerCase();
    const prevProc = this.activeOAuthProcs.get(slugKey);
    if (prevProc) {
      try { prevProc.kill(); } catch (_e) {}
      this.activeOAuthProcs.delete(slugKey);
    }

    const pyScript = [
      'import sys, os, re, json, time',
      'payload = json.loads(sys.argv[1])',
      'sys.path.insert(0, payload["hermesAgentDir"])',
      'for cp in payload.get("cfgFiles", []):',
      '    if os.path.exists(cp):',
      '        try:',
      '            raw = open(cp, "r", encoding="utf-8").read()',
      '            if len(re.findall(r"(?m)^hooks\\s*:", raw)) > 1:',
      '                cleaned = re.sub(r"\\r?\\n?# 9remote hooks begin[\\s\\S]*?# 9remote hooks end\\s*", "\\n", raw)',
      '                if len(re.findall(r"(?m)^hooks\\s*:", cleaned)) == 1:',
      '                    open(cp, "w", encoding="utf-8").write(cleaned)',
      '        except Exception:',
      '            pass',
      'from hermes_cli.mcp_catalog import list_catalog, _build_server_config',
      'from hermes_cli.mcp_config import _save_mcp_server',
      'from hermes_constants import get_hermes_home',
      'from tui_gateway.mcp_oauth_sessions import start_flow, poll_flow, finish_flow, cancel_flow',
      'slug = payload["slug"]',
      'entry = next((e for e in list_catalog() if e.name.lower() == slug.lower()), None)',
      'if not entry:',
      '    print("__DYNAMIC_OAUTH__:" + json.dumps({"event": "error", "error": f"Katalog MCP \'{slug}\' tidak ditemukan"}), flush=True)',
      '    sys.exit(0)',
      'server_cfg = _build_server_config(entry, None)',
      'server_cfg["enabled"] = True',
      'if payload.get("customUrl"):',
      '    server_cfg["url"] = payload["customUrl"]',
      '_save_mcp_server(entry.name, server_cfg)',
      'home = str(get_hermes_home())',
      'try:',
      '    res = start_flow(home, entry.name, server_cfg, url_timeout=22.0)',
      'except Exception as exc:',
      '    print("__DYNAMIC_OAUTH__:" + json.dumps({"event": "error", "error": str(exc)}), flush=True)',
      '    sys.exit(0)',
      'sid = res["session_id"]',
      'print("__DYNAMIC_OAUTH__:" + json.dumps({"event": "auth_url", "auth_url": res["auth_url"], "session_id": sid}), flush=True)',
      'done = False',
      'for _ in range(240):',
      '    time.sleep(1.0)',
      '    p = poll_flow(sid, entry.name)',
      '    st = p.get("status")',
      '    if st == "approved":',
      '        tools = p.get("tools") or []',
      '        print("__DYNAMIC_OAUTH__:" + json.dumps({"event": "approved", "toolCount": len(tools)}), flush=True)',
      '        finish_flow(sid)',
      '        done = True',
      '        break',
      '    if st == "error":',
      '        print("__DYNAMIC_OAUTH__:" + json.dumps({"event": "error", "error": p.get("error_message") or "OAuth dibatalkan atau gagal"}), flush=True)',
      '        finish_flow(sid)',
      '        done = True',
      '        break',
      'if not done:',
      '    try:',
      '        cancel_flow(sid, entry.name, home)',
      '    except Exception:',
      '        pass',
      '    print("__DYNAMIC_OAUTH__:" + json.dumps({"event": "timeout"}), flush=True)'
    ].join('\n');

    const argPayload = JSON.stringify({
      slug: mcpSlug,
      customUrl,
      hermesAgentDir: hermes.hermesAgentDir,
      cfgFiles: hermes.cfgFiles
    });

    return new Promise((resolve) => {
      let settledInitial = false;
      let stdoutBuf = '';
      let stderrBuf = '';

      const proc = spawn(hermes.hermesPy, ['-u', '-c', pyScript, argPayload], {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      this.activeOAuthProcs.set(slugKey, proc);

      const initialTimer = setTimeout(() => {
        if (!settledInitial) {
          settledInitial = true;
          try { proc.kill(); } catch (_e) {}
          this.activeOAuthProcs.delete(slugKey);
          resolve({
            ok: false,
            error: `Waktu habis saat meminta link OAuth dari server ${item.name}. Coba lagi atau gunakan token langsung.`
          });
        }
      }, 25000);

      const handleEvent = async (ev) => {
        if (!ev || typeof ev !== 'object') return;

        if (ev.event === 'auth_url' && ev.auth_url) {
          if (!settledInitial) {
            settledInitial = true;
            clearTimeout(initialTimer);
            await this._openBrowserUrl(ev.auth_url);
            this.getConnectorsStatus()
              .then((st) => this.sendToRenderer('connectors-updated', st))
              .catch(() => {});
            resolve({
              ok: true,
              openedBrowser: true,
              authUrl: ev.auth_url,
              message: `Halaman login ${item.name} dibuka di browser! Klik Allow / Izinkan — status otomatis terhubung.`
            });
          }
          return;
        }

        if (ev.event === 'approved') {
          this.activeOAuthProcs.delete(slugKey);
          const latestCfg = safeReadJson(this.connectorsPath, {});
          latestCfg[connectorId] = { ...(latestCfg[connectorId] || {}), enabled: true };
          safeWriteJson(this.connectorsPath, latestCfg);
          this.getConnectorsStatus()
            .then((st) => this.sendToRenderer('connectors-updated', st))
            .catch(() => {});
          return;
        }

        if (ev.event === 'error' || ev.event === 'timeout') {
          this.activeOAuthProcs.delete(slugKey);
          if (!settledInitial) {
            settledInitial = true;
            clearTimeout(initialTimer);
            const fallbackUrl = fallbackPortalUrls[connectorId];
            if (fallbackUrl) {
              await this._openBrowserUrl(fallbackUrl);
              resolve({
                ok: false,
                openedBrowser: true,
                error: `Server ${item.name} membutuhkan API Token manual. Halaman token resmi sudah dibuka di browser — salin token lalu klik Simpan.`
              });
            } else {
              resolve({
                ok: false,
                error: ev.error || `Gagal memulai OAuth untuk ${item.name}.`
              });
            }
          } else {
            this.getConnectorsStatus()
              .then((st) => this.sendToRenderer('connectors-updated', st))
              .catch(() => {});
          }
        }
      };

      proc.stdout.on('data', (chunk) => {
        stdoutBuf += chunk.toString('utf8');
        const lines = stdoutBuf.split(/\r?\n/);
        stdoutBuf = lines.pop() || '';
        for (const line of lines) {
          const idx = line.indexOf('__DYNAMIC_OAUTH__:');
          if (idx !== -1) {
            const parsed = safeJsonParse(line.slice(idx + '__DYNAMIC_OAUTH__:'.length));
            if (parsed) handleEvent(parsed).catch(() => {});
          }
        }
      });

      proc.stderr.on('data', (chunk) => {
        if (stderrBuf.length < 4000) stderrBuf += chunk.toString('utf8');
      });

      proc.on('close', () => {
        if (this.activeOAuthProcs.get(slugKey) === proc) {
          this.activeOAuthProcs.delete(slugKey);
        }
        if (!settledInitial) {
          settledInitial = true;
          clearTimeout(initialTimer);
          resolve({
            ok: false,
            error: stderrBuf.trim().split(/\r?\n/).pop() || `Proses OAuth ${item.name} berhenti lebih awal.`
          });
        }
      });

      proc.on('error', (err) => {
        this.activeOAuthProcs.delete(slugKey);
        if (!settledInitial) {
          settledInitial = true;
          clearTimeout(initialTimer);
          resolve({ ok: false, error: err.message });
        }
      });
    });
  }

  async _executeMcpOAuthConnector(mcpSlug, action, params = {}) {
    const hermes = this._readHermesEnvironment();
    if (!hermes.hasHermesPy) {
      return { ok: false, error: 'Runtime Python Hermes tidak ditemukan untuk menjalankan MCP OAuth.' };
    }

    const pyScript = [
      'import sys, json, asyncio',
      'payload = json.loads(sys.argv[1])',
      'sys.path.insert(0, payload["hermesAgentDir"])',
      'from hermes_cli.mcp_config import _get_mcp_servers, _resolve_mcp_server_config',
      'from hermes_cli.mcp_catalog import list_catalog, _build_server_config',
      'from tools.mcp_tool_loop import _ensure_mcp_loop, _run_on_mcp_loop',
      'from tools.mcp_tool_discovery import _connect_server',
      'from tools.mcp_tool_lifecycle import _stop_mcp_loop_if_idle',
      'from tools import mcp_tool as _core',
      'slug = payload["slug"]',
      'act = (payload.get("action") or "test").lower()',
      'params = payload.get("params") or {}',
      'servers = _get_mcp_servers()',
      'cfg = next((v for k, v in servers.items() if k.lower() == slug.lower()), None)',
      'real_name = next((k for k in servers.keys() if k.lower() == slug.lower()), slug)',
      'if not cfg:',
      '    entry = next((e for e in list_catalog() if e.name.lower() == slug.lower()), None)',
      '    if entry:',
      '        real_name = entry.name',
      '        cfg = _build_server_config(entry, None)',
      'if not cfg:',
      '    print("__DYNAMIC_MCP__:" + json.dumps({"ok": False, "error": f"Konfigurasi MCP \'{slug}\' belum ditemukan."}), flush=True)',
      '    sys.exit(0)',
      'cfg = _resolve_mcp_server_config(dict(cfg))',
      'cfg["connect_timeout"] = 18.0',
      '_ensure_mcp_loop()',
      'async def _run():',
      '    claimed = []',
      '    tok = _core._connect_server_claim.set(claimed.append)',
      '    try:',
      '        server = await asyncio.wait_for(_connect_server(real_name, cfg), timeout=18.0)',
      '    finally:',
      '        _core._connect_server_claim.reset(tok)',
      '    try:',
      '        tools_meta = []',
      '        for t in server._tools:',
      '            schema = getattr(t, "inputSchema", None) or {}',
      '            props = list((schema.get("properties") or {}).keys()) if isinstance(schema, dict) else []',
      '            tools_meta.append({"name": t.name, "description": (getattr(t, "description", "") or "")[:140], "params": props[:10]})',
      '        explicit_tool = params.get("mcpTool") or params.get("tool")',
      '        target_tool = None',
      '        tool_args = params.get("mcpArgs") if isinstance(params.get("mcpArgs"), dict) else None',
      '        if explicit_tool:',
      '            target_tool = next((t for t in server._tools if t.name == explicit_tool or t.name.lower() == str(explicit_tool).lower()), None)',
      '            if tool_args is None:',
      '                tool_args = {k: v for k, v in params.items() if k not in ("mcpTool", "tool", "mcpArgs")}',
      '        elif act not in ("test", "status", "ping"):',
      '            target_tool = next((t for t in server._tools if t.name.lower() == act), None)',
      '            if not target_tool and act in ("search", "query", "find"):',
      '                target_tool = next((t for t in server._tools if "search" in t.name.lower()), None)',
      '            if target_tool and tool_args is None:',
      '                schema = getattr(target_tool, "inputSchema", None) or {}',
      '                props = (schema.get("properties") or {}) if isinstance(schema, dict) else {}',
      '                tool_args = {k: params[k] for k in props if k in params}',
      '                if not tool_args and params.get("query") is not None:',
      '                    for qk in ("query", "q", "search", "keyword", "filter"):',
      '                        if qk in props:',
      '                            tool_args[qk] = params["query"]',
      '                            break',
      '        is_ui_blank_search = (act == "search" and not params.get("query") and not explicit_tool)',
      '        if target_tool and not is_ui_blank_search:',
      '            call_res = await asyncio.wait_for(server.session.call_tool(target_tool.name, tool_args or {}), timeout=25.0)',
      '            parts = []',
      '            for c in (getattr(call_res, "content", None) or []):',
      '                txt = getattr(c, "text", None)',
      '                parts.append(txt if txt is not None else str(c))',
      '            return {',
      '                "ok": not bool(getattr(call_res, "isError", False)),',
      '                "connected": True,',
      '                "auth": "oauth",',
      '                "executedTool": target_tool.name,',
      '                "toolCount": len(tools_meta),',
      '                "output": "\\n".join(parts)[:18000]',
      '            }',
      '        return {',
      '            "ok": True,',
      '            "connected": True,',
      '            "auth": "oauth",',
      '            "toolCount": len(tools_meta),',
      '            "availableMcpTools": tools_meta[:35],',
      '            "hint": "Konektor terhubung via OAuth Browser. Panggil kembali use_connector dengan params: { mcpTool: \'<nama_tool>\', mcpArgs: { ... } } untuk mengeksekusi salah satu tool di availableMcpTools."',
      '        }',
      '    finally:',
      '        await server.shutdown()',
      'try:',
      '    out = _run_on_mcp_loop(_run(), timeout=32.0)',
      '    print("__DYNAMIC_MCP__:" + json.dumps(out), flush=True)',
      'except BaseException as exc:',
      '    print("__DYNAMIC_MCP__:" + json.dumps({"ok": False, "error": str(exc)}), flush=True)',
      'finally:',
      '    _stop_mcp_loop_if_idle()'
    ].join('\n');

    const argPayload = JSON.stringify({
      slug: mcpSlug,
      action,
      params,
      hermesAgentDir: hermes.hermesAgentDir
    });

    const res = await execPromise(hermes.hermesPy, ['-u', '-c', pyScript, argPayload], {
      timeoutMs: 35000
    });

    for (const line of String(res.stdout || '').split(/\r?\n/)) {
      const idx = line.indexOf('__DYNAMIC_MCP__:');
      if (idx !== -1) {
        const parsed = safeJsonParse(line.slice(idx + '__DYNAMIC_MCP__:'.length));
        if (parsed) return parsed;
      }
    }
    return {
      ok: false,
      error: res.stderr ? res.stderr.split(/\r?\n/).pop() : 'Gagal menghubungi server MCP OAuth.'
    };
  }

  _detectDefaultObsidianVault() {
    const candidates = [
      path.join(os.homedir(), 'Documents', 'Obsidian Vault'),
      path.join(os.homedir(), 'Documents', 'Obsidian'),
      path.join(os.homedir(), 'Obsidian'),
      path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'vault')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return '';
  }

  async _getWhatsAppLiveStatus(force = false) {
    if (!force && this._waStatusCache && Date.now() - this._waStatusCacheAt < 5000) {
      return this._waStatusCache;
    }

    const hermesBase = path.join(os.homedir(), 'AppData', 'Local', 'hermes');
    const gwState = safeReadJson(path.join(hermesBase, 'gateway_state.json'), null);
    const bridgeLog = safeReadText(path.join(hermesBase, 'whatsapp', 'bridge.log'), '');
    const tailLog = bridgeLog.slice(-1200);

    const hermesPlatState = gwState?.platforms?.whatsapp?.state || 'not_configured';
    const isLoggedOut = /Logged out\.\s*Delete session/i.test(tailLog) && hermesPlatState !== 'connected';
    const hermesConnected = hermesPlatState === 'connected';

    let desktopRunning = false;
    try {
      const ps = await execPromise(
        'powershell.exe',
        ['-NoProfile', '-Command', 'if (Get-Process -Name "WhatsApp*" -ErrorAction SilentlyContinue) { "1" } else { "0" }'],
        { timeoutMs: 2500 }
      );
      desktopRunning = ps.stdout.trim() === '1';
    } catch (_e) {}

    const status = {
      desktopRunning,
      hermesState: isLoggedOut ? 'logged_out' : hermesPlatState,
      hermesConnected,
      connected: desktopRunning || hermesConnected
    };
    this._waStatusCache = status;
    this._waStatusCacheAt = Date.now();
    return status;
  }

  async getConnectorsStatus() {
    const cfg = safeReadJson(this.connectorsPath, {});
    const hermes = this._readHermesEnvironment();
    const hEnv = hermes.envMap;
    const hasMcp = (slug) => Boolean(slug && hermes.mcpTokens.has(slug.toLowerCase()));
    const isOAuthPending = (slug) => Boolean(slug && this.activeOAuthProcs.has(slug.toLowerCase()));
    const waStatus = await this._getWhatsAppLiveStatus();

    const hermesGoogleToken = fs.existsSync(path.join(os.homedir(), '.hermes', 'google_token.json')) ||
      fs.existsSync(path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'google_token.json'));
    const ghExists = fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe');
    const dockerExists = fs.existsSync('C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe');
    const defaultVault = this._detectDefaultObsidianVault();
    const defaultDropbox = fs.existsSync(path.join(os.homedir(), 'Dropbox')) ? path.join(os.homedir(), 'Dropbox') : '';
    const bsiPath = cfg.bsi_mybest?.statePath || path.join(os.homedir(), '.hermes', 'bsi-monitor', 'state.json');
    const bsiStateExists = fs.existsSync(bsiPath);

    const firecrawlKey = cfg.web_search?.firecrawlApiKey || hEnv.FIRECRAWL_API_KEY || '';
    const notionKey = cfg.notion?.apiKey || hEnv.NOTION_API_KEY || '';
    const linearKey = cfg.linear?.apiKey || hEnv.LINEAR_API_KEY || '';
    const ghToken = cfg.github?.token || hEnv.GITHUB_TOKEN || hEnv.GH_TOKEN || '';
    const tgToken = cfg.telegram?.botToken || hEnv.TELEGRAM_BOT_TOKEN || '';
    const discordHook = cfg.discord?.webhookUrl || '';
    const discordToken = cfg.discord?.botToken || hEnv.DISCORD_BOT_TOKEN || '';
    const slackToken = cfg.slack?.botToken || hEnv.SLACK_BOT_TOKEN || '';
    const slackHook = cfg.slack?.webhookUrl || '';
    const hfToken = cfg.huggingface?.token || hEnv.HF_TOKEN || hEnv.HUGGINGFACE_TOKEN || '';
    const braveKey = cfg.brave?.apiKey || hEnv.BRAVE_API_KEY || '';
    const obsPath = cfg.obsidian?.vaultPath || defaultVault;

    const mk = (item) => {
      let statusText = item.statusText;
      if (statusText === 'Hermes MCP') {
        statusText = 'OAuth Terhubung';
      } else if (!item.connected && isOAuthPending(item.mcpSlug)) {
        statusText = 'Menunggu izin browser...';
      }
      return {
        ...item,
        statusText,
        badge: statusText,
        hasHermesOAuth: Boolean(item.mcpSlug && (hermes.hasHermesPy || hermes.hasHermesCli))
      };
    };

    return {
      config: cfg,
      hasHermesCli: hermes.hasHermesCli,
      items: [
        // === PESAN & KOMUNIKASI ===
        mk({
          id: 'whatsapp',
          name: 'WhatsApp',
          category: 'pesan',
          icon: 'public/assets/connectors/whatsapp.svg',
          desc: 'Baca daftar chat masuk & kirim pesan WA silent via WA Desktop atau Hermes QR Bridge',
          enabled: cfg.whatsapp?.enabled !== false,
          connected: waStatus.connected,
          statusText: waStatus.desktopRunning && waStatus.hermesConnected
            ? 'WA Desktop + Hermes'
            : waStatus.desktopRunning
            ? 'WA Desktop Aktif'
            : waStatus.hermesConnected
            ? 'Hermes WA Aktif'
            : 'Belum aktif (Klik Atur)',
          hasWaQuickSetup: true,
          fields: []
        }),
        mk({
          id: 'telegram',
          name: 'Telegram',
          category: 'pesan',
          icon: 'public/assets/connectors/telegram.svg',
          desc: 'Remote Control Laptop 2-Arah dari HP (terminal, file, screenshot) & kirim laporan otomatis',
          enabled: Boolean(cfg.telegram?.enabled || tgToken),
          connected: Boolean(tgToken),
          statusText: tgToken
            ? ((cfg.telegram?.chatId || hEnv.TELEGRAM_CHAT_ID) ? 'Remote Control Aktif' : 'Bot Aktif (Chat bot utk bind ID)')
            : 'Belum diatur',
          fields: [
            { key: 'botToken', label: 'Bot Token (@BotFather)', type: 'password', value: cfg.telegram?.botToken || '' },
            { key: 'chatId', label: 'Chat ID Diizinkan (Kosongkan = auto-bind saat kamu chat bot)', type: 'text', value: cfg.telegram?.chatId || '' }
          ]
        }),
        mk({
          id: 'discord',
          name: 'Discord',
          category: 'pesan',
          icon: 'public/assets/connectors/discord.svg',
          desc: 'Kirim notifikasi server via Webhook atau baca/balas channel via Bot Token',
          enabled: Boolean(cfg.discord?.enabled),
          connected: Boolean(discordHook || discordToken),
          statusText: discordHook ? 'Webhook siap' : (discordToken ? 'Bot siap' : 'Belum diatur'),
          fields: [
            { key: 'webhookUrl', label: 'Discord Webhook URL (Cepat tanpa bot)', type: 'password', value: cfg.discord?.webhookUrl || '' },
            { key: 'botToken', label: 'Discord Bot Token (Opsional)', type: 'password', value: cfg.discord?.botToken || '' },
            { key: 'channelId', label: 'Default Channel ID (Opsional)', type: 'text', value: cfg.discord?.channelId || '' }
          ]
        }),
        mk({
          id: 'slack',
          name: 'Slack',
          category: 'pesan',
          icon: 'public/assets/connectors/slack.svg',
          desc: 'Baca percakapan channel & kirim update tim via Bot Token atau Webhook',
          enabled: Boolean(cfg.slack?.enabled),
          connected: Boolean(slackToken || slackHook),
          statusText: slackToken ? 'Workspace siap' : (slackHook ? 'Webhook siap' : 'Belum diatur'),
          fields: [
            { key: 'botToken', label: 'Slack Bot User OAuth Token (xoxb-...)', type: 'password', value: cfg.slack?.botToken || '' },
            { key: 'webhookUrl', label: 'Incoming Webhook URL (Opsional)', type: 'password', value: cfg.slack?.webhookUrl || '' },
            { key: 'channelId', label: 'Channel ID Default (C0...)', type: 'text', value: cfg.slack?.channelId || '' }
          ]
        }),

        // === GOOGLE, MICROSOFT & KAMPUS ===
        mk({
          id: 'gmail',
          name: 'Gmail',
          category: 'workspace',
          icon: 'public/assets/connectors/gmail.svg',
          desc: 'Baca inbox/unread & kirim email via App Password IMAP/SMTP atau Google OAuth',
          enabled: cfg.gmail?.enabled !== false,
          connected: hermesGoogleToken || Boolean(cfg.gmail?.email && cfg.gmail?.appPassword),
          statusText: hermesGoogleToken ? 'Google OAuth' : (cfg.gmail?.email && cfg.gmail?.appPassword ? 'IMAP/SMTP aktif' : 'Belum diatur'),
          fields: [
            { key: 'email', label: 'Alamat Gmail', type: 'text', value: cfg.gmail?.email || '' },
            { key: 'appPassword', label: 'Google App Password (16 karakter)', type: 'password', value: cfg.gmail?.appPassword || '' }
          ]
        }),
        mk({
          id: 'google_calendar',
          name: 'Google Calendar',
          category: 'workspace',
          icon: 'public/assets/connectors/google_calendar.svg',
          desc: 'Pantau agenda harian & pengingat rapat via Secret iCal (.ics) atau OAuth',
          enabled: cfg.google_calendar?.enabled !== false,
          connected: hermesGoogleToken || Boolean(cfg.google_calendar?.icalUrl),
          statusText: hermesGoogleToken ? 'Google OAuth' : (cfg.google_calendar?.icalUrl ? 'iCal terhubung' : 'Belum diatur'),
          fields: [
            { key: 'icalUrl', label: 'Secret Address in iCal format (.ics URL)', type: 'text', value: cfg.google_calendar?.icalUrl || '' }
          ]
        }),
        mk({
          id: 'google_drive',
          name: 'Google Drive',
          category: 'workspace',
          icon: 'public/assets/connectors/google_drive.svg',
          desc: 'Cari dokumen, folder & kelola file cloud Google Drive',
          enabled: Boolean(cfg.google_drive?.enabled || hermesGoogleToken),
          connected: hermesGoogleToken || Boolean(cfg.google_drive?.accessToken),
          statusText: hermesGoogleToken ? 'Google OAuth' : (cfg.google_drive?.accessToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'accessToken', label: 'OAuth Access Token (Kosongkan jika memakai Hermes Google OAuth)', type: 'password', value: cfg.google_drive?.accessToken || '' }
          ]
        }),
        mk({
          id: 'google_docs',
          name: 'Google Docs',
          category: 'workspace',
          icon: 'public/assets/connectors/google_docs.svg',
          desc: 'Baca isi dokumen, ringkas laporan & tulis draf Google Docs',
          enabled: Boolean(cfg.google_docs?.enabled || hermesGoogleToken),
          connected: hermesGoogleToken || Boolean(cfg.google_docs?.accessToken),
          statusText: hermesGoogleToken ? 'Google OAuth' : (cfg.google_docs?.accessToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'accessToken', label: 'OAuth Access Token (Opsional jika Hermes Google aktif)', type: 'password', value: cfg.google_docs?.accessToken || '' }
          ]
        }),
        mk({
          id: 'google_sheets',
          name: 'Google Sheets',
          category: 'workspace',
          icon: 'public/assets/connectors/google_sheets.svg',
          desc: 'Baca tabel spreadsheet, analisis data & ekspor CSV/Sheet',
          enabled: Boolean(cfg.google_sheets?.enabled || hermesGoogleToken),
          connected: hermesGoogleToken || Boolean(cfg.google_sheets?.sheetUrl || cfg.google_sheets?.accessToken),
          statusText: hermesGoogleToken ? 'Google OAuth' : (cfg.google_sheets?.sheetUrl ? 'Sheet siap' : 'Belum diatur'),
          fields: [
            { key: 'sheetUrl', label: 'Default Google Sheet URL / ID (Opsional)', type: 'text', value: cfg.google_sheets?.sheetUrl || '' },
            { key: 'accessToken', label: 'OAuth Access Token (Opsional)', type: 'password', value: cfg.google_sheets?.accessToken || '' }
          ]
        }),
        mk({
          id: 'microsoft_365',
          name: 'Microsoft 365 & Outlook',
          category: 'workspace',
          icon: 'public/assets/connectors/microsoft_365.svg',
          desc: 'Sinkronisasi kalender Outlook (.ics) & email Microsoft Graph API',
          enabled: Boolean(cfg.microsoft_365?.enabled),
          connected: Boolean(cfg.microsoft_365?.icalUrl || cfg.microsoft_365?.accessToken),
          statusText: cfg.microsoft_365?.accessToken ? 'Graph aktif' : (cfg.microsoft_365?.icalUrl ? 'iCal aktif' : 'Belum diatur'),
          fields: [
            { key: 'icalUrl', label: 'Outlook Published Calendar (.ics URL)', type: 'text', value: cfg.microsoft_365?.icalUrl || '' },
            { key: 'accessToken', label: 'Microsoft Graph Bearer Token (Opsional)', type: 'password', value: cfg.microsoft_365?.accessToken || '' }
          ]
        }),
        mk({
          id: 'bsi_mybest',
          name: 'BSI MyBest E-Learning',
          category: 'workspace',
          icon: 'public/assets/connectors/bsi_mybest.png',
          desc: 'Pantau jadwal kuliah, presensi & ruang tugas MyBest UBSI otomatis',
          enabled: cfg.bsi_mybest?.enabled !== false,
          connected: bsiStateExists,
          statusText: bsiStateExists ? 'Terhubung' : 'State belum ada',
          fields: [
            { key: 'statePath', label: 'Path state.json BSI Monitor', type: 'text', value: bsiPath }
          ]
        }),

        // === PRODUKTIVITAS, CATATAN & MANAJEMEN PROYEK ===
        mk({
          id: 'notion',
          name: 'Notion',
          category: 'produktivitas',
          icon: 'public/assets/connectors/notion.svg',
          mcpSlug: 'notion',
          desc: 'Cari halaman, baca catatan markdown, update database & buat halaman baru',
          enabled: Boolean(cfg.notion?.enabled || notionKey || hasMcp('notion')),
          connected: Boolean(notionKey || hasMcp('notion')),
          statusText: hasMcp('notion') ? 'Hermes MCP' : (notionKey ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'apiKey', label: 'Notion Integration Token (ntn_... / secret_...)', type: 'password', value: cfg.notion?.apiKey || '' }
          ]
        }),
        mk({
          id: 'obsidian',
          name: 'Obsidian',
          category: 'produktivitas',
          icon: 'public/assets/connectors/obsidian.svg',
          desc: 'Cari, baca & tulis catatan Markdown langsung di folder Vault lokal',
          enabled: cfg.obsidian?.enabled !== false && Boolean(obsPath),
          connected: Boolean(obsPath && fs.existsSync(obsPath)),
          statusText: obsPath && fs.existsSync(obsPath) ? `Vault: ${path.basename(obsPath)}` : 'Pilih folder vault',
          fields: [
            { key: 'vaultPath', label: 'Lokasi Folder Vault Obsidian (misal C:\\Users\\Kingska\\Documents\\Vault)', type: 'text', value: obsPath }
          ]
        }),
        mk({
          id: 'linear',
          name: 'Linear',
          category: 'produktivitas',
          icon: 'public/assets/connectors/linear.svg',
          mcpSlug: 'linear',
          desc: 'Cari, buat & perbarui issue, sprint cycle, dan project di Linear',
          enabled: Boolean(cfg.linear?.enabled || linearKey || hasMcp('linear')),
          connected: Boolean(linearKey || hasMcp('linear')),
          statusText: hasMcp('linear') ? 'Hermes MCP' : (linearKey ? 'API aktif' : 'Belum diatur'),
          fields: [
            { key: 'apiKey', label: 'Linear Personal API Key (lin_api_...)', type: 'password', value: cfg.linear?.apiKey || '' }
          ]
        }),
        mk({
          id: 'todoist',
          name: 'Todoist',
          category: 'produktivitas',
          icon: 'public/assets/connectors/todoist.svg',
          mcpSlug: 'todoist',
          desc: 'Kelola daftar to-do harian, tenggat waktu & tandai tugas selesai',
          enabled: Boolean(cfg.todoist?.enabled || hasMcp('todoist')),
          connected: Boolean(cfg.todoist?.apiToken || hasMcp('todoist')),
          statusText: hasMcp('todoist') ? 'Hermes MCP' : (cfg.todoist?.apiToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'apiToken', label: 'Todoist API Token', type: 'password', value: cfg.todoist?.apiToken || '' }
          ]
        }),
        mk({
          id: 'trello',
          name: 'Trello',
          category: 'produktivitas',
          icon: 'public/assets/connectors/trello.svg',
          desc: 'Pantau kanban board, daftar kartu & buat kartu tugas Trello baru',
          enabled: Boolean(cfg.trello?.enabled),
          connected: Boolean(cfg.trello?.apiKey && cfg.trello?.token),
          statusText: cfg.trello?.apiKey && cfg.trello?.token ? 'Board siap' : 'Belum diatur',
          fields: [
            { key: 'apiKey', label: 'Trello API Key', type: 'text', value: cfg.trello?.apiKey || '' },
            { key: 'token', label: 'Trello Token', type: 'password', value: cfg.trello?.token || '' }
          ]
        }),
        mk({
          id: 'airtable',
          name: 'Airtable',
          category: 'produktivitas',
          icon: 'public/assets/connectors/airtable.svg',
          mcpSlug: 'airtable',
          desc: 'Baca base, filter record tabel & tambah baris data ke Airtable',
          enabled: Boolean(cfg.airtable?.enabled || hasMcp('airtable')),
          connected: Boolean(cfg.airtable?.token || hasMcp('airtable')),
          statusText: hasMcp('airtable') ? 'Hermes MCP' : (cfg.airtable?.token ? 'PAT aktif' : 'Belum diatur'),
          fields: [
            { key: 'token', label: 'Airtable Personal Access Token (pat...)', type: 'password', value: cfg.airtable?.token || '' }
          ]
        }),
        mk({
          id: 'clickup',
          name: 'ClickUp',
          category: 'produktivitas',
          icon: 'public/assets/connectors/clickup.svg',
          mcpSlug: 'clickup',
          desc: 'Lihat daftar task, workspace, status sprint & buat task ClickUp',
          enabled: Boolean(cfg.clickup?.enabled || hasMcp('clickup')),
          connected: Boolean(cfg.clickup?.apiToken || hasMcp('clickup')),
          statusText: hasMcp('clickup') ? 'Hermes MCP' : (cfg.clickup?.apiToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'apiToken', label: 'ClickUp Personal Token (pk_...)', type: 'password', value: cfg.clickup?.apiToken || '' }
          ]
        }),
        mk({
          id: 'jira',
          name: 'Jira Software',
          category: 'produktivitas',
          icon: 'public/assets/connectors/jira.svg',
          mcpSlug: 'atlassian',
          desc: 'Cari tiket via JQL, pantau backlog & update status issue Jira',
          enabled: Boolean(cfg.jira?.enabled || hasMcp('atlassian')),
          connected: Boolean((cfg.jira?.domain && cfg.jira?.email && cfg.jira?.apiToken) || hasMcp('atlassian')),
          statusText: hasMcp('atlassian') ? 'Hermes MCP' : (cfg.jira?.apiToken ? 'REST aktif' : 'Belum diatur'),
          fields: [
            { key: 'domain', label: 'Domain Atlassian (misal timkamu.atlassian.net)', type: 'text', value: cfg.jira?.domain || '' },
            { key: 'email', label: 'Email Akun Atlassian', type: 'text', value: cfg.jira?.email || '' },
            { key: 'apiToken', label: 'Atlassian API Token', type: 'password', value: cfg.jira?.apiToken || '' }
          ]
        }),
        mk({
          id: 'atlassian',
          name: 'Confluence',
          category: 'produktivitas',
          icon: 'public/assets/connectors/atlassian.svg',
          mcpSlug: 'atlassian',
          desc: 'Cari dokumentasi wiki tim, spesifikasi produk & halaman Confluence',
          enabled: Boolean(cfg.atlassian?.enabled || hasMcp('atlassian')),
          connected: Boolean((cfg.atlassian?.domain && cfg.atlassian?.apiToken) || hasMcp('atlassian')),
          statusText: hasMcp('atlassian') ? 'Hermes MCP' : (cfg.atlassian?.apiToken ? 'Wiki siap' : 'Belum diatur'),
          fields: [
            { key: 'domain', label: 'Domain Atlassian (misal timkamu.atlassian.net)', type: 'text', value: cfg.atlassian?.domain || '' },
            { key: 'email', label: 'Email Akun Atlassian', type: 'text', value: cfg.atlassian?.email || '' },
            { key: 'apiToken', label: 'Atlassian API Token', type: 'password', value: cfg.atlassian?.apiToken || '' }
          ]
        }),
        mk({
          id: 'dropbox',
          name: 'Dropbox',
          category: 'produktivitas',
          icon: 'public/assets/connectors/dropbox.svg',
          mcpSlug: 'dropbox',
          desc: 'Telusuri file sinkronisasi Dropbox lokal maupun cloud API',
          enabled: Boolean(cfg.dropbox?.enabled || defaultDropbox || hasMcp('dropbox')),
          connected: Boolean(defaultDropbox || cfg.dropbox?.accessToken || hasMcp('dropbox')),
          statusText: defaultDropbox ? 'Folder lokal siap' : (hasMcp('dropbox') ? 'Hermes MCP' : (cfg.dropbox?.accessToken ? 'Cloud aktif' : 'Belum diatur')),
          fields: [
            { key: 'accessToken', label: 'Dropbox Access Token (Opsional jika aplikasi Dropbox terpasang)', type: 'password', value: cfg.dropbox?.accessToken || '' }
          ]
        }),

        // === DEVELOPER, CLOUD, DESAIN & AUTOMASI ===
        mk({
          id: 'github',
          name: 'GitHub',
          category: 'dev',
          icon: 'public/assets/connectors/github.svg',
          desc: 'Akses repo, pull requests, issues, Actions & notifikasi via GitHub CLI / Token',
          enabled: cfg.github?.enabled !== false,
          connected: ghExists || Boolean(ghToken),
          statusText: ghExists ? 'gh CLI terhubung' : (ghToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'token', label: 'Personal Access Token (Opsional jika gh CLI aktif)', type: 'password', value: cfg.github?.token || '' }
          ]
        }),
        mk({
          id: 'gitlab',
          name: 'GitLab',
          category: 'dev',
          icon: 'public/assets/connectors/gitlab.svg',
          mcpSlug: 'gitlab',
          desc: 'Kelola repository, Merge Requests & status CI/CD pipeline GitLab',
          enabled: Boolean(cfg.gitlab?.enabled || hasMcp('gitlab')),
          connected: Boolean(cfg.gitlab?.token || hasMcp('gitlab')),
          statusText: hasMcp('gitlab') ? 'Hermes MCP' : (cfg.gitlab?.token ? 'PAT aktif' : 'Belum diatur'),
          fields: [
            { key: 'token', label: 'GitLab Personal Access Token (glpat-...)', type: 'password', value: cfg.gitlab?.token || '' },
            { key: 'host', label: 'Host GitLab (Default: https://gitlab.com)', type: 'text', value: cfg.gitlab?.host || 'https://gitlab.com' }
          ]
        }),
        mk({
          id: 'vercel',
          name: 'Vercel',
          category: 'dev',
          icon: 'public/assets/connectors/vercel.svg',
          mcpSlug: 'vercel',
          desc: 'Pantau status deployment produksi, preview URL & log build project',
          enabled: Boolean(cfg.vercel?.enabled || hasMcp('vercel')),
          connected: Boolean(cfg.vercel?.token || hasMcp('vercel')),
          statusText: hasMcp('vercel') ? 'Hermes MCP' : (cfg.vercel?.token ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'token', label: 'Vercel Access Token', type: 'password', value: cfg.vercel?.token || '' }
          ]
        }),
        mk({
          id: 'supabase',
          name: 'Supabase',
          category: 'dev',
          icon: 'public/assets/connectors/supabase.svg',
          mcpSlug: 'supabase',
          desc: 'Query tabel PostgREST, cek project, autentikasi & storage Supabase',
          enabled: Boolean(cfg.supabase?.enabled || hasMcp('supabase')),
          connected: Boolean((cfg.supabase?.projectUrl && cfg.supabase?.apiKey) || cfg.supabase?.accessToken || hasMcp('supabase')),
          statusText: hasMcp('supabase') ? 'Hermes MCP' : (cfg.supabase?.apiKey || cfg.supabase?.accessToken ? 'Project siap' : 'Belum diatur'),
          fields: [
            { key: 'projectUrl', label: 'Project URL (https://xyz.supabase.co)', type: 'text', value: cfg.supabase?.projectUrl || '' },
            { key: 'apiKey', label: 'Anon / Service Role Key', type: 'password', value: cfg.supabase?.apiKey || '' },
            { key: 'accessToken', label: 'Management Personal Token sbp_... (Opsional)', type: 'password', value: cfg.supabase?.accessToken || '' }
          ]
        }),
        mk({
          id: 'cloudflare',
          name: 'Cloudflare',
          category: 'dev',
          icon: 'public/assets/connectors/cloudflare.svg',
          mcpSlug: 'cloudflare',
          desc: 'Kelola domain DNS, Workers, Pages & status jaringan Cloudflare',
          enabled: Boolean(cfg.cloudflare?.enabled || hasMcp('cloudflare')),
          connected: Boolean(cfg.cloudflare?.apiToken || hasMcp('cloudflare')),
          statusText: hasMcp('cloudflare') ? 'Hermes MCP' : (cfg.cloudflare?.apiToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'apiToken', label: 'Cloudflare API Token', type: 'password', value: cfg.cloudflare?.apiToken || '' }
          ]
        }),
        mk({
          id: 'docker',
          name: 'Docker',
          category: 'dev',
          icon: 'public/assets/connectors/docker.svg',
          desc: 'Pantau container aktif, baca log servis, image & Docker Compose lokal',
          enabled: cfg.docker?.enabled !== false && dockerExists,
          connected: dockerExists,
          statusText: dockerExists ? 'Docker CLI terdeteksi' : 'Docker belum terpasang',
          fields: []
        }),
        mk({
          id: 'sentry',
          name: 'Sentry',
          category: 'dev',
          icon: 'public/assets/connectors/sentry.svg',
          mcpSlug: 'sentry',
          desc: 'Lacak crash report, stack trace & issue produksi aplikasi secara real-time',
          enabled: Boolean(cfg.sentry?.enabled || hasMcp('sentry')),
          connected: Boolean(cfg.sentry?.authToken || hasMcp('sentry')),
          statusText: hasMcp('sentry') ? 'Hermes MCP' : (cfg.sentry?.authToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'authToken', label: 'Sentry Auth Token (sntrys_...)', type: 'password', value: cfg.sentry?.authToken || '' },
            { key: 'orgSlug', label: 'Organization Slug (Opsional)', type: 'text', value: cfg.sentry?.orgSlug || '' }
          ]
        }),
        mk({
          id: 'n8n',
          name: 'n8n Automation',
          category: 'dev',
          icon: 'public/assets/connectors/n8n.svg',
          mcpSlug: 'n8n-official',
          desc: 'Picu workflow webhook otomatis & kelola eksekusi pipeline n8n',
          enabled: Boolean(cfg.n8n?.enabled || hasMcp('n8n-official')),
          connected: Boolean(cfg.n8n?.webhookUrl || cfg.n8n?.apiKey || hasMcp('n8n-official')),
          statusText: hasMcp('n8n-official') ? 'Hermes MCP' : (cfg.n8n?.webhookUrl || cfg.n8n?.apiKey ? 'Siap eksekusi' : 'Belum diatur'),
          fields: [
            { key: 'webhookUrl', label: 'n8n Webhook URL (Untuk trigger cepat)', type: 'text', value: cfg.n8n?.webhookUrl || '' },
            { key: 'baseUrl', label: 'Base URL Instance n8n (Opsional)', type: 'text', value: cfg.n8n?.baseUrl || '' },
            { key: 'apiKey', label: 'n8n API Key (Opsional)', type: 'password', value: cfg.n8n?.apiKey || '' }
          ]
        }),
        mk({
          id: 'postman',
          name: 'Postman',
          category: 'dev',
          icon: 'public/assets/connectors/postman.svg',
          mcpSlug: 'postman',
          desc: 'Akses koleksi endpoint API, environment & dokumentasi workspace Postman',
          enabled: Boolean(cfg.postman?.enabled || hasMcp('postman')),
          connected: Boolean(cfg.postman?.apiKey || hasMcp('postman')),
          statusText: hasMcp('postman') ? 'Hermes MCP' : (cfg.postman?.apiKey ? 'API aktif' : 'Belum diatur'),
          fields: [
            { key: 'apiKey', label: 'Postman API Key (PMAK-...)', type: 'password', value: cfg.postman?.apiKey || '' }
          ]
        }),
        mk({
          id: 'stripe',
          name: 'Stripe',
          category: 'dev',
          icon: 'public/assets/connectors/stripe.svg',
          mcpSlug: 'stripe',
          desc: 'Cek saldo akun, pembayaran terbaru, pelanggan & status invoice Stripe',
          enabled: Boolean(cfg.stripe?.enabled || hasMcp('stripe')),
          connected: Boolean(cfg.stripe?.secretKey || hasMcp('stripe')),
          statusText: hasMcp('stripe') ? 'Hermes MCP' : (cfg.stripe?.secretKey ? 'Key aktif' : 'Belum diatur'),
          fields: [
            { key: 'secretKey', label: 'Stripe Secret / Restricted Key (sk_... / rk_...)', type: 'password', value: cfg.stripe?.secretKey || '' }
          ]
        }),
        mk({
          id: 'figma',
          name: 'Figma',
          category: 'dev',
          icon: 'public/assets/connectors/figma.svg',
          mcpSlug: 'figma',
          desc: 'Inspeksi file desain, layer komponen, komentar & Dev Mode MCP lokal',
          enabled: Boolean(cfg.figma?.enabled || hasMcp('figma')),
          connected: Boolean(cfg.figma?.token || hasMcp('figma')),
          statusText: hasMcp('figma') ? 'Hermes MCP' : (cfg.figma?.token ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'token', label: 'Figma Personal Access Token (figd_...)', type: 'password', value: cfg.figma?.token || '' }
          ]
        }),
        mk({
          id: 'huggingface',
          name: 'Hugging Face',
          category: 'dev',
          icon: 'public/assets/connectors/huggingface.svg',
          mcpSlug: 'hugging_face',
          desc: 'Cari model open-source, dataset, Spaces & panggil Inference API',
          enabled: cfg.huggingface?.enabled !== false,
          connected: true,
          statusText: hfToken ? 'Token aktif' : (hasMcp('hugging_face') ? 'Hermes MCP' : 'Publik siap'),
          fields: [
            { key: 'token', label: 'Hugging Face Access Token hf_... (Opsional)', type: 'password', value: cfg.huggingface?.token || '' }
          ]
        }),

        // === MEDIA, RISET WEB & SMART HOME ===
        mk({
          id: 'spotify',
          name: 'Spotify',
          category: 'media',
          icon: 'public/assets/connectors/spotify.svg',
          desc: 'Kontrol pemutaran lagu aktif di laptop & cari lagu/playlist Spotify',
          enabled: cfg.spotify?.enabled !== false,
          connected: true,
          statusText: cfg.spotify?.accessToken ? 'Web API + Desktop' : 'Media Bridge',
          fields: [
            { key: 'accessToken', label: 'Spotify Web API Bearer Token (Opsional, kontrol desktop otomatis jalan)', type: 'password', value: cfg.spotify?.accessToken || '' }
          ]
        }),
        mk({
          id: 'youtube',
          name: 'YouTube',
          category: 'media',
          icon: 'public/assets/connectors/youtube.svg',
          desc: 'Cari video, ambil metadata channel & ringkas konten YouTube',
          enabled: cfg.youtube?.enabled !== false,
          connected: true,
          statusText: cfg.youtube?.apiKey ? 'Data API v3' : 'Pencarian aktif',
          fields: [
            { key: 'apiKey', label: 'YouTube Data API v3 Key (Opsional)', type: 'password', value: cfg.youtube?.apiKey || '' }
          ]
        }),
        mk({
          id: 'x_twitter',
          name: 'X (Twitter)',
          category: 'media',
          icon: 'public/assets/connectors/x_twitter.svg',
          desc: 'Baca isi postingan publik dari URL tweet & cari tren via X API v2',
          enabled: cfg.x_twitter?.enabled !== false,
          connected: true,
          statusText: cfg.x_twitter?.bearerToken ? 'API v2 aktif' : 'Reader publik',
          fields: [
            { key: 'bearerToken', label: 'X API v2 Bearer Token (Opsional untuk search penuh)', type: 'password', value: cfg.x_twitter?.bearerToken || '' }
          ]
        }),
        mk({
          id: 'canva',
          name: 'Canva',
          category: 'media',
          icon: 'public/assets/connectors/canva.svg',
          mcpSlug: 'canva',
          desc: 'Buat & kelola aset desain presentasi/sosmed via Canva Connect & MCP',
          enabled: Boolean(cfg.canva?.enabled || hasMcp('canva')),
          connected: Boolean(cfg.canva?.accessToken || hasMcp('canva')),
          statusText: hasMcp('canva') ? 'Hermes MCP' : (cfg.canva?.accessToken ? 'Token aktif' : 'Belum diatur'),
          fields: [
            { key: 'accessToken', label: 'Canva Connect Access Token', type: 'password', value: cfg.canva?.accessToken || '' }
          ]
        }),
        mk({
          id: 'web_search',
          name: 'Chrome Web & Firecrawl',
          category: 'media',
          icon: 'public/assets/connectors/web_search.svg',
          desc: 'Pencarian internet real-time & ekstraksi halaman web bersih ke Markdown',
          enabled: cfg.web_search?.enabled !== false,
          connected: true,
          statusText: firecrawlKey ? 'Firecrawl aktif' : 'Web siap',
          fields: [
            { key: 'firecrawlApiKey', label: 'Firecrawl API Key (Otomatis terbaca dari .hermes jika ada)', type: 'password', value: cfg.web_search?.firecrawlApiKey || '' }
          ]
        }),
        mk({
          id: 'brave',
          name: 'Brave Search',
          category: 'media',
          icon: 'public/assets/connectors/brave.svg',
          desc: 'Indeks pencarian web independen cepat & bebas pelacak iklan',
          enabled: Boolean(cfg.brave?.enabled || braveKey),
          connected: Boolean(braveKey),
          statusText: braveKey ? 'API aktif' : 'Belum diatur',
          fields: [
            { key: 'apiKey', label: 'Brave Search Subscription Token', type: 'password', value: cfg.brave?.apiKey || '' }
          ]
        }),
        mk({
          id: 'homeassistant',
          name: 'Home Assistant',
          category: 'media',
          icon: 'public/assets/connectors/homeassistant.svg',
          desc: 'Cek sensor ruangan & kontrol perangkat smart home langsung dari laptop',
          enabled: Boolean(cfg.homeassistant?.enabled),
          connected: Boolean(cfg.homeassistant?.baseUrl && cfg.homeassistant?.accessToken),
          statusText: cfg.homeassistant?.accessToken ? 'Smart Home siap' : 'Belum diatur',
          fields: [
            { key: 'baseUrl', label: 'URL Home Assistant (misal http://homeassistant.local:8123)', type: 'text', value: cfg.homeassistant?.baseUrl || '' },
            { key: 'accessToken', label: 'Long-Lived Access Token', type: 'password', value: cfg.homeassistant?.accessToken || '' }
          ]
        })
      ]
    };
  }

  async updateConnector(connectorId, patch) {
    const cfg = safeReadJson(this.connectorsPath, {});
    cfg[connectorId] = { ...(cfg[connectorId] || {}), ...patch };
    safeWriteJson(this.connectorsPath, cfg);
    return this.getConnectorsStatus();
  }

  async executeConnector(connector, action, params = {}) {
    const cfg = safeReadJson(this.connectorsPath, {});
    const hermes = this._readHermesEnvironment();
    const hEnv = hermes.envMap;
    const act = String(action || 'test').toLowerCase();

    if (connector === 'whatsapp') {
      const waAppId = '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App';
      if (act === 'open' || act === 'open_desktop' || act === 'launch') {
        await execPromise('explorer.exe', [`shell:AppsFolder\\${waAppId}`], { timeoutMs: 5000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2800));
        const live = await this._getWhatsAppLiveStatus(true);
        const listRes = await this.runMediaBridgeAction('listWhatsAppChats', '').catch(() => ({ chats: [] }));
        return {
          ok: live.desktopRunning,
          connected: live.desktopRunning || live.hermesConnected,
          whatsappOpen: live.desktopRunning,
          chats: listRes?.chats || [],
          message: live.desktopRunning
            ? 'Aplikasi WhatsApp Desktop berhasil dibuka dan terhubung ke Live Bridge.'
            : 'Perintah buka WhatsApp Desktop dikirim. Pastikan WhatsApp terinstal dan sudah login.'
        };
      }

      if (act === 'pair_qr' || act === 'oauth') {
        if (!hermes.hasHermesCli) {
          return { ok: false, error: 'hermes.exe tidak ditemukan di AppData\\Local\\hermes\\bin.' };
        }
        const live = await this._getWhatsAppLiveStatus(true);
        const sessDir = path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'whatsapp', 'session');
        if (live.hermesState === 'logged_out' && fs.existsSync(sessDir)) {
          try { fs.rmSync(sessDir, { recursive: true, force: true }); } catch (_e) {}
        }
        const cmd = `Start-Process powershell.exe -ArgumentList '-NoExit','-Command','& "${hermes.hermesExe}" whatsapp'`;
        await execPromise('powershell.exe', ['-NoProfile', '-Command', cmd], { timeoutMs: 8000 });
        return {
          ok: true,
          message: 'Terminal QR Pairing WhatsApp Hermes dibuka. Scan QR code dari HP WhatsApp -> Perangkat Tertaut.'
        };
      }

      if (act === 'send') {
        const to = String(params.to || params.contact || params.sender || '').trim();
        const message = String(params.message || params.text || '').trim();
        if (!to || !message) return { ok: false, error: 'Parameter to (nama kontak/grup) dan message wajib diisi.' };
        let live = await this._getWhatsAppLiveStatus(true);
        if (!live.desktopRunning) {
          await execPromise('explorer.exe', [`shell:AppsFolder\\${waAppId}`], { timeoutMs: 5000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 3200));
          live = await this._getWhatsAppLiveStatus(true);
        }
        if (!live.desktopRunning) {
          return { ok: false, error: 'Aplikasi WhatsApp Desktop belum berjalan di Windows. Buka WhatsApp Desktop terlebih dahulu.' };
        }
        const val = `${Buffer.from(to, 'utf8').toString('base64')}|${Buffer.from(message, 'utf8').toString('base64')}`;
        return this.runMediaBridgeAction('sendWhatsApp', val);
      }

      const live = await this._getWhatsAppLiveStatus(true);
      const listRes = live.desktopRunning
        ? await this.runMediaBridgeAction('listWhatsAppChats', '').catch(() => ({ whatsappOpen: true, chats: [] }))
        : { ok: true, whatsappOpen: false, chats: [] };
      const chats = Array.isArray(listRes?.chats) ? listRes.chats : [];
      const isConnected = live.desktopRunning || live.hermesConnected;

      return {
        ok: isConnected,
        connected: isConnected,
        whatsappDesktop: {
          installed: true,
          running: live.desktopRunning,
          chatCount: chats.length
        },
        hermesBridge: {
          connected: live.hermesConnected,
          state: live.hermesState
        },
        chats,
        summary: isConnected
          ? `WhatsApp TERHUBUNG (${live.desktopRunning ? `WA Desktop aktif, ${chats.length} chat terbaca` : 'Hermes Bridge aktif'}).`
          : `WhatsApp BELUM NYAMBUNG saat ini karena: (1) Aplikasi WhatsApp Desktop di Windows sedang tertutup/belum dibuka, dan (2) Sesi Hermes WhatsApp Bridge berstatus '${live.hermesState}' (logout/perlu scan ulang QR). Untuk menyambungkan: panggil use_connector whatsapp dengan action 'open' untuk menyalakan WA Desktop, atau action 'pair_qr' untuk scan ulang QR Hermes.`,
        error: isConnected ? undefined : 'WA Desktop sedang tertutup & Hermes Bridge belum login QR (Klik Atur -> Buka WA Desktop atau Scan QR)'
      };
    }

    // Direct-to-Browser PKCE OAuth (no terminal / PowerShell popup)
    if (act === 'oauth') {
      const status = await this.getConnectorsStatus();
      const item = status.items.find((i) => i.id === connector);
      if (!item || !item.mcpSlug) {
        return { ok: false, error: 'Konektor ini menggunakan token langsung, bukan OAuth Browser.' };
      }
      return this._startMcpBrowserOAuth(connector, item, cfg);
    }

    // If connector is authenticated via Hermes MCP OAuth (without manual API key, or explicit mcpTool requested)
    const mcpConnectorMap = {
      notion: { slug: 'notion', hasManual: Boolean((cfg.notion?.apiKey || hEnv.NOTION_API_KEY || '').trim()) },
      linear: { slug: 'linear', hasManual: Boolean((cfg.linear?.apiKey || hEnv.LINEAR_API_KEY || '').trim()) },
      todoist: { slug: 'todoist', hasManual: Boolean((cfg.todoist?.apiToken || '').trim()) },
      airtable: { slug: 'airtable', hasManual: Boolean((cfg.airtable?.token || '').trim()) },
      clickup: { slug: 'clickup', hasManual: Boolean((cfg.clickup?.apiToken || '').trim()) },
      jira: { slug: 'atlassian', hasManual: Boolean(cfg.jira?.domain && cfg.jira?.email && cfg.jira?.apiToken) },
      atlassian: { slug: 'atlassian', hasManual: Boolean(cfg.atlassian?.domain && cfg.atlassian?.email && cfg.atlassian?.apiToken) },
      dropbox: { slug: 'dropbox', hasManual: Boolean((cfg.dropbox?.accessToken || '').trim() || fs.existsSync(path.join(os.homedir(), 'Dropbox'))) },
      gitlab: { slug: 'gitlab', hasManual: Boolean((cfg.gitlab?.token || '').trim()) },
      vercel: { slug: 'vercel', hasManual: Boolean((cfg.vercel?.token || '').trim()) },
      supabase: { slug: 'supabase', hasManual: Boolean((cfg.supabase?.projectUrl && cfg.supabase?.apiKey) || cfg.supabase?.accessToken) },
      cloudflare: { slug: 'cloudflare', hasManual: Boolean((cfg.cloudflare?.apiToken || '').trim()) },
      sentry: { slug: 'sentry', hasManual: Boolean((cfg.sentry?.authToken || '').trim()) },
      n8n: { slug: 'n8n-official', hasManual: Boolean((cfg.n8n?.webhookUrl || (cfg.n8n?.baseUrl && cfg.n8n?.apiKey) || '').trim()) },
      postman: { slug: 'postman', hasManual: Boolean((cfg.postman?.apiKey || '').trim()) },
      stripe: { slug: 'stripe', hasManual: Boolean((cfg.stripe?.secretKey || '').trim()) },
      figma: { slug: 'figma', hasManual: Boolean((cfg.figma?.token || '').trim()) },
      huggingface: { slug: 'hugging_face', hasManual: Boolean((cfg.huggingface?.token || hEnv.HF_TOKEN || hEnv.HUGGINGFACE_TOKEN || '').trim()) },
      canva: { slug: 'canva', hasManual: Boolean((cfg.canva?.accessToken || '').trim()) }
    };
    const mcpEntry = mcpConnectorMap[connector];
    if (mcpEntry && hermes.mcpTokens.has(mcpEntry.slug) && (!mcpEntry.hasManual || params.mcpTool || params.tool)) {
      return this._executeMcpOAuthConnector(mcpEntry.slug, act, params);
    }

    if (connector === 'telegram') {
      const token = (cfg.telegram?.botToken || hEnv.TELEGRAM_BOT_TOKEN || '').trim();
      let chatId = String(params.chatId || cfg.telegram?.chatId || hEnv.TELEGRAM_CHAT_ID || '').trim();
      if (!token) return { ok: false, error: 'Telegram Bot Token belum diisi.' };
      if (act === 'send') {
        if (!chatId) return { ok: false, error: 'Chat ID tujuan belum diisi. Kirim pesan /start dari HP ke bot Telegram kamu dulu agar ter-bind otomatis.' };
        const res = await httpRequestRaw(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { chat_id: chatId.split(/[,;\s]+/)[0], text: String(params.message || params.text || '') }
        });
        return { ok: res.statusCode < 300, data: safeJsonParse(res.body) };
      }
      const meRes = await httpRequestRaw(`https://api.telegram.org/bot${token}/getMe`, { timeoutMs: 8000 });
      const meData = safeJsonParse(meRes.body);
      if (meRes.statusCode >= 300 || !meData?.ok) {
        return { ok: false, error: meData?.description || 'Token Bot Telegram tidak valid.' };
      }
      const botUsername = meData.result?.username ? `@${meData.result.username}` : (meData.result?.first_name || 'Bot');
      const res = await httpRequestRaw(`https://api.telegram.org/bot${token}/getUpdates?limit=8`, { timeoutMs: 10000 });
      const upData = safeJsonParse(res.body);
      const updates = Array.isArray(upData?.result) ? upData.result : [];
      if (!chatId && updates.length > 0) {
        const lastMsg = [...updates].reverse().find((u) => u.message && u.message.chat && u.message.chat.id);
        if (lastMsg) {
          chatId = String(lastMsg.message.chat.id);
          cfg.telegram = { ...(cfg.telegram || {}), enabled: true, botToken: token, chatId };
          safeWriteJson(this.connectorsPath, cfg);
          this.getConnectorsStatus().then((st) => this.sendToRenderer('connectors-updated', st)).catch(() => {});
        }
      }
      return {
        ok: true,
        botUsername,
        chatId,
        remoteControlActive: true,
        summary: `Remote Control Telegram siap via ${botUsername}${chatId ? ` (Chat ID: ${chatId})` : ' — kirim /start dari HP ke bot untuk auto-bind Chat ID'}.`,
        data: upData
      };
    }

    if (connector === 'discord') {
      const hook = (cfg.discord?.webhookUrl || '').trim();
      const botToken = (cfg.discord?.botToken || hEnv.DISCORD_BOT_TOKEN || '').trim();
      const channelId = String(params.channelId || cfg.discord?.channelId || '').trim();
      if (act === 'send') {
        const content = String(params.message || params.text || params.content || '').trim();
        if (hook) {
          const r = await httpRequestRaw(hook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { content }
          });
          return { ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode };
        }
        if (botToken && channelId) {
          const r = await httpRequestRaw(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: { content }
          });
          return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
        }
        return { ok: false, error: 'Isi Webhook URL atau Bot Token + Channel ID Discord.' };
      }
      if (botToken) {
        const url = channelId && act === 'list'
          ? `https://discord.com/api/v10/channels/${channelId}/messages?limit=10`
          : 'https://discord.com/api/v10/users/@me';
        const r = await httpRequestRaw(url, { headers: { 'Authorization': `Bot ${botToken}` } });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      if (hook) {
        const r = await httpRequestRaw(hook, { method: 'GET' });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      return { ok: false, error: 'Discord belum diatur (isi Webhook URL atau Bot Token).' };
    }

    if (connector === 'slack') {
      const token = (cfg.slack?.botToken || hEnv.SLACK_BOT_TOKEN || '').trim();
      const hook = (cfg.slack?.webhookUrl || '').trim();
      const channel = String(params.channelId || params.channel || cfg.slack?.channelId || '').trim();
      if (act === 'send') {
        const text = String(params.message || params.text || '').trim();
        if (hook && !channel) {
          const r = await httpRequestRaw(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { text } });
          return { ok: r.statusCode < 300, body: r.body };
        }
        if (token && channel) {
          const r = await httpRequestRaw('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: { channel, text }
          });
          const d = safeJsonParse(r.body);
          return { ok: Boolean(d && d.ok), data: d };
        }
      }
      if (token) {
        const endpoint = act === 'list' && channel
          ? `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=10`
          : 'https://slack.com/api/auth.test';
        const r = await httpRequestRaw(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = safeJsonParse(r.body);
        return { ok: Boolean(d && d.ok), data: d, error: d && d.error };
      }
      if (hook) return { ok: true, info: 'Webhook Slack tersimpan dan siap kirim pesan.' };
      return { ok: false, error: 'Slack Bot Token atau Webhook URL belum diisi.' };
    }

    if (connector === 'github') {
      const ghBin = fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
      const tok = (cfg.github?.token || hEnv.GITHUB_TOKEN || hEnv.GH_TOKEN || '').trim();
      const env = tok ? { GH_TOKEN: tok } : {};
      if (act === 'notifications') {
        const res = await execPromise(ghBin, ['api', 'notifications', '--jq', '.[:10] | map({id: .id, repo: .repository.full_name, title: .subject.title, type: .subject.type, reason: .reason, updated_at: .updated_at})'], { env, timeoutMs: 15000 });
        return { ok: res.ok, output: res.stdout || res.stderr };
      }
      if (act === 'repos') {
        const res = await execPromise(ghBin, ['repo', 'list', '--limit', '15', '--json', 'nameWithOwner,updatedAt,description,isPrivate'], { env, timeoutMs: 15000 });
        return { ok: res.ok, output: res.stdout || res.stderr };
      }
      if (act === 'prs') {
        const res = await execPromise(ghBin, ['search', 'prs', '--author=@me', '--state=open', '--json', 'repository,title,url,updatedAt'], { env, timeoutMs: 15000 });
        return { ok: res.ok, output: res.stdout || res.stderr };
      }
      if (act === 'cli' && Array.isArray(params.args)) {
        const res = await execPromise(ghBin, params.args.map(String), { env, timeoutMs: 20000 });
        return { ok: res.ok, output: res.stdout || res.stderr };
      }
      const statusRes = await execPromise(ghBin, ['auth', 'status'], { env, timeoutMs: 10000 });
      return { ok: statusRes.ok, output: `${statusRes.stdout}\n${statusRes.stderr}`.trim() };
    }

    if (connector === 'gmail') {
      const email = cfg.gmail?.email || '';
      const appPassword = (cfg.gmail?.appPassword || '').replace(/\s+/g, '');
      const gapiScript = path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'skills', 'productivity', 'google-workspace', 'scripts', 'google_api.py');
      const hasHermesToken = fs.existsSync(path.join(os.homedir(), '.hermes', 'google_token.json')) ||
        fs.existsSync(path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'google_token.json'));

      if (email && appPassword) {
        if (act === 'send') {
          const pyCode = [
            'import smtplib, sys, json',
            'from email.mime.text import MIMEText',
            'data = json.loads(sys.stdin.read())',
            'msg = MIMEText(data["body"], "plain", "utf-8")',
            'msg["Subject"] = data["subject"]',
            'msg["From"] = data["email"]',
            'msg["To"] = data["to"]',
            'with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as s:',
            '    s.login(data["email"], data["password"])',
            '    s.send_message(msg)',
            'print(json.dumps({"ok": True, "sentTo": data["to"]}))'
          ].join('\n');
          return this._runPythonWithStdin(pyCode, {
            email,
            password: appPassword,
            to: params.to || '',
            subject: params.subject || '(Tanpa Subjek)',
            body: params.body || params.message || ''
          });
        }
        const searchCriteria = params.unreadOnly !== false && !params.query ? 'UNSEEN' : 'ALL';
        const pyCode = [
          'import imaplib, email, json, sys',
          'from email.header import decode_header',
          'cfg = json.loads(sys.stdin.read())',
          'def dec(v):',
          '    if not v: return ""',
          '    parts = decode_header(v)',
          '    out = ""',
          '    for p, enc in parts:',
          '        out += p.decode(enc or "utf-8", errors="replace") if isinstance(p, bytes) else str(p)',
          '    return out',
          'm = imaplib.IMAP4_SSL("imap.gmail.com", 993)',
          'm.login(cfg["email"], cfg["password"])',
          'm.select("INBOX", readonly=True)',
          'typ, nums = m.search(None, cfg["criteria"])',
          'ids = nums[0].split()[-10:] if nums and nums[0] else []',
          'items = []',
          'for i in reversed(ids):',
          '    _, msg_data = m.fetch(i, "(RFC822.HEADER BODY.PEEK[TEXT]<0.400>)")',
          '    raw_hdr = msg_data[0][1] if msg_data and msg_data[0] else b""',
          '    em = email.message_from_bytes(raw_hdr)',
          '    items.append({"id": i.decode(), "from": dec(em.get("From")), "subject": dec(em.get("Subject")), "date": em.get("Date", "")})',
          'm.logout()',
          'print(json.dumps({"ok": True, "emails": items}))'
        ].join('\n');
        return this._runPythonWithStdin(pyCode, { email, password: appPassword, criteria: searchCriteria });
      }

      if (hasHermesToken && fs.existsSync(gapiScript)) {
        const args = act === 'send'
          ? [gapiScript, 'gmail', 'send', '--to', String(params.to || ''), '--subject', String(params.subject || ''), '--body', String(params.body || '')]
          : [gapiScript, 'gmail', 'search', String(params.query || 'is:unread'), '--max', '10'];
        const res = await execPromise('python', args, { timeoutMs: 20000 });
        return { ok: res.ok, output: res.stdout || res.stderr };
      }

      return { ok: false, error: 'Isi Email + Google App Password di Atur Gmail.' };
    }

    if (connector === 'google_calendar') {
      const icalUrl = (cfg.google_calendar?.icalUrl || '').trim();
      if (icalUrl) {
        try {
          const res = await httpRequestRaw(icalUrl, { timeoutMs: 12000 });
          const events = this._parseIcsEvents(res.body);
          return { ok: true, events };
        } catch (err) {
          return { ok: false, error: `Gagal memuat iCal URL: ${err.message}` };
        }
      }
      const gapiScript = path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'skills', 'productivity', 'google-workspace', 'scripts', 'google_api.py');
      const hasHermesToken = fs.existsSync(path.join(os.homedir(), '.hermes', 'google_token.json')) ||
        fs.existsSync(path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'google_token.json'));
      if (hasHermesToken && fs.existsSync(gapiScript)) {
        const res = await execPromise('python', [gapiScript, 'calendar', 'list'], { timeoutMs: 20000 });
        return { ok: res.ok, output: res.stdout || res.stderr };
      }
      return { ok: false, error: 'Tempel Secret Address iCal (.ics) dari Setelan Google Calendar.' };
    }

    if (connector === 'google_drive' || connector === 'google_docs' || connector === 'google_sheets') {
      const token = (cfg[connector]?.accessToken || '').trim();
      const gapiScript = path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'skills', 'productivity', 'google-workspace', 'scripts', 'google_api.py');
      const hasHermesToken = fs.existsSync(path.join(os.homedir(), '.hermes', 'google_token.json')) ||
        fs.existsSync(path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'google_token.json'));

      if (connector === 'google_sheets' && (params.sheetUrl || cfg.google_sheets?.sheetUrl) && !token && !hasHermesToken) {
        const rawUrl = String(params.sheetUrl || cfg.google_sheets?.sheetUrl).trim();
        const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const sheetId = idMatch ? idMatch[1] : rawUrl;
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const r = await httpRequestRaw(csvUrl, { timeoutMs: 12000 });
        return { ok: r.statusCode < 400, preview: r.body.slice(0, 8000) };
      }

      if (token) {
        if (connector === 'google_drive') {
          const q = params.query ? `&q=${encodeURIComponent(`name contains '${params.query}'`)}` : '';
          const r = await httpRequestRaw(`https://www.googleapis.com/drive/v3/files?pageSize=12&fields=files(id,name,mimeType,modifiedTime)${q}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
        }
        if (connector === 'google_docs' && params.documentId) {
          const r = await httpRequestRaw(`https://docs.googleapis.com/v1/documents/${params.documentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
        }
        const r = await httpRequestRaw('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }

      if (hasHermesToken && fs.existsSync(gapiScript)) {
        const svc = connector === 'google_drive' ? 'drive' : connector === 'google_docs' ? 'docs' : 'sheets';
        const res = await execPromise('python', [gapiScript, svc, 'list'], { timeoutMs: 20000 });
        return { ok: res.ok, output: res.stdout || res.stderr };
      }
      return { ok: false, error: `${connector} memerlukan Google OAuth Token atau Sheet URL.` };
    }

    if (connector === 'microsoft_365') {
      const ical = (cfg.microsoft_365?.icalUrl || '').trim();
      const token = (cfg.microsoft_365?.accessToken || '').trim();
      if (token) {
        const ep = act === 'emails' ? 'https://graph.microsoft.com/v1.0/me/messages?$top=10' : 'https://graph.microsoft.com/v1.0/me';
        const r = await httpRequestRaw(ep, { headers: { 'Authorization': `Bearer ${token}` } });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      if (ical) {
        const r = await httpRequestRaw(ical, { timeoutMs: 12000 });
        return { ok: true, events: this._parseIcsEvents(r.body) };
      }
      return { ok: false, error: 'Isi URL Kalender Outlook (.ics) atau Graph Bearer Token.' };
    }

    if (connector === 'notion') {
      const token = (cfg.notion?.apiKey || hEnv.NOTION_API_KEY || '').trim();
      if (!token) return { ok: false, error: 'Notion Integration Token belum diisi.' };
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      };
      if (act === 'read_page' && params.pageId) {
        const cleanId = String(params.pageId).replace(/[^a-fA-F0-9-]/g, '');
        const res = await httpRequestRaw(`https://api.notion.com/v1/blocks/${cleanId}/children?page_size=50`, { method: 'GET', headers });
        return { ok: res.statusCode < 300, data: safeJsonParse(res.body) };
      }
      if (act === 'create_page' && params.parentPageId) {
        const res = await httpRequestRaw('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers,
          body: {
            parent: { page_id: params.parentPageId },
            properties: { title: { title: [{ text: { content: String(params.title || 'Catatan Agent') } }] } },
            children: params.content ? [{
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: String(params.content).slice(0, 1950) } }] }
            }] : []
          }
        });
        return { ok: res.statusCode < 300, data: safeJsonParse(res.body) };
      }
      const res = await httpRequestRaw('https://api.notion.com/v1/search', {
        method: 'POST',
        headers,
        body: { query: params.query || '', page_size: 12 }
      });
      return { ok: res.statusCode < 300, status: res.statusCode, data: safeJsonParse(res.body) };
    }

    if (connector === 'obsidian') {
      const vault = (cfg.obsidian?.vaultPath || this._detectDefaultObsidianVault() || '').trim();
      if (!vault || !fs.existsSync(vault)) return { ok: false, error: 'Folder Vault Obsidian belum diatur atau tidak ditemukan.' };
      if (act === 'create' || act === 'write') {
        const title = String(params.title || `Note-${Date.now()}`).replace(/[<>:"/\\|?*]/g, '-');
        const fp = path.join(vault, title.endsWith('.md') ? title : `${title}.md`);
        safeWriteText(fp, String(params.content || ''));
        return { ok: true, savedPath: fp };
      }
      if (act === 'read' && params.note) {
        const fp = path.resolve(vault, String(params.note));
        if (!fs.existsSync(fp)) return { ok: false, error: `Catatan tidak ditemukan: ${fp}` };
        return { ok: true, content: safeReadText(fp, '').slice(0, 15000) };
      }
      const notes = [];
      const walk = (dir, depth = 0) => {
        if (depth > 3 || notes.length >= 30) return;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (ent.name.startsWith('.')) continue;
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(full, depth + 1);
          else if (ent.name.endsWith('.md')) {
            if (!params.query || ent.name.toLowerCase().includes(String(params.query).toLowerCase())) {
              notes.push(path.relative(vault, full));
            }
          }
        }
      };
      walk(vault);
      return { ok: true, vault, notes };
    }

    if (connector === 'linear') {
      const key = (cfg.linear?.apiKey || hEnv.LINEAR_API_KEY || '').trim();
      if (!key) return { ok: false, error: 'Isi Linear API Key atau klik Login OAuth.' };
      const gql = act === 'create' && params.teamId && params.title
        ? {
            query: 'mutation($title: String!, $teamId: String!, $description: String) { issueCreate(input: { title: $title, teamId: $teamId, description: $description }) { success issue { identifier title url } } }',
            variables: { title: String(params.title), teamId: String(params.teamId), description: String(params.description || '') }
          }
        : {
            query: '{ viewer { name email } issues(first: 10, orderBy: updatedAt) { nodes { identifier title state { name } priorityLabel url } } }'
          };
      const r = await httpRequestRaw('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: gql
      });
      const parsed = safeJsonParse(r.body);
      return { ok: r.statusCode < 300 && !parsed?.errors, data: parsed };
    }

    if (connector === 'todoist') {
      const token = (cfg.todoist?.apiToken || '').trim();
      if (!token) return { ok: false, error: 'Todoist API Token belum diisi.' };
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      if (act === 'create' && params.content) {
        const r = await httpRequestRaw('https://api.todoist.com/rest/v2/tasks', {
          method: 'POST',
          headers,
          body: { content: String(params.content), due_string: params.due || undefined }
        });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      const r = await httpRequestRaw('https://api.todoist.com/rest/v2/tasks', { headers });
      const tasks = safeJsonParse(r.body);
      return { ok: r.statusCode < 300, tasks: Array.isArray(tasks) ? tasks.slice(0, 15) : tasks };
    }

    if (connector === 'trello') {
      const key = (cfg.trello?.apiKey || '').trim();
      const token = (cfg.trello?.token || '').trim();
      if (!key || !token) return { ok: false, error: 'Trello API Key dan Token belum diisi.' };
      const authQ = `key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
      if (act === 'create_card' && params.idList && params.name) {
        const r = await httpRequestRaw(`https://api.trello.com/1/cards?${authQ}&idList=${encodeURIComponent(params.idList)}&name=${encodeURIComponent(params.name)}`, { method: 'POST' });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      const r = await httpRequestRaw(`https://api.trello.com/1/members/me/boards?fields=name,url&${authQ}`);
      return { ok: r.statusCode < 300, boards: safeJsonParse(r.body) };
    }

    if (connector === 'airtable') {
      const token = (cfg.airtable?.token || '').trim();
      if (!token) return { ok: false, error: 'Airtable Personal Access Token belum diisi.' };
      const url = params.baseId && params.table
        ? `https://api.airtable.com/v0/${params.baseId}/${encodeURIComponent(params.table)}?maxRecords=15`
        : 'https://api.airtable.com/v0/meta/bases';
      const r = await httpRequestRaw(url, { headers: { 'Authorization': `Bearer ${token}` } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'clickup') {
      const token = (cfg.clickup?.apiToken || '').trim();
      if (!token) return { ok: false, error: 'ClickUp Personal Token belum diisi.' };
      const url = params.listId
        ? `https://api.clickup.com/api/v2/list/${params.listId}/task`
        : 'https://api.clickup.com/api/v2/team';
      const r = await httpRequestRaw(url, { headers: { 'Authorization': token } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'jira' || connector === 'atlassian') {
      const sec = cfg[connector] || cfg.jira || cfg.atlassian || {};
      const domain = String(sec.domain || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const email = String(sec.email || '').trim();
      const apiToken = String(sec.apiToken || '').trim();
      if (!domain || !email || !apiToken) return { ok: false, error: 'Isi Domain, Email, dan API Token Atlassian (atau Login OAuth).' };
      const basic = Buffer.from(`${email}:${apiToken}`).toString('base64');
      const headers = { 'Authorization': `Basic ${basic}`, 'Accept': 'application/json' };
      const url = connector === 'atlassian'
        ? `https://${domain}/wiki/rest/api/content?limit=10`
        : `https://${domain}/rest/api/3/search?jql=${encodeURIComponent(params.jql || 'order by updated DESC')}&maxResults=10`;
      const r = await httpRequestRaw(url, { headers });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'dropbox') {
      const localDbx = path.join(os.homedir(), 'Dropbox');
      const token = (cfg.dropbox?.accessToken || '').trim();
      if (token) {
        const r = await httpRequestRaw('https://api.dropboxapi.com/2/files/list_folder', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: { path: params.path || '', limit: 25 }
        });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      if (fs.existsSync(localDbx)) {
        const entries = fs.readdirSync(localDbx).slice(0, 30);
        return { ok: true, localPath: localDbx, entries };
      }
      return { ok: false, error: 'Isi Dropbox Access Token atau pasang folder Dropbox lokal.' };
    }

    if (connector === 'gitlab') {
      const token = (cfg.gitlab?.token || '').trim();
      const host = String(cfg.gitlab?.host || 'https://gitlab.com').replace(/\/+$/, '');
      if (!token) return { ok: false, error: 'GitLab Personal Access Token belum diisi.' };
      const ep = act === 'mrs' ? `${host}/api/v4/merge_requests?scope=assigned_to_me&state=opened` : `${host}/api/v4/projects?membership=true&per_page=12`;
      const r = await httpRequestRaw(ep, { headers: { 'PRIVATE-TOKEN': token } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'vercel') {
      const token = (cfg.vercel?.token || '').trim();
      if (!token) return { ok: false, error: 'Vercel Access Token belum diisi (atau klik Login OAuth).' };
      const ep = act === 'projects' ? 'https://api.vercel.com/v9/projects?limit=12' : 'https://api.vercel.com/v6/deployments?limit=10';
      const r = await httpRequestRaw(ep, { headers: { 'Authorization': `Bearer ${token}` } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'supabase') {
      const projectUrl = String(cfg.supabase?.projectUrl || '').replace(/\/+$/, '');
      const apiKey = (cfg.supabase?.apiKey || '').trim();
      const mgmtToken = (cfg.supabase?.accessToken || '').trim();
      if (projectUrl && apiKey) {
        const ep = params.table ? `${projectUrl}/rest/v1/${params.table}?select=*&limit=15` : `${projectUrl}/rest/v1/`;
        const r = await httpRequestRaw(ep, { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` } });
        return { ok: r.statusCode < 400, status: r.statusCode, data: safeJsonParse(r.body) || 'REST Schema OK' };
      }
      if (mgmtToken) {
        const r = await httpRequestRaw('https://api.supabase.com/v1/projects', { headers: { Authorization: `Bearer ${mgmtToken}` } });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      return { ok: false, error: 'Isi Project URL + API Key Supabase atau klik Login OAuth.' };
    }

    if (connector === 'cloudflare') {
      const token = (cfg.cloudflare?.apiToken || '').trim();
      if (!token) return { ok: false, error: 'Cloudflare API Token belum diisi.' };
      const ep = act === 'zones' ? 'https://api.cloudflare.com/client/v4/zones?per_page=15' : 'https://api.cloudflare.com/client/v4/user/tokens/verify';
      const r = await httpRequestRaw(ep, { headers: { Authorization: `Bearer ${token}` } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'docker') {
      const dockerBin = fs.existsSync('C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe')
        ? 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe'
        : 'docker';
      if (act === 'logs' && params.container) {
        const r = await execPromise(dockerBin, ['logs', '--tail', '60', String(params.container)], { timeoutMs: 12000 });
        return { ok: r.ok, logs: r.stdout || r.stderr };
      }
      const r = await execPromise(dockerBin, ['ps', '--format', '{{json .}}'], { timeoutMs: 10000 });
      if (!r.ok) return { ok: false, error: r.stderr || 'Pastikan Docker Desktop sedang berjalan.' };
      const containers = r.stdout.split(/\r?\n/).filter(Boolean).map((l) => safeJsonParse(l) || l);
      return { ok: true, containers };
    }

    if (connector === 'sentry') {
      const token = (cfg.sentry?.authToken || '').trim();
      if (!token) return { ok: false, error: 'Sentry Auth Token belum diisi.' };
      const org = (cfg.sentry?.orgSlug || params.org || '').trim();
      const ep = org ? `https://sentry.io/api/0/organizations/${org}/issues/?limit=10` : 'https://sentry.io/api/0/organizations/';
      const r = await httpRequestRaw(ep, { headers: { Authorization: `Bearer ${token}` } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'n8n') {
      const hook = (cfg.n8n?.webhookUrl || params.webhookUrl || '').trim();
      const baseUrl = String(cfg.n8n?.baseUrl || '').replace(/\/+$/, '');
      const apiKey = (cfg.n8n?.apiKey || '').trim();
      if ((act === 'trigger' || act === 'send' || (act === 'test' && !apiKey)) && hook) {
        const r = await httpRequestRaw(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: params.payload || { source: 'DynamicIslandAgent', timestamp: new Date().toISOString() }
        });
        return { ok: r.statusCode < 400, status: r.statusCode, response: safeJsonParse(r.body) || r.body };
      }
      if (baseUrl && apiKey) {
        const r = await httpRequestRaw(`${baseUrl}/api/v1/workflows?limit=15`, { headers: { 'X-N8N-API-KEY': apiKey } });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      return { ok: false, error: 'Isi n8n Webhook URL atau Base URL + API Key.' };
    }

    if (connector === 'postman') {
      const key = (cfg.postman?.apiKey || '').trim();
      if (!key) return { ok: false, error: 'Postman API Key belum diisi.' };
      const r = await httpRequestRaw('https://api.getpostman.com/collections', { headers: { 'X-Api-Key': key } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'stripe') {
      const key = (cfg.stripe?.secretKey || '').trim();
      if (!key) return { ok: false, error: 'Stripe Secret Key belum diisi.' };
      const ep = act === 'charges' ? 'https://api.stripe.com/v1/charges?limit=10' : 'https://api.stripe.com/v1/balance';
      const r = await httpRequestRaw(ep, { headers: { Authorization: `Bearer ${key}` } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'figma') {
      const token = (cfg.figma?.token || '').trim();
      if (!token) return { ok: false, error: 'Figma Personal Access Token belum diisi (atau klik Login OAuth).' };
      const ep = params.fileKey
        ? `https://api.figma.com/v1/files/${params.fileKey}?depth=2`
        : 'https://api.figma.com/v1/me';
      const r = await httpRequestRaw(ep, { headers: { 'X-Figma-Token': token } });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'huggingface') {
      const token = (cfg.huggingface?.token || hEnv.HF_TOKEN || hEnv.HUGGINGFACE_TOKEN || '').trim();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      if (act === 'whoami' && token) {
        const r = await httpRequestRaw('https://huggingface.co/api/whoami-v2', { headers });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      const q = encodeURIComponent(params.query || 'qwen');
      const r = await httpRequestRaw(`https://huggingface.co/api/models?search=${q}&limit=8&sort=downloads&direction=-1`, { headers });
      return { ok: r.statusCode < 300, models: safeJsonParse(r.body) };
    }

    if (connector === 'spotify') {
      if (['playpause', 'next', 'prev'].includes(act)) {
        const mapAct = act === 'playpause' ? 'playPause' : act;
        return this.runMediaBridgeAction(mapAct, '');
      }
      const token = (cfg.spotify?.accessToken || '').trim();
      if (token && params.query) {
        const r = await httpRequestRaw(`https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(params.query)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      const live = this.getLiveContext ? this.getLiveContext() : {};
      return { ok: true, nowPlaying: live.media || { info: 'Media Bridge aktif, putar lagu di Spotify Desktop.' } };
    }

    if (connector === 'youtube') {
      const q = String(params.query || 'teknologi AI terbaru').trim();
      const apiKey = (cfg.youtube?.apiKey || '').trim();
      if (apiKey) {
        const r = await httpRequestRaw(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}`);
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      const r = await httpRequestRaw(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeoutMs: 12000
      });
      const videos = [];
      const re = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}/g;
      let m;
      while ((m = re.exec(r.body)) !== null && videos.length < 8) {
        videos.push({ videoId: m[1], title: m[2], url: `https://www.youtube.com/watch?v=${m[1]}` });
      }
      return { ok: true, query: q, videos };
    }

    if (connector === 'x_twitter') {
      const bearer = (cfg.x_twitter?.bearerToken || '').trim();
      const tweetUrlOrId = String(params.tweetId || params.url || '').trim();
      const idMatch = tweetUrlOrId.match(/status\/(\d+)/) || tweetUrlOrId.match(/^(\d{10,25})$/);
      if (idMatch) {
        const r = await httpRequestRaw(`https://cdn.syndication.twimg.com/tweet-result?id=${idMatch[1]}&token=x`, { timeoutMs: 10000 });
        return { ok: r.statusCode < 300, tweet: safeJsonParse(r.body) };
      }
      if (bearer && params.query) {
        const r = await httpRequestRaw(`https://api.x.com/2/tweets/search/recent?max_results=10&query=${encodeURIComponent(params.query)}`, {
          headers: { Authorization: `Bearer ${bearer}` }
        });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      return { ok: true, info: 'Reader tweet publik siap (kirim URL/ID tweet, atau isi Bearer Token untuk search).' };
    }

    if (connector === 'canva') {
      const token = (cfg.canva?.accessToken || '').trim();
      if (!token) return { ok: false, error: 'Isi Canva Access Token atau klik Login OAuth.' };
      const r = await httpRequestRaw('https://api.canva.com/rest/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'web_search') {
      const query = String(params.query || params.url || 'berita teknologi hari ini').trim();
      const fcKey = (cfg.web_search?.firecrawlApiKey || hEnv.FIRECRAWL_API_KEY || '').trim();
      if (/^https?:\/\//i.test(query)) {
        if (fcKey) {
          try {
            const fc = await httpRequestRaw('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
              body: { url: query, formats: ['markdown'] },
              timeoutMs: 20000
            });
            if (fc.statusCode >= 200 && fc.statusCode < 300) {
              const parsed = safeJsonParse(fc.body);
              return { ok: true, url: query, markdown: String(parsed?.data?.markdown || '').slice(0, 16000) };
            }
          } catch (_e) {}
        }
        const rawPage = await httpRequestRaw(query, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DynamicIslandAgent/2.0' },
          timeoutMs: 15000
        });
        const cleanText = rawPage.body
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 14000);
        return { ok: true, url: query, text: cleanText };
      }

      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await httpRequestRaw(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeoutMs: 12000
      });
      const results = [];
      const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = linkRegex.exec(res.body)) !== null && results.length < 8) {
        results.push({
          url: m[1],
          title: m[2].replace(/<[^>]+>/g, '').trim()
        });
      }
      return { ok: true, query, results };
    }

    if (connector === 'brave') {
      const key = (cfg.brave?.apiKey || hEnv.BRAVE_API_KEY || '').trim();
      if (!key) return { ok: false, error: 'Brave Search Subscription Token belum diisi.' };
      const q = encodeURIComponent(params.query || 'artificial intelligence');
      const r = await httpRequestRaw(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=8`, {
        headers: { 'X-Subscription-Token': key, Accept: 'application/json' }
      });
      return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
    }

    if (connector === 'homeassistant') {
      const base = String(cfg.homeassistant?.baseUrl || '').replace(/\/+$/, '');
      const token = (cfg.homeassistant?.accessToken || '').trim();
      if (!base || !token) return { ok: false, error: 'URL Home Assistant dan Access Token belum diisi.' };
      if (act === 'call_service' && params.domain && params.service) {
        const r = await httpRequestRaw(`${base}/api/services/${params.domain}/${params.service}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: params.serviceData || {}
        });
        return { ok: r.statusCode < 300, data: safeJsonParse(r.body) };
      }
      const r = await httpRequestRaw(`${base}/api/states`, { headers: { Authorization: `Bearer ${token}` } });
      const states = safeJsonParse(r.body);
      return { ok: r.statusCode < 300, entitiesCount: Array.isArray(states) ? states.length : 0, sample: Array.isArray(states) ? states.slice(0, 15) : states };
    }

    if (connector === 'bsi_mybest') {
      const stPath = cfg.bsi_mybest?.statePath || path.join(os.homedir(), '.hermes', 'bsi-monitor', 'state.json');
      if (!fs.existsSync(stPath)) return { ok: false, error: `File state tidak ditemukan: ${stPath}` };
      const stateObj = safeReadJson(stPath, {});
      return { ok: true, statePath: stPath, data: stateObj };
    }

    return { ok: false, error: `Konektor '${connector}' tidak dikenal.` };
  }

  _runPythonWithStdin(code, inputObj) {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let proc;
      try {
        proc = spawn('python', ['-c', code], { windowsHide: true });
      } catch (err) {
        return resolve({ ok: false, error: err.message });
      }
      const timer = setTimeout(() => {
        try { proc.kill(); } catch (_e) {}
        resolve({ ok: false, error: 'Python connector timeout' });
      }, 20000);

      proc.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
      proc.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        if (exitCode === 0 && stdout.trim()) {
          resolve(safeJsonParse(stdout.trim()) || { ok: true, raw: stdout.trim() });
        } else {
          resolve({ ok: false, error: stderr.trim() || stdout.trim() || `Exit ${exitCode}` });
        }
      });
      proc.stdin.write(JSON.stringify(inputObj));
      proc.stdin.end();
    });
  }

  _parseIcsEvents(icsText) {
    const blocks = String(icsText || '').split('BEGIN:VEVENT').slice(1);
    const now = Date.now();
    const horizon = now + 7 * 86400000;
    const out = [];
    for (const b of blocks) {
      const endIdx = b.indexOf('END:VEVENT');
      const body = endIdx >= 0 ? b.slice(0, endIdx) : b;
      const getField = (name) => {
        const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'mi');
        const m = body.match(re);
        return m ? m[1].trim() : '';
      };
      const summary = getField('SUMMARY');
      const dtStartRaw = getField('DTSTART');
      const location = getField('LOCATION');
      const dt = parseIcsDate(dtStartRaw);
      if (dt && dt.getTime() >= now - 3600000 && dt.getTime() <= horizon) {
        out.push({
          summary: summary || 'Acara Kalender',
          startIso: dt.toISOString(),
          startLocal: dt.toLocaleString('id-ID'),
          location
        });
      }
    }
    out.sort((a, b) => a.startIso.localeCompare(b.startIso));
    return out.slice(0, 15);
  }

  // ==================== CRONJOBS / SCHEDULER ====================

  listCronjobs() {
    const store = safeReadJson(this.cronjobsPath, { jobs: [] });
    return Array.isArray(store.jobs) ? store.jobs : [];
  }

  createCronjob({ name, schedule, prompt, agentId, enabled = true }) {
    const jobs = this.listCronjobs();
    const job = {
      id: `cron-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: String(name || 'Jadwal Otomatis').trim().slice(0, 60),
      agentId: agentId || this.getPlatformState().activeAgentId || 'hancow',
      schedule: String(schedule || 'every 30m').trim(),
      prompt: String(prompt || '').trim(),
      enabled: Boolean(enabled),
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      lastStatus: 'scheduled',
      lastResult: ''
    };
    jobs.unshift(job);
    safeWriteJson(this.cronjobsPath, { jobs });
    this._emitCronUpdated();
    return { ok: true, job, jobs };
  }

  toggleCronjob(id, enabled) {
    const jobs = this.listCronjobs();
    const target = jobs.find((j) => j.id === id);
    if (!target) return { ok: false, error: 'Cronjob tidak ditemukan' };
    target.enabled = typeof enabled === 'boolean' ? enabled : !target.enabled;
    safeWriteJson(this.cronjobsPath, { jobs });
    this._emitCronUpdated();
    return { ok: true, job: target, jobs };
  }

  deleteCronjob(id) {
    const jobs = this.listCronjobs().filter((j) => j.id !== id);
    safeWriteJson(this.cronjobsPath, { jobs });
    this._emitCronUpdated();
    return { ok: true, jobs };
  }

  _emitCronUpdated() {
    this.sendToRenderer('cron-updated', { jobs: this.listCronjobs() });
  }

  async runCronjobNow(id) {
    const jobs = this.listCronjobs();
    const job = jobs.find((j) => j.id === id);
    if (!job) return { ok: false, error: 'Cronjob tidak ditemukan' };
    if (this.runningCronIds.has(job.id)) return { ok: false, error: 'Cronjob sedang berjalan' };

    this.runningCronIds.add(job.id);
    job.lastStatus = 'running';
    safeWriteJson(this.cronjobsPath, { jobs });
    this._emitCronUpdated();

    try {
      const res = await this.chatWithAgent({
        agentId: job.agentId,
        userText: `[TUGAS TERJADWAL OTOMATIS: "${job.name}"]\n${job.prompt}`,
        attachments: [],
        isBackgroundTask: true
      });

      const freshJobs = this.listCronjobs();
      const freshTarget = freshJobs.find((j) => j.id === id);
      if (freshTarget) {
        freshTarget.lastRunAt = new Date().toISOString();
        freshTarget.lastStatus = res.ok ? 'success' : 'error';
        freshTarget.lastResult = String(res.reply || res.error || '').slice(0, 500);
        // Auto-disable one-shot relative jobs ("in 10m" / "dalam 10 menit")
        if (/^(?:in|dalam)\s+\d+/i.test(freshTarget.schedule)) {
          freshTarget.enabled = false;
        }
        safeWriteJson(this.cronjobsPath, { jobs: freshJobs });
      }
      this._emitCronUpdated();

      const cleanCronReply = String(res.reply || res.error || 'Jadwal selesai dijalankan').replace(/\s+/g, ' ').trim();
      this._pushProactiveIslandAlert({
        agentId: job.agentId,
        title: job.name,
        body: cleanCronReply.slice(0, 140),
        fullMessage: res.reply || res.error || cleanCronReply,
        alreadyInHistory: true
      });

      return { ok: res.ok, reply: res.reply, error: res.error, jobs: this.listCronjobs() };
    } finally {
      this.runningCronIds.delete(job.id);
    }
  }

  startBackgroundEngines() {
    if (!this.cronTimer) {
      this.cronTimer = setInterval(() => {
        this._tickCronjobs().catch(() => {});
      }, 20000);
    }
    if (!this.proactiveTimer) {
      // Initial laptop & connector check 22s after boot, then every 65s
      setTimeout(() => this._tickProactiveMonitor().catch(() => {}), 22000);
      this.proactiveTimer = setInterval(() => {
        this._tickProactiveMonitor().catch(() => {});
      }, 65000);
    }
    if (!this.telegramTimer) {
      setTimeout(() => this._tickTelegramRemoteBridge().catch(() => {}), 3000);
      this.telegramTimer = setInterval(() => {
        this._tickTelegramRemoteBridge().catch(() => {});
      }, 3500);
    }
  }

  stopBackgroundEngines() {
    if (this.cronTimer) clearInterval(this.cronTimer);
    if (this.proactiveTimer) clearInterval(this.proactiveTimer);
    if (this.telegramTimer) clearInterval(this.telegramTimer);
    for (const proc of this.activeOAuthProcs.values()) {
      try { proc.kill(); } catch (_e) {}
    }
    this.activeOAuthProcs.clear();
  }

  async _sendTelegramText(token, chatId, text) {
    const raw = String(text || '').trim() || 'Selesai.';
    const chunks = [];
    for (let i = 0; i < raw.length; i += 3900) {
      chunks.push(raw.slice(i, i + 3900));
    }
    for (const part of chunks) {
      await httpRequestRaw(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { chat_id: chatId, text: part },
        timeoutMs: 12000
      }).catch(() => {});
    }
  }

  async _sendTelegramPhoto(token, chatId, filePath, caption = '') {
    if (!filePath || !fs.existsSync(filePath)) return false;
    try {
      const boundary = `----DynamicIslandTgBoundary${Date.now().toString(16)}`;
      const fileData = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const parts = [];
      const pushField = (name, val) => {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`, 'utf8'));
      };
      pushField('chat_id', String(chatId));
      if (caption) pushField('caption', String(caption).slice(0, 950));
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`,
          'utf8'
        )
      );
      parts.push(fileData);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
      const payload = Buffer.concat(parts);

      return await new Promise((resolve) => {
        const u = new URL(`https://api.telegram.org/bot${token}/sendPhoto`);
        const req = https.request(
          {
            hostname: u.hostname,
            port: 443,
            path: u.pathname,
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': payload.length
            },
            timeout: 20000
          },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve(res.statusCode < 300));
          }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.write(payload);
        req.end();
      });
    } catch (_e) {
      return false;
    }
  }

  async _tickTelegramRemoteBridge() {
    if (this.isPollingTelegram) return;
    const cfg = safeReadJson(this.connectorsPath, {});
    const hEnv = this._readHermesEnvironment().envMap;
    const token = (cfg.telegram?.botToken || hEnv.TELEGRAM_BOT_TOKEN || '').trim();
    const isEnabled = cfg.telegram?.enabled !== false && Boolean(token);
    if (!isEnabled) return;

    this.isPollingTelegram = true;
    try {
      const isFirstBootPoll = this.tgLastUpdateId === null && !cfg.telegram?.lastUpdateId;
      if (this.tgLastUpdateId === null) {
        this.tgLastUpdateId = Number(cfg.telegram?.lastUpdateId || 0);
      }

      const offsetParam = this.tgLastUpdateId > 0 ? `?offset=${this.tgLastUpdateId + 1}&limit=10&timeout=0` : '?limit=10&timeout=0';
      const res = await httpRequestRaw(`https://api.telegram.org/bot${token}/getUpdates${offsetParam}`, {
        timeoutMs: 8500
      });

      if (res.statusCode === 409) {
        await httpRequestRaw(`https://api.telegram.org/bot${token}/deleteWebhook`, { timeoutMs: 6000 }).catch(() => {});
        return;
      }

      const parsed = safeJsonParse(res.body);
      if (!parsed || !parsed.ok || !Array.isArray(parsed.result) || parsed.result.length === 0) {
        return;
      }

      const updates = parsed.result;
      const nowSec = Math.floor(Date.now() / 1000);

      for (const u of updates) {
        if (!u || typeof u.update_id !== 'number') continue;
        this.tgLastUpdateId = Math.max(this.tgLastUpdateId, u.update_id);
        cfg.telegram = { ...(cfg.telegram || {}), lastUpdateId: this.tgLastUpdateId };
        safeWriteJson(this.connectorsPath, cfg);

        const msg = u.message || u.edited_message;
        if (!msg || !msg.chat) continue;

        // Skip stale backlog messages older than 60s on very first uninitialized poll
        if (isFirstBootPoll && msg.date && (nowSec - msg.date > 60)) {
          continue;
        }

        const incomingChatId = String(msg.chat.id);
        const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || 'Telegram';
        const rawText = String(msg.text || msg.caption || '').trim();
        if (!rawText) continue;

        // Auto-bind Chat ID if empty, or verify against allowed Chat IDs
        let allowedRaw = String(cfg.telegram?.chatId || hEnv.TELEGRAM_CHAT_ID || '').trim();
        if (!allowedRaw) {
          allowedRaw = incomingChatId;
          cfg.telegram = {
            ...(cfg.telegram || {}),
            enabled: true,
            botToken: token,
            chatId: incomingChatId,
            lastUpdateId: this.tgLastUpdateId
          };
          safeWriteJson(this.connectorsPath, cfg);
          this.getConnectorsStatus().then((st) => this.sendToRenderer('connectors-updated', st)).catch(() => {});
        } else {
          const allowedSet = new Set(allowedRaw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean));
          if (!allowedSet.has(incomingChatId)) {
            await this._sendTelegramText(
              token,
              incomingChatId,
              `Akses ditolak. Chat ID kamu (${incomingChatId}) belum diizinkan di pengaturan konektor Telegram Dynamic Island.`
            );
            continue;
          }
        }

        const state = this.getPlatformState();
        let targetAgent = this.getAgentDetail(state.activeAgentId) || this.getAgentDetail('hancow');

        // Built-in Bot Commands: /start, /help, /screenshot, /hancow, /wana, /winnie, /agent <name>
        if (/^\/(start|help)(@\S+)?$/i.test(rawText)) {
          const agentsList = this.listAgents().map((a) => `• /${a.id} — ${a.name} (${a.role})`).join('\n');
          await this._sendTelegramText(
            token,
            incomingChatId,
            [
              `Terhubung ke Dynamic Island (${os.hostname()})!`,
              `Agent aktif saat ini: ${targetAgent.name}`,
              `Chat ID terikat: ${incomingChatId}`,
              '',
              'Kirim perintah apa saja untuk mengontrol laptop secara langsung (terminal, cek/ kelola file & folder, kontrol musik/volume, cek tugas/konektor).',
              '',
              'Shortcut Cepat:',
              '• /screenshot — Ambil & kirim foto layar laptop sekarang',
              agentsList
            ].join('\n')
          );
          continue;
        }

        if (/^\/(screenshot|ss)(@\S+)?$/i.test(rawText)) {
          await httpRequestRaw(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { chat_id: incomingChatId, action: 'upload_photo' }
          }).catch(() => {});
          const outFile = path.join(this.uploadsDir, `screenshot-${Date.now()}.png`);
          await this.runMediaBridgeAction('takeScreenshot', outFile).catch(() => {});
          const sent = await this._sendTelegramPhoto(token, incomingChatId, outFile, `Layar ${os.hostname()} · ${new Date().toLocaleTimeString('id-ID')}`);
          if (!sent) {
            await this._sendTelegramText(token, incomingChatId, 'Gagal mengambil tangkapan layar.');
          }
          continue;
        }

        let promptText = rawText;
        const cmdMatch = rawText.match(/^\/([a-zA-Z0-9_-]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
        if (cmdMatch) {
          const cmdName = cmdMatch[1].toLowerCase();
          const restPrompt = (cmdMatch[2] || '').trim();
          const allAg = this.listAgents();
          const matchedAg = allAg.find((a) => a.id.toLowerCase() === cmdName || a.name.toLowerCase() === cmdName);
          if (matchedAg) {
            this.setActiveAgent(matchedAg.id);
            targetAgent = this.getAgentDetail(matchedAg.id) || targetAgent;
            if (!restPrompt) {
              await this._sendTelegramText(
                token,
                incomingChatId,
                `Agent aktif diganti ke ${targetAgent.name} (${targetAgent.role}). Silakan kirim perintahmu, bre.`
              );
              continue;
            }
            promptText = restPrompt;
          }
        }

        // Send typing indicator while agent executes on laptop
        const sendTyping = () => {
          httpRequestRaw(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { chat_id: incomingChatId, action: 'typing' }
          }).catch(() => {});
        };
        sendTyping();
        const typingInterval = setInterval(sendTyping, 4200);

        try {
          const execRes = await this.chatWithAgent({
            agentId: targetAgent.id,
            userText: `[TELEGRAM REMOTE DARI ${senderName}]: ${promptText}`,
            attachments: [],
            isBackgroundTask: false,
            sourceOverride: 'telegram'
          });

          clearInterval(typingInterval);

          // If any tool took a screenshot during execution, upload it to Telegram automatically
          const screenshots = (execRes.toolsUsed || [])
            .map((t) => t.screenshotPath)
            .filter((p) => p && fs.existsSync(p));
          for (const sp of screenshots) {
            await this._sendTelegramPhoto(token, incomingChatId, sp, `Tangkapan layar dari ${targetAgent.name}`);
          }

          const replyBody = execRes.ok
            ? `[${targetAgent.name}]\n${execRes.reply || 'Selesai dijalankan.'}`
            : `[${targetAgent.name}] Gagal: ${execRes.error || 'Terjadi kesalahan.'}`;

          await this._sendTelegramText(token, incomingChatId, replyBody);

          const cleanTgReply = String(execRes.reply || execRes.error || 'Selesai dibalas ke Telegram').replace(/\s+/g, ' ').trim();
          this._pushProactiveIslandAlert({
            agentId: targetAgent.id,
            title: 'Telegram Remote',
            body: cleanTgReply.slice(0, 140),
            fullMessage: execRes.reply || execRes.error || cleanTgReply,
            alreadyInHistory: true
          });
        } catch (err) {
          clearInterval(typingInterval);
          await this._sendTelegramText(token, incomingChatId, `Error eksekusi di laptop: ${err.message}`);
        }
      }
    } catch (_err) {
      // Ignore transient network errors
    } finally {
      this.isPollingTelegram = false;
    }
  }

  async _tickCronjobs() {
    const now = new Date();
    const jobs = this.listCronjobs();
    for (const job of jobs) {
      if (!job.enabled) continue;
      if (this.runningCronIds.has(job.id)) continue;
      if (isCronDueNow(job.schedule, job.lastRunAt, job.createdAt, now)) {
        this.runCronjobNow(job.id).catch(() => {});
      }
    }
  }

  // ==================== PROACTIVE MONITOR ENGINE ====================

  _canAlertTopic(topicKey, cooldownMs) {
    const prev = this.proactiveCooldowns.get(topicKey) || 0;
    if (Date.now() - prev < cooldownMs) return false;
    this.proactiveCooldowns.set(topicKey, Date.now());
    return true;
  }

  _pushProactiveIslandAlert({ agentId, title, body, fullMessage, alreadyInHistory = false }) {
    const targetAgentId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    const nowIso = new Date().toISOString();
    let actId = '';
    if (!alreadyInHistory && fullMessage) {
      actId = `act-pro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const store = this._loadSessionsStore(targetAgentId);
      const sess = store.sessions.find((s) => s.id === store.activeSessionId) || store.sessions[0];
      if (sess) {
        sess.messages = Array.isArray(sess.messages) ? sess.messages : [];
        sess.messages.push({
          role: 'assistant',
          content: fullMessage,
          proactive: true,
          activityId: actId,
          at: nowIso
        });
        sess.messages = sess.messages.slice(-50);
        sess.updatedAt = nowIso;
        this._saveSessionsStore(targetAgentId, store);
      }

      this._upsertActivity(targetAgentId, {
        id: actId,
        agentId: targetAgentId,
        sessionId: sess ? sess.id : '',
        source: 'proactive',
        title: title || 'Pemantauan Proaktif Laptop',
        subtitle: this._deriveActivitySubtitle(body || fullMessage, 'completed', []),
        prompt: 'Monitor proaktif otomatis kondisi sistem laptop & konektor aktif.',
        status: 'completed',
        startedAt: nowIso,
        completedAt: nowIso,
        durationMs: 850,
        steps: [
          {
            id: `step-${actId}-1`,
            tool: 'proactive_monitor',
            label: title || 'Cek kondisi sistem & konektor',
            detailTitle: title || 'Pemeriksaan Proaktif Otomatis',
            status: 'done',
            argsPreview: 'Monitor latar belakang: CPU, RAM, Baterai, Disk C:, WhatsApp, GitHub',
            outputPreview: String(fullMessage || body || ''),
            durationMs: 850,
            at: nowIso
          }
        ],
        summary: String(fullMessage || body || '')
      });
    }

    this.sendToRenderer('proactive-message', {
      agentId: targetAgentId,
      title,
      body,
      fullMessage: fullMessage || body,
      activityId: actId || undefined,
      at: nowIso
    });

    this.sendToRenderer('notification-update', {
      type: 'notification',
      id: `proactive-${Date.now()}`,
      appName: '',
      aumid: 'DynamicIsland.Agent',
      title: String(fullMessage || body || title || '').replace(/\s+/g, ' ').trim(),
      body: '',
      fullMessage: fullMessage || body || title,
      isCall: false,
      canReply: false,
      isAgentProactive: true,
      agentId: targetAgentId
    });
  }

  async _tickProactiveMonitor() {
    const state = this.getPlatformState();
    if (state.proactiveEnabled === false) return;

    const activeAgent = this.getAgentDetail(state.activeAgentId) || this.getAgentDetail('hancow');

    // 1. Laptop Health (CPU / RAM / Battery / Disk C:)
    const snap = await this._getLaptopHealthSnapshot();
    if (snap.cpuPercent >= 90) this.highCpuStreak++;
    else this.highCpuStreak = 0;

    if (snap.ramPercent >= 90) this.highRamStreak++;
    else this.highRamStreak = 0;

    if (this.highCpuStreak >= 2 && this._canAlertTopic('high-cpu', 15 * 60000)) {
      const msg = `Beban CPU bertahan di ${snap.cpuPercent}% (proses tertinggi: ${snap.topProcess || 'sistem'}). Mau kubantu cek atau hentikan prosesnya, bre?`;
      this._pushProactiveIslandAlert({
        agentId: activeAgent.id,
        title: `CPU Tinggi (${snap.cpuPercent}%)`,
        body: msg,
        fullMessage: msg
      });
    }

    if (this.highRamStreak >= 2 && this._canAlertTopic('high-ram', 20 * 60000)) {
      const msg = `Pemakaian RAM mencapai ${snap.ramPercent}% (${snap.ramUsedGb}/${snap.ramTotalGb} GB). Proses terbesar saat ini: ${snap.topProcess || 'beberapa aplikasi'}.`;
      this._pushProactiveIslandAlert({
        agentId: activeAgent.id,
        title: `RAM ${snap.ramPercent}%`,
        body: msg,
        fullMessage: msg
      });
    }

    if (snap.batteryPercent !== null && !snap.isCharging && snap.batteryPercent <= 22 && this._canAlertTopic('low-bat', 25 * 60000)) {
      const msg = `Baterai laptop tinggal ${snap.batteryPercent}% dan belum dicolok charger, bre. Sebaiknya segera sambungkan daya biar kerjaan aman.`;
      this._pushProactiveIslandAlert({
        agentId: activeAgent.id,
        title: `Baterai ${snap.batteryPercent}%`,
        body: msg,
        fullMessage: msg
      });
    }

    if (snap.cDriveFreeGb !== null && snap.cDriveFreeGb < 8 && this._canAlertTopic('low-disk', 60 * 60000)) {
      const msg = `Ruang kosong Drive C: tersisa ${snap.cDriveFreeGb} GB. Aku bisa bantu bersihkan cache temp kalau kamu mau, bre.`;
      this._pushProactiveIslandAlert({
        agentId: activeAgent.id,
        title: `Disk C: Sisa ${snap.cDriveFreeGb} GB`,
        body: msg,
        fullMessage: msg
      });
    }

    // 2. Connector Proactive Checks (every ~4 minutes)
    if (!this._canAlertTopic('connector-poll-gate', 4 * 60000)) return;

    const connCfg = safeReadJson(this.connectorsPath, {});

    // GitHub unread notifications
    if (connCfg.github?.enabled !== false && connCfg.github?.autoProactive !== false) {
      const gh = await this.executeConnector('github', 'notifications').catch(() => null);
      if (gh && gh.ok && gh.output && gh.output.startsWith('[')) {
        const list = safeJsonParse(gh.output) || [];
        if (list.length > 0 && list[0].id !== this.lastSeenGhNotifId) {
          const isInitial = !this.lastSeenGhNotifId;
          this.lastSeenGhNotifId = list[0].id;
          if (!isInitial) {
            const top = list[0];
            const msg = `Notifikasi GitHub baru di ${top.repo}: [${top.type}] ${top.title} (alasan: ${top.reason}).`;
            this._pushProactiveIslandAlert({
              agentId: activeAgent.id,
              title: `GitHub (${top.repo})`,
              body: msg,
              fullMessage: msg
            });
          }
        }
      }
    }

    // Google Calendar upcoming within 20 min
    if (connCfg.google_calendar?.enabled !== false && connCfg.google_calendar?.icalUrl) {
      const cal = await this.executeConnector('google_calendar', 'list').catch(() => null);
      if (cal && cal.ok && Array.isArray(cal.events)) {
        const nowMs = Date.now();
        const soon = cal.events.find((ev) => {
          const diffMin = (new Date(ev.startIso).getTime() - nowMs) / 60000;
          return diffMin > 0 && diffMin <= 20;
        });
        if (soon && this._canAlertTopic(`cal-${soon.summary}-${soon.startIso}`, 60 * 60000)) {
          const msg = `Pengingat Google Calendar: "${soon.summary}" dimulai pada ${soon.startLocal}${soon.location ? ` di ${soon.location}` : ''}.`;
          this._pushProactiveIslandAlert({
            agentId: activeAgent.id,
            title: 'Agenda Sebentar Lagi',
            body: msg,
            fullMessage: msg
          });
        }
      }
    }
  }

  async runProactiveBriefingNow(agentId) {
    const targetId = agentId || this.getPlatformState().activeAgentId || 'hancow';
    return this.chatWithAgent({
      agentId: targetId,
      userText: 'Lakukan pemindaian proaktif sekarang: cek kondisi laptop saya (CPU, RAM, Baterai, Disk, proses terberat) serta cek semua konektor yang aktif (WhatsApp, GitHub, BSI/MyBest, Gmail/Calendar bila terhubung), lalu berikan briefing singkat hal-hal penting yang perlu saya ketahui.',
      attachments: [],
      isBackgroundTask: false
    });
  }

  async _getLaptopHealthSnapshot() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);
    const live = this.getLiveContext ? this.getLiveContext() : {};

    let batteryPercent = null;
    let isCharging = false;
    let cDriveFreeGb = null;
    let topProcess = '';

    try {
      const ps = await execPromise(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          '$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1; $d = Get-PSDrive C -ErrorAction SilentlyContinue; $p = Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 1; @{ bat = if($b){[int]$b.EstimatedChargeRemaining}else{$null}; chg = if($b){[int]$b.BatteryStatus -in @(2,6,7,8,9)}else{$false}; freeGb = if($d){[math]::Round($d.Free/1GB,1)}else{$null}; top = if($p){"$($p.ProcessName) ($([math]::Round($p.WorkingSet64/1MB))MB)"}else{""} } | ConvertTo-Json -Compress'
        ],
        { timeoutMs: 6000 }
      );
      if (ps.ok && ps.stdout.startsWith('{')) {
        const parsed = JSON.parse(ps.stdout);
        batteryPercent = typeof parsed.bat === 'number' ? parsed.bat : null;
        isCharging = Boolean(parsed.chg);
        cDriveFreeGb = typeof parsed.freeGb === 'number' ? parsed.freeGb : null;
        topProcess = parsed.top || '';
      }
    } catch (_e) {}

    return {
      cpuPercent: typeof live.cpu === 'number' ? live.cpu : 0,
      cpuTempC: typeof live.cpuTemp === 'number' ? live.cpuTemp : null,
      gpuTempC: typeof live.gpuTemp === 'number' ? live.gpuTemp : null,
      gpuLoadPercent: typeof live.gpuLoad === 'number' ? live.gpuLoad : 0,
      ramPercent,
      ramUsedGb: (usedMem / (1024 ** 3)).toFixed(1),
      ramTotalGb: (totalMem / (1024 ** 3)).toFixed(0),
      batteryPercent,
      isCharging,
      cDriveFreeGb,
      topProcess
    };
  }

  // ==================== FULL COMPUTER ACCESS TOOLS ====================

  _getToolSchemas() {
    return [
      {
        type: 'function',
        function: {
          name: 'run_terminal',
          description: 'Jalankan perintah PowerShell atau CMD dengan akses penuh ke seluruh komputer pengguna.',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Perintah PowerShell/CMD yang akan dijalankan' },
              cwd: { type: 'string', description: 'Working directory opsional (default home user)' },
              shell: { type: 'string', enum: ['powershell', 'cmd'], description: 'Shell eksekusi (default powershell)' },
              timeoutSec: { type: 'number', description: 'Batas waktu detik (default 30, maks 120)' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_directory',
          description: 'Akses Folder Manager: lihat isi folder mana pun di komputer (atau ketik "drives" untuk daftar semua drive C:, D:, dll).',
          parameters: {
            type: 'object',
            properties: {
              dirPath: { type: 'string', description: 'Path absolut folder atau "drives"' },
              maxItems: { type: 'number', description: 'Jumlah maksimum item (default 80)' }
            },
            required: ['dirPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Baca isi file teks/kode/konfigurasi/log dari path mana pun di komputer.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path absolut file' },
              startLine: { type: 'number', description: 'Baris awal (1-based, opsional)' },
              endLine: { type: 'number', description: 'Baris akhir (opsional)' }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Buat file baru, timpa isi file, atau tambahkan teks ke file di komputer.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path absolut file tujuan' },
              content: { type: 'string', description: 'Isi file yang akan ditulis' },
              append: { type: 'boolean', description: 'True jika ingin menambahkan di akhir file' }
            },
            required: ['filePath', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'edit_file',
          description: 'Edit bagian teks spesifik di dalam file yang sudah ada.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path absolut file' },
              target: { type: 'string', description: 'Teks lama yang persis ingin diganti' },
              replacement: { type: 'string', description: 'Teks pengganti baru' }
            },
            required: ['filePath', 'target', 'replacement']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_files',
          description: 'Cari file berdasarkan nama atau isi teks di dalam sebuah folder.',
          parameters: {
            type: 'object',
            properties: {
              rootPath: { type: 'string', description: 'Folder awal pencarian' },
              namePattern: { type: 'string', description: 'Filter nama file (misal *.pdf, *laporan*)' },
              contentQuery: { type: 'string', description: 'Teks di dalam file yang dicari (opsional)' }
            },
            required: ['rootPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'manage_folder',
          description: 'Operasi Folder Manager: buat folder (mkdir), pindah/rename (move), salin (copy), hapus (delete), atau buka di Windows Explorer (open_explorer).',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['mkdir', 'move', 'copy', 'delete', 'open_explorer'] },
              sourcePath: { type: 'string', description: 'Path sumber / target' },
              destPath: { type: 'string', description: 'Path tujuan (untuk move / copy)' }
            },
            required: ['action', 'sourcePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'system_control',
          description: 'Kontrol & pantau laptop: overview kesehatan sistem, daftar proses, set_volume, toggle_mute, set_brightness, media_control (playPause/next/prev), open_app_or_url, atau screenshot layar.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['overview', 'processes', 'kill_process', 'set_volume', 'toggle_mute', 'set_brightness', 'media_control', 'open_app_or_url', 'screenshot']
              },
              value: { type: 'string', description: 'Nilai parameter (angka 0-100, nama proses/PID, URL/nama aplikasi, atau playPause/next/prev)' }
            },
            required: ['action']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'memory_manager',
          description: 'Baca atau perbarui Memori Utama (global) maupun Memori khusus Agent ini (agent).',
          parameters: {
            type: 'object',
            properties: {
              scope: { type: 'string', enum: ['global', 'agent'] },
              action: { type: 'string', enum: ['read', 'append', 'replace'] },
              content: { type: 'string', description: 'Catatan memori yang ingin ditambahkan atau disimpan' }
            },
            required: ['scope', 'action']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'skill_manager',
          description: 'Daftar semua skill yang tersedia, baca instruksi SKILL.md tertentu, atau buat skill baru.',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['list', 'load', 'create'] },
              query: { type: 'string', description: 'Kata kunci filter saat list, atau nama skill saat load/create' },
              description: { type: 'string', description: 'Deskripsi skill baru (untuk create)' },
              content: { type: 'string', description: 'Isi markdown skill baru (untuk create)' }
            },
            required: ['action']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'use_connector',
          description: 'Gunakan 40 konektor aplikasi resmi: whatsapp, telegram, discord, slack, gmail, google_calendar, google_drive, google_docs, google_sheets, microsoft_365, bsi_mybest, notion, obsidian, linear, todoist, trello, airtable, clickup, jira, atlassian, dropbox, github, gitlab, vercel, supabase, cloudflare, docker, sentry, n8n, postman, stripe, figma, huggingface, spotify, youtube, x_twitter, canva, web_search, brave, homeassistant.',
          parameters: {
            type: 'object',
            properties: {
              connector: {
                type: 'string',
                enum: [
                  'whatsapp', 'telegram', 'discord', 'slack',
                  'gmail', 'google_calendar', 'google_drive', 'google_docs', 'google_sheets', 'microsoft_365', 'bsi_mybest',
                  'notion', 'obsidian', 'linear', 'todoist', 'trello', 'airtable', 'clickup', 'jira', 'atlassian', 'dropbox',
                  'github', 'gitlab', 'vercel', 'supabase', 'cloudflare', 'docker', 'sentry', 'n8n', 'postman', 'stripe', 'figma', 'huggingface',
                  'spotify', 'youtube', 'x_twitter', 'canva', 'web_search', 'brave', 'homeassistant'
                ]
              },
              action: { type: 'string', description: 'Aksi konektor (misal status, list, send, open, pair_qr, oauth, search, create, read, notifications, repos, prs, playpause, next, prev, trigger, logs)' },
              params: { type: 'object', description: 'Objek parameter sesuai konektor (misal {to, message}, {query}, {subject, body}, {title, content}, atau {mcpTool, mcpArgs} untuk konektor OAuth MCP)' }
            },
            required: ['connector']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'cron_manager',
          description: 'Buat, lihat, aktifkan/nonaktifkan, atau hapus jadwal otomatis (cronjob) untuk AI.',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['list', 'create', 'toggle', 'delete'] },
              id: { type: 'string', description: 'ID cronjob untuk toggle/delete' },
              name: { type: 'string', description: 'Nama jadwal (untuk create)' },
              schedule: { type: 'string', description: 'Format jadwal: "every 15m", "every 2h", "daily 08:00", "in 10m", atau cron 5-field "0 8 * * *"' },
              prompt: { type: 'string', description: 'Instruksi lengkap yang akan dijalankan AI saat jadwal tiba' },
              agentId: { type: 'string', description: 'ID agent pelaksana (opsional)' },
              enabled: { type: 'boolean', description: 'Status aktif/nonaktif' }
            },
            required: ['action']
          }
        }
      }
    ];
  }

  _describeToolStep(name, args) {
    switch (name) {
      case 'run_terminal': return `Terminal: ${String(args.command || '').slice(0, 48)}`;
      case 'list_directory': return `Folder: ${args.dirPath || ''}`;
      case 'read_file': return `Baca file: ${path.basename(String(args.filePath || ''))}`;
      case 'write_file': return `Tulis file: ${path.basename(String(args.filePath || ''))}`;
      case 'edit_file': return `Edit file: ${path.basename(String(args.filePath || ''))}`;
      case 'search_files': return `Cari file di ${path.basename(String(args.rootPath || '')) || args.rootPath}`;
      case 'manage_folder': return `Folder ${args.action}: ${path.basename(String(args.sourcePath || ''))}`;
      case 'system_control': return `Sistem: ${args.action}${args.value ? ` (${args.value})` : ''}`;
      case 'memory_manager': return `Memori (${args.scope}): ${args.action}`;
      case 'skill_manager': return `Skill: ${args.action}${args.query ? ` (${args.query})` : ''}`;
      case 'use_connector': return `Konektor ${args.connector}${args.action ? ` · ${args.action}` : ''}`;
      case 'cron_manager': return `Jadwal Cron: ${args.action}${args.name ? ` (${args.name})` : ''}`;
      default: return `Menjalankan ${name}`;
    }
  }

  async _executeTool(agentId, name, rawArgs) {
    let args = {};
    try {
      args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : (rawArgs || {});
    } catch (_e) {
      args = {};
    }

    try {
      if (name === 'run_terminal') {
        const timeoutMs = Math.min(120, Math.max(5, Number(args.timeoutSec) || 35)) * 1000;
        const cwd = args.cwd && fs.existsSync(args.cwd) ? args.cwd : os.homedir();
        let cmdStr = String(args.command || '').trim();
        if (args.shell === 'cmd') {
          return await execPromise('cmd.exe', ['/d', '/s', '/c', cmdStr], { cwd, timeoutMs });
        }
        // Unwrap redundant outer `powershell -Command "..."` wrapper so $_ and $vars are not swallowed by double-interpolation
        const psWrapMatch = cmdStr.match(/^(?:powershell(?:\.exe)?|pwsh(?:\.exe)?)\s+(?:-[a-zA-Z]+\s+)*-Command\s+(['"])([\s\S]+)\1$/i);
        if (psWrapMatch && psWrapMatch[2]) {
          cmdStr = psWrapMatch[2];
        }
        return await execPromise(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmdStr],
          { cwd, timeoutMs }
        );
      }

      if (name === 'list_directory') {
        const target = String(args.dirPath || os.homedir()).trim();
        if (target.toLowerCase() === 'drives') {
          const ps = await execPromise('powershell.exe', [
            '-NoProfile',
            '-Command',
            'Get-PSDrive -PSProvider FileSystem | Select-Object Name, Root, @{N="UsedGB";E={[math]::Round($_.Used/1GB,1)}}, @{N="FreeGB";E={[math]::Round($_.Free/1GB,1)}} | ConvertTo-Json -Compress'
          ]);
          return { ok: ps.ok, drives: safeJsonParse(ps.stdout) || ps.stdout };
        }
        const resolved = this._resolveUserPath(target);
        if (!fs.existsSync(resolved)) return { ok: false, error: `Folder tidak ditemukan: ${resolved}` };
        const maxItems = Math.min(200, Math.max(10, Number(args.maxItems) || 80));
        const entries = fs.readdirSync(resolved, { withFileTypes: true }).slice(0, maxItems);
        const items = entries.map((e) => {
          const full = path.join(resolved, e.name);
          let size = 0;
          let mtime = '';
          try {
            const st = fs.statSync(full);
            size = st.size;
            mtime = st.mtime.toISOString();
          } catch (_err) {}
          return {
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
            size,
            modifiedAt: mtime
          };
        });
        return { ok: true, path: resolved, count: items.length, items };
      }

      if (name === 'read_file') {
        const resolved = this._resolveUserPath(args.filePath);
        if (!fs.existsSync(resolved)) return { ok: false, error: `File tidak ditemukan: ${resolved}` };
        const st = fs.statSync(resolved);
        if (st.isDirectory()) return { ok: false, error: 'Path adalah folder, gunakan list_directory.' };
        const raw = fs.readFileSync(resolved, 'utf8');
        const lines = raw.split(/\r?\n/);
        const sLine = Math.max(1, Number(args.startLine) || 1);
        const eLine = Math.min(lines.length, Number(args.endLine) || (sLine + 249));
        const sliced = lines.slice(sLine - 1, eLine).join('\n').slice(0, 28000);
        return { ok: true, path: resolved, totalLines: lines.length, range: `${sLine}-${eLine}`, content: sliced };
      }

      if (name === 'write_file') {
        const resolved = this._resolveUserPath(args.filePath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        if (args.append) {
          fs.appendFileSync(resolved, String(args.content ?? ''), 'utf8');
        } else {
          fs.writeFileSync(resolved, String(args.content ?? ''), 'utf8');
        }
        return { ok: true, path: resolved, bytes: Buffer.byteLength(String(args.content ?? '')) };
      }

      if (name === 'edit_file') {
        const resolved = this._resolveUserPath(args.filePath);
        if (!fs.existsSync(resolved)) return { ok: false, error: `File tidak ditemukan: ${resolved}` };
        const content = fs.readFileSync(resolved, 'utf8');
        if (!content.includes(args.target)) {
          return { ok: false, error: 'Teks target tidak ditemukan persis di dalam file.' };
        }
        const updated = content.split(args.target).join(args.replacement);
        fs.writeFileSync(resolved, updated, 'utf8');
        return { ok: true, path: resolved };
      }

      if (name === 'search_files') {
        const root = this._resolveUserPath(args.rootPath || os.homedir());
        if (!fs.existsSync(root)) return { ok: false, error: `Folder tidak ditemukan: ${root}` };
        const results = [];
        const nameRegex = args.namePattern
          ? new RegExp('^' + String(args.namePattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
          : null;
        const contentNeedle = args.contentQuery ? String(args.contentQuery).toLowerCase() : '';

        const walk = (dir, depth) => {
          if (depth > 5 || results.length >= 40) return;
          let list = [];
          try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
          for (const ent of list) {
            if (results.length >= 40) break;
            if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'AppData') continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              walk(full, depth + 1);
            } else {
              if (nameRegex && !nameRegex.test(ent.name)) continue;
              if (contentNeedle) {
                try {
                  const st = fs.statSync(full);
                  if (st.size > 2 * 1024 * 1024) continue;
                  const txt = fs.readFileSync(full, 'utf8');
                  if (!txt.toLowerCase().includes(contentNeedle)) continue;
                } catch (_e) { continue; }
              }
              results.push(full);
            }
          }
        };
        walk(root, 0);
        return { ok: true, root, matches: results };
      }

      if (name === 'manage_folder') {
        const src = this._resolveUserPath(args.sourcePath);
        const dst = args.destPath ? this._resolveUserPath(args.destPath) : '';
        if (args.action === 'mkdir') {
          fs.mkdirSync(src, { recursive: true });
          return { ok: true, created: src };
        }
        if (args.action === 'open_explorer') {
          if (fs.existsSync(src) && fs.statSync(src).isFile()) {
            spawn('explorer.exe', [`/select,${src}`], { detached: true, stdio: 'ignore' }).unref();
          } else {
            spawn('explorer.exe', [src], { detached: true, stdio: 'ignore' }).unref();
          }
          return { ok: true, opened: src };
        }
        if (!fs.existsSync(src)) return { ok: false, error: `Path tidak ditemukan: ${src}` };
        if (args.action === 'move') {
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.renameSync(src, dst);
          return { ok: true, movedFrom: src, movedTo: dst };
        }
        if (args.action === 'copy') {
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.cpSync(src, dst, { recursive: true });
          return { ok: true, copiedFrom: src, copiedTo: dst };
        }
        if (args.action === 'delete') {
          fs.rmSync(src, { recursive: true, force: true });
          return { ok: true, deleted: src };
        }
        return { ok: false, error: 'Aksi manage_folder tidak valid' };
      }

      if (name === 'system_control') {
        const act = args.action;
        if (act === 'overview') {
          const health = await this._getLaptopHealthSnapshot();
          const live = this.getLiveContext ? this.getLiveContext() : {};
          return {
            ok: true,
            hostname: os.hostname(),
            platform: `${os.type()} ${os.release()}`,
            uptimeHours: (os.uptime() / 3600).toFixed(1),
            ...health,
            nowPlaying: live.media || null
          };
        }
        if (act === 'processes') {
          const ps = await execPromise('powershell.exe', [
            '-NoProfile',
            '-Command',
            'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 20 Id, ProcessName, @{N="MemoryMB";E={[math]::Round($_.WorkingSet64/1MB,1)}}, CPU | ConvertTo-Json -Compress'
          ]);
          return { ok: ps.ok, processes: safeJsonParse(ps.stdout) || ps.stdout };
        }
        if (act === 'kill_process') {
          const v = String(args.value || '').trim();
          const cmd = /^\d+$/.test(v) ? `Stop-Process -Id ${v} -Force` : `Stop-Process -Name "${v.replace(/"/g, '')}" -Force`;
          return await execPromise('powershell.exe', ['-NoProfile', '-Command', cmd]);
        }
        if (act === 'set_volume') {
          return await this.runMediaBridgeAction('setVolume', String(args.value || '50'));
        }
        if (act === 'toggle_mute') {
          return await this.runMediaBridgeAction('toggleMute', '');
        }
        if (act === 'set_brightness') {
          return await this.runMediaBridgeAction('setBrightness', String(args.value || '80'));
        }
        if (act === 'media_control') {
          const mc = ['playPause', 'next', 'prev'].includes(args.value) ? args.value : 'playPause';
          return await this.runMediaBridgeAction(mc, '');
        }
        if (act === 'open_app_or_url') {
          const target = String(args.value || '').trim();
          const ps = await execPromise('powershell.exe', ['-NoProfile', '-Command', `Start-Process "${target.replace(/"/g, '')}"`]);
          return { ok: ps.ok, opened: target, stderr: ps.stderr };
        }
        if (act === 'screenshot') {
          const outFile = path.join(this.uploadsDir, `screenshot-${Date.now()}.png`);
          const scRes = await this.runMediaBridgeAction('takeScreenshot', outFile);
          return { ...scRes, screenshotPath: outFile };
        }
      }

      if (name === 'memory_manager') {
        const isGlobal = args.scope === 'global';
        const targetPath = isGlobal ? this.globalMemoryPath : path.join(this.agentsDir, agentId, 'memory.md');
        const current = safeReadText(targetPath, '');
        if (args.action === 'read') {
          return { ok: true, scope: args.scope, content: current };
        }
        if (args.action === 'append') {
          const line = String(args.content || '').trim();
          let next = current;
          if (isGlobal) {
            next = this._appendFactToGlobalAndHermesMemory(line, 'memory') || current;
          } else {
            const cleanLine = line.replace(/^[-*•\s]+/, '').trim();
            next = `${current.trim()}\n- ${cleanLine}\n`;
            safeWriteText(targetPath, next);
          }
          this.sendToRenderer('memory-updated', { scope: args.scope, agentId, content: next });
          return { ok: true, scope: args.scope, updated: next, syncedWithHermes: isGlobal };
        }
        if (args.action === 'replace') {
          const next = String(args.content || '');
          safeWriteText(targetPath, next);
          this.sendToRenderer('memory-updated', { scope: args.scope, agentId, content: next });
          return { ok: true, scope: args.scope, updated: next };
        }
      }

      if (name === 'skill_manager') {
        if (args.action === 'list') {
          const all = this.discoverSkills();
          const q = String(args.query || '').toLowerCase();
          const filtered = q
            ? all.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
            : all;
          return {
            ok: true,
            total: filtered.length,
            skills: filtered.slice(0, 60).map((s) => ({ name: s.name, category: s.category, description: s.description }))
          };
        }
        if (args.action === 'load') {
          return this.readSkillContent(args.query || '');
        }
        if (args.action === 'create') {
          return this.createCustomSkill({
            name: args.query,
            description: args.description,
            content: args.content
          });
        }
      }

      if (name === 'use_connector') {
        return await this.executeConnector(args.connector, args.action || 'list', args.params || {});
      }

      if (name === 'cron_manager') {
        if (args.action === 'list') {
          const all = this.listCronjobs();
          return {
            ok: true,
            currentAgentId: agentId,
            myJobs: all.filter((j) => j.agentId === agentId),
            otherAgentsJobs: all.filter((j) => j.agentId !== agentId),
            jobs: all
          };
        }
        if (args.action === 'create') {
          return this.createCronjob({
            name: args.name,
            schedule: args.schedule,
            prompt: args.prompt,
            agentId: args.agentId || agentId,
            enabled: args.enabled !== false
          });
        }
        if (args.action === 'toggle') return this.toggleCronjob(args.id, args.enabled);
        if (args.action === 'delete') return this.deleteCronjob(args.id);
      }

      return { ok: false, error: `Tool '${name}' tidak ditemukan.` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  _resolveUserPath(p) {
    const raw = String(p || '').trim();
    if (!raw) return os.homedir();
    if (raw.startsWith('~')) return path.join(os.homedir(), raw.slice(1));
    if (/^(desktop|downloads|documents|pictures|music|videos)$/i.test(raw)) {
      const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      return path.join(os.homedir(), cap);
    }
    return path.resolve(os.homedir(), raw);
  }

  // ==================== MULTI-TURN AGENTIC LOOP ====================

  async _buildSystemPrompt(agentDetail) {
    this._syncHermesMemoriesIntoGlobal();
    const freshGlobalMemory = safeReadText(this.globalMemoryPath, '') || agentDetail.globalMemory || '';
    const live = this.getLiveContext ? this.getLiveContext() : {};
    const connStatus = await this.getConnectorsStatus();
    const activeConns = connStatus.items.filter((i) => i.enabled).map((i) => `${i.id} (${i.badge})`).join(', ');
    const pinnedSkills = Array.isArray(agentDetail.pinnedSkills) && agentDetail.pinnedSkills.length > 0
      ? agentDetail.pinnedSkills.join(', ')
      : 'semua skill tersedia lewat skill_manager';

    return [
      `Kamu adalah **${agentDetail.name}** (${agentDetail.role}), sebuah Autonomous Full-Access Multi-Agent Bot yang berjalan langsung di dalam Dynamic Island Windows milik pengguna.`,
      `Waktu Lokal: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' })}`,
      `Home Directory: ${os.homedir()} | OS: Windows (${os.release()}) | CPU: ${live.cpu ?? 0}% | RAM: ${live.ramPercent ?? 0}%`,
      `Konektor Aktif: ${activeConns}`,
      `Skill Prioritas Agent: ${pinnedSkills}`,
      '',
      '=== ATURAN INTI (EKSEKUSI LANGSUNG & AUTO-IMPROVE HERMES) ===',
      '- Kamu BUKAN sekadar chatbot biasa: kamu punya akses penuh ke seluruh komputer, terminal PowerShell/CMD (`run_terminal`), seluruh Folder Manager (`list_directory`, `read_file`, `write_file`, `edit_file`, `search_files`, `manage_folder`), kontrol sistem (`system_control`), konektor aplikasi (`use_connector`), skill (`skill_manager`), memori (`memory_manager`), dan penjadwal cronjob (`cron_manager`).',
      '- **DILARANG MINTA KONFIRMASI BERULANG ("Ketik lanjutkan"):** Jika pengguna sudah meminta eksekusi/perbaikan (misalnya mengetik "gas", "gas perbaiki", "lanjutkan", "benerin", "perbaiki", "eksekusi", "ya", "oke"), DILARANG KERAS berhenti hanya untuk memaparkan rencana atau meminta konfirmasi "Ketik lanjutkan" lagi! Langsung terapkan perubahannya saat itu juga menggunakan `edit_file`, `write_file`, atau `run_terminal`, restart service bila perlu, verifikasi hasilnya, lalu laporkan bahwa perbaikan sudah selesai diterapkan.',
      '- **GUNAKAN KONTEKS TOOL SEBELUMNYA (JANGAN CEK ULANG DARI NOL):** Di dalam riwayat percakapan sudah disertakan blok `[RIWAYAT EKSEKUSI TOOL PADA GILIRAN INI]` yang berisi hasil terminal, isi file, dan nomor baris dari chat sebelumnya. Jangan membuang langkah dengan menjalankan `Get-Content` / `Select-String` / `Get-ChildItem` berulang-ulang pada file yang sudah pernah diperiksa di giliran sebelumnya — langsung gunakan informasi tersebut untuk mengeksekusi perubahan!',
      '- **AUTO-IMPROVE MEMORY (SEPERTI HERMES):** Setiap kali kamu menemukan fakta penting baru tentang preferensi pengguna, struktur proyek, konfigurasi environment, atau berhasil menyelesaikan akar masalah bug teknis, kamu WAJIB otomatis memanggil `memory_manager` (`action: "append"`, `scope: "global"`) untuk menyimpannya ke Memori Utama (yang otomatis tersinkronisasi dua arah dengan `MEMORY.md` Hermes) tanpa perlu menunggu disuruh pengguna.',
      '- Fokus & Relevan: Jika pengguna hanya bertanya status singkat (misal "WA udah nyambung belum?"), cukup cek 1 tool konektor yang relevan (`use_connector`), lalu LANGSUNG jawab pertanyaannya secara jelas, nyambung, dan jujur.',
      '- Jawab dengan Bahasa Indonesia yang santai, jelas, ringkas, dan to-the-point tanpa menggunakan emoji.',
      '',
      '=== IDENTITY.MD ===',
      agentDetail.identity || '',
      '',
      '=== SOUL.MD ===',
      agentDetail.soul || '',
      '',
      '=== INSTRUKSI AGENT ===',
      agentDetail.instructions || '',
      '',
      '=== MEMORI UTAMA (GLOBAL MEMORY · SINKRON DENGAN HERMES) ===',
      freshGlobalMemory.slice(0, 4200),
      '',
      `=== MEMORI KHUSUS ${agentDetail.name.toUpperCase()} ===`,
      (agentDetail.memory || '').slice(0, 2500)
    ].join('\n');
  }

  _buildUserMessageWithAttachments(userText, attachments = []) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return {
        apiContent: userText,
        historyText: userText,
        hasVisionImage: false
      };
    }

    const textParts = [];
    const multimodalParts = [];
    let hasVisionImage = false;

    if (userText) {
      textParts.push(userText);
    }

    for (const att of attachments) {
      const loc = att.localPath || att.sourcePath || '';
      if (att.isImage && loc && fs.existsSync(loc)) {
        const st = fs.statSync(loc);
        textParts.push(`[Lampiran Gambar: "${att.name}" tersimpan di ${loc} (${Math.round(st.size / 1024)} KB)]`);
        if (st.size <= 6 * 1024 * 1024) {
          const b64 = fs.readFileSync(loc).toString('base64');
          const mime = att.mimeType || 'image/png';
          multimodalParts.push({
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${b64}` }
          });
          hasVisionImage = true;
        }
      } else if (loc && fs.existsSync(loc)) {
        const st = fs.statSync(loc);
        let snippet = '';
        if (/\.(txt|md|json|csv|js|ts|jsx|tsx|py|ps1|bat|sh|yaml|yml|toml|ini|env|html|css|xml|sql|log|php|java|c|cpp|go|rs)$/i.test(att.name) && st.size <= 256000) {
          snippet = `\n--- Isi File ${att.name} ---\n${safeReadText(loc, '').slice(0, 12000)}\n--- Akhir Preview ---`;
        }
        textParts.push(`[Lampiran File: "${att.name}" tersimpan di ${loc} (${Math.round(st.size / 1024)} KB — gunakan read_file atau run_terminal pada path ini bila perlu pemrosesan lebih lanjut)]${snippet}`);
      }
    }

    const combinedText = textParts.join('\n\n');
    if (hasVisionImage) {
      return {
        apiContent: [{ type: 'text', text: combinedText }, ...multimodalParts],
        fallbackTextContent: combinedText,
        historyText: combinedText,
        hasVisionImage: true
      };
    }

    return {
      apiContent: combinedText,
      fallbackTextContent: combinedText,
      historyText: combinedText,
      hasVisionImage: false
    };
  }

  async _rawChatCompletion({ gateway, messages, tools, timeoutMs = 75000 }) {
    const baseUrl = String(gateway.baseUrl || 'http://127.0.0.1:20128/v1').replace(/\/+$/, '');
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
    const bodyObj = {
      model: gateway.model || 'claude-fable-5',
      messages
    };
    if (Array.isArray(tools) && tools.length > 0) {
      bodyObj.tools = tools;
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (gateway.apiKey) {
      headers['Authorization'] = `Bearer ${gateway.apiKey}`;
    }

    try {
      const res = await httpRequestRaw(endpoint, {
        method: 'POST',
        headers,
        body: bodyObj,
        timeoutMs
      });

      const raw = res.body || '';
      if (res.statusCode >= 400) {
        const parsedErr = safeJsonParse(raw);
        return {
          ok: false,
          statusCode: res.statusCode,
          error: parsedErr?.error?.message || raw.slice(0, 260) || `HTTP ${res.statusCode}`
        };
      }

      // Parse SSE stream if response contains "data:" chunks
      if (raw.includes('data:')) {
        let fullText = '';
        let fullReasoning = '';
        let resolvedModel = '';
        const toolCallMap = new Map();

        for (const line of raw.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          const obj = safeJsonParse(dataStr);
          if (!obj) continue;
          if (obj.model) resolvedModel = obj.model;
          const choice = obj.choices && obj.choices[0];
          if (!choice) continue;

          const delta = choice.delta || choice.message || {};
          if (typeof delta.content === 'string') fullText += delta.content;
          if (typeof delta.reasoning_content === 'string') fullReasoning += delta.reasoning_content;
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = typeof tc.index === 'number' ? tc.index : 0;
              if (!toolCallMap.has(idx)) {
                toolCallMap.set(idx, {
                  id: tc.id || `call_${idx}_${Date.now()}`,
                  type: 'function',
                  function: { name: '', arguments: '' }
                });
              }
              const entry = toolCallMap.get(idx);
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.function.name += tc.function.name;
              if (typeof tc.function?.arguments === 'string') entry.function.arguments += tc.function.arguments;
              if (tc.extra_content) entry.extra_content = tc.extra_content;
            }
          }
        }

        const toolCalls = Array.from(toolCallMap.values()).filter((t) => t.function.name);
        return {
          ok: true,
          model: resolvedModel || gateway.model,
          content: fullText.trim(),
          reasoning_content: fullReasoning || undefined,
          tool_calls: toolCalls.length > 0 ? toolCalls : null
        };
      }

      // Standard JSON completion response
      const parsed = safeJsonParse(raw);
      if (!parsed) {
        return { ok: false, error: 'Respons gateway bukan JSON yang valid.' };
      }
      if (parsed.error) {
        return { ok: false, error: parsed.error.message || JSON.stringify(parsed.error) };
      }
      const msg = parsed.choices && parsed.choices[0] && parsed.choices[0].message;
      if (!msg) {
        return { ok: false, error: 'Respons kosong dari AI gateway.' };
      }
      return {
        ok: true,
        model: parsed.model || gateway.model,
        content: typeof msg.content === 'string' ? msg.content.trim() : '',
        reasoning_content: msg.reasoning_content || undefined,
        tool_calls: Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 ? msg.tool_calls : null
      };
    } catch (err) {
      return {
        ok: false,
        error: `Gagal terhubung ke gateway (${endpoint}): ${err.message}`
      };
    }
  }

  _formatHistoryMessageWithToolContext(m, isRecentTurn = false) {
    const baseText = String(m.content || '').trim();
    if (m.role !== 'assistant' || !Array.isArray(m.toolsUsed) || m.toolsUsed.length === 0) {
      return baseText;
    }
    const maxTools = isRecentTurn ? 12 : 6;
    const maxOutLen = isRecentTurn ? 1100 : 360;
    const lines = m.toolsUsed.slice(-maxTools).map((t, idx) => {
      const statusTag = t.ok === false ? 'GAGAL' : 'OK';
      const argsClean = String(t.argsPreview || t.label || t.tool || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      const outSource = isRecentTurn && t.rawOutput ? t.rawOutput : (t.outputPreview || '');
      const outClean = String(outSource || '').replace(/\s+/g, ' ').trim().slice(0, maxOutLen);
      return `${idx + 1}. [${t.tool} · ${statusTag}] ${argsClean}${outClean ? ` => Hasil: ${outClean}` : ''}`;
    });
    return `${baseText}\n\n[RIWAYAT EKSEKUSI TOOL PADA GILIRAN INI (GUNAKAN DATA INI, JANGAN BACA ULANG DARI NOL)]:\n${lines.join('\n')}`.trim();
  }

  async _autoImproveMemoryFromTurn({ agentId, userText, finalReply, executedToolsLog }) {
    try {
      const cleanUser = String(userText || '').trim();
      const cleanReply = String(finalReply || '').trim();
      if (!cleanUser || cleanUser.length < 4) return;

      // Skip if agent already explicitly called memory_manager in this turn
      const alreadySavedMem = Array.isArray(executedToolsLog) && executedToolsLog.some((t) => t.tool === 'memory_manager' && /append|replace/i.test(t.argsPreview || ''));
      if (alreadySavedMem) return;

      const hadWriteOrFix = Array.isArray(executedToolsLog) && executedToolsLog.some((t) =>
        t.tool === 'write_file' ||
        t.tool === 'edit_file' ||
        t.tool === 'cron_manager' ||
        (t.tool === 'run_terminal' && /Set-Content|Out-File|Add-Content|Stop-Process|Start-Process|git |npm |pip /i.test(t.argsPreview || ''))
      );
      const userStatedFact = /\b(ingat|catat|jangan lupa|selalu|mulai sekarang|nama gua|nama saya|nomor wa|nomor whatsapp|pakai|gunakan|folder|project|proyek|repo)\b/i.test(cleanUser);

      if (!hadWriteOrFix && !userStatedFact) return;

      const currentMem = safeReadText(this.globalMemoryPath, '').slice(-2500);
      const gateway = this.getGatewayConfig();
      const prompt = [
        'Kamu adalah modul Auto-Improve Memory (setara Hermes MEMORY.md).',
        'Tugasmu: periksa interaksi terakhir di bawah. Jika ada (a) fakta/preferensi permanen baru tentang pengguna, ATAU (b) solusi teknis/konfigurasi/path penting yang baru saja berhasil diperbaiki dan berguna untuk diingat di masa depan, tuliskan HANYA 1 baris kalimat singkat padat (tanpa bullet, tanpa tanda kutip, maksimal 180 karakter).',
        'Jika TIDAK ada fakta baru atau sudah tercatat di memori saat ini, balas persis dengan kata: NONE',
        '',
        `Memori Saat Ini:\n${currentMem}`,
        '',
        `Pesan Pengguna: ${cleanUser.slice(0, 500)}`,
        `Tindakan/Jawaban Agent: ${cleanReply.slice(0, 900)}`
      ].join('\n');

      const res = await this._rawChatCompletion({
        gateway,
        messages: [{ role: 'user', content: prompt }],
        tools: null,
        timeoutMs: 15000
      });

      if (!res || !res.ok || !res.content) return;
      const line = String(res.content || '').split(/\r?\n/)[0].replace(/^[-*•"'\s]+|["'\s]+$/g, '').trim();
      if (!line || /^none\b/i.test(line) || line.length < 10 || line.length > 240) return;

      const updated = this._appendFactToGlobalAndHermesMemory(line, userStatedFact ? 'user' : 'memory');
      if (updated) {
        this.sendToRenderer('memory-updated', { scope: 'global', agentId, content: updated, autoImproved: true });
      }
    } catch (_e) {}
  }

  async chatWithAgent({ agentId, sessionId, userText, attachments = [], isBackgroundTask = false, sourceOverride = '' }) {
    const detail = this.getAgentDetail(agentId) || this.getAgentDetail('hancow');
    const gateway = this.getGatewayConfig();
    const systemPrompt = await this._buildSystemPrompt(detail);
    const tools = this._getToolSchemas();

    const store = this._loadSessionsStore(detail.id);
    const activeSess = (sessionId && store.sessions.find((s) => s.id === sessionId)) ||
      store.sessions.find((s) => s.id === store.activeSessionId) ||
      store.sessions[0];
    const savedHistory = activeSess && Array.isArray(activeSess.messages) ? activeSess.messages : [];
    const slicedHistory = savedHistory.slice(-14);
    const recentHistory = slicedHistory.map((m, idx) => {
      const isRecentTurn = idx >= slicedHistory.length - 4;
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: this._formatHistoryMessageWithToolContext(m, isRecentTurn)
      };
    });

    const builtUser = this._buildUserMessageWithAttachments(userText, attachments);
    const isActionConfirmation = /\b(gas|gass+|lanjut|lanjutkan|perbaiki|benerin|eksekusi|terapkan|jalanin|sikat|fix|oke|ok|ya|boleh|setuju)\b/i.test(String(userText || '').trim());

    const userContentToSend = isActionConfirmation && typeof builtUser.apiContent === 'string'
      ? `${builtUser.apiContent}\n\n[INSTRUKSI EKSEKUSI LANGSUNG: Pengguna sudah memberikan konfirmasi eksekusi. Gunakan hasil pemeriksaan di riwayat sebelumnya tanpa membaca ulang dari nol, LANGSUNG terapkan perubahannya sekarang menggunakan edit_file / write_file / run_terminal, dan DILARANG meminta konfirmasi "Ketik lanjutkan" lagi!]`
      : builtUser.apiContent;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: userContentToSend }
    ];

    const executedToolsLog = [];
    let finalReply = '';
    let supportToolsParam = true;
    let nudgeInjected = false;
    let maxSteps = 45;
    const HARD_MAX_STEPS = 100;
    const recentSignatures = [];
    let stuckCount = 0;

    const runStartMs = Date.now();
    const runStartIso = new Date(runStartMs).toISOString();
    const actId = `act-${runStartMs.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const actSource = sourceOverride || (isBackgroundTask ? 'cron' : 'chat');
    const rawPromptForTitle = userText || (attachments[0] && `Lampiran: ${attachments[0].name}`) || 'Instruksi Agent';
    const activityRecord = {
      id: actId,
      agentId: detail.id,
      sessionId: activeSess ? activeSess.id : '',
      source: actSource,
      title: this._deriveActivityTitle(rawPromptForTitle, actSource),
      subtitle: 'Sedang memproses instruksi...',
      prompt: String(userText || builtUser.historyText || ''),
      status: 'running',
      startedAt: runStartIso,
      completedAt: null,
      durationMs: 0,
      steps: [],
      summary: ''
    };
    this._upsertActivity(detail.id, activityRecord);

    for (let step = 0; step < maxSteps; step++) {
      // Auto-compact older tool outputs in apiMessages when session grows beyond 14 steps to prevent token bloat
      if (step > 14 && apiMessages.length > 26) {
        const cutoff = apiMessages.length - 16;
        for (let mIdx = 1; mIdx < cutoff; mIdx++) {
          const msgObj = apiMessages[mIdx];
          if (msgObj && msgObj.role === 'tool' && typeof msgObj.content === 'string' && msgObj.content.length > 1400) {
            msgObj.content = `${msgObj.content.slice(0, 1200)} ... [Output diringkas otomatis untuk menjaga kecepatan konteks]`;
          }
        }
      }

      // Mid-loop guard: if user asked to fix/continue and agent spent 4+ steps only inspecting, push it to execute now
      if (isActionConfirmation && !nudgeInjected && step >= 4) {
        const hasMutated = executedToolsLog.some((t) =>
          t.tool === 'write_file' ||
          t.tool === 'edit_file' ||
          (t.tool === 'run_terminal' && /Set-Content|Out-File|Add-Content|Stop-Process|Start-Process|Restart-Service/i.test(t.argsPreview || ''))
        );
        if (!hasMutated) {
          nudgeInjected = true;
          apiMessages.push({
            role: 'user',
            content: '[SISTEM DARURAT: Kamu sudah menjalankan 4+ langkah pembacaan ulang padahal pengguna sudah memerintahkan eksekusi ("' + String(userText || '').trim() + '"). Berhenti membaca ulang file! Sekarang juga panggil tool `edit_file`, `write_file`, atau `run_terminal` untuk menerapkan perubahannya secara nyata, lalu laporkan hasilnya.]'
          });
        }
      }

      let resp = await this._rawChatCompletion({
        gateway,
        messages: apiMessages,
        tools: supportToolsParam ? tools : null
      });

      // Fallback 1: if vision multimodal array rejected by text-only model, downgrade content to text+localPath
      if (!resp.ok && step === 0 && builtUser.hasVisionImage) {
        apiMessages[apiMessages.length - 1].content = builtUser.fallbackTextContent;
        resp = await this._rawChatCompletion({
          gateway,
          messages: apiMessages,
          tools: supportToolsParam ? tools : null
        });
      }

      // Fallback 2: if gateway/model rejects `tools` parameter, retry without native tools
      if (!resp.ok && supportToolsParam && /tool|function|unsupported|400/i.test(resp.error || '')) {
        supportToolsParam = false;
        resp = await this._rawChatCompletion({
          gateway,
          messages: apiMessages,
          tools: null
        });
      }

      if (!resp.ok) {
        const errIso = new Date().toISOString();
        activityRecord.status = 'error';
        activityRecord.completedAt = errIso;
        activityRecord.durationMs = Math.max(100, Date.now() - runStartMs);
        activityRecord.summary = String(resp.error || 'Gagal menjalankan tugas.');
        activityRecord.subtitle = this._deriveActivitySubtitle(resp.error, 'error', activityRecord.steps);
        this._upsertActivity(detail.id, activityRecord);
        return { ok: false, error: resp.error, toolsUsed: executedToolsLog, activityId: actId };
      }

      if (!resp.tool_calls || resp.tool_calls.length === 0) {
        const candidateReply = resp.content || '';
        // Guard against the model still asking "Ketik lanjutkan" when the user ALREADY said "lanjutkan" / "gas perbaiki"
        const asksForConfirmationAgain = /ketik\s+["'`](?:lanjut|lanjutkan|gas)["'`]/i.test(candidateReply);
        const hasMutatedAny = executedToolsLog.some((t) =>
          t.tool === 'write_file' ||
          t.tool === 'edit_file' ||
          (t.tool === 'run_terminal' && /Set-Content|Out-File|Add-Content|Stop-Process|Start-Process/i.test(t.argsPreview || ''))
        );
        if (isActionConfirmation && asksForConfirmationAgain && !hasMutatedAny && step < maxSteps - 2) {
          apiMessages.push({
            role: 'assistant',
            content: candidateReply
          });
          apiMessages.push({
            role: 'user',
            content: '[SISTEM: Pengguna SUDAH mengetik konfirmasi eksekusi di awal giliran ini! DILARANG meminta pengguna mengetik "lanjutkan" lagi. Eksekusi perubahan tersebut SEKARANG JUGA menggunakan tool `edit_file`, `write_file`, atau `run_terminal`!]'
          });
          continue;
        }
        if (candidateReply.trim()) {
          finalReply = candidateReply.trim();
        }
        break;
      }

      // Append assistant tool_calls message
      const assistantMsg = {
        role: 'assistant',
        content: resp.content || '',
        tool_calls: resp.tool_calls
      };
      if (resp.reasoning_content) {
        assistantMsg.reasoning_content = resp.reasoning_content;
      }
      apiMessages.push(assistantMsg);

      let abortStuckLoop = false;

      // Execute each tool call sequentially and emit live progress to UI
      for (const tc of resp.tool_calls) {
        const fnName = tc.function.name;
        let parsedArgs = {};
        try { parsedArgs = JSON.parse(tc.function.arguments || '{}'); } catch (_e) {}
        const sig = `${fnName}:${JSON.stringify(parsedArgs)}`;
        recentSignatures.push(sig);

        // Stuck Loop Detector: check if identical tool+args repeated 3x in a row
        const len = recentSignatures.length;
        const isRepeated3x = len >= 3 &&
          recentSignatures[len - 1] === sig &&
          recentSignatures[len - 2] === sig &&
          recentSignatures[len - 3] === sig;

        if (isRepeated3x) {
          stuckCount++;
          apiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: false,
              error: 'STUCK_LOOP_DETECTED: Kamu sudah memanggil tool dengan argumen yang persis sama 3x berturut-turut. Jangan mengulangi perintah ini lagi — gunakan cara berbeda atau langsung berikan penjelasan hasil akhirnya ke pengguna.'
            })
          });
          if (stuckCount >= 2) {
            abortStuckLoop = true;
            break;
          }
          continue;
        }

        const label = this._describeToolStep(fnName, parsedArgs);
        const stepStartMs = Date.now();
        const stepId = `step-${actId}-${activityRecord.steps.length + 1}`;
        const argsPreview = this._formatToolInputPreview(fnName, parsedArgs);

        const stepItem = {
          id: stepId,
          tool: fnName,
          label,
          detailTitle: label,
          status: 'running',
          argsPreview,
          outputPreview: 'Sedang mengeksekusi...',
          durationMs: 0,
          at: new Date(stepStartMs).toISOString()
        };
        activityRecord.steps.push(stepItem);
        activityRecord.subtitle = this._deriveActivitySubtitle('', 'running', activityRecord.steps);
        this._upsertActivity(detail.id, activityRecord);

        if (!isBackgroundTask) {
          this.sendToRenderer('agent-step', {
            agentId: detail.id,
            activityId: actId,
            phase: 'start',
            tool: fnName,
            label
          });
        }

        const resultObj = await this._executeTool(detail.id, fnName, parsedArgs);
        const stepDurationMs = Math.max(12, Date.now() - stepStartMs);
        const resultStr = JSON.stringify(resultObj).slice(0, 22000);
        const stepOk = resultObj?.ok !== false;
        const outputPreview = this._formatToolOutputPreview(fnName, resultObj);

        stepItem.status = stepOk ? 'done' : 'error';
        stepItem.durationMs = stepDurationMs;
        stepItem.outputPreview = outputPreview;
        this._upsertActivity(detail.id, activityRecord);

        executedToolsLog.push({
          tool: fnName,
          label,
          ok: stepOk,
          argsPreview,
          outputPreview: outputPreview.slice(0, 1200),
          rawOutput: resultStr.slice(0, 3200),
          durationMs: stepDurationMs,
          screenshotPath: resultObj?.screenshotPath || undefined,
          activityId: actId
        });

        // Smart Dynamic Step Extension: if agent is actively writing/editing files or progressing near maxSteps, extend budget up to 100
        if (stepOk && (fnName === 'write_file' || fnName === 'edit_file' || fnName === 'run_terminal') && step >= maxSteps - 6 && maxSteps < HARD_MAX_STEPS) {
          maxSteps = Math.min(HARD_MAX_STEPS, maxSteps + 16);
        }

        if (!isBackgroundTask) {
          this.sendToRenderer('agent-step', {
            agentId: detail.id,
            activityId: actId,
            phase: 'done',
            tool: fnName,
            label,
            ok: stepOk
          });
        }

        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: resultStr
        });
      }

      if (abortStuckLoop) break;
    }

    // Guaranteed Detailed Final Summary (Flatten tool log into plain text so tools:null never triggers HTTP 400 on Claude/9router)
    if (!finalReply) {
      const stepsDigest = executedToolsLog.slice(-18).map((t, idx) => {
        const st = t.ok === false ? 'GAGAL' : 'BERHASIL';
        return `${idx + 1}. [${t.tool} - ${st}] ${t.label}\n   Input: ${String(t.argsPreview || '').slice(0, 240)}\n   Output: ${String(t.outputPreview || '').slice(0, 500)}`;
      }).join('\n\n');

      const cleanSynthMessages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.slice(-6),
        {
          role: 'user',
          content: [
            `Permintaan pengguna: "${String(userText || '').trim()}"`,
            '',
            'Berikut adalah daftar langkah tool yang baru saja kamu jalankan beserta hasilnya:',
            stepsDigest || '(Tidak ada tool dijalankan)',
            '',
            'Berikan penjelasan rangkuman hasil akhirnya kepada pengguna secara jelas, jujur, dan spesifik (file apa saja yang sudah diubah, proses apa yang sudah di-restart, dan status akhirnya). Jangan menjawab hanya dengan kalimat pendek "Eksekusi selesai dijalankan".'
          ].join('\n')
        }
      ];

      const synthResp = await this._rawChatCompletion({
        gateway,
        messages: cleanSynthMessages,
        tools: null,
        timeoutMs: 35000
      });

      if (synthResp && synthResp.ok && synthResp.content) {
        finalReply = synthResp.content.trim();
      } else {
        const okSteps = executedToolsLog.filter((t) => t.ok !== false);
        const lastOutputs = okSteps.slice(-4).map((t) => `- **${t.label}**: ${String(t.outputPreview || 'Selesai').replace(/\s+/g, ' ').slice(0, 180)}`).join('\n');
        finalReply = `Berikut ringkasan langkah yang sudah dieksekusi (${okSteps.length}/${executedToolsLog.length} langkah berhasil):\n${lastOutputs || '- Perubahan telah diterapkan.'}`;
      }
    }

    // Persist conversation to active session inside sessions.json
    const freshStore = this._loadSessionsStore(detail.id);
    const targetSess = (activeSess && freshStore.sessions.find((s) => s.id === activeSess.id)) ||
      freshStore.sessions.find((s) => s.id === freshStore.activeSessionId) ||
      freshStore.sessions[0];
    const nowIso = new Date().toISOString();

    activityRecord.status = 'completed';
    activityRecord.completedAt = nowIso;
    activityRecord.durationMs = Math.max(80, Date.now() - runStartMs);
    activityRecord.summary = finalReply;
    activityRecord.subtitle = this._deriveActivitySubtitle(finalReply, 'completed', activityRecord.steps);
    if (targetSess) {
      activityRecord.sessionId = targetSess.id;
    }
    this._upsertActivity(detail.id, activityRecord);

    if (targetSess) {
      targetSess.messages = Array.isArray(targetSess.messages) ? targetSess.messages : [];
      if (!targetSess.title || targetSess.title === 'Chat Baru') {
        const cleanTitle = String(userText || (attachments[0] && attachments[0].name) || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 44);
        if (cleanTitle) targetSess.title = cleanTitle;
      }
      targetSess.messages.push({
        role: 'user',
        content: builtUser.historyText,
        displayText: userText,
        attachments: attachments.map((a) => ({
          name: a.name,
          localPath: a.localPath,
          isImage: a.isImage,
          previewDataUrl: a.isImage ? a.previewDataUrl : ''
        })),
        at: nowIso
      });
      targetSess.messages.push({
        role: 'assistant',
        content: finalReply,
        toolsUsed: executedToolsLog,
        activityId: actId,
        at: nowIso
      });
      targetSess.messages = targetSess.messages.slice(-60);
      targetSess.updatedAt = nowIso;
      this._saveSessionsStore(detail.id, freshStore);
    }

    // Trigger background Hermes-style Auto-Improve Memory extraction (non-blocking)
    if (!isBackgroundTask) {
      this._autoImproveMemoryFromTurn({
        agentId: detail.id,
        userText,
        finalReply,
        executedToolsLog
      }).catch(() => {});
    }

    return {
      ok: true,
      agentId: detail.id,
      sessionId: targetSess ? targetSess.id : '',
      activityId: actId,
      reply: finalReply,
      toolsUsed: executedToolsLog
    };
  }
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (_e) {
    return null;
  }
}

function parseIcsDate(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const mon = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const hh = m[4] ? parseInt(m[4], 10) : 9;
  const mm = m[5] ? parseInt(m[5], 10) : 0;
  const ss = m[6] ? parseInt(m[6], 10) : 0;
  if (m[7] === 'Z') {
    return new Date(Date.UTC(year, mon, day, hh, mm, ss));
  }
  return new Date(year, mon, day, hh, mm, ss);
}

module.exports = { AgentPlatform, GATEWAY_PRESETS };
