// ===== AI AVATAR PRESETS (Winnie / Pipo, Wana & Hancow + Custom) =====
const AVATAR_PRESETS = {
  pipo: {
    defaultName: 'Winnie',
    sub: 'Fast Ops',
    idleSrc: 'public/assets/pipo-idle.webm',
    workingSrc: 'public/assets/pipo-working.webm',
    idlePoster: 'public/assets/pipo-idle-poster.png',
    workingPoster: 'public/assets/pipo-working-poster.png'
  },
  wana: {
    defaultName: 'Wana',
    sub: 'Cue & Konektor',
    idleSrc: 'public/assets/wana-idle.webm',
    workingSrc: 'public/assets/wana-working.webm',
    idlePoster: 'public/assets/wana-idle-poster.png',
    workingPoster: 'public/assets/wana-working-poster.png'
  },
  hancow: {
    defaultName: 'Hancow',
    sub: 'System & Code',
    idleSrc: 'public/assets/hancow-idle.webm',
    workingSrc: 'public/assets/hancow-working.webm',
    idlePoster: 'public/assets/hancow-idle-poster.png',
    workingPoster: 'public/assets/hancow-working-poster.png'
  },
  lab: {
    defaultName: 'Lab',
    sub: 'Research & Lab',
    idleSrc: 'public/assets/lab-idle.webm',
    workingSrc: 'public/assets/lab-working.webm',
    idlePoster: 'public/assets/lab-idle-poster.png',
    workingPoster: 'public/assets/lab-working-poster.png'
  },
  ninja: {
    defaultName: 'Ninja',
    sub: 'Stealth Ops',
    idleSrc: 'public/assets/ninja-idle.webm',
    workingSrc: 'public/assets/ninja-working.webm',
    idlePoster: 'public/assets/ninja-idle-poster.png',
    workingPoster: 'public/assets/ninja-working-poster.png'
  },
  hoodie: {
    defaultName: 'Hoodie',
    sub: 'Dev & Hacker',
    idleSrc: 'public/assets/hoodie-idle.webm',
    workingSrc: 'public/assets/hoodie-working.webm',
    idlePoster: 'public/assets/hoodie-idle-poster.png',
    workingPoster: 'public/assets/hoodie-working-poster.png'
  },
  wizard: {
    defaultName: 'Wizard',
    sub: 'Magic & Logic',
    idleSrc: 'public/assets/wizard-idle.webm',
    workingSrc: 'public/assets/wizard-working.webm',
    idlePoster: 'public/assets/wizard-idle-poster.png',
    workingPoster: 'public/assets/wizard-working-poster.png'
  },
  astro: {
    defaultName: 'Astro',
    sub: 'Cosmic Ops',
    idleSrc: 'public/assets/astro-idle.webm',
    workingSrc: 'public/assets/astro-working.webm',
    idlePoster: 'public/assets/astro-idle-poster.png',
    workingPoster: 'public/assets/astro-working-poster.png'
  },
  cowboy: {
    defaultName: 'Cowboy',
    sub: 'Wild West Code',
    idleSrc: 'public/assets/cowboy-idle.webm',
    workingSrc: 'public/assets/cowboy-working.webm',
    idlePoster: 'public/assets/cowboy-idle-poster.png',
    workingPoster: 'public/assets/cowboy-working-poster.png'
  },
  hero: {
    defaultName: 'Hero',
    sub: 'Super Guardian',
    idleSrc: 'public/assets/hero-idle.webm',
    workingSrc: 'public/assets/hero-working.webm',
    idlePoster: 'public/assets/hero-idle-poster.png',
    workingPoster: 'public/assets/hero-working-poster.png'
  }
};

const GATEWAY_PRESET_URLS = {
  '9router': { baseUrl: 'http://127.0.0.1:20128/v1', model: 'claude-fable-5' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.7-sonnet' },
  ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5-coder:7b' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' }
};

let currentAiAvatar = 'hancow';
let currentAiName = 'Hancow';
let currentCustomAvatarUrl = '';
let currentModelName = 'claude-fable-5';

function getAvatarAssetsForAgent(agent) {
  if (agent && agent.avatar === 'custom' && agent.customAvatarUrl) {
    const isVid = /\.(webm|mp4)$/i.test(agent.customAvatarUrl);
    return {
      defaultName: agent.name || 'Custom',
      idleSrc: isVid ? agent.customAvatarUrl : '',
      workingSrc: isVid ? agent.customAvatarUrl : '',
      idlePoster: isVid ? AVATAR_PRESETS.hancow.idlePoster : agent.customAvatarUrl,
      workingPoster: isVid ? AVATAR_PRESETS.hancow.workingPoster : agent.customAvatarUrl
    };
  }
  const key = (agent && agent.avatar) || currentAiAvatar || 'hancow';
  return AVATAR_PRESETS[key] || AVATAR_PRESETS.hancow;
}

function getAgentThumbSrc(agent) {
  if (agent && agent.avatar === 'custom' && agent.customAvatarUrl && !/\.(webm|mp4)$/i.test(agent.customAvatarUrl)) {
    return agent.customAvatarUrl;
  }
  const preset = AVATAR_PRESETS[(agent && agent.avatar) || 'hancow'] || AVATAR_PRESETS.hancow;
  return preset.idlePoster;
}

function renderStaticAvatars(assetsOverride) {
  const preset = assetsOverride || AVATAR_PRESETS[currentAiAvatar] || AVATAR_PRESETS.hancow;
  document.querySelectorAll('.jg-avatar:not(.hermes-avatar)').forEach((el) => {
    el.innerHTML = `<img class="jg-poster" src="${preset.idlePoster}" alt="${escapeHtml(currentAiName)}" draggable="false" />`;
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

renderStaticAvatars();

let jeanAvatar = new AvatarVideo(
  document.querySelector('.hermes-avatar'),
  AVATAR_PRESETS[currentAiAvatar]
);
jeanAvatar.setVisible(false);

function updateJeanAvatarVisibility() {
  if (!jeanAvatar) return;
  const islandEl = document.getElementById('island');
  const tabHermes = document.getElementById('tab-hermes');
  const tabOpen = tabHermes && tabHermes.classList.contains('active');
  jeanAvatar.setVisible(islandEl && islandEl.classList.contains('expanded') && tabOpen);
}

function setJeanState(state, customStatusText) {
  const islandEl = document.getElementById('island');
  if (islandEl) {
    islandEl.classList.remove('jg-happy', 'jg-thinking', 'jg-talking');
    if (state) islandEl.classList.add(`jg-${state}`);
  }
  if (jeanAvatar) {
    jeanAvatar.setState(state ? 'working' : 'idle');
  }

  const statusEl = document.getElementById('jgStatusText');
  if (statusEl) {
    if (customStatusText) {
      statusEl.textContent = customStatusText;
    } else {
      statusEl.textContent =
        state === 'thinking' ? 'menjalankan agent...' :
        state === 'talking' ? 'menyusun hasil...' :
        state === 'happy' ? 'siap eksekusi!' :
        `autonomous · ${currentModelName}`;
    }
  }
}

// ===== DOM REFERENCES =====
const island = document.getElementById('island');
const clockText = document.getElementById('clockText');
const batteryText = document.getElementById('batteryText');
const batteryFill = document.getElementById('batteryFill');
const miniMediaWave = document.getElementById('miniMediaWave');
const collapsedPillRow = document.getElementById('collapsedPillRow');
const notchLyricRow = document.getElementById('notchLyricRow');
const notchLyricText = document.getElementById('notchLyricText');
const themeCardIsland = document.getElementById('themeCardIsland');
const themeCardNotch = document.getElementById('themeCardNotch');
const btnAutoStart = document.getElementById('btnAutoStart');
const bannerAiName = document.getElementById('bannerAiName');
const bannerSubText = document.getElementById('bannerSubText');
const hermesAiName = document.getElementById('hermesAiName');
const bannerAskBtn = document.getElementById('bannerAskBtn');

let currentTheme = 'island';
let lastNotchDisplayedText = '';
let lastGlowSrc = '';
let isPinnedOpen = false;
let isFileDialogOpen = false;

// Media Elements
const albumArt = document.getElementById('albumArt');
const mediaTag = document.getElementById('mediaTag');
const mediaTitle = document.getElementById('mediaTitle');
const mediaArtist = document.getElementById('mediaArtist');
const waveformBars = document.getElementById('waveformBars');
const timeCurrent = document.getElementById('timeCurrent');
const timeRemaining = document.getElementById('timeRemaining');
const progressTrack = document.getElementById('progressTrack');
const progressFill = document.getElementById('progressFill');
const btnShuffle = document.getElementById('btnShuffle');
const btnPrev = document.getElementById('btnPrev');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnNext = document.getElementById('btnNext');
const btnRepeat = document.getElementById('btnRepeat');
const repeatOneBadge = document.getElementById('repeatOneBadge');
const btnLyrics = document.getElementById('btnLyrics');
const btnCloseLyrics = document.getElementById('btnCloseLyrics');
const lyricsPanel = document.getElementById('lyricsPanel');
const lyricsBody = document.getElementById('lyricsBody');
const iconPause = document.getElementById('iconPause');
const iconPlay = document.getElementById('iconPlay');

// System Elements
const sysUptime = document.getElementById('sysUptime');
const cpuVal = document.getElementById('cpuVal');
const cpuBar = document.getElementById('cpuBar');
const cpuSub = document.getElementById('cpuSub');
const ramVal = document.getElementById('ramVal');
const ramBar = document.getElementById('ramBar');
const ramSub = document.getElementById('ramSub');
const cpuTempVal = document.getElementById('cpuTempVal');
const cpuTempBar = document.getElementById('cpuTempBar');
const cpuTempSub = document.getElementById('cpuTempSub');
const gpuTempVal = document.getElementById('gpuTempVal');
const gpuTempBar = document.getElementById('gpuTempBar');
const gpuTempSub = document.getElementById('gpuTempSub');

// Agent Hub Elements
const hermesMessages = document.getElementById('hermesMessages');
const hermesForm = document.getElementById('hermesForm');
const hermesInput = document.getElementById('hermesInput');
const hermesSendBtn = document.getElementById('hermesSendBtn');
const hermesClearBtn = document.getElementById('hermesClearBtn');
const btnNewChat = document.getElementById('btnNewChat');
const btnChatSessions = document.getElementById('btnChatSessions');
const btnPinIsland = document.getElementById('btnPinIsland');
const btnProactiveScan = document.getElementById('btnProactiveScan');
const agentSelect = document.getElementById('agentSelect');
const agentSelectTrigger = document.getElementById('agentSelectTrigger');
const agentSelectThumb = document.getElementById('agentSelectThumb');
const agentSelectName = document.getElementById('agentSelectName');
const agentSelectBusy = document.getElementById('agentSelectBusy');
const agentSelectMenu = document.getElementById('agentSelectMenu');
const agentPillsBar = document.getElementById('agentPillsBar');
const btnAddAgent = document.getElementById('btnAddAgent');
const agentSubNav = document.getElementById('agentSubNav');
const dropOverlay = document.getElementById('dropOverlay');
const attachmentStrip = document.getElementById('attachmentStrip');
const hermesFileInput = document.getElementById('hermesFileInput');
const btnAttachFile = document.getElementById('btnAttachFile');
const islandConfirmModal = document.getElementById('islandConfirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalDesc = document.getElementById('confirmModalDesc');
const btnConfirmCancel = document.getElementById('btnConfirmCancel');
const btnConfirmOk = document.getElementById('btnConfirmOk');
const sessionHistoryDrawer = document.getElementById('sessionHistoryDrawer');
const sessionsDrawerTitle = document.getElementById('sessionsDrawerTitle');
const btnDrawerNewChat = document.getElementById('btnDrawerNewChat');
const btnCloseSessionsDrawer = document.getElementById('btnCloseSessionsDrawer');
const sessionsListContainer = document.getElementById('sessionsListContainer');

// Studio Config Elements
const cfgAgentName = document.getElementById('cfgAgentName');
const cfgAgentAvatar = document.getElementById('cfgAgentAvatar');
const cfgCustomAvatarInput = document.getElementById('cfgCustomAvatarInput');
const btnUploadAvatar = document.getElementById('btnUploadAvatar');
const cfgAgentRole = document.getElementById('cfgAgentRole');
const cfgDocTabs = document.getElementById('cfgDocTabs');
const cfgDocEditor = document.getElementById('cfgDocEditor');
const cfgStatusText = document.getElementById('cfgStatusText');
const btnDeleteAgent = document.getElementById('btnDeleteAgent');
const btnSaveAgent = document.getElementById('btnSaveAgent');
const btnBackToAgentList = document.getElementById('btnBackToAgentList');
const cfgPaneTitle = document.getElementById('cfgPaneTitle');

// Skills, Connectors, Cron Elements
const skillSearchInput = document.getElementById('skillSearchInput');
const btnToggleNewSkill = document.getElementById('btnToggleNewSkill');
const newSkillBox = document.getElementById('newSkillBox');
const newSkillName = document.getElementById('newSkillName');
const newSkillDesc = document.getElementById('newSkillDesc');
const newSkillContent = document.getElementById('newSkillContent');
const btnCreateSkillSave = document.getElementById('btnCreateSkillSave');
const skillsListContainer = document.getElementById('skillsListContainer');
const connectorsListContainer = document.getElementById('connectorsListContainer');
const btnProactiveToggle = document.getElementById('btnProactiveToggle');
const btnToggleNewCron = document.getElementById('btnToggleNewCron');
const newCronBox = document.getElementById('newCronBox');
const newCronName = document.getElementById('newCronName');
const newCronSchedule = document.getElementById('newCronSchedule');
const newCronAgent = document.getElementById('newCronAgent');
const newCronPrompt = document.getElementById('newCronPrompt');
const btnSaveNewCron = document.getElementById('btnSaveNewCron');
const cronListContainer = document.getElementById('cronListContainer');

// Activity Log & Split Inspector Modal Elements
const activityScopeBar = document.getElementById('activityScopeBar');
const actTabCurrentAgent = document.getElementById('actTabCurrentAgent');
const actTabAllAgents = document.getElementById('actTabAllAgents');
const activitySearchInput = document.getElementById('activitySearchInput');
const btnClearActivities = document.getElementById('btnClearActivities');
const activityListContainer = document.getElementById('activityListContainer');
const activityDetailModal = document.getElementById('activityDetailModal');
const actModalStatusBadge = document.getElementById('actModalStatusBadge');
const actModalStatusDot = document.getElementById('actModalStatusDot');
const actModalStatusText = document.getElementById('actModalStatusText');
const actModalTitle = document.getElementById('actModalTitle');
const actModalMeta = document.getElementById('actModalMeta');
const btnCloseActModal = document.getElementById('btnCloseActModal');
const actTimelineList = document.getElementById('actTimelineList');
const actDetailPane = document.getElementById('actDetailPane');

// Gateway & Settings Navigation Elements
const settingsNav = document.getElementById('settingsNav');
const manageSubNav = document.getElementById('manageSubNav');
const btnCreateAgentOpen = document.getElementById('btnCreateAgentOpen');
const manageAgentList = document.getElementById('manageAgentList');
const createAgentModal = document.getElementById('createAgentModal');
const btnCloseCreateAgent = document.getElementById('btnCloseCreateAgent');
const caAvatarPreview = document.getElementById('caAvatarPreview');
const btnCaEditAvatar = document.getElementById('btnCaEditAvatar');
const caAgentName = document.getElementById('caAgentName');
const btnCaCancel = document.getElementById('btnCaCancel');
const btnCaCreate = document.getElementById('btnCaCreate');
const caAvatarPicker = document.getElementById('caAvatarPicker');
const btnCaRandom = document.getElementById('btnCaRandom');
const caFaceGrid = document.getElementById('caFaceGrid');
const caShapeGrid = document.getElementById('caShapeGrid');
const gwStatusBadge = document.getElementById('gwStatusBadge');
const gwProviderSelect = document.getElementById('gwProviderSelect');
const gwModelInput = document.getElementById('gwModelInput');
const gwModelDatalist = document.getElementById('gwModelDatalist');
const btnFetchModels = document.getElementById('btnFetchModels');
const gwBaseUrlInput = document.getElementById('gwBaseUrlInput');
const gwApiKeyInput = document.getElementById('gwApiKeyInput');
const btnToggleGwKey = document.getElementById('btnToggleGwKey');
const gwTestResultText = document.getElementById('gwTestResultText');
const btnTestGateway = document.getElementById('btnTestGateway');
const btnSaveGateway = document.getElementById('btnSaveGateway');
const settingsAgentGrid = document.getElementById('settingsAgentGrid');
const btnOpenAgentStudio = document.getElementById('btnOpenAgentStudio');

const modeDots = document.querySelectorAll('.mode-dot');
const tabPanels = document.querySelectorAll('.tab-panel');

const IDLE_COVER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#182820"/>
      <stop offset="100%" stop-color="#0d1114"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="20" fill="url(#g)"/>
  <circle cx="60" cy="60" r="32" fill="#1db954" opacity="0.16"/>
  <circle cx="60" cy="60" r="24" fill="#1db954"/>
  <path d="M47 53 C56 50 67 51 74 55" stroke="#090a0c" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M49 61 C56 58.5 65 59.5 71 63" stroke="#090a0c" stroke-width="3.4" stroke-linecap="round" fill="none"/>
  <path d="M51 68.5 C57 66.5 63 67.5 68 70" stroke="#090a0c" stroke-width="3" stroke-linecap="round" fill="none"/>
</svg>
`)}`;

function updateNotchGlowFromCover(src) {
  if (!src || src === lastGlowSrc) return;
  lastGlowSrc = src;
  if (src === IDLE_COVER_SVG) {
    island.style.setProperty('--notch-glow', 'rgba(212, 84, 48, 0.56)');
    return;
  }
  const img = new Image();
  if (/^https?:/i.test(src)) {
    img.crossOrigin = 'anonymous';
  }
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 8, 8);
      const data = ctx.getImageData(0, 0, 8, 8).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        count++;
      }
      if (count > 0) {
        let r = Math.round(rSum / count);
        let g = Math.round(gSum / count);
        let b = Math.round(bSum / count);
        const maxC = Math.max(r, g, b);
        if (maxC < 95) {
          const boost = 135 / Math.max(1, maxC);
          r = Math.min(255, Math.round(r * boost));
          g = Math.min(255, Math.round(g * boost));
          b = Math.min(255, Math.round(b * boost));
        }
        island.style.setProperty('--notch-glow', `rgba(${r}, ${g}, ${b}, 0.58)`);
        return;
      }
    } catch (_e) {}
    island.style.setProperty('--notch-glow', 'rgba(212, 84, 48, 0.56)');
  };
  img.onerror = () => {
    island.style.setProperty('--notch-glow', 'rgba(212, 84, 48, 0.56)');
  };
  img.src = src;
}

// ===== MEDIA PLAYER STATE =====
let mediaState = {
  hasMedia: false,
  spotifyOpen: false,
  title: 'Belum ada musik',
  artist: 'Putar lagu di Spotify',
  status: 'Paused',
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 'None',
  thumbnail: IDLE_COVER_SVG,
  sourceApp: 'SPOTIFY'
};

let isDraggingProgress = false;
let seekCooldownUntil = 0;
let modeLockUntil = 0;
const runningAgentTasks = new Map();
function isAgentBusy(agentId = activeAgentId) {
  return Boolean(agentId && runningAgentTasks.has(agentId));
}
let lastPosBase = 0;
let lastPosSyncAt = performance.now();
let lastTrackId = '';

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function renderShuffleRepeatUI() {
  btnShuffle.classList.toggle('active', Boolean(mediaState.shuffle));
  if (mediaState.repeat === 'List') {
    btnRepeat.classList.add('active');
    repeatOneBadge.classList.add('hidden');
  } else if (mediaState.repeat === 'Track') {
    btnRepeat.classList.add('active');
    repeatOneBadge.classList.remove('hidden');
  } else {
    btnRepeat.classList.remove('active');
    repeatOneBadge.classList.add('hidden');
  }
}

function renderMediaUI() {
  renderShuffleRepeatUI();
  const isEn = currentLang === 'en';

  if (!mediaState.hasMedia) {
    mediaTag.textContent = 'SPOTIFY';
    mediaTitle.textContent = mediaState.spotifyOpen
      ? (isEn ? 'Spotify (Paused)' : 'Spotify (Dijeda)')
      : (isEn ? 'No Music Playing' : 'Belum ada musik');
    mediaArtist.textContent = isEn ? 'Play music in Spotify / Browser' : 'Putar lagu di Spotify / Browser';
    if (albumArt.getAttribute('src') !== IDLE_COVER_SVG) {
      albumArt.setAttribute('src', IDLE_COVER_SVG);
    }
    waveformBars.classList.remove('playing');
    iconPause.classList.add('hidden');
    iconPlay.classList.remove('hidden');
    miniMediaWave.classList.add('hidden');
    timeCurrent.textContent = '0:00';
    timeRemaining.textContent = '-0:00';
    progressFill.style.width = '0%';
    updateCollapsedWidth();
    syncLyricsState();
    return;
  }

  mediaTag.textContent = mediaState.sourceApp || 'SPOTIFY';
  mediaTitle.textContent = mediaState.title || (isEn ? 'Unknown Title' : 'Judul Tidak Diketahui');
  mediaArtist.textContent = mediaState.artist || 'Spotify';

  const thumb = mediaState.thumbnail || IDLE_COVER_SVG;
  if (albumArt.getAttribute('src') !== thumb) {
    albumArt.setAttribute('src', thumb);
  }
  updateNotchGlowFromCover(thumb);

  const isPlaying = mediaState.status === 'Playing';
  waveformBars.classList.toggle('playing', isPlaying);
  iconPause.classList.toggle('hidden', !isPlaying);
  iconPlay.classList.toggle('hidden', isPlaying);
  miniMediaWave.classList.toggle('hidden', !isPlaying);

  updateCollapsedWidth();

  if (!isDraggingProgress) {
    const dur = mediaState.duration > 0 ? mediaState.duration : 0;
    const pos = dur > 0 ? Math.min(dur, Math.max(0, mediaState.position || 0)) : Math.max(0, mediaState.position || 0);
    const pct = dur > 0 ? Math.min(100, Math.max(2, (pos / dur) * 100)) : 0;
    const rem = dur > 0 ? Math.max(0, dur - pos) : 0;

    timeCurrent.textContent = formatTime(pos);
    timeRemaining.textContent = `-${formatTime(rem)}`;
    progressFill.style.width = `${pct}%`;
  }

  syncLyricsState();
}

function updateCollapsedWidth() {
  const hasWave = !miniMediaWave.classList.contains('hidden');
  island.classList.toggle('has-activity', hasWave);
  updateCollapsedNotchLyricUI();
}

function updateCollapsedNotchLyricUI() {
  const showNotchLyric =
    currentTheme === 'notch' &&
    mediaState.hasMedia &&
    mediaState.status === 'Playing';

  island.classList.toggle('notch-music-active', showNotchLyric);
  collapsedPillRow.classList.toggle('hidden', showNotchLyric);
  notchLyricRow.classList.toggle('hidden', !showNotchLyric);

  if (!showNotchLyric) {
    lastNotchDisplayedText = '';
    return;
  }

  let nextText = '';
  if (syncedLyricLines.length > 0 && activeLyricIndex >= 0 && syncedLyricLines[activeLyricIndex]) {
    nextText = syncedLyricLines[activeLyricIndex].text;
  } else if (mediaState.title) {
    nextText = mediaState.artist ? `${mediaState.title} — ${mediaState.artist}` : mediaState.title;
  }

  if (nextText && nextText !== lastNotchDisplayedText) {
    const isFirst = !lastNotchDisplayedText;
    lastNotchDisplayedText = nextText;
    if (isFirst) {
      notchLyricText.textContent = nextText;
    } else {
      notchLyricText.classList.add('changing');
      setTimeout(() => {
        notchLyricText.textContent = nextText;
        notchLyricText.classList.remove('changing');
      }, 120);
    }
  }
}

// ===== ISLAND HOVER / COLLAPSE / NOTIFICATIONS / OSD =====
let collapseTimer = null;
let isExpanded = false;
let isBanner = false;
let bannerTimer = null;
let isNotif = false;
let notifTimer = null;
let currentNotif = null;
let isOsd = false;
let osdTimer = null;
let isDraggingOsd = false;
let osdState = {
  osdType: 'volume',
  volume: 64,
  muted: false,
  brightness: 80
};

const osdIconBtn = document.getElementById('osdIconBtn');
const osdIconVol = document.getElementById('osdIconVol');
const osdVolWave1 = document.getElementById('osdVolWave1');
const osdVolWave2 = document.getElementById('osdVolWave2');
const osdIconMute = document.getElementById('osdIconMute');
const osdIconBright = document.getElementById('osdIconBright');
const osdTrack = document.getElementById('osdTrack');
const osdFill = document.getElementById('osdFill');
const osdVal = document.getElementById('osdVal');

const notifIconWrap = document.getElementById('notifIconWrap');
const notifLogoImg = document.getElementById('notifLogoImg');
const notifSvgMsg = document.getElementById('notifSvgMsg');
const notifSvgCall = document.getElementById('notifSvgCall');
const notifAppTag = document.getElementById('notifAppTag');
const notifCallBadge = document.getElementById('notifCallBadge');
const notifTitle = document.getElementById('notifTitle');
const notifBody = document.getElementById('notifBody');
const notifTextArea = document.getElementById('notifTextArea');
const notifReplyBtn = document.getElementById('notifReplyBtn');
const notifOpenBtn = document.getElementById('notifOpenBtn');
const notifOpenIconMsg = document.getElementById('notifOpenIconMsg');
const notifOpenIconCall = document.getElementById('notifOpenIconCall');
const notifDismissBtn = document.getElementById('notifDismissBtn');
const notifDismissIconClose = document.getElementById('notifDismissIconClose');
const notifDismissIconHangup = document.getElementById('notifDismissIconHangup');
const notifReplyForm = document.getElementById('notifReplyForm');
const notifReplyInput = document.getElementById('notifReplyInput');

let isReplyingNotif = false;

function toUtf8Base64(str) {
  try {
    return btoa(unescape(encodeURIComponent(String(str || ''))));
  } catch (_e) {
    return '';
  }
}

let isQuickCmd = false;
let isLiveToast = false;
let liveToastTimer = null;
let isHwHud = false;
let hwHudTimer = null;
let lastDragOverAt = 0;
let currentLang = 'id';

function setIslandState(state) {
  island.classList.remove('collapsed', 'banner', 'notif', 'osd', 'quick-cmd', 'live-toast', 'hw-hud', 'expanded');
  island.classList.add(state);
  updateJeanAvatarVisibility();
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
}

function setNotifReplyMode(open) {
  isReplyingNotif = Boolean(open);
  notifReplyBtn.classList.toggle('active', isReplyingNotif);
  notifReplyForm.classList.toggle('hidden', !isReplyingNotif);
  island.classList.toggle('replying', isReplyingNotif);
  if (isReplyingNotif) {
    if (notifTimer) {
      clearTimeout(notifTimer);
      notifTimer = null;
    }
    const targetName = currentNotif && currentNotif.title ? currentNotif.title : 'pesan';
    notifReplyInput.placeholder = `Balas ke ${targetName}...`;
    window.islandAPI.sendMediaCommand('prepareReply');
    window.islandAPI.setMousePassthrough(false);
    window.islandAPI.focusWindow();
    setTimeout(() => notifReplyInput.focus(), 30);
  } else {
    notifReplyInput.value = '';
    notifReplyInput.blur();
  }
}

function hideNotif() {
  isNotif = false;
  isReplyingNotif = false;
  notifReplyBtn.classList.remove('active');
  notifReplyForm.classList.add('hidden');
  notifReplyInput.value = '';
  notifReplyInput.blur();
  island.classList.remove('notif-overlay', 'is-call', 'replying');
  if (notifTimer) {
    clearTimeout(notifTimer);
    notifTimer = null;
  }
}

function scheduleNotifDismiss(ms) {
  if (isReplyingNotif) return;
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => {
    notifTimer = null;
    if (isReplyingNotif) return;
    hideNotif();
    if (!isExpanded) {
      setIslandState('collapsed');
      window.islandAPI.setMousePassthrough(true);
    }
  }, ms);
}

function showNotifHud(data) {
  if (!data) return;
  if (data.type === 'callEnded') {
    if (currentNotif && currentNotif.isCall) {
      hideNotif();
      if (!isExpanded) {
        setIslandState('collapsed');
        window.islandAPI.setMousePassthrough(true);
      }
    }
    return;
  }

  const isSameNotifUpdate = currentNotif && currentNotif.id === data.id && (isNotif || island.classList.contains('notif-overlay'));
  currentNotif = data;
  const isEn = currentLang === 'en';
  const appName = String(data.appName || (isEn ? 'Notification' : 'Notifikasi')).trim();
  const isWhatsApp = /whatsapp/i.test(appName) || /whatsapp/i.test(data.aumid || '');
  const isTelegram = /telegram/i.test(appName) || /telegram/i.test(data.aumid || '');
  const isDiscord = /discord/i.test(appName) || /discord/i.test(data.aumid || '');
  const isAgent = Boolean(data.isAgentProactive);
  const isCall = Boolean(data.isCall);

  if (!isSameNotifUpdate) {
    setNotifReplyMode(false);
  }

  notifAppTag.textContent = '';
  notifCallBadge.classList.toggle('hidden', !isCall);

  const badCallTitle = /non client input sink|reunioncaption|chrome legacy|^voice call$|^video call$/i;
  const genericBodyRegex = /^(message|pesan|new\s+message|pesan\s+baru|\d+\s+(unread\s+)?messages?|\d+\s+pesan(\s+belum\s+dibaca)?)$/i;
  const rawBody = String(data.body || '').trim();
  const hasRealBody = Boolean(rawBody && !genericBodyRegex.test(rawBody));

  if (isAgent) {
    const cleanAgentMsg = cleanMarkdown(data.fullMessage || rawBody || data.title || '');
    notifTitle.textContent = cleanAgentMsg;
    notifTitle.classList.remove('hidden');
    notifBody.textContent = '';
    notifBody.classList.add('hidden');
  } else if (isCall) {
    notifTitle.textContent = data.title && !badCallTitle.test(data.title)
      ? data.title
      : (isEn ? 'Incoming Call' : 'Panggilan Masuk');
    notifTitle.classList.remove('hidden');
    notifBody.textContent = hasRealBody ? rawBody : (isEn ? 'Incoming call...' : 'Panggilan masuk...');
    notifBody.classList.remove('hidden');
  } else {
    notifTitle.textContent = data.title || appName;
    notifTitle.classList.remove('hidden');
    if (hasRealBody) {
      notifBody.textContent = rawBody;
      notifBody.classList.remove('hidden');
    } else {
      notifBody.textContent = '';
      notifBody.classList.add('hidden');
    }
  }

  notifIconWrap.classList.toggle('is-call', isCall);
  island.classList.toggle('is-call', isCall);

  if (isAgent) {
    const agObj = (allAgents && allAgents.find((a) => a.id === data.agentId)) || activeAgentDetail;
    notifLogoImg.src = getAgentThumbSrc(agObj);
    notifLogoImg.classList.remove('hidden');
    notifSvgMsg.classList.add('hidden');
    notifSvgCall.classList.add('hidden');
  } else if (isWhatsApp) {
    notifLogoImg.src = 'public/assets/connectors/whatsapp.svg';
    notifLogoImg.classList.remove('hidden');
    notifSvgMsg.classList.add('hidden');
    notifSvgCall.classList.add('hidden');
  } else if (isTelegram) {
    notifLogoImg.src = 'public/assets/connectors/telegram.svg';
    notifLogoImg.classList.remove('hidden');
    notifSvgMsg.classList.add('hidden');
    notifSvgCall.classList.add('hidden');
  } else if (isDiscord) {
    notifLogoImg.src = 'public/assets/connectors/discord.svg';
    notifLogoImg.classList.remove('hidden');
    notifSvgMsg.classList.add('hidden');
    notifSvgCall.classList.add('hidden');
  } else if (data.logo && String(data.logo).startsWith('data:image')) {
    notifLogoImg.src = data.logo;
    notifLogoImg.classList.remove('hidden');
    notifSvgMsg.classList.add('hidden');
    notifSvgCall.classList.add('hidden');
  } else {
    notifLogoImg.classList.add('hidden');
    notifSvgMsg.classList.toggle('hidden', isCall);
    notifSvgCall.classList.toggle('hidden', !isCall);
  }

  const isNonReplyUtility = /(snipping|screen\s*sketch|screenshot|security|defender|explorer|photos|clock|system|dynamicisland\.agent)/i.test(
    `${appName} ${data.aumid || ''} ${data.title || ''}`
  );
  const canReply =
    !isCall &&
    !isAgent &&
    !isNonReplyUtility &&
    (typeof data.canReply === 'boolean'
      ? data.canReply
      : isWhatsApp || /(telegram|discord|instagram|messenger|line|signal|slack|teams)/i.test(`${appName} ${data.aumid || ''}`));

  notifReplyBtn.classList.toggle('hidden', !canReply);
  notifOpenIconMsg.classList.toggle('hidden', isCall);
  notifOpenIconCall.classList.toggle('hidden', !isCall);
  notifOpenBtn.title = isCall
    ? (isEn ? 'Accept Call' : 'Terima Panggilan')
    : (isAgent ? (isEn ? 'Open Chat' : 'Buka Chat') : (isEn ? `Open ${appName}` : `Buka ${appName}`));

  notifDismissBtn.classList.toggle('is-call', isCall);
  notifDismissIconClose.classList.toggle('hidden', isCall);
  notifDismissIconHangup.classList.toggle('hidden', !isCall);
  notifDismissBtn.title = isCall
    ? (isEn ? 'Decline Call' : 'Tolak Panggilan')
    : (isEn ? 'Dismiss' : 'Tutup');

  if (isExpanded) {
    island.classList.add('notif-overlay');
  } else {
    hideBanner();
    isOsd = false;
    isNotif = true;
    setIslandState('notif');
  }

  scheduleNotifDismiss(isCall ? 25000 : 6500);
}

function openCurrentNotifApp(e) {
  if (e) e.stopPropagation();
  if (currentNotif) {
    if (currentNotif.isAgentProactive) {
      const targetAgent = currentNotif.agentId;
      hideNotif();
      isExpanded = true;
      window.islandAPI.setMousePassthrough(false);
      setIslandState('expanded');
      switchTab('tab-hermes');
      switchSubView('chat');
      if (targetAgent && targetAgent !== activeAgentId) {
        handleSelectAgent(targetAgent);
      }
      return;
    }
    if (currentNotif.isCall) {
      window.islandAPI.sendMediaCommand('acceptCall');
    } else {
      const appName = currentNotif.appName || '';
      const aumid = currentNotif.aumid || '';
      window.islandAPI.sendMediaCommand('focusApp', `${appName}|${aumid}`);
    }
  }
  hideNotif();
  if (!isExpanded) {
    setIslandState('collapsed');
    window.islandAPI.setMousePassthrough(true);
  }
}

notifReplyBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setNotifReplyMode(!isReplyingNotif);
});

notifReplyInput.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  window.islandAPI.focusWindow();
  setTimeout(() => notifReplyInput.focus(), 20);
});

notifReplyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const replyText = notifReplyInput.value.trim();
  if (!replyText || !currentNotif) return;

  const appName = currentNotif.appName || '';
  const aumid = currentNotif.aumid || '';
  const senderB64 = toUtf8Base64(currentNotif.title || '');
  const replyB64 = toUtf8Base64(replyText);

  notifBody.textContent = 'Mengirim balasan...';
  setNotifReplyMode(false);
  window.islandAPI.sendMediaCommand('replyNotif', `${appName}|${aumid}|${senderB64}|${replyB64}`);

  setTimeout(() => {
    hideNotif();
    if (!isExpanded) {
      setIslandState('collapsed');
      window.islandAPI.setMousePassthrough(true);
    }
  }, 550);
});

notifOpenBtn.addEventListener('click', openCurrentNotifApp);
notifTextArea.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentNotif && currentNotif.isAgentProactive) {
    openCurrentNotifApp(e);
  } else if (currentNotif && !currentNotif.isCall && !notifReplyBtn.classList.contains('hidden')) {
    setNotifReplyMode(true);
  } else {
    openCurrentNotifApp(e);
  }
});

notifDismissBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentNotif && currentNotif.isCall) {
    window.islandAPI.sendMediaCommand('declineCall');
  }
  hideNotif();
  if (!isExpanded) {
    setIslandState('collapsed');
    window.islandAPI.setMousePassthrough(true);
  }
});

if (window.islandAPI.onNotification) {
  window.islandAPI.onNotification((data) => showNotifHud(data));
}

function renderOsdUI() {
  const isBright = osdState.osdType === 'brightness';
  if (isBright) {
    const pct = Math.max(0, Math.min(100, osdState.brightness));
    osdIconVol.classList.add('hidden');
    osdIconMute.classList.add('hidden');
    osdIconBright.classList.remove('hidden');
    osdIconBtn.classList.remove('muted');
    osdIconBtn.classList.add('brightness');
    osdFill.classList.remove('muted');
    osdFill.style.width = `${pct}%`;
    osdVal.textContent = `${pct}%`;
  } else {
    const pct = osdState.muted ? 0 : Math.max(0, Math.min(100, osdState.volume));
    osdIconBright.classList.add('hidden');
    osdIconBtn.classList.remove('brightness');
    if (osdState.muted || pct === 0) {
      osdIconVol.classList.add('hidden');
      osdIconMute.classList.remove('hidden');
      osdIconBtn.classList.add('muted');
      osdFill.classList.add('muted');
      osdFill.style.width = `${osdState.muted ? Math.max(4, osdState.volume) : 0}%`;
      osdVal.textContent = osdState.muted ? 'Mute' : '0%';
    } else {
      osdIconMute.classList.add('hidden');
      osdIconVol.classList.remove('hidden');
      osdIconBtn.classList.remove('muted');
      osdFill.classList.remove('muted');
      osdVolWave1.style.display = pct >= 20 ? '' : 'none';
      osdVolWave2.style.display = pct >= 60 ? '' : 'none';
      osdFill.style.width = `${pct}%`;
      osdVal.textContent = `${pct}%`;
    }
  }
}

function showOsdHud(type) {
  if (type === 'volume' || type === 'brightness') {
    osdState.osdType = type;
  }
  renderOsdUI();

  if (osdTimer) {
    clearTimeout(osdTimer);
    osdTimer = null;
  }

  if (isExpanded) {
    island.classList.add('osd-overlay');
  } else {
    hideBanner();
    hideNotif();
    isOsd = true;
    setIslandState('osd');
  }

  osdTimer = setTimeout(() => {
    osdTimer = null;
    if (isDraggingOsd) return;
    island.classList.remove('osd-overlay');
    if (isOsd) {
      isOsd = false;
      if (!isExpanded) {
        setIslandState('collapsed');
        window.islandAPI.setMousePassthrough(true);
      }
    }
  }, 1850);
}

if (window.islandAPI.onOsdUpdate) {
  window.islandAPI.onOsdUpdate((data) => {
    if (!data) return;
    if (typeof data.volume === 'number') osdState.volume = data.volume;
    if (typeof data.muted === 'boolean') osdState.muted = data.muted;
    if (typeof data.brightness === 'number') osdState.brightness = data.brightness;
    if (data.trigger && !isDraggingOsd) {
      showOsdHud(data.osdType);
    } else {
      renderOsdUI();
    }
  });
}

osdIconBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (osdState.osdType === 'volume') {
    osdState.muted = !osdState.muted;
    showOsdHud('volume');
    window.islandAPI.sendMediaCommand('toggleMute');
  }
});

function applyOsdDrag(clientX) {
  const rect = osdTrack.getBoundingClientRect();
  if (rect.width <= 0) return;
  const pct = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
  if (osdState.osdType === 'brightness') {
    osdState.brightness = pct;
    renderOsdUI();
    window.islandAPI.sendMediaCommand('setBrightness', pct);
  } else {
    osdState.volume = pct;
    osdState.muted = pct === 0;
    renderOsdUI();
    window.islandAPI.sendMediaCommand('setVolume', pct);
  }
}

osdTrack.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  isDraggingOsd = true;
  osdTrack.classList.add('dragging');
  applyOsdDrag(e.clientX);
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingOsd) return;
  applyOsdDrag(e.clientX);
});

window.addEventListener('mouseup', () => {
  if (!isDraggingOsd) return;
  isDraggingOsd = false;
  osdTrack.classList.remove('dragging');
  showOsdHud(osdState.osdType);
});

let isPointerInsideIsland = false;

function isEditingFormControl() {
  const active = document.activeElement;
  if (!active || !island.contains(active)) return false;
  if (!document.hasFocus() || !['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return false;
  if (active === hermesInput && isAgentBusy() && !hermesInput.value.trim()) return false;
  return true;
}

window.addEventListener('blur', () => {
  if (!isPinnedOpen && !isFileDialogOpen && document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    document.activeElement.blur();
  }
});

function expandIsland() {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
  if (isQuickCmd) {
    window.islandAPI.setMousePassthrough(false);
    return;
  }
  if (isBanner || isOsd || isNotif || isLiveToast || isHwHud) {
    window.islandAPI.setMousePassthrough(false);
    if (isNotif) {
      scheduleNotifDismiss(currentNotif && currentNotif.isCall ? 15000 : 5000);
    }
    return;
  }
  if (!isExpanded) {
    isExpanded = true;
    window.islandAPI.setMousePassthrough(false);
    setIslandState('expanded');
    requestAnimationFrame(moveSegIndicator);
  }
}

function hideBanner() {
  isBanner = false;
  if (bannerTimer) {
    clearTimeout(bannerTimer);
    bannerTimer = null;
  }
}

function isFileDragActive() {
  return (typeof dragDepth === 'number' && dragDepth > 0) || (Date.now() - lastDragOverAt < 1100);
}

function scheduleCollapseIsland() {
  if (
    isPinnedOpen ||
    isFileDialogOpen ||
    isQuickCmd ||
    isFileDragActive() ||
    Boolean(pendingConfirmResolver) ||
    isDraggingProgress ||
    isDraggingOsd ||
    isReplyingNotif ||
    isEditingFormControl()
  ) {
    return;
  }
  if (isOsd || isNotif || isLiveToast || isHwHud) {
    window.islandAPI.setMousePassthrough(true);
    return;
  }
  if ((!isExpanded && !isBanner) || collapseTimer) return;
  collapseTimer = setTimeout(() => {
    collapseTimer = null;
    if (
      isPinnedOpen ||
      isFileDialogOpen ||
      isQuickCmd ||
      isFileDragActive() ||
      Boolean(pendingConfirmResolver) ||
      isEditingFormControl()
    ) {
      return;
    }
    isExpanded = false;
    hideBanner();
    setIslandState('collapsed');
    window.islandAPI.setMousePassthrough(true);
  }, 260);
}

function isPointInsideIsland(x, y) {
  const rect = island.getBoundingClientRect();
  const padX = isExpanded ? 12 : 42;
  const padY = isExpanded ? 12 : 20;
  return (
    x >= rect.left - padX &&
    x <= rect.right + padX &&
    y >= rect.top - padY &&
    y <= rect.bottom + padY
  );
}

function handlePointer(x, y) {
  const inside = isPointInsideIsland(x, y);
  isPointerInsideIsland = inside;
  if (inside) {
    expandIsland();
  } else {
    scheduleCollapseIsland();
  }
}

window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY));
window.islandAPI.onCursorPos(({ x, y }) => handlePointer(x, y));
document.addEventListener('mouseleave', scheduleCollapseIsland);
island.addEventListener('mouseenter', expandIsland);
island.addEventListener('mouseleave', scheduleCollapseIsland);

// Enable focus on click for all text inputs/textareas/selects inside the frameless Electron window
island.addEventListener('mousedown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    e.stopPropagation();
    window.islandAPI.focusWindow();
    setTimeout(() => e.target.focus(), 15);
  }
});

// ===== CLOCK & BATTERY =====
function updateClock() {
  const now = new Date();
  clockText.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
updateClock();
setInterval(updateClock, 1000);

async function initBattery() {
  const boltEl = document.getElementById('batteryBoltIcon');
  const batIconEl = document.getElementById('batteryIcon');
  try {
    if ('getBattery' in navigator) {
      const bat = await navigator.getBattery();
      let prevCharging = bat.charging;
      const applyBattery = (triggerHud = false) => {
        const pct = Math.round((bat.level ?? 1) * 100);
        const isCharging = Boolean(bat.charging);
        batteryText.textContent = `${pct}%`;
        batteryFill.style.width = `${Math.max(10, pct)}%`;
        batteryFill.classList.toggle('charging', isCharging);
        if (batIconEl) batIconEl.classList.toggle('is-charging', isCharging);
        if (boltEl) boltEl.classList.toggle('hidden', !isCharging);

        if (triggerHud && isCharging !== prevCharging) {
          prevCharging = isCharging;
          if (typeof showHardwareHud === 'function') {
            showHardwareHud({
              mode: isCharging ? 'charger-in' : 'charger-out',
              pct
            });
          }
        }
      };
      applyBattery(false);
      bat.addEventListener('levelchange', () => applyBattery(false));
      bat.addEventListener('chargingchange', () => applyBattery(true));
    }
  } catch (_e) {
    batteryText.textContent = '100%';
    batteryFill.style.width = '100%';
  }
}
initBattery();

// ===== MEDIA EVENTS & LYRICS =====
window.islandAPI.onMediaUpdate((data) => {
  const now = Date.now();
  if (data && data.hasMedia && data.title) {
    const trackId = `${data.title}|${data.artist || ''}`;
    const isNewTrack = trackId !== lastTrackId;
    lastTrackId = trackId;

    mediaState.hasMedia = true;
    mediaState.title = data.title;
    mediaState.artist = data.artist || 'Spotify';
    mediaState.status = data.status || 'Playing';
    mediaState.sourceApp = data.sourceApp || 'SPOTIFY';
    mediaState.duration = data.duration || 0;
    if (!isDraggingProgress && now > seekCooldownUntil) {
      const incomingPos = typeof data.position === 'number' ? data.position : 0;
      if (
        isNewTrack ||
        mediaState.status !== 'Playing' ||
        incomingPos >= mediaState.position ||
        Math.abs(incomingPos - mediaState.position) >= 2.0
      ) {
        mediaState.position = incomingPos;
        lastPosBase = incomingPos;
        lastPosSyncAt = performance.now();
      }
    }
    if (now > modeLockUntil) {
      mediaState.shuffle = Boolean(data.shuffle);
      mediaState.repeat = data.repeat || 'None';
    }
    mediaState.thumbnail = data.thumbnail || IDLE_COVER_SVG;
  } else {
    lastTrackId = '';
    mediaState.hasMedia = false;
    mediaState.spotifyOpen = Boolean(data && data.spotifyOpen);
    mediaState.status = 'Paused';
    mediaState.position = 0;
    mediaState.duration = 0;
  }
  renderMediaUI();
});

setInterval(() => {
  if (!isDraggingProgress && mediaState.hasMedia && mediaState.status === 'Playing' && mediaState.duration > 0) {
    const elapsed = (performance.now() - lastPosSyncAt) / 1000;
    mediaState.position = Math.min(mediaState.duration, lastPosBase + elapsed);
    renderMediaUI();
  }
}, 250);

function computeSeekFromEvent(e) {
  if (!mediaState.hasMedia || mediaState.duration <= 0) return null;
  const rect = progressTrack.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  return { ratio, targetSec: Math.round(ratio * mediaState.duration) };
}

function previewSeek(e) {
  const res = computeSeekFromEvent(e);
  if (!res) return null;
  const { ratio, targetSec } = res;
  mediaState.position = targetSec;
  lastPosBase = targetSec;
  lastPosSyncAt = performance.now();
  timeCurrent.textContent = formatTime(targetSec);
  timeRemaining.textContent = `-${formatTime(Math.max(0, mediaState.duration - targetSec))}`;
  progressFill.style.width = `${Math.min(100, Math.max(2, ratio * 100))}%`;
  updateActiveLyricLine(true);
  return targetSec;
}

let lastDragSeekTime = 0;
progressTrack.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  if (!mediaState.hasMedia || mediaState.duration <= 0) return;
  isDraggingProgress = true;
  progressTrack.classList.add('dragging');
  const targetSec = previewSeek(e);
  if (targetSec !== null) {
    lastDragSeekTime = Date.now();
    seekCooldownUntil = Date.now() + 1400;
    window.islandAPI.sendMediaCommand('seek', targetSec);
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingProgress) return;
  const targetSec = previewSeek(e);
  const now = Date.now();
  if (targetSec !== null && now - lastDragSeekTime > 90) {
    lastDragSeekTime = now;
    seekCooldownUntil = now + 1400;
    window.islandAPI.sendMediaCommand('seek', targetSec);
  }
});

window.addEventListener('mouseup', (e) => {
  if (!isDraggingProgress) return;
  isDraggingProgress = false;
  progressTrack.classList.remove('dragging');
  const targetSec = previewSeek(e);
  if (targetSec !== null) {
    seekCooldownUntil = Date.now() + 1400;
    window.islandAPI.sendMediaCommand('seek', targetSec);
  }
});

btnShuffle.addEventListener('click', (e) => {
  e.stopPropagation();
  mediaState.shuffle = !mediaState.shuffle;
  modeLockUntil = Date.now() + 2000;
  renderShuffleRepeatUI();
  window.islandAPI.sendMediaCommand('shuffle', mediaState.shuffle ? 'true' : 'false');
});

btnRepeat.addEventListener('click', (e) => {
  e.stopPropagation();
  const nextMap = { None: 'List', List: 'Track', Track: 'None' };
  mediaState.repeat = nextMap[mediaState.repeat] || 'List';
  modeLockUntil = Date.now() + 2000;
  renderShuffleRepeatUI();
  window.islandAPI.sendMediaCommand('repeat', mediaState.repeat);
});

btnPlayPause.addEventListener('click', (e) => {
  e.stopPropagation();
  if (mediaState.hasMedia) {
    mediaState.status = mediaState.status === 'Playing' ? 'Paused' : 'Playing';
    renderMediaUI();
  }
  window.islandAPI.sendMediaCommand('playPause');
});

btnPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  window.islandAPI.sendMediaCommand('prev');
});

btnNext.addEventListener('click', (e) => {
  e.stopPropagation();
  window.islandAPI.sendMediaCommand('next');
});

// Lyrics Drawer
let isLyricsOpen = false;
let currentLyricsTrackKey = '';
let syncedLyricLines = [];
let activeLyricIndex = -1;
let isFetchingLyrics = false;
let userLyricsScrollUntil = 0;

lyricsBody.addEventListener('wheel', () => {
  userLyricsScrollUntil = Date.now() + 3500;
}, { passive: true });

function parseLrcLyrics(lrcText) {
  const lines = String(lrcText || '').split(/\r?\n/);
  const result = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const rawLine of lines) {
    timeRegex.lastIndex = 0;
    const matches = [...rawLine.matchAll(timeRegex)];
    if (matches.length === 0) continue;
    const text = rawLine.replace(timeRegex, '').trim();
    if (!text) continue;
    for (const m of matches) {
      const mins = parseInt(m[1], 10);
      const secs = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
      result.push({ time: mins * 60 + secs + ms / 1000, text });
    }
  }
  result.sort((a, b) => a.time - b.time);
  return result;
}

async function loadLyricsForCurrentTrack() {
  if (!isLyricsOpen && currentTheme !== 'notch') return;
  const isEn = currentLang === 'en';
  if (!mediaState.hasMedia || !mediaState.title || mediaState.title === 'Belum ada musik' || mediaState.title === 'No media playing') {
    currentLyricsTrackKey = '';
    syncedLyricLines = [];
    activeLyricIndex = -1;
    lyricsBody.innerHTML = `<div class="lyrics-empty">${isEn ? 'Play a song to display lyrics' : 'Putar lagu untuk menampilkan lirik'}</div>`;
    updateCollapsedNotchLyricUI();
    return;
  }

  const key = `${mediaState.title}|${mediaState.artist}`;
  if (key === currentLyricsTrackKey || isFetchingLyrics) return;
  currentLyricsTrackKey = key;
  syncedLyricLines = [];
  activeLyricIndex = -1;
  isFetchingLyrics = true;
  lyricsBody.innerHTML = `<div class="lyrics-empty">${isEn ? 'Loading lyrics...' : 'Memuat lirik...'}</div>`;
  updateCollapsedNotchLyricUI();

  try {
    const res = await window.islandAPI.getLyrics({
      title: mediaState.title,
      artist: mediaState.artist,
      duration: mediaState.duration
    });
    if (currentLyricsTrackKey !== key) return;

    if (res && res.ok && res.syncedLyrics) {
      const parsed = parseLrcLyrics(res.syncedLyrics);
      if (parsed.length > 0) {
        syncedLyricLines = parsed;
        lyricsBody.innerHTML = '';
        parsed.forEach((item, idx) => {
          const div = document.createElement('div');
          div.className = 'lyric-line';
          div.dataset.index = String(idx);
          div.textContent = item.text;
          div.title = `${currentLang === 'en' ? 'Jump to' : 'Loncat ke'} ${formatTime(item.time)}`;
          div.addEventListener('click', (ev) => {
            ev.stopPropagation();
            mediaState.position = item.time;
            lastPosBase = item.time;
            lastPosSyncAt = performance.now();
            userLyricsScrollUntil = 0;
            seekCooldownUntil = Date.now() + 1400;
            renderMediaUI();
            window.islandAPI.sendMediaCommand('seek', Math.floor(item.time));
          });
          lyricsBody.appendChild(div);
        });
        updateActiveLyricLine(true);
        return;
      }
    }

    if (res && res.ok && res.plainLyrics) {
      lyricsBody.innerHTML = '';
      String(res.plainLyrics).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((lineText) => {
        const div = document.createElement('div');
        div.className = 'lyric-line plain';
        div.textContent = lineText;
        lyricsBody.appendChild(div);
      });
      return;
    }

    lyricsBody.innerHTML = `<div class="lyrics-empty">${escapeHtml((res && res.error) || (currentLang === 'en' ? 'Lyrics not available' : 'Lirik belum tersedia'))}</div>`;
  } catch (_e) {
    lyricsBody.innerHTML = `<div class="lyrics-empty">${currentLang === 'en' ? 'Failed to load lyrics' : 'Gagal memuat lirik'}</div>`;
  } finally {
    isFetchingLyrics = false;
    updateCollapsedNotchLyricUI();
  }
}

function updateActiveLyricLine(forceScroll = false) {
  if ((!isLyricsOpen && currentTheme !== 'notch') || syncedLyricLines.length === 0) {
    updateCollapsedNotchLyricUI();
    return;
  }
  const pos = (mediaState.position || 0) + 0.2;
  let idx = -1;
  for (let i = 0; i < syncedLyricLines.length; i++) {
    if (pos >= syncedLyricLines[i].time) idx = i;
    else break;
  }
  if (idx === activeLyricIndex && !forceScroll) return;
  activeLyricIndex = idx;
  updateCollapsedNotchLyricUI();

  const nodes = lyricsBody.querySelectorAll('.lyric-line');
  nodes.forEach((node, i) => {
    node.classList.toggle('active', i === idx);
    node.classList.toggle('past', idx >= 0 && i < idx);
  });

  if (isLyricsOpen && idx >= 0 && nodes[idx] && (forceScroll || Date.now() > userLyricsScrollUntil)) {
    const activeNode = nodes[idx];
    const targetTop = activeNode.offsetTop - (lyricsBody.clientHeight / 2) + (activeNode.offsetHeight / 2);
    lyricsBody.scrollTo({ top: Math.max(0, targetTop), behavior: forceScroll ? 'auto' : 'smooth' });
  }
}

function syncLyricsState() {
  if (!isLyricsOpen && currentTheme !== 'notch') return;
  const key = mediaState.hasMedia ? `${mediaState.title}|${mediaState.artist}` : '';
  if (key !== currentLyricsTrackKey) loadLyricsForCurrentTrack();
  else updateActiveLyricLine(false);
}

function setLyricsOpen(open) {
  isLyricsOpen = Boolean(open);
  btnLyrics.classList.toggle('active', isLyricsOpen);
  lyricsPanel.classList.toggle('hidden', !isLyricsOpen);
  const mediaTabActive = document.getElementById('tab-media').classList.contains('active');
  island.classList.toggle('lyrics-open', isLyricsOpen && mediaTabActive);
  if (isLyricsOpen) {
    loadLyricsForCurrentTrack();
    updateActiveLyricLine(true);
  }
}

btnLyrics.addEventListener('click', (e) => {
  e.stopPropagation();
  setLyricsOpen(!isLyricsOpen);
});
btnCloseLyrics.addEventListener('click', (e) => {
  e.stopPropagation();
  setLyricsOpen(false);
});

// ===== SYSTEM MONITOR =====
let latestSystemStats = null;

function getThermalStateLabel(tempC) {
  const isEn = currentLang === 'en';
  if (tempC >= 85) return isEn ? 'Hot' : 'Panas';
  if (tempC >= 72) return isEn ? 'Warm' : 'Hangat';
  return 'Normal';
}

window.islandAPI.onSystemUpdate((sys) => {
  if (!sys) return;
  latestSystemStats = sys;
  const isEn = currentLang === 'en';
  cpuVal.textContent = `${sys.cpu}%`;
  cpuBar.style.width = `${Math.max(4, sys.cpu)}%`;
  if (cpuSub) {
    cpuSub.textContent = sys.cpuName || (isEn ? 'Active Processor' : 'Processor Aktif');
  }
  ramVal.textContent = `${sys.ramPercent}%`;
  ramBar.style.width = `${Math.max(4, sys.ramPercent)}%`;
  ramSub.textContent = `${sys.usedGb} / ${sys.totalGb} GB`;
  sysUptime.textContent = `Uptime ${sys.uptimeHours}h`;

  if (cpuTempVal && cpuTempBar && cpuTempSub) {
    if (typeof sys.cpuTemp === 'number') {
      cpuTempVal.textContent = `${sys.cpuTemp}°C`;
      const pct = Math.max(8, Math.min(100, Math.round(sys.cpuTemp)));
      cpuTempBar.style.width = `${pct}%`;
      cpuTempSub.textContent = `${getThermalStateLabel(sys.cpuTemp)} · ${sys.cpuName || 'CPU'}`;
    } else {
      cpuTempVal.textContent = '--°C';
      cpuTempSub.textContent = sys.cpuName || (isEn ? 'CPU Thermal Sensor' : 'Sensor Termal CPU');
    }
  }

  if (gpuTempVal && gpuTempBar && gpuTempSub) {
    const gLoad = typeof sys.gpuLoad === 'number' ? sys.gpuLoad : 0;
    if (typeof sys.gpuTemp === 'number') {
      gpuTempVal.textContent = `${sys.gpuTemp}°C`;
      const pct = Math.max(8, Math.min(100, Math.round(sys.gpuTemp)));
      gpuTempBar.style.width = `${pct}%`;
      gpuTempSub.textContent = `Load ${gLoad}% · ${sys.gpuName || 'GPU'}`;
    } else {
      gpuTempVal.textContent = '--°C';
      gpuTempSub.textContent = `Load ${gLoad}% · ${sys.gpuName || 'GPU'}`;
    }
  }
});

// =========================================================================
// ===== ACER SENSE CONTROLS (Power Mode & Visual Adjustment) ==============
// =========================================================================
const powerModePills = document.getElementById('powerModePills');
const powerModeSub = document.getElementById('powerModeSub');
const visualModePills = document.getElementById('visualModePills');
const btnPowerModeHelp = document.getElementById('btnPowerModeHelp');

let currentPowerMode = 'balanced';
let currentVisualMode = 'standard';

const POWER_MODE_DESC = {
  silent: {
    id: 'Operasi senyap & hemat konsumsi baterai.',
    en: 'For quiet operations & low power consumption.'
  },
  balanced: {
    id: 'Untuk produktivitas harian seperti aplikasi kantor.',
    en: 'For productivity tools like Microsoft Office.'
  },
  performance: {
    id: 'Komputasi berat & performa clock maksimal.',
    en: 'For heavy computing tasks & maximum clock speeds.'
  }
};

function renderSystemModesUI() {
  const isEn = currentLang === 'en';
  if (powerModePills) {
    powerModePills.querySelectorAll('.sys-mode-pill').forEach((btn) => {
      const p = btn.dataset.power;
      btn.classList.toggle('active', p === currentPowerMode);
    });
  }
  if (powerModeSub) {
    const descObj = POWER_MODE_DESC[currentPowerMode] || POWER_MODE_DESC.balanced;
    powerModeSub.textContent = isEn ? descObj.en : descObj.id;
  }
  if (visualModePills) {
    visualModePills.querySelectorAll('.sys-mode-pill').forEach((btn) => {
      const v = btn.dataset.visual;
      btn.classList.toggle('active', v === currentVisualMode);
    });
  }
}

if (powerModePills) {
  powerModePills.querySelectorAll('.sys-mode-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = btn.dataset.power;
      if (!p || p === currentPowerMode) return;
      currentPowerMode = p;
      renderSystemModesUI();
      window.islandAPI.sendMediaCommand('setPowerMode', p);
    });
  });
}

if (visualModePills) {
  visualModePills.querySelectorAll('.sys-mode-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = btn.dataset.visual;
      if (!v || v === currentVisualMode) return;
      currentVisualMode = v;
      renderSystemModesUI();
      window.islandAPI.sendMediaCommand('setVisualMode', v);
    });
  });
}

if (btnPowerModeHelp) {
  btnPowerModeHelp.addEventListener('click', (e) => {
    e.stopPropagation();
    const isEn = currentLang === 'en';
    const msg = isEn
      ? `Current Mode: ${currentPowerMode.toUpperCase()}\n\n• Silent: Limits CPU power & lowers fan speeds for battery life\n• Balanced: Standard factory balance for daily multitasking\n• Performance: Releases TDP limits for maximum boost clock & heavy tasks`
      : `Mode Aktif: ${currentPowerMode.toUpperCase()}\n\n• Silent: Menurunkan batas daya CPU & kipas senyap untuk hemat baterai\n• Balanced: Keseimbangan standar bawaan untuk aktivitas harian\n• Performance: Melepas limit TDP untuk clock maksimal & komputasi berat`;
    alert(msg);
  });
}

if (window.islandAPI.onSystemModeUpdate) {
  window.islandAPI.onSystemModeUpdate((data) => {
    if (!data) return;
    if (data.powerMode) currentPowerMode = data.powerMode;
    if (data.visualMode) currentVisualMode = data.visualMode;
    renderSystemModesUI();
  });
}

// =========================================================================
// ===== FULL-ACCESS MULTI-AGENT BOT SYSTEM (Chat, Studio, Skills, Cron) ===
// =========================================================================

let allAgents = [];
let activeAgentId = 'hancow';
let activeAgentDetail = null;
let allSkills = [];
let connectorsState = { items: [] };
let allCronjobs = [];
let allActivities = [];
let activeActivityScope = 'agent';
let inspectedActivity = null;
let inspectedNodeKey = 'summary';
let stagedAttachments = [];

function appendLiveWorkingBubble(task) {
  hideWelcome();
  const workingWrap = document.createElement('div');
  workingWrap.className = 'hermes-msg assistant';
  const stepsBox = document.createElement('div');
  stepsBox.className = 'tool-steps-box clickable';
  stepsBox.title = 'Klik untuk melihat detail log aktivitas secara live';
  (task.steps || []).forEach((st) => {
    const pill = document.createElement('div');
    pill.className = `tool-step-pill${st.state === 'done' ? ' done' : st.state === 'err' ? ' err' : ''}`;
    const prefix = st.state === 'done' ? '✓' : st.state === 'err' ? '×' : '→';
    pill.textContent = `${prefix} ${st.label}`;
    stepsBox.appendChild(pill);
  });
  stepsBox.addEventListener('click', (e) => {
    e.stopPropagation();
    if (task.activityId) {
      openActivityByIdOrFallback(task.activityId, {
        agentId: task.agentId,
        prompt: task.userText,
        text: 'Sedang menjalankan perintah...',
        toolsUsed: (task.steps || []).map((s) => ({
          label: s.label,
          ok: s.state !== 'err'
        }))
      });
    }
  });
  const dots = document.createElement('div');
  dots.className = 'hermes-msg typing';
  dots.style.padding = '4px 2px';
  dots.style.background = 'transparent';
  dots.style.border = 'none';
  dots.innerHTML = '<span></span><span></span><span></span>';
  workingWrap.appendChild(stepsBox);
  workingWrap.appendChild(dots);
  hermesMessages.appendChild(workingWrap);
  hermesMessages.scrollTop = hermesMessages.scrollHeight;
  task.workingWrapEl = workingWrap;
  task.stepsBoxEl = stepsBox;
}

function syncActiveAgentBusyUI() {
  const task = runningAgentTasks.get(activeAgentId);
  if (hermesSendBtn) hermesSendBtn.disabled = Boolean(task);
  if (task) {
    setJeanState('thinking', task.statusLabel || 'menjalankan agent...');
  } else {
    setJeanState(null);
  }
}

// Agent Studio Draft State
let studioEditingId = 'hancow'; // null when adding a new agent
let studioActiveDocKey = 'instructions';
let studioDocsDraft = {
  instructions: '',
  memory: '',
  soul: '',
  identity: '',
  globalMemory: ''
};
let studioCustomAvatarUrl = '';

const welcomeTemplate = document.getElementById('hermesWelcome').outerHTML;

function hideWelcome() {
  const w = document.getElementById('hermesWelcome');
  if (w) w.remove();
}

function cleanMarkdown(text) {
  return String(text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '');
}

function renderMessageBubble({ role, text, attachments = [], toolsUsed = [], activityId = '', at = '' }) {
  hideWelcome();
  const div = document.createElement('div');
  div.className = `hermes-msg ${role}`;

  if (Array.isArray(attachments) && attachments.length > 0) {
    const attBox = document.createElement('div');
    attBox.className = 'msg-attachments';
    attachments.forEach((a) => {
      if (a.isImage && a.previewDataUrl) {
        const img = document.createElement('img');
        img.className = 'msg-att-img';
        img.src = a.previewDataUrl;
        img.alt = a.name || 'image';
        attBox.appendChild(img);
      } else {
        const chip = document.createElement('span');
        chip.className = 'msg-att-file';
        chip.textContent = a.name || 'file';
        attBox.appendChild(chip);
      }
    });
    div.appendChild(attBox);
  }

  if (role === 'assistant' && Array.isArray(toolsUsed) && toolsUsed.length > 0) {
    const resolvedActId = activityId || (toolsUsed[0] && toolsUsed[0].activityId) || '';
    const tBox = document.createElement('div');
    tBox.className = 'tool-steps-box clickable';
    tBox.title = 'Klik untuk melihat detail log aktivitas';
    toolsUsed.forEach((t) => {
      const p = document.createElement('div');
      p.className = `tool-step-pill ${t.ok === false ? 'err' : 'done'}`;
      p.textContent = `${t.ok === false ? '×' : '✓'} ${t.label || t.tool}`;
      tBox.appendChild(p);
    });
    tBox.addEventListener('click', (e) => {
      e.stopPropagation();
      openActivityByIdOrFallback(resolvedActId, {
        agentId: activeAgentId,
        text,
        toolsUsed,
        at
      });
    });
    div.appendChild(tBox);
  }

  const bodySpan = document.createElement('div');
  bodySpan.textContent = role === 'assistant' ? cleanMarkdown(text) : text;
  div.appendChild(bodySpan);

  hermesMessages.appendChild(div);
  hermesMessages.scrollTop = hermesMessages.scrollHeight;
  return { div, bodySpan };
}

function localizeAgentRole(role) {
  if (!role) return currentLang === 'en' ? 'Autonomous Agent ready to help' : 'Agent otonom siap membantu';
  if (currentLang !== 'en') return role;
  return String(role)
    .replace(/Siap bantu segala urusan laptopmu/gi, 'Ready to handle everything on your laptop')
    .replace(/Riset, analisa dokumen, dan strategi mendalam/gi, 'Research, document analysis & deep strategy')
    .replace(/Otomasi harian, pantau sistem, dan pengingat cepat/gi, 'Daily automation, system monitoring & quick reminders')
    .replace(/Agent otonom siap membantu/gi, 'Autonomous Agent ready to help');
}

function renderAgentHistory(agentDetail) {
  hermesMessages.innerHTML = '';
  const isEn = currentLang === 'en';
  const hist = (agentDetail && Array.isArray(agentDetail.history)) ? agentDetail.history : [];
  const task = agentDetail ? runningAgentTasks.get(agentDetail.id) : null;
  const hasMatchingInFlight = Boolean(
    task && (!task.sessionId || !agentDetail.activeSessionId || task.sessionId === agentDetail.activeSessionId)
  );

  if (hist.length === 0 && !hasMatchingInFlight) {
    if (task) {
      task.workingWrapEl = null;
      task.stepsBoxEl = null;
    }
    hermesMessages.innerHTML = welcomeTemplate;
    const wt = document.getElementById('welcomeTitleText');
    const wr = document.getElementById('welcomeRoleSub');
    if (wt && agentDetail) {
      wt.textContent = isEn
        ? `${agentDetail.name} has full access to your laptop`
        : `${agentDetail.name} siap akses penuh laptopmu`;
    }
    if (wr && agentDetail) {
      wr.textContent = localizeAgentRole(agentDetail.role) || (isEn ? 'Terminal · Folders · Skills · Connectors · Cronjobs' : 'Terminal · Folder · Skill · Konektor · Cronjob');
    }
    const chips = hermesMessages.querySelectorAll('.hermes-chips .chip');
    const chipLocalized = isEn
      ? [
          { label: 'Scan Laptop', prompt: 'Check my laptop status (CPU, RAM, Disk C, top heavy processes)' },
          { label: 'Inspect Downloads', prompt: 'List the latest files in my Downloads folder' },
          { label: 'Daily Briefing', prompt: 'Check active connectors and summarize my schedule or latest info' },
          { label: 'Auto Reminder', prompt: 'Create a cronjob every 1 hour to check RAM & CPU usage' }
        ]
      : [
          { label: 'Scan Laptop', prompt: 'Cek kondisi laptopku sekarang (CPU, RAM, Disk C, dan proses terberat)' },
          { label: 'Cek Downloads', prompt: 'Lihat daftar file terbaru di folder Downloads milikku' },
          { label: 'Rangkum Hari Ini', prompt: 'Cek konektor aktif (kalender/cuaca/berita) dan rangkum agenda hari ini' },
          { label: 'Pengingat Otomatis', prompt: 'Buatkan jadwal cronjob setiap 1 jam untuk mengecek kesehatan RAM & CPU' }
        ];
    chips.forEach((chip, idx) => {
      if (chipLocalized[idx]) {
        chip.dataset.prompt = chipLocalized[idx].prompt;
        const sp = chip.querySelector('span');
        if (sp) sp.textContent = chipLocalized[idx].label;
      }
    });
    renderStaticAvatars(getAvatarAssetsForAgent(agentDetail));
    bindChips();
    return;
  }

  hist.forEach((m) => {
    renderMessageBubble({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      text: m.displayText !== undefined ? m.displayText : m.content,
      attachments: m.attachments || [],
      toolsUsed: m.toolsUsed || [],
      activityId: m.activityId || '',
      at: m.at || ''
    });
  });

  if (hasMatchingInFlight && task) {
    renderMessageBubble({
      role: 'user',
      text: task.userText,
      attachments: task.attachments || []
    });
    appendLiveWorkingBubble(task);
  } else if (task) {
    task.workingWrapEl = null;
    task.stepsBoxEl = null;
  }
}

function applyActiveAgentVisuals(agentDetail) {
  if (!agentDetail) return;
  const isEn = currentLang === 'en';
  activeAgentId = agentDetail.id;
  activeAgentDetail = agentDetail;
  currentAiName = agentDetail.name || 'Hancow';
  currentAiAvatar = agentDetail.avatar || 'hancow';
  currentCustomAvatarUrl = agentDetail.customAvatarUrl || '';

  const assets = getAvatarAssetsForAgent(agentDetail);
  if (jeanAvatar) jeanAvatar.setAssets(assets);
  renderStaticAvatars(assets);

  if (bannerAiName) bannerAiName.textContent = currentAiName;
  if (bannerSubText) bannerSubText.textContent = localizeAgentRole(agentDetail.role);
  if (hermesAiName) hermesAiName.textContent = currentAiName;
  if (hermesInput) {
    hermesInput.placeholder = isEn
      ? `Command ${currentAiName}... (Upload / Drag / Paste files)`
      : `Perintahkan ${currentAiName}... (Upload / Drag / Paste file)`;
  }
  if (bannerAskBtn) bannerAskBtn.title = isEn ? `Open ${currentAiName}` : `Buka ${currentAiName}`;
  const thumbSrc = getAgentThumbSrc(agentDetail);
  const miniImg = document.getElementById('miniAvatarImg');
  const qAvatar = document.getElementById('quickCmdAvatar');
  const qInput = document.getElementById('quickCmdInput');
  const fAvatar = document.getElementById('focusAvatarImg');
  if (miniImg) miniImg.src = thumbSrc;
  if (qAvatar) qAvatar.src = thumbSrc;
  if (fAvatar) fAvatar.src = thumbSrc;
  if (qInput) {
    qInput.placeholder = isEn
      ? `Quick command for ${currentAiName}... (Enter = send, Esc = close)`
      : `Perintah cepat ke ${currentAiName}... (Enter = kirim, Esc = tutup)`;
  }
  syncActiveAgentBusyUI();

  renderAgentPills();
  renderSettingsAgentGrid();
  loadAgentIntoStudio(agentDetail);
}

function closeAgentSelectMenu() {
  if (agentSelect) agentSelect.classList.remove('open');
  if (agentSelectMenu) agentSelectMenu.classList.add('hidden');
}

if (agentSelectTrigger) {
  agentSelectTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = agentSelectMenu ? agentSelectMenu.classList.contains('hidden') : false;
    if (agentSelect) agentSelect.classList.toggle('open', willOpen);
    if (agentSelectMenu) agentSelectMenu.classList.toggle('hidden', !willOpen);
  });
}

document.addEventListener('click', (e) => {
  if (agentSelect && !agentSelect.contains(e.target)) {
    closeAgentSelectMenu();
  }
});

function renderAgentPills() {
  const isEn = currentLang === 'en';
  const activeAg = allAgents.find((a) => a.id === activeAgentId) || activeAgentDetail || allAgents[0];
  if (activeAg) {
    if (agentSelectThumb) agentSelectThumb.src = getAgentThumbSrc(activeAg);
    if (agentSelectName) agentSelectName.textContent = activeAg.name || 'Hancow';
    if (agentSelectBusy) agentSelectBusy.classList.toggle('hidden', !isAgentBusy(activeAg.id));
  }

  if (agentPillsBar) {
    agentPillsBar.innerHTML = '';
    allAgents.forEach((ag) => {
      const busy = isAgentBusy(ag.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `agent-tile${ag.id === activeAgentId ? ' active' : ''}`;
      const busyLabel = isEn ? 'Running task' : 'Sedang menjalankan tugas';
      btn.innerHTML = `
        <img class="agent-tile-thumb" src="${escapeHtml(getAgentThumbSrc(ag))}" alt="" draggable="false" />
        <span class="agent-tile-name">${escapeHtml(ag.name)}</span>
        ${busy ? `<span class="agent-tile-busy" title="${busyLabel}"></span>` : ''}
      `;
      btn.title = `${ag.name} — ${busy ? busyLabel : localizeAgentRole(ag.role || 'Agent')}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAgentSelectMenu();
        handleSelectAgent(ag.id);
      });
      agentPillsBar.appendChild(btn);
    });
  }

  // Also refresh cron agent select options
  if (newCronAgent) {
    newCronAgent.innerHTML = allAgents
      .map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === activeAgentId ? 'selected' : ''}>Agent: ${escapeHtml(a.name)}</option>`)
      .join('');
  }
}

function renderSettingsAgentGrid() {
  const isEn = currentLang === 'en';
  if (manageAgentList) {
    manageAgentList.innerHTML = '';
    allAgents.forEach((ag) => {
      const isAct = ag.id === activeAgentId;
      const busy = isAgentBusy(ag.id);
      const row = document.createElement('div');
      row.className = `manage-agent-row${isAct ? ' active' : ''}`;
      row.innerHTML = `
        <img class="manage-agent-thumb" src="${escapeHtml(getAgentThumbSrc(ag))}" alt="" draggable="false" />
        <div class="manage-agent-info">
          <div class="manage-agent-name">${escapeHtml(ag.name)}${busy ? (isEn ? ' · Busy' : ' · Sibuk') : ''}</div>
          <div class="manage-agent-role">${escapeHtml(localizeAgentRole(ag.role || 'Autonomous Agent'))}</div>
        </div>
        ${isAct ? `<span class="manage-agent-badge">${isEn ? 'Active' : 'Aktif'}</span>` : ''}
        <span class="manage-agent-arrow" title="${isEn ? 'Configure Agent' : 'Konfigurasi Agent'}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
      `;
      row.addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await window.islandAPI.selectAgent(ag.id);
        if (res && res.ok && res.agent) {
          allAgents = res.agents || allAgents;
          applyActiveAgentVisuals(res.agent);
          renderAgentHistory(res.agent);
          loadAgentIntoStudio(res.agent);
          switchManagePane('config');
        }
      });
      manageAgentList.appendChild(row);
    });
    if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
  }
}

let isSessionsDrawerOpen = false;
let pendingConfirmResolver = null;

function resolveIslandConfirm(result) {
  if (islandConfirmModal) islandConfirmModal.classList.add('hidden');
  if (pendingConfirmResolver) {
    const fn = pendingConfirmResolver;
    pendingConfirmResolver = null;
    fn(Boolean(result));
  }
}

function askIslandConfirm({ title, desc, okText = 'Ya, Lanjutkan' }) {
  if (!islandConfirmModal) return Promise.resolve(true);
  if (pendingConfirmResolver) resolveIslandConfirm(false);
  if (confirmModalTitle) confirmModalTitle.textContent = title || 'Konfirmasi';
  if (confirmModalDesc) confirmModalDesc.textContent = desc || '';
  if (btnConfirmOk) btnConfirmOk.textContent = okText;
  islandConfirmModal.classList.remove('hidden');
  return new Promise((resolve) => {
    pendingConfirmResolver = resolve;
  });
}

if (islandConfirmModal) {
  islandConfirmModal.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target === islandConfirmModal) resolveIslandConfirm(false);
  });
}
if (btnConfirmCancel) {
  btnConfirmCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    resolveIslandConfirm(false);
  });
}
if (btnConfirmOk) {
  btnConfirmOk.addEventListener('click', (e) => {
    e.stopPropagation();
    resolveIslandConfirm(true);
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && pendingConfirmResolver) {
    e.stopPropagation();
    resolveIslandConfirm(false);
  }
});

function formatSessionTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  const isEn = currentLang === 'en';
  const locale = isEn ? 'en-US' : 'id-ID';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 45) return isEn ? 'Just now' : 'Baru saja';
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  const dm = d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  return `${dm} ${hm}`;
}

function setSessionsDrawerOpen(open) {
  isSessionsDrawerOpen = Boolean(open);
  if (sessionHistoryDrawer) sessionHistoryDrawer.classList.toggle('hidden', !isSessionsDrawerOpen);
  if (btnChatSessions) btnChatSessions.classList.toggle('active', isSessionsDrawerOpen);
  if (isSessionsDrawerOpen) renderSessionsDrawer();
}

function renderSessionsDrawer() {
  if (!sessionsListContainer) return;
  const isEn = currentLang === 'en';
  if (sessionsDrawerTitle) {
    sessionsDrawerTitle.textContent = isEn ? `Chat History · ${currentAiName}` : `Riwayat Chat · ${currentAiName}`;
  }
  const sessions = (activeAgentDetail && Array.isArray(activeAgentDetail.sessions))
    ? activeAgentDetail.sessions
    : [];
  const activeSid = activeAgentDetail ? activeAgentDetail.activeSessionId : '';

  sessionsListContainer.innerHTML = '';
  if (sessions.length === 0) {
    sessionsListContainer.innerHTML = `<div class="lyrics-empty">${isEn ? 'No saved chat sessions yet' : 'Belum ada riwayat chat tersimpan'}</div>`;
    return;
  }

  sessions.forEach((sess) => {
    const isActive = sess.id === activeSid;
    const row = document.createElement('div');
    row.className = `session-row${isActive ? ' active' : ''}`;
    const countLabel = isEn ? `${sess.messageCount || 0} msgs` : `${sess.messageCount || 0} pesan`;
    const timeLabel = formatSessionTime(sess.updatedAt);
    const activeLabel = isActive ? (isEn ? ' · Active' : ' · Aktif') : '';
    const metaText = [countLabel, timeLabel].filter(Boolean).join(' · ') + activeLabel;
    const defaultTitle = isEn ? 'New Chat' : 'Chat Baru';
    const rawTitle = sess.title === 'Chat Baru' && isEn ? 'New Chat' : (sess.title || defaultTitle);

    row.innerHTML = `
      <div class="session-row-info">
        <div class="session-row-title">${escapeHtml(rawTitle)}</div>
        <div class="session-row-meta">${escapeHtml(metaText)}</div>
      </div>
      <button type="button" class="session-del-btn" title="${isEn ? 'Delete this chat session' : 'Hapus riwayat chat ini'}">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    row.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (isAgentBusy()) return;
      const res = await window.islandAPI.selectChatSession(activeAgentId, sess.id);
      if (res && res.ok && res.agent) {
        activeAgentDetail = res.agent;
        renderAgentHistory(activeAgentDetail);
        setSessionsDrawerOpen(false);
        window.islandAPI.focusWindow();
        setTimeout(() => hermesInput.focus(), 20);
      }
    });

    row.querySelector('.session-del-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (isAgentBusy()) return;
      const titleDisplay = rawTitle;
      const confirmed = await askIslandConfirm({
        title: isEn ? 'Delete this chat session?' : 'Hapus riwayat chat ini?',
        desc: isEn
          ? `Session "${titleDisplay}" will be permanently deleted. Agent memory and other sessions remain safe.`
          : `Sesi "${titleDisplay}" akan dihapus permanen. Memori agent dan riwayat chat lainnya tetap aman.`,
        okText: isEn ? 'Delete' : 'Hapus'
      });
      if (!confirmed) return;
      const res = await window.islandAPI.deleteChatSession(activeAgentId, sess.id);
      if (res && res.ok && res.agent) {
        activeAgentDetail = res.agent;
        renderAgentHistory(activeAgentDetail);
        renderSessionsDrawer();
      }
    });

    sessionsListContainer.appendChild(row);
  });
}

async function handleCreateNewChat() {
  if (isAgentBusy()) return;
  switchSubView('chat');
  setSessionsDrawerOpen(false);
  const res = await window.islandAPI.createChatSession(activeAgentId);
  if (res && res.ok && res.agent) {
    activeAgentDetail = res.agent;
    renderAgentHistory(activeAgentDetail);
    window.islandAPI.focusWindow();
    setTimeout(() => hermesInput.focus(), 20);
  }
}

if (btnNewChat) {
  btnNewChat.addEventListener('click', (e) => {
    e.stopPropagation();
    handleCreateNewChat();
  });
}

if (btnDrawerNewChat) {
  btnDrawerNewChat.addEventListener('click', (e) => {
    e.stopPropagation();
    handleCreateNewChat();
  });
}

if (btnChatSessions) {
  btnChatSessions.addEventListener('click', (e) => {
    e.stopPropagation();
    const chatSubActive = document.getElementById('subview-chat').classList.contains('active');
    if (!chatSubActive) {
      switchSubView('chat');
      setSessionsDrawerOpen(true);
    } else {
      setSessionsDrawerOpen(!isSessionsDrawerOpen);
    }
  });
}

if (btnCloseSessionsDrawer) {
  btnCloseSessionsDrawer.addEventListener('click', (e) => {
    e.stopPropagation();
    setSessionsDrawerOpen(false);
  });
}

async function handleSelectAgent(agentId) {
  const res = await window.islandAPI.selectAgent(agentId);
  if (res && res.ok && res.agent) {
    allAgents = res.agents || allAgents;
    applyActiveAgentVisuals(res.agent);
    renderAgentHistory(res.agent);
    if (isSessionsDrawerOpen) renderSessionsDrawer();
    renderSkillsList();
    renderCronList();
    renderActivityLogList();
  }
}

// Settings 3-section navigation (Tampilan | Provider | Kelola Agent)
function switchSettingsSection(sectionName) {
  if (settingsNav) {
    settingsNav.querySelectorAll('.settings-nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.section === sectionName);
    });
  }
  document.querySelectorAll('.settings-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `settings-${sectionName}`);
  });
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
}

function switchManagePane(paneName) {
  if (manageSubNav) {
    manageSubNav.querySelectorAll('.conn-filter-tab').forEach((b) => {
      const match = (paneName === 'config' && b.dataset.pane === 'list') || b.dataset.pane === paneName;
      b.classList.toggle('active', match);
    });
  }
  const mapId = {
    list: 'pane-agentlist',
    config: 'subview-config',
    skills: 'subview-skills',
    connectors: 'subview-connectors'
  };
  const targetId = mapId[paneName] || 'pane-agentlist';
  document.querySelectorAll('#settings-agents .settings-pane').forEach((p) => {
    p.classList.toggle('active', p.id === targetId);
  });
  if (paneName === 'list') renderSettingsAgentGrid();
  if (paneName === 'skills') renderSkillsList();
  if (paneName === 'connectors') renderConnectorsList();
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
}

if (settingsNav) {
  settingsNav.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchSettingsSection(btn.dataset.section);
    });
  });
}

if (manageSubNav) {
  manageSubNav.querySelectorAll('.conn-filter-tab').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchManagePane(btn.dataset.pane);
    });
  });
}

if (btnBackToAgentList) {
  btnBackToAgentList.addEventListener('click', (e) => {
    e.stopPropagation();
    switchManagePane('list');
  });
}

// Sub-view switching inside #tab-hermes (and redirecting moved panes to #tab-settings)
function switchSubView(subName) {
  if (subName === 'config' || subName === 'skills' || subName === 'connectors') {
    switchTab('tab-settings');
    switchSettingsSection('agents');
    switchManagePane(subName);
    return;
  }
  if (subName !== 'chat' && isSessionsDrawerOpen) {
    setSessionsDrawerOpen(false);
  }
  agentSubNav.querySelectorAll('.subnav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.subview === subName);
  });
  document.querySelectorAll('.agent-subview').forEach((v) => {
    v.classList.toggle('active', v.id === `subview-${subName}`);
  });
  if (subName === 'activity') {
    refreshAllActivities();
    renderActivityLogList();
  }
  if (subName === 'cron') renderCronList();
}

agentSubNav.querySelectorAll('.subnav-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    switchSubView(btn.dataset.subview);
  });
});

// Pin Island & Instant Proactive Scan buttons
btnPinIsland.addEventListener('click', (e) => {
  e.stopPropagation();
  isPinnedOpen = !isPinnedOpen;
  btnPinIsland.classList.toggle('active', isPinnedOpen);
});

btnProactiveScan.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (isAgentBusy()) return;
  switchSubView('chat');
  await sendPromptToActiveAgent(
    'Cek proaktif kondisi laptopku sekarang (CPU, RAM, Baterai, Disk C:, proses terberat) dan rangkum info terbaru dari semua konektor aktif.',
    []
  );
});

// ===== AGENT STUDIO (Add / Edit Agent: Instruksi, Memori, soul.md, identity.md) =====

function loadAgentIntoStudio(agentDetail) {
  const isEn = currentLang === 'en';
  studioEditingId = agentDetail ? agentDetail.id : null;
  studioCustomAvatarUrl = (agentDetail && agentDetail.customAvatarUrl) || '';
  cfgAgentName.value = agentDetail ? agentDetail.name : '';
  cfgAgentRole.value = agentDetail ? (agentDetail.role || '') : '';
  cfgAgentAvatar.value = agentDetail ? (agentDetail.avatar || 'hancow') : 'hancow';
  if (cfgPaneTitle) {
    cfgPaneTitle.textContent = agentDetail
      ? (isEn ? `Configure · ${agentDetail.name}` : `Konfigurasi · ${agentDetail.name}`)
      : (isEn ? 'Configure New Agent' : 'Konfigurasi Agent Baru');
  }

  studioDocsDraft = {
    instructions: agentDetail ? (agentDetail.instructions || '') : '# Instruksi Agent Baru\n1. Eksekusi perintah terminal, folder manager, skill, dan konektor secara otonom.\n2. Berikan info proaktif yang akurat tanpa basa-basi.',
    memory: agentDetail ? (agentDetail.memory || '') : '# Memori Khusus Agent\n- Catatan spesifik agent ini.',
    soul: agentDetail ? (agentDetail.soul || '') : '# Soul\nKamu lugas, jujur, proaktif, dan fokus menuntaskan pekerjaan pengguna sampai beres.',
    identity: agentDetail ? (agentDetail.identity || '') : '# Identity\n- **Nama**: Agent Baru\n- **Spesialisasi**: Autonomous Computer Agent',
    globalMemory: (agentDetail && agentDetail.globalMemory) || (activeAgentDetail && activeAgentDetail.globalMemory) || ''
  };

  cfgDocEditor.value = studioDocsDraft[studioActiveDocKey] || '';
  const isBuiltIn = Boolean(agentDetail && agentDetail.builtIn);
  btnDeleteAgent.classList.toggle('hidden', !studioEditingId || isBuiltIn);
  cfgStatusText.textContent = studioEditingId
    ? (isEn ? `Editing: ${agentDetail.name}` : `Mengedit: ${agentDetail.name}`)
    : (isEn ? 'Mode: Create New Agent' : 'Mode: Tambah Agent Baru');
}

// ===== CREATE AGENT MODAL (6 Avatar Presets: Hancow, Wana, Winnie, Lab, Ninja, Hoodie) =====
const CA_AVATAR_CHOICES = [
  { key: 'hancow', label: 'Hancow', poster: AVATAR_PRESETS.hancow.idlePoster },
  { key: 'wana', label: 'Wana', poster: AVATAR_PRESETS.wana.idlePoster },
  { key: 'pipo', label: 'Winnie', poster: AVATAR_PRESETS.pipo.idlePoster },
  { key: 'lab', label: 'Lab', poster: AVATAR_PRESETS.lab.idlePoster },
  { key: 'ninja', label: 'Ninja', poster: AVATAR_PRESETS.ninja.idlePoster },
  { key: 'hoodie', label: 'Hoodie', poster: AVATAR_PRESETS.hoodie.idlePoster },
  { key: 'wizard', label: 'Wizard', poster: AVATAR_PRESETS.wizard.idlePoster },
  { key: 'astro', label: 'Astro', poster: AVATAR_PRESETS.astro.idlePoster },
  { key: 'cowboy', label: 'Cowboy', poster: AVATAR_PRESETS.cowboy.idlePoster },
  { key: 'hero', label: 'Hero', poster: AVATAR_PRESETS.hero.idlePoster }
];

let caSelectedAvatarKey = 'hancow';

function renderCaAvatarPreviewAndPicker() {
  const chosen = CA_AVATAR_CHOICES.find((c) => c.key === caSelectedAvatarKey) || CA_AVATAR_CHOICES[0];
  if (caAvatarPreview) {
    caAvatarPreview.innerHTML = `<img src="${escapeHtml(chosen.poster)}" alt="${escapeHtml(chosen.label)}" draggable="false" />`;
  }
  if (caFaceGrid) {
    caFaceGrid.innerHTML = '';
    CA_AVATAR_CHOICES.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ca-opt${item.key === caSelectedAvatarKey ? ' active' : ''}`;
      btn.innerHTML = `
        <img class="ca-opt-img" src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.label)}" draggable="false" />
        <span class="ca-opt-label">${escapeHtml(item.label)}</span>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        caSelectedAvatarKey = item.key;
        renderCaAvatarPreviewAndPicker();
        if (caAvatarPicker) caAvatarPicker.classList.add('hidden');
      });
      caFaceGrid.appendChild(btn);
    });
  }
}

function openCreateAgentModal() {
  switchTab('tab-settings');
  switchSettingsSection('agents');
  renderCaAvatarPreviewAndPicker();
  if (caAgentName) caAgentName.value = '';
  if (btnCaCreate) btnCaCreate.disabled = true;
  if (caAvatarPicker) caAvatarPicker.classList.add('hidden');
  if (createAgentModal) createAgentModal.classList.remove('hidden');
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
  window.islandAPI.focusWindow();
  setTimeout(() => {
    if (caAgentName) caAgentName.focus();
  }, 30);
}

function closeCreateAgentModal() {
  if (caAvatarPicker) caAvatarPicker.classList.add('hidden');
  if (createAgentModal) createAgentModal.classList.add('hidden');
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
}

if (btnCreateAgentOpen) {
  btnCreateAgentOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    openCreateAgentModal();
  });
}

if (btnAddAgent) {
  btnAddAgent.addEventListener('click', (e) => {
    e.stopPropagation();
    openCreateAgentModal();
  });
}

if (btnCloseCreateAgent) {
  btnCloseCreateAgent.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCreateAgentModal();
  });
}

if (btnCaCancel) {
  btnCaCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCreateAgentModal();
  });
}

if (createAgentModal) {
  createAgentModal.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target === createAgentModal) {
      closeCreateAgentModal();
    } else if (caAvatarPicker && !caAvatarPicker.classList.contains('hidden')) {
      if (!caAvatarPicker.contains(e.target) && e.target !== btnCaEditAvatar && !btnCaEditAvatar.contains(e.target)) {
        caAvatarPicker.classList.add('hidden');
      }
    }
  });
}

if (btnCaEditAvatar) {
  btnCaEditAvatar.addEventListener('click', (e) => {
    e.stopPropagation();
    if (caAvatarPicker) caAvatarPicker.classList.toggle('hidden');
  });
}

if (btnCaRandom) {
  btnCaRandom.addEventListener('click', (e) => {
    e.stopPropagation();
    const others = CA_AVATAR_CHOICES.filter((c) => c.key !== caSelectedAvatarKey);
    const pick = others[Math.floor(Math.random() * others.length)] || CA_AVATAR_CHOICES[0];
    caSelectedAvatarKey = pick.key;
    renderCaAvatarPreviewAndPicker();
  });
}

if (caAgentName) {
  caAgentName.addEventListener('input', () => {
    if (btnCaCreate) btnCaCreate.disabled = !caAgentName.value.trim();
  });
  caAgentName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && caAgentName.value.trim()) {
      e.preventDefault();
      btnCaCreate.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCreateAgentModal();
    }
  });
}

if (btnCaCreate) {
  btnCaCreate.addEventListener('click', async (e) => {
    e.stopPropagation();
    const name = (caAgentName && caAgentName.value.trim()) || '';
    if (!name) return;
    btnCaCreate.disabled = true;
    const payload = {
      name,
      role: 'Autonomous Computer Agent',
      avatar: caSelectedAvatarKey || 'hancow',
      customAvatarUrl: '',
      instructions: `# Instruksi ${name}\n1. Eksekusi perintah terminal, folder manager, skill, dan konektor secara otonom.\n2. Berikan info proaktif yang akurat tanpa basa-basi.`,
      memory: `# Memori Khusus ${name}\n- Catatan spesifik agent ini.`,
      soul: `# Soul\nKamu adalah ${name}, agent yang lugas, jujur, proaktif, dan fokus menuntaskan pekerjaan pengguna sampai beres.`,
      identity: `# Identity\n- **Nama**: ${name}\n- **Spesialisasi**: Autonomous Computer Agent`,
      globalMemory: (activeAgentDetail && activeAgentDetail.globalMemory) || '',
      makeActive: true
    };
    const res = await window.islandAPI.saveAgent(payload);
    if (res && res.ok) {
      allAgents = res.agents || allAgents;
      applyActiveAgentVisuals(res.agent);
      renderAgentHistory(res.agent);
      closeCreateAgentModal();
      switchManagePane('list');
    } else {
      btnCaCreate.disabled = false;
    }
  });
}

cfgDocEditor.addEventListener('input', () => {
  studioDocsDraft[studioActiveDocKey] = cfgDocEditor.value;
});

cfgDocTabs.querySelectorAll('.doc-tab').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    studioDocsDraft[studioActiveDocKey] = cfgDocEditor.value;
    studioActiveDocKey = tab.dataset.doc;
    cfgDocTabs.querySelectorAll('.doc-tab').forEach((t) => t.classList.toggle('active', t === tab));
    cfgDocEditor.value = studioDocsDraft[studioActiveDocKey] || '';
  });
});

btnUploadAvatar.addEventListener('click', (e) => {
  e.stopPropagation();
  isFileDialogOpen = true;
  cfgCustomAvatarInput.click();
});

cfgCustomAvatarInput.addEventListener('change', async () => {
  isFileDialogOpen = false;
  const f = cfgCustomAvatarInput.files && cfgCustomAvatarInput.files[0];
  if (!f) return;
  const filePath = window.islandAPI.getPathForFile(f);
  const res = await window.islandAPI.importCustomAvatar({ filePath, fileName: f.name });
  if (res && res.ok) {
    studioCustomAvatarUrl = res.customAvatarUrl;
    cfgAgentAvatar.value = 'custom';
    cfgStatusText.textContent = `Avatar dipilih: ${f.name}`;
  }
  cfgCustomAvatarInput.value = '';
});
window.addEventListener('focus', () => {
  setTimeout(() => { isFileDialogOpen = false; }, 400);
});

btnSaveAgent.addEventListener('click', async (e) => {
  e.stopPropagation();
  studioDocsDraft[studioActiveDocKey] = cfgDocEditor.value;
  const name = cfgAgentName.value.trim() || 'Agent Baru';
  const payload = {
    id: studioEditingId || undefined,
    name,
    role: cfgAgentRole.value.trim() || 'Autonomous Agent',
    avatar: cfgAgentAvatar.value,
    customAvatarUrl: cfgAgentAvatar.value === 'custom' ? studioCustomAvatarUrl : '',
    instructions: studioDocsDraft.instructions,
    memory: studioDocsDraft.memory,
    soul: studioDocsDraft.soul,
    identity: studioDocsDraft.identity,
    globalMemory: studioDocsDraft.globalMemory,
    makeActive: true
  };

  cfgStatusText.textContent = 'Menyimpan...';
  const res = await window.islandAPI.saveAgent(payload);
  if (res && res.ok) {
    allAgents = res.agents || allAgents;
    applyActiveAgentVisuals(res.agent);
    renderAgentHistory(res.agent);
    cfgStatusText.textContent = `Tersimpan: ${res.agent.name}`;
  } else {
    cfgStatusText.textContent = (res && res.error) || 'Gagal menyimpan';
  }
});

btnDeleteAgent.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!studioEditingId) return;
  const res = await window.islandAPI.deleteAgent(studioEditingId);
  if (res && res.ok) {
    allAgents = res.agents || [];
    if (res.activeAgent) {
      applyActiveAgentVisuals(res.activeAgent);
      renderAgentHistory(res.activeAgent);
    }
    switchManagePane('list');
  }
});

// ===== FILE UPLOAD + DRAG & DROP + CLIPBOARD PASTE =====

function renderAttachmentStrip() {
  if (stagedAttachments.length === 0) {
    attachmentStrip.classList.add('hidden');
    attachmentStrip.innerHTML = '';
    return;
  }
  attachmentStrip.classList.remove('hidden');
  attachmentStrip.innerHTML = '';
  stagedAttachments.forEach((att, idx) => {
    const chip = document.createElement('div');
    chip.className = 'att-chip';
    chip.innerHTML = `
      ${att.isImage && att.previewDataUrl ? `<img class="att-chip-thumb" src="${att.previewDataUrl}" alt="" />` : ''}
      <span class="att-chip-name" title="${escapeHtml(att.localPath)}">${escapeHtml(att.name)}</span>
      <button type="button" class="att-chip-remove" title="Hapus lampiran">×</button>
    `;
    chip.querySelector('.att-chip-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      stagedAttachments.splice(idx, 1);
      renderAttachmentStrip();
    });
    attachmentStrip.appendChild(chip);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function stageBrowserFileList(fileList) {
  if (!fileList || fileList.length === 0) return;
  for (const file of Array.from(fileList)) {
    const nativePath = window.islandAPI.getPathForFile(file);
    let payload;
    if (nativePath) {
      payload = { filePath: nativePath, fileName: file.name, mimeType: file.type };
    } else {
      const dataUrl = await readFileAsDataUrl(file);
      payload = {
        base64Data: dataUrl,
        fileName: file.name || `clipboard-${Date.now()}.png`,
        mimeType: file.type || 'image/png'
      };
    }
    const res = await window.islandAPI.stageAttachment(payload);
    if (res && res.ok && res.attachment) {
      stagedAttachments.push(res.attachment);
    }
  }
  renderAttachmentStrip();
}

btnAttachFile.addEventListener('click', (e) => {
  e.stopPropagation();
  isFileDialogOpen = true;
  hermesFileInput.click();
});

hermesFileInput.addEventListener('change', async () => {
  isFileDialogOpen = false;
  if (hermesFileInput.files && hermesFileInput.files.length > 0) {
    await stageBrowserFileList(hermesFileInput.files);
  }
  hermesFileInput.value = '';
  hermesInput.focus();
});

// Drag & Drop anywhere onto #island or top magnetic catch zone
let dragDepth = 0;
let dragStartedOnHermes = false;
let dragIdleResetTimer = null;

function setTrayDropZoneInteractiveState(mode) {
  const dz = document.getElementById('trayDropZone');
  const titleEl = document.getElementById('trayDzTitle');
  const subEl = document.getElementById('trayDzSub');
  if (!dz) return;
  const isEn = currentLang === 'en';
  dz.classList.remove('drag-ready', 'drop-success');
  if (mode === 'ready') {
    dz.classList.add('drag-ready');
    if (titleEl) titleEl.textContent = isEn ? 'Ready to Drop! Release File Now' : 'Siap Tempel! Lepas File Sekarang';
    if (subEl) subEl.textContent = isEn ? 'Magnetic lock active · File will be pinned to Tray' : 'Kunci magnet aktif · File otomatis masuk ke Drop Tray';
  } else if (mode === 'success') {
    dz.classList.add('drop-success');
    if (titleEl) titleEl.textContent = isEn ? 'File Pinned to Island! ✨' : 'File Berhasil Tertempel! ✨';
    if (subEl) subEl.textContent = isEn ? 'Ready to drag out or send to AI' : 'Siap di-drag keluar atau dikirim ke AI';
    setTimeout(() => {
      setTrayDropZoneInteractiveState('idle');
    }, 1350);
  } else {
    if (titleEl) titleEl.textContent = isEn ? 'Drag & Drop Files Here' : 'Tarik & Tempel File ke Sini';
    if (subEl) subEl.textContent = isEn ? 'Or click to browse · Hold files temporarily' : 'Atau klik untuk pilih file · Titip file sementara';
  }
}

function handleGlobalDragEnterOrOver(e) {
  const dt = e.dataTransfer;
  if (!dt) return;
  e.preventDefault();
  dt.dropEffect = 'copy';
  lastDragOverAt = Date.now();
  clearTimeout(collapseTimeout);

  if (!isExpanded) {
    dragStartedOnHermes = false;
    expandIsland();
    switchTab('tab-hub');
    if (typeof switchHubSection === 'function') switchHubSection('tray');
  } else if (!dragStartedOnHermes && !document.getElementById('tab-hermes').classList.contains('active')) {
    if (!document.getElementById('tab-hub').classList.contains('active')) {
      switchTab('tab-hub');
    }
    if (typeof switchHubSection === 'function') switchHubSection('tray');
  }

  if (document.getElementById('tab-hermes').classList.contains('active') && dragStartedOnHermes) {
    dropOverlay.classList.remove('hidden');
  } else {
    setTrayDropZoneInteractiveState('ready');
  }

  clearTimeout(dragIdleResetTimer);
  dragIdleResetTimer = setTimeout(() => {
    if (Date.now() - lastDragOverAt >= 420) {
      dragDepth = 0;
      dropOverlay.classList.add('hidden');
      setTrayDropZoneInteractiveState('idle');
    }
  }, 460);
}

window.addEventListener('dragenter', (e) => {
  if (dragDepth === 0) {
    dragStartedOnHermes = isExpanded && document.getElementById('tab-hermes').classList.contains('active');
  }
  dragDepth++;
  handleGlobalDragEnterOrOver(e);
});

window.addEventListener('dragover', (e) => {
  handleGlobalDragEnterOrOver(e);
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    dropOverlay.classList.add('hidden');
    setTrayDropZoneInteractiveState('idle');
  }
});

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragDepth = 0;
  lastDragOverAt = 0;
  clearTimeout(dragIdleResetTimer);
  dropOverlay.classList.add('hidden');
  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length > 0) {
    setTrayDropZoneInteractiveState('success');
    if (typeof addBrowserFilesToTray === 'function') {
      await addBrowserFilesToTray(files, files.length);
    }
    if (dragStartedOnHermes) {
      switchTab('tab-hermes');
      switchSubView('chat');
      await stageBrowserFileList(files);
      window.islandAPI.focusWindow();
      setTimeout(() => hermesInput.focus(), 30);
    } else {
      switchTab('tab-hub');
      if (typeof switchHubSection === 'function') switchHubSection('tray');
    }
  } else {
    setTrayDropZoneInteractiveState('idle');
  }
});

// Clipboard Paste (Ctrl+V images / files) inside Agent tab
document.addEventListener('paste', async (e) => {
  if (!document.getElementById('tab-hermes').classList.contains('active')) return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const files = [];
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length > 0) {
    e.preventDefault();
    switchSubView('chat');
    await stageBrowserFileList(files);
  }
});

// ===== CHAT EXECUTION + LIVE TOOL STREAM =====

function bindChips() {
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      hermesInput.value = chip.getAttribute('data-prompt') || chip.textContent;
      hermesForm.requestSubmit();
    });
  });
}
bindChips();

async function sendPromptToActiveAgent(promptText, attachmentsToSend) {
  const runAgentId = activeAgentId;
  if (isAgentBusy(runAgentId)) return;
  const cleanPrompt = String(promptText || '').trim();
  if (!cleanPrompt && (!attachmentsToSend || attachmentsToSend.length === 0)) return;

  const runSessionId = activeAgentDetail ? activeAgentDetail.activeSessionId : undefined;
  const displayPrompt = cleanPrompt || '(Lampiran dikirim)';

  if (isSessionsDrawerOpen) setSessionsDrawerOpen(false);
  if (!isPinnedOpen && document.activeElement === hermesInput) {
    hermesInput.blur();
  }

  const task = {
    agentId: runAgentId,
    sessionId: runSessionId,
    userText: displayPrompt,
    attachments: attachmentsToSend || [],
    steps: [],
    statusLabel: 'menjalankan agent...',
    workingWrapEl: null,
    stepsBoxEl: null
  };
  runningAgentTasks.set(runAgentId, task);
  renderAgentPills();

  renderMessageBubble({
    role: 'user',
    text: displayPrompt,
    attachments: attachmentsToSend
  });
  appendLiveWorkingBubble(task);

  hermesSendBtn.disabled = true;
  setJeanState('happy');
  setTimeout(() => {
    if (activeAgentId === runAgentId && runningAgentTasks.get(runAgentId) === task) {
      setJeanState('thinking', task.statusLabel);
    }
  }, 360);

  let replyText = '';
  let toolsUsed = [];
  let finishedActivityId = '';
  try {
    const res = await window.islandAPI.chatWithAgent({
      agentId: runAgentId,
      sessionId: runSessionId,
      text: cleanPrompt,
      attachments: attachmentsToSend
    });
    if (res && res.ok) {
      replyText = res.reply || 'Selesai.';
      toolsUsed = res.toolsUsed || [];
      finishedActivityId = res.activityId || '';
    } else {
      replyText = `Gagal mengeksekusi lewat gateway: ${(res && res.error) || 'koneksi gagal'}`;
      finishedActivityId = (res && res.activityId) || '';
    }
  } catch (err) {
    replyText = `Error: ${err.message}`;
  }

  runningAgentTasks.delete(runAgentId);
  renderAgentPills();
  refreshAllActivities();

  if (task.workingWrapEl && task.workingWrapEl.parentNode) {
    task.workingWrapEl.remove();
  }

  const stillViewingSameAgent = activeAgentId === runAgentId;
  const stillSameSession = stillViewingSameAgent &&
    (!runSessionId || !activeAgentDetail || activeAgentDetail.activeSessionId === runSessionId);

  if (!isExpanded && replyText) {
    const isEn = currentLang === 'en';
    showLiveToast({
      title: cleanMarkdown(replyText),
      actionLabel: isEn ? 'View' : 'Lihat',
      onAction: () => {
        isExpanded = true;
        window.islandAPI.setMousePassthrough(false);
        setIslandState('expanded');
        switchTab('tab-hermes');
        switchSubView('chat');
      },
      durationMs: 6500
    });
  }

  if (stillSameSession) {
    setJeanState('talking');
    await typewriterAssistantBubble(cleanMarkdown(replyText), toolsUsed, runAgentId, finishedActivityId);
    if (activeAgentId === runAgentId) {
      syncActiveAgentBusyUI();
      if (isExpanded && (isPinnedOpen || isPointerInsideIsland)) {
        hermesInput.focus();
      }
    }
  } else if (stillViewingSameAgent) {
    syncActiveAgentBusyUI();
  }

  // Refresh finished agent's detail if currently active
  window.islandAPI.getAgentDetail(runAgentId).then((r) => {
    if (r && r.ok && r.agent && activeAgentId === runAgentId) {
      activeAgentDetail = r.agent;
      loadAgentIntoStudio(r.agent);
      if (isSessionsDrawerOpen) renderSessionsDrawer();
    }
  }).catch(() => {});

  return replyText;
}

function typewriterAssistantBubble(text, toolsUsed, ownerAgentId = activeAgentId, activityId = '') {
  return new Promise((resolve) => {
    const { bodySpan } = renderMessageBubble({
      role: 'assistant',
      text: '',
      toolsUsed,
      activityId
    });
    let i = 0;
    const step = Math.max(2, Math.ceil(text.length / 120));
    const timer = setInterval(() => {
      if (!bodySpan.isConnected || activeAgentId !== ownerAgentId) {
        bodySpan.textContent = text;
        clearInterval(timer);
        resolve();
        return;
      }
      i = Math.min(text.length, i + step);
      bodySpan.textContent = text.slice(0, i);
      hermesMessages.scrollTop = hermesMessages.scrollHeight;
      if (i >= text.length) {
        clearInterval(timer);
        resolve();
      }
    }, 15);
  });
}

hermesForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const prompt = hermesInput.value.trim();
  if ((!prompt && stagedAttachments.length === 0) || isAgentBusy()) return;

  const atts = [...stagedAttachments];
  stagedAttachments = [];
  renderAttachmentStrip();
  hermesInput.value = '';

  await sendPromptToActiveAgent(prompt, atts);
});

hermesClearBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (isAgentBusy()) return;
  const hasBubbles = hermesMessages.querySelector('.hermes-msg') !== null;
  const hasHistory = Boolean(activeAgentDetail && Array.isArray(activeAgentDetail.history) && activeAgentDetail.history.length > 0);
  if (!hasBubbles && !hasHistory) {
    switchSubView('chat');
    setSessionsDrawerOpen(false);
    hermesInput.focus();
    return;
  }

  const confirmed = await askIslandConfirm({
    title: 'Bersihkan isi sesi chat ini?',
    desc: 'Semua pesan di sesi ini akan dikosongkan. Memori agent dan riwayat sesi chat lainnya tetap tersimpan.',
    okText: 'Bersihkan'
  });
  if (!confirmed) return;

  const targetSessionId = activeAgentDetail ? activeAgentDetail.activeSessionId : undefined;
  const res = await window.islandAPI.clearAgentHistory(activeAgentId, targetSessionId);
  if (res && res.ok && res.agent) {
    activeAgentDetail = res.agent;
  } else if (activeAgentDetail) {
    activeAgentDetail.history = [];
  }
  renderAgentHistory(activeAgentDetail);
  if (isSessionsDrawerOpen) renderSessionsDrawer();
});

// Live Tool Step Events from Main Process (tracked per-agent even when viewing another agent)
window.islandAPI.onAgentStep((ev) => {
  if (!ev || !ev.agentId) return;
  const task = runningAgentTasks.get(ev.agentId);
  if (task && ev.activityId) {
    task.activityId = ev.activityId;
  }
  if (ev.phase === 'start') {
    if (task) {
      task.statusLabel = ev.label || 'menjalankan agent...';
      task.steps.push({ label: ev.label, state: 'running' });
      if (task.stepsBoxEl && task.stepsBoxEl.isConnected) {
        const pill = document.createElement('div');
        pill.className = 'tool-step-pill';
        pill.dataset.toolLabel = ev.label;
        pill.textContent = `→ ${ev.label}`;
        task.stepsBoxEl.appendChild(pill);
        if (ev.agentId === activeAgentId) {
          hermesMessages.scrollTop = hermesMessages.scrollHeight;
        }
      }
    }
    if (ev.agentId === activeAgentId) {
      setJeanState('thinking', ev.label);
    }
  } else if (ev.phase === 'done') {
    const finalState = ev.ok === false ? 'err' : 'done';
    if (task && task.steps.length > 0) {
      const lastStep = task.steps[task.steps.length - 1];
      lastStep.state = finalState;
      if (task.stepsBoxEl && task.stepsBoxEl.isConnected) {
        const items = task.stepsBoxEl.querySelectorAll('.tool-step-pill');
        const lastEl = items[items.length - 1];
        if (lastEl) {
          lastEl.classList.add(finalState);
          lastEl.textContent = `${finalState === 'err' ? '×' : '✓'} ${ev.label}`;
        }
      }
    }
  }
});

// Proactive Message Listener (appends live if agent chat is open)
window.islandAPI.onProactiveMessage((data) => {
  if (!data) return;
  if (data.agentId === activeAgentId && !isAgentBusy(data.agentId)) {
    window.islandAPI.getAgentDetail(activeAgentId).then((r) => {
      if (r && r.ok && r.agent) {
        activeAgentDetail = r.agent;
        renderAgentHistory(activeAgentDetail);
        if (isSessionsDrawerOpen) renderSessionsDrawer();
      }
    }).catch(() => {});
  }
});

// ===== SKILLS UI =====

function renderSkillsList() {
  if (!skillsListContainer) return;
  const isEn = currentLang === 'en';
  const q = (skillSearchInput.value || '').trim().toLowerCase();
  const pinned = new Set((activeAgentDetail && activeAgentDetail.pinnedSkills) || []);
  const filtered = q
    ? allSkills.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
    : allSkills;

  skillsListContainer.innerHTML = '';
  if (filtered.length === 0) {
    skillsListContainer.innerHTML = `<div class="lyrics-empty">${isEn ? 'No matching skills found' : 'Tidak ada skill yang cocok'}</div>`;
    return;
  }

  filtered.slice(0, 60).forEach((sk) => {
    const isPinned = pinned.has(sk.name) || pinned.has(sk.id);
    const card = document.createElement('div');
    card.className = 'hub-card';
    card.innerHTML = `
      <div class="hub-card-top">
        <div class="hub-card-title-wrap">
          <span class="hub-card-title">${escapeHtml(sk.name)}</span>
          <span class="inline-meta-text">· ${escapeHtml(sk.category)}</span>
        </div>
        <div class="studio-btn-group">
          <button type="button" class="mini-btn ${isPinned ? 'success' : ''} btn-pin-skill">${isPinned ? (isEn ? 'Pinned' : 'Dipakai') : 'Pin'}</button>
          <button type="button" class="mini-btn primary btn-run-skill">${isEn ? 'Use' : 'Gunakan'}</button>
        </div>
      </div>
      <div class="hub-card-desc">${escapeHtml(sk.description)}</div>
    `;

    card.querySelector('.btn-pin-skill').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!activeAgentDetail) return;
      const cur = new Set(activeAgentDetail.pinnedSkills || []);
      if (cur.has(sk.name)) cur.delete(sk.name);
      else cur.add(sk.name);
      const res = await window.islandAPI.saveAgent({
        id: activeAgentId,
        name: activeAgentDetail.name,
        pinnedSkills: Array.from(cur)
      });
      if (res && res.ok && res.agent) {
        activeAgentDetail = res.agent;
        renderSkillsList();
      }
    });

    card.querySelector('.btn-run-skill').addEventListener('click', (e) => {
      e.stopPropagation();
      switchSubView('chat');
      hermesInput.value = isEn ? `Use skill "${sk.name}" to: ` : `Gunakan skill "${sk.name}" untuk: `;
      window.islandAPI.focusWindow();
      setTimeout(() => hermesInput.focus(), 20);
    });

    skillsListContainer.appendChild(card);
  });
}

skillSearchInput.addEventListener('input', renderSkillsList);

btnToggleNewSkill.addEventListener('click', (e) => {
  e.stopPropagation();
  newSkillBox.classList.toggle('hidden');
});

btnCreateSkillSave.addEventListener('click', async (e) => {
  e.stopPropagation();
  const name = newSkillName.value.trim();
  if (!name) return;
  const res = await window.islandAPI.createSkill({
    name,
    description: newSkillDesc.value.trim(),
    content: newSkillContent.value.trim()
  });
  if (res && res.ok) {
    allSkills = res.skills || allSkills;
    newSkillName.value = '';
    newSkillDesc.value = '';
    newSkillContent.value = '';
    newSkillBox.classList.add('hidden');
    renderSkillsList();
  }
});

// ===== CONNECTORS / PLUGINS UI =====

const connSearchInput = document.getElementById('connSearchInput');
const connFilterBar = document.getElementById('connFilterBar');
let activeConnectorCategory = 'all';

if (connSearchInput) {
  connSearchInput.addEventListener('input', renderConnectorsList);
}

if (connFilterBar) {
  connFilterBar.querySelectorAll('.conn-filter-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      activeConnectorCategory = tab.dataset.cat || 'all';
      connFilterBar.querySelectorAll('.conn-filter-tab').forEach((t) => t.classList.toggle('active', t === tab));
      renderConnectorsList();
    });
  });
}

const CONNECTOR_EN_DESC_MAP = {
  whatsapp: 'Read incoming chats & send silent WhatsApp messages via WA Desktop or Hermes QR Bridge',
  telegram: '2-Way Laptop Remote Control from phone (terminal, files, screenshots) & automated reports',
  discord: 'Send server alerts via Webhook or read/reply to channels via Bot Token',
  slack: 'Read channel conversations & send team updates via Bot Token or Webhook',
  gmail: 'Read inbox/unread emails & send messages via IMAP/SMTP App Password or Google OAuth',
  google_calendar: 'Monitor daily agenda & meeting reminders via Secret iCal (.ics) or OAuth',
  google_drive: 'Search documents, folders & manage cloud files in Google Drive',
  google_docs: 'Read document contents, summarize reports & draft in Google Docs',
  google_sheets: 'Read spreadsheet tables, analyze data & export CSV/Sheets',
  microsoft_365: 'Sync Outlook calendar (.ics) & Microsoft Graph API emails',
  bsi_mybest: 'Monitor class schedules, attendance & UBSI MyBest assignments automatically',
  notion: 'Search pages, read markdown notes, update databases & create new pages',
  obsidian: 'Search, read & write Markdown notes directly in your local Vault folder',
  linear: 'Search, create & update issues, sprint cycles, and projects in Linear',
  todoist: 'Manage daily to-do lists, due dates & mark tasks complete',
  trello: 'Monitor kanban boards, card lists & create new Trello task cards',
  airtable: 'Read bases, filter table records & insert data rows into Airtable',
  clickup: 'View task lists, workspaces, sprint status & create ClickUp tasks',
  jira: 'Search tickets via JQL, monitor backlog & update Jira issue status',
  atlassian: 'Search team wiki docs, product specs & Confluence pages',
  dropbox: 'Browse local synced Dropbox files or cloud API storage',
  github: 'Access repos, pull requests, issues, Actions & notifications via GitHub CLI / Token',
  gitlab: 'Manage repositories, Merge Requests & GitLab CI/CD pipeline status',
  vercel: 'Monitor production deployments, preview URLs & project build logs',
  supabase: 'Query PostgREST tables, inspect projects, auth & Supabase storage',
  cloudflare: 'Manage DNS domains, Workers, Pages & Cloudflare network status',
  docker: 'Monitor active containers, read service logs, images & local Docker Compose',
  sentry: 'Track crash reports, stack traces & production app issues in real time',
  n8n: 'Trigger automated webhook workflows & manage n8n pipeline executions',
  postman: 'Access API endpoint collections, environments & Postman workspace docs',
  stripe: 'Check account balance, latest payments, customers & Stripe invoice status',
  figma: 'Inspect design files, component layers, comments & local Dev Mode MCP',
  huggingface: 'Search open-source models, datasets, Spaces & call Inference API',
  spotify: 'Control active song playback on laptop & search Spotify tracks/playlists',
  youtube: 'Search videos, fetch channel metadata & summarize YouTube content',
  x_twitter: 'Read public posts from tweet URLs & search trends via X API v2',
  canva: 'Create & manage presentation/social design assets via Canva Connect & MCP',
  web_search: 'Real-time internet search & clean web page extraction to Markdown',
  brave: 'Fast, independent web search index with zero ad trackers',
  homeassistant: 'Check room sensors & control smart home devices directly from your laptop'
};

function localizeConnectorText(text) {
  if (!text || currentLang !== 'en') return text || '';
  return String(text)
    .replace(/Menunggu izin browser\.\.\./gi, 'Waiting for browser auth...')
    .replace(/Belum aktif \(Klik Atur\)/gi, 'Not active (Click Setup)')
    .replace(/Belum diatur/gi, 'Not configured')
    .replace(/WA Desktop Aktif/gi, 'WA Desktop Active')
    .replace(/Hermes WA Aktif/gi, 'Hermes WA Active')
    .replace(/Remote Control Aktif/gi, 'Remote Control Active')
    .replace(/Bot Aktif \(Chat bot utk bind ID\)/gi, 'Bot Active (Chat bot to bind ID)')
    .replace(/Webhook siap/gi, 'Webhook ready')
    .replace(/Bot siap/gi, 'Bot ready')
    .replace(/Workspace siap/gi, 'Workspace ready')
    .replace(/IMAP\/SMTP aktif/gi, 'IMAP/SMTP active')
    .replace(/iCal terhubung/gi, 'iCal connected')
    .replace(/iCal aktif/gi, 'iCal active')
    .replace(/Graph aktif/gi, 'Graph active')
    .replace(/Sheet siap/gi, 'Sheet ready')
    .replace(/State belum ada/gi, 'State not found')
    .replace(/Pilih folder vault/gi, 'Select vault folder')
    .replace(/Board siap/gi, 'Board ready')
    .replace(/PAT aktif/gi, 'PAT active')
    .replace(/REST aktif/gi, 'REST active')
    .replace(/Wiki siap/gi, 'Wiki ready')
    .replace(/Folder lokal siap/gi, 'Local folder ready')
    .replace(/Cloud aktif/gi, 'Cloud active')
    .replace(/gh CLI terhubung/gi, 'gh CLI connected')
    .replace(/Project siap/gi, 'Project ready')
    .replace(/Docker CLI terdeteksi/gi, 'Docker CLI detected')
    .replace(/Docker belum terpasang/gi, 'Docker not installed')
    .replace(/Siap eksekusi/gi, 'Ready to execute')
    .replace(/API v2 aktif/gi, 'API v2 active')
    .replace(/API aktif/gi, 'API active')
    .replace(/Key aktif/gi, 'Key active')
    .replace(/Token aktif/gi, 'Token active')
    .replace(/Publik siap/gi, 'Public ready')
    .replace(/Pencarian aktif/gi, 'Search active')
    .replace(/Reader publik/gi, 'Public reader')
    .replace(/Firecrawl aktif/gi, 'Firecrawl active')
    .replace(/Web siap/gi, 'Web ready')
    .replace(/Smart Home siap/gi, 'Smart Home ready')
    .replace(/Siap \(Tanpa API Key\)/gi, 'Ready (No API Key)')
    .replace(/Terhubung/gi, 'Connected')
    .replace(/Siap digunakan/gi, 'Ready to use')
    .replace(/Butuh Token/gi, 'Needs Token')
    .replace(/Butuh Login OAuth/gi, 'Needs OAuth Login')
    .replace(/Butuh Setup/gi, 'Needs Setup')
    .replace(/Nonaktif/gi, 'Disabled')
    .replace(/Aktif/gi, 'Active');
}

function localizeConnectorFieldLabel(label) {
  if (!label || currentLang !== 'en') return label || '';
  return String(label)
    .replace(/Chat ID Diizinkan \(Kosongkan = auto-bind saat kamu chat bot\)/gi, 'Allowed Chat ID (Leave blank = auto-bind when you message bot)')
    .replace(/Cepat tanpa bot/gi, 'Quick without bot')
    .replace(/Alamat Gmail/gi, 'Gmail Address')
    .replace(/16 karakter/gi, '16 characters')
    .replace(/Kosongkan jika memakai Hermes Google OAuth/gi, 'Leave blank if using Hermes Google OAuth')
    .replace(/Opsional jika Hermes Google aktif/gi, 'Optional if Hermes Google is active')
    .replace(/Lokasi Folder Vault Obsidian \(misal/gi, 'Obsidian Vault Folder Path (e.g.')
    .replace(/misal /gi, 'e.g. ')
    .replace(/Email Akun Atlassian/gi, 'Atlassian Account Email')
    .replace(/Opsional jika aplikasi Dropbox terpasang/gi, 'Optional if Dropbox app is installed')
    .replace(/Opsional jika gh CLI aktif/gi, 'Optional if gh CLI is active')
    .replace(/Untuk trigger cepat/gi, 'For quick triggers')
    .replace(/Opsional, kontrol desktop otomatis jalan/gi, 'Optional, desktop control works automatically')
    .replace(/Opsional untuk search penuh/gi, 'Optional for full search')
    .replace(/Otomatis terbaca dari \.hermes jika ada/gi, 'Auto-detected from .hermes if present')
    .replace(/Opsional/gi, 'Optional');
}

function renderConnectorsList() {
  if (!connectorsListContainer) return;
  connectorsListContainer.innerHTML = '';
  const isEn = currentLang === 'en';
  const allItems = (connectorsState && connectorsState.items) || [];
  const connectedCount = allItems.filter((c) => c.connected).length;

  if (connSearchInput && !connSearchInput.value) {
    connSearchInput.placeholder = isEn
      ? `Search ${allItems.length} official connectors (${connectedCount} ready)...`
      : `Cari dari ${allItems.length} konektor resmi (${connectedCount} siap)...`;
  }

  const q = ((connSearchInput && connSearchInput.value) || '').trim().toLowerCase();
  const items = allItems.filter((c) => {
    if (activeConnectorCategory === 'connected' && !c.connected) return false;
    if (activeConnectorCategory !== 'all' && activeConnectorCategory !== 'connected' && c.category !== activeConnectorCategory) {
      return false;
    }
    if (q) {
      const hay = `${c.name} ${c.id} ${c.desc} ${c.category || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (items.length === 0) {
    connectorsListContainer.innerHTML = `<div class="lyrics-empty">${isEn ? 'No connectors found' : 'Konektor tidak ditemukan'}</div>`;
    return;
  }

  items.forEach((conn) => {
    const card = document.createElement('div');
    card.className = 'conn-row';
    const hasFields = Array.isArray(conn.fields) && conn.fields.length > 0;
    const canConfigure = hasFields || Boolean(conn.hasHermesOAuth) || Boolean(conn.hasWaQuickSetup);
    const statusLabel = localizeConnectorText(conn.statusText || conn.badge || '');
    const descText = (isEn && CONNECTOR_EN_DESC_MAP[conn.id]) ? CONNECTOR_EN_DESC_MAP[conn.id] : conn.desc;

    card.innerHTML = `
      <div class="conn-main">
        <div class="conn-logo-box">
          <img class="conn-logo-img" src="${escapeHtml(conn.icon || 'public/assets/connectors/web_search.svg')}" alt="${escapeHtml(conn.name)}" draggable="false" />
        </div>
        <div class="conn-body">
          <div class="conn-title-line">
            <span class="conn-title">${escapeHtml(conn.name)}</span>
            <span class="conn-meta">
              <span class="conn-dot ${conn.connected ? 'on' : ''}"></span>
              <span>${escapeHtml(statusLabel)}</span>
            </span>
          </div>
          <div class="conn-desc">${escapeHtml(descText)}</div>
        </div>
        <div class="conn-actions">
          ${canConfigure ? `<button type="button" class="mini-btn ghost btn-cfg-conn">${isEn ? 'Setup' : 'Atur'}</button>` : ''}
          <button type="button" class="mini-btn ghost btn-test-conn">${isEn ? 'Test' : 'Tes'}</button>
          <button type="button" class="conn-switch ${conn.enabled ? 'active' : ''} btn-toggle-conn" role="switch" aria-checked="${Boolean(conn.enabled)}" title="${conn.enabled ? (isEn ? 'Disable connector' : 'Nonaktifkan konektor') : (isEn ? 'Enable connector' : 'Aktifkan konektor')}">
            <span class="conn-switch-thumb"></span>
          </button>
        </div>
      </div>
      <div class="studio-status conn-feedback hidden"></div>
      <div class="hub-card-fields hidden"></div>
    `;

    const fieldsBox = card.querySelector('.hub-card-fields');
    const feedbackEl = card.querySelector('.conn-feedback');

    if (canConfigure) {
      if (conn.hasWaQuickSetup) {
        const note = document.createElement('div');
        note.className = 'hub-card-desc';
        note.textContent = isEn
          ? 'Choose WhatsApp connection mode: launch Windows WhatsApp Desktop (silent read/reply) or pair via Hermes Bot Bridge QR.'
          : 'Pilih jalur koneksi WhatsApp: buka aplikasi WhatsApp Desktop Windows (otomatis baca/balas silent) atau tautkan QR Hermes Bot Bridge.';
        fieldsBox.appendChild(note);
      }

      if (hasFields) {
        conn.fields.forEach((f) => {
          const wrap = document.createElement('div');
          wrap.className = 'studio-field';
          wrap.innerHTML = `
            <label>${escapeHtml(localizeConnectorFieldLabel(f.label))}</label>
            <input type="${f.type || 'text'}" data-key="${escapeHtml(f.key)}" class="studio-input compact" value="${escapeHtml(f.value || '')}" autocomplete="off" />
          `;
          fieldsBox.appendChild(wrap);
        });
      }

      const saveRow = document.createElement('div');
      saveRow.className = 'studio-btn-group right';
      saveRow.innerHTML = `
        ${conn.hasWaQuickSetup ? `<button type="button" class="mini-btn btn-wa-open">${isEn ? 'Open WA Desktop' : 'Buka WA Desktop'}</button><button type="button" class="mini-btn primary btn-wa-qr">${isEn ? 'Scan Hermes QR' : 'Scan QR Hermes'}</button>` : ''}
        ${conn.hasHermesOAuth ? `<button type="button" class="mini-btn btn-oauth-conn">${isEn ? 'Browser OAuth Login' : 'Login OAuth Browser'}</button>` : ''}
        ${hasFields ? `<button type="button" class="mini-btn primary btn-save-conn">${isEn ? 'Save' : 'Simpan'}</button>` : ''}
      `;

      const waOpenBtn = saveRow.querySelector('.btn-wa-open');
      if (waOpenBtn) {
        waOpenBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          feedbackEl.classList.remove('hidden');
          feedbackEl.textContent = isEn ? 'Opening WhatsApp Desktop...' : 'Membuka aplikasi WhatsApp Desktop Windows...';
          const r = await window.islandAPI.testConnector('whatsapp', 'open');
          connectorsState = await window.islandAPI.getConnectors();
          renderConnectorsList();
          if (r && r.message) {
            window.islandAPI.focusWindow();
          }
        });
      }

      const waQrBtn = saveRow.querySelector('.btn-wa-qr');
      if (waQrBtn) {
        waQrBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          feedbackEl.classList.remove('hidden');
          feedbackEl.textContent = isEn ? 'Opening Hermes WhatsApp QR Pairing terminal...' : 'Membuka terminal QR Pairing WhatsApp Hermes...';
          const r = await window.islandAPI.testConnector('whatsapp', 'pair_qr');
          feedbackEl.textContent = (r && r.message) || (r && r.error) || (isEn ? 'Check QR terminal.' : 'Cek terminal QR.');
        });
      }

      const oauthBtn = saveRow.querySelector('.btn-oauth-conn');
      if (oauthBtn) {
        oauthBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          feedbackEl.classList.remove('hidden');
          oauthBtn.disabled = true;
          const prevLabel = oauthBtn.textContent;
          oauthBtn.textContent = isEn ? 'Opening Browser...' : 'Membuka Browser...';
          feedbackEl.textContent = isEn
            ? `Preparing ${conn.name} OAuth link & opening browser...`
            : `Menyiapkan link OAuth ${conn.name} & membuka browser...`;
          try {
            const r = await window.islandAPI.testConnector(conn.id, 'oauth');
            feedbackEl.textContent = (r && (r.message || r.error)) || (isEn ? 'Check login tab in browser.' : 'Cek tab login di browser.');
          } catch (err) {
            feedbackEl.textContent = `${isEn ? 'Failed to open OAuth' : 'Gagal membuka OAuth'}: ${err.message}`;
          } finally {
            oauthBtn.disabled = false;
            oauthBtn.textContent = prevLabel;
          }
        });
      }

      const saveBtn = saveRow.querySelector('.btn-save-conn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const patch = { enabled: true };
          fieldsBox.querySelectorAll('input[data-key]').forEach((inp) => {
            patch[inp.dataset.key] = inp.value.trim();
          });
          connectorsState = await window.islandAPI.updateConnector(conn.id, patch);
          renderConnectorsList();
        });
      }

      fieldsBox.appendChild(saveRow);

      card.querySelector('.btn-cfg-conn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        fieldsBox.classList.toggle('hidden');
      });
    }

    card.querySelector('.btn-toggle-conn').addEventListener('click', async (ev) => {
      ev.stopPropagation();
      connectorsState = await window.islandAPI.updateConnector(conn.id, { enabled: !conn.enabled });
      renderConnectorsList();
    });

    card.querySelector('.btn-test-conn').addEventListener('click', async (ev) => {
      ev.stopPropagation();
      feedbackEl.classList.remove('hidden');
      feedbackEl.textContent = isEn ? 'Testing connection...' : 'Mengetes koneksi...';
      const res = await window.islandAPI.testConnector(conn.id);
      if (res && res.ok) {
        const extra = res.summary
          ? res.summary
          : res.chats
          ? (isEn ? `(${res.chats.length} chats read)` : `(${res.chats.length} chat terbaca)`)
          : res.events
          ? (isEn ? `(${res.events.length} events)` : `(${res.events.length} jadwal)`)
          : res.videos
          ? `(${res.videos.length} video)`
          : res.toolCount
          ? (isEn ? `OAuth active (${res.toolCount} MCP tools ready)` : `OAuth aktif (${res.toolCount} tool MCP siap)`)
          : (isEn ? 'Connector ready' : 'Konektor siap digunakan');
        feedbackEl.textContent = res.summary ? extra : `${isEn ? 'Connected' : 'Terhubung'} · ${extra}`;
      } else {
        feedbackEl.textContent = (res && res.error) || (isEn ? 'Check configuration' : 'Periksa konfigurasi');
      }
    });

    connectorsListContainer.appendChild(card);
  });
}

// ===== CRONJOBS & PROACTIVE AUTOMATION UI =====

const cronScopeBar = document.getElementById('cronScopeBar');
const cronTabCurrentAgent = document.getElementById('cronTabCurrentAgent');
const cronTabAllAgents = document.getElementById('cronTabAllAgents');
let activeCronScope = 'agent';

if (cronScopeBar) {
  cronScopeBar.querySelectorAll('.conn-filter-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      activeCronScope = tab.dataset.scope || 'agent';
      cronScopeBar.querySelectorAll('.conn-filter-tab').forEach((t) => t.classList.toggle('active', t === tab));
      renderCronList();
    });
  });
}

function renderCronList() {
  if (!cronListContainer) return;
  cronListContainer.innerHTML = '';
  const isEn = currentLang === 'en';
  const locale = isEn ? 'en-US' : 'id-ID';

  const totalList = Array.isArray(allCronjobs) ? allCronjobs : [];
  const agentList = totalList.filter((j) => j.agentId === activeAgentId);

  if (cronTabCurrentAgent) {
    cronTabCurrentAgent.textContent = isEn
      ? `${currentAiName}'s (${agentList.length})`
      : `Milik ${currentAiName} (${agentList.length})`;
  }
  if (cronTabAllAgents) {
    cronTabAllAgents.textContent = isEn
      ? `All Agents (${totalList.length})`
      : `Semua Agent (${totalList.length})`;
  }

  const visibleJobs = activeCronScope === 'all' ? totalList : agentList;

  if (visibleJobs.length === 0) {
    const otherCount = totalList.length - agentList.length;
    const msg = activeCronScope === 'agent'
      ? (isEn
          ? `No cronjobs for ${escapeHtml(currentAiName)} yet.${otherCount > 0 ? `<br><span style="opacity:0.72">(${otherCount} schedule(s) owned by other agents run independently — check "All Agents")</span>` : ''}`
          : `Belum ada jadwal cronjob milik ${escapeHtml(currentAiName)}.${otherCount > 0 ? `<br><span style="opacity:0.72">(${otherCount} jadwal milik agent lain tetap jalan sendiri tanpa bentrok — cek tab "Semua Agent")</span>` : ''}`)
      : (isEn
          ? 'No cronjob schedules yet. Click "+ New Schedule" or ask your Agent to create one.'
          : 'Belum ada jadwal cronjob. Klik "+ Buat Jadwal" atau minta Agent membuatkan jadwal.');
    cronListContainer.innerHTML = `<div class="lyrics-empty">${msg}</div>`;
    return;
  }

  visibleJobs.forEach((job) => {
    const ag = allAgents.find((a) => a.id === job.agentId);
    const agName = ag ? ag.name : job.agentId;
    const card = document.createElement('div');
    card.className = 'hub-card';
    const lastInfo = job.lastRunAt
      ? `${isEn ? 'Last run' : 'Terakhir'}: ${new Date(job.lastRunAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} (${job.lastStatus})`
      : (isEn ? 'Never executed yet' : 'Belum pernah dijalankan');
    const cleanLastResult = job.lastResult ? cleanMarkdown(job.lastResult).replace(/\s+/g, ' ').trim().slice(0, 95) : '';

    card.innerHTML = `
      <div class="hub-card-top">
        <div class="hub-card-title-wrap">
          <span class="hub-card-title">${escapeHtml(job.name)}</span>
          <span class="inline-meta-text">· ${escapeHtml(job.schedule)} · ${isEn ? 'Agent' : 'Pelaksana'}: ${escapeHtml(agName)}</span>
        </div>
        <div class="studio-btn-group">
          <button type="button" class="mini-btn ghost btn-run-cron" title="${isEn ? 'Run Now' : 'Jalankan Sekarang'}">${isEn ? 'Run' : 'Jalankan'}</button>
          <button type="button" class="mini-btn danger btn-del-cron" title="${isEn ? 'Delete Cronjob' : 'Hapus Cronjob'}">${isEn ? 'Delete' : 'Hapus'}</button>
          <button type="button" class="conn-switch ${job.enabled ? 'active' : ''} btn-toggle-cron" role="switch" aria-checked="${Boolean(job.enabled)}" title="${job.enabled ? (isEn ? 'Disable' : 'Nonaktifkan') : (isEn ? 'Enable' : 'Aktifkan')}">
            <span class="conn-switch-thumb"></span>
          </button>
        </div>
      </div>
      <div class="hub-card-desc">${escapeHtml(job.prompt)}</div>
      <div class="hub-card-desc" style="opacity:0.65">${escapeHtml(lastInfo)}${cleanLastResult ? ` — ${escapeHtml(cleanLastResult)}` : ''}</div>
    `;

    card.querySelector('.btn-toggle-cron').addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await window.islandAPI.toggleCron(job.id, !job.enabled);
      if (res && res.jobs) {
        allCronjobs = res.jobs;
        renderCronList();
      }
    });

    card.querySelector('.btn-del-cron').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await askIslandConfirm({
        title: isEn ? 'Delete cronjob schedule?' : 'Hapus jadwal cronjob?',
        desc: isEn
          ? `Schedule "${job.name}" (agent: ${agName}) will be permanently deleted.`
          : `Jadwal "${job.name}" (pelaksana: ${agName}) akan dihapus permanen.`,
        okText: isEn ? 'Delete' : 'Hapus'
      });
      if (!confirmed) return;
      const res = await window.islandAPI.deleteCron(job.id);
      if (res && res.jobs) {
        allCronjobs = res.jobs;
        renderCronList();
      }
    });

    card.querySelector('.btn-run-cron').addEventListener('click', async (e) => {
      e.stopPropagation();
      e.target.textContent = isEn ? 'Running...' : 'Jalan...';
      const res = await window.islandAPI.runCronNow(job.id);
      if (res && res.jobs) allCronjobs = res.jobs;
      renderCronList();
    });

    cronListContainer.appendChild(card);
  });
}

btnToggleNewCron.addEventListener('click', (e) => {
  e.stopPropagation();
  newCronBox.classList.toggle('hidden');
});

btnSaveNewCron.addEventListener('click', async (e) => {
  e.stopPropagation();
  const name = newCronName.value.trim() || 'Jadwal Otomatis';
  const schedule = newCronSchedule.value.trim() || 'every 30m';
  const prompt = newCronPrompt.value.trim();
  if (!prompt) return;

  const res = await window.islandAPI.createCron({
    name,
    schedule,
    prompt,
    agentId: newCronAgent.value || activeAgentId,
    enabled: true
  });
  if (res && res.ok) {
    allCronjobs = res.jobs || [];
    newCronName.value = '';
    newCronPrompt.value = '';
    newCronBox.classList.add('hidden');
    renderCronList();
  }
});

btnProactiveToggle.addEventListener('click', async (e) => {
  e.stopPropagation();
  const next = !btnProactiveToggle.classList.contains('active');
  btnProactiveToggle.classList.toggle('active', next);
  btnProactiveToggle.setAttribute('aria-checked', String(next));
  await window.islandAPI.toggleProactive(next);
});

window.islandAPI.onCronUpdated((data) => {
  if (data && Array.isArray(data.jobs)) {
    allCronjobs = data.jobs;
    renderCronList();
  }
});

if (window.islandAPI.onConnectorsUpdated) {
  window.islandAPI.onConnectorsUpdated((freshState) => {
    if (freshState && Array.isArray(freshState.items)) {
      connectorsState = freshState;
      renderConnectorsList();
    }
  });
}

// ===== MUSE AI ACTIVITY LOG FEED & SPLIT INSPECTOR MODAL =====

function formatMuseTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function formatMuseFullTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDurationHuman(ms) {
  const n = Number(ms || 0);
  if (!n || n <= 0) return '-';
  if (n < 1000) return `${n}ms`;
  const sec = (n / 1000).toFixed(1);
  return `${sec}s`;
}

function getActivityDateGroupLabel(isoStr) {
  const isEn = currentLang === 'en';
  const locale = isEn ? 'en-US' : 'id-ID';
  if (!isoStr) return isEn ? 'Today' : 'Hari ini';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isEn ? 'Today' : 'Hari ini';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((todayStart - itemStart) / 86400000);
  if (diffDays <= 0) return isEn ? 'Today' : 'Hari ini';
  if (diffDays === 1) return isEn ? 'Yesterday' : 'Kemarin';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function getActivityStatusIconSvg(status, size = 15) {
  if (status === 'running') {
    return `<svg class="muse-act-spin" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
  }
  if (status === 'error' || status === 'err') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
}

async function refreshAllActivities() {
  if (!window.islandAPI.listActivities) return;
  try {
    const res = await window.islandAPI.listActivities({ scope: 'all' });
    if (res && Array.isArray(res.activities)) {
      allActivities = res.activities;
      renderActivityLogList();
      if (inspectedActivity) {
        const updated = allActivities.find((a) => a.id === inspectedActivity.id);
        if (updated) {
          inspectedActivity = updated;
          renderActivityDetailModalContent();
        }
      }
    }
  } catch (_e) {}
}

function renderActivityLogList() {
  if (!activityListContainer) return;
  const isEn = currentLang === 'en';
  const totalList = Array.isArray(allActivities) ? allActivities : [];
  const agentList = totalList.filter((a) => a.agentId === activeAgentId);

  if (actTabCurrentAgent) {
    actTabCurrentAgent.textContent = isEn
      ? `${currentAiName}'s (${agentList.length})`
      : `Milik ${currentAiName} (${agentList.length})`;
  }
  if (actTabAllAgents) {
    actTabAllAgents.textContent = isEn
      ? `All Agents (${totalList.length})`
      : `Semua Agent (${totalList.length})`;
  }

  const q = ((activitySearchInput && activitySearchInput.value) || '').trim().toLowerCase();
  const baseItems = activeActivityScope === 'all' ? totalList : agentList;
  const filtered = q
    ? baseItems.filter((a) => {
        const stepHay = (a.steps || []).map((s) => `${s.label || ''} ${s.tool || ''}`).join(' ');
        const hay = `${a.title || ''} ${a.subtitle || ''} ${a.prompt || ''} ${a.summary || ''} ${a.agentName || ''} ${stepHay}`.toLowerCase();
        return hay.includes(q);
      })
    : baseItems;

  activityListContainer.innerHTML = '';
  if (filtered.length === 0) {
    const emptyMsg = q
      ? (isEn ? 'No activity logs match your search.' : 'Tidak ada log aktivitas yang cocok dengan pencarian.')
      : activeActivityScope === 'agent'
      ? (isEn
          ? `No activity logs for ${escapeHtml(currentAiName)} yet. Send a command in Chat to start logging.`
          : `Belum ada log aktivitas untuk ${escapeHtml(currentAiName)}. Berikan perintah di Chat untuk mulai mencatat aktivitas.`)
      : (isEn ? 'No activity logs from any agent yet.' : 'Belum ada log aktivitas dari semua agent.');
    activityListContainer.innerHTML = `<div class="lyrics-empty">${emptyMsg}</div>`;
    return;
  }

  // Group by date header ('Hari ini'/'Today', 'Kemarin'/'Yesterday', or date string)
  const groups = [];
  const groupMap = new Map();
  filtered.forEach((act) => {
    const label = getActivityDateGroupLabel(act.startedAt || act.completedAt);
    if (!groupMap.has(label)) {
      const grp = { label, items: [] };
      groupMap.set(label, grp);
      groups.push(grp);
    }
    groupMap.get(label).items.push(act);
  });

  groups.forEach((grp) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'muse-act-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'muse-act-group-title';
    titleEl.textContent = grp.label;
    groupEl.appendChild(titleEl);

    grp.items.forEach((act) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'muse-act-item';
      const stepCount = Array.isArray(act.steps) ? act.steps.length : 0;
      const agObj = allAgents.find((ag) => ag.id === act.agentId);
      const agName = act.agentName || (agObj ? agObj.name : act.agentId);
      const sourceLabel = act.source === 'cron'
        ? ' · Cronjob'
        : act.source === 'proactive'
        ? (isEn ? ' · Proactive' : ' · Proaktif')
        : act.source === 'telegram'
        ? ' · Telegram'
        : '';
      const showAgentTag = activeActivityScope === 'all' || Boolean(sourceLabel);
      const tagText = activeActivityScope === 'all'
        ? `${agName}${sourceLabel}`
        : sourceLabel.replace(/^ · /, '');

      itemEl.innerHTML = `
        <div class="muse-act-icon-box ${act.status === 'error' ? 'error' : ''}">
          ${getActivityStatusIconSvg(act.status, 15)}
        </div>
        <div class="muse-act-body">
          <div class="muse-act-title-row">
            <span class="muse-act-title">${escapeHtml(act.title || (isEn ? 'Agent Task Execution' : 'Eksekusi Tugas Agent'))}</span>
            ${showAgentTag && tagText ? `<span class="muse-act-agent-tag">· ${escapeHtml(tagText)}</span>` : ''}
          </div>
          <div class="muse-act-sub">${escapeHtml(act.subtitle || act.summary || (isEn ? 'Completed.' : 'Selesai dieksekusi.'))}</div>
        </div>
        <div class="muse-act-right">
          <span class="muse-act-time">${escapeHtml(formatMuseTime(act.startedAt || act.completedAt))}</span>
          <span class="muse-act-step-count">${stepCount > 0 ? (isEn ? `${stepCount} steps` : `${stepCount} langkah`) : (isEn ? 'Direct' : 'Langsung')}</span>
        </div>
      `;

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openActivityDetailModal(act);
      });

      groupEl.appendChild(itemEl);
    });

    activityListContainer.appendChild(groupEl);
  });
}

async function openActivityByIdOrFallback(activityId, fallbackData = {}) {
  if (activityId) {
    let found = allActivities.find((a) => a.id === activityId);
    if (!found && window.islandAPI.listActivities) {
      const res = await window.islandAPI.listActivities({ scope: 'all' });
      if (res && Array.isArray(res.activities)) {
        allActivities = res.activities;
        found = allActivities.find((a) => a.id === activityId);
      }
    }
    if (found) {
      openActivityDetailModal(found);
      return;
    }
  }

  // Fallback Match by timestamp or build ad-hoc inspector object from bubble data
  const tools = Array.isArray(fallbackData.toolsUsed) ? fallbackData.toolsUsed : [];
  const nowIso = fallbackData.at || new Date().toISOString();
  const adhocAct = {
    id: activityId || `adhoc-${Date.now()}`,
    agentId: fallbackData.agentId || activeAgentId,
    agentName: currentAiName,
    source: 'chat',
    title: fallbackData.prompt
      ? String(fallbackData.prompt).slice(0, 56)
      : (tools[0] && tools[0].label) || 'Detail Eksekusi Perintah',
    subtitle: String(fallbackData.text || '').slice(0, 100),
    prompt: fallbackData.prompt || '(Perintah dari sesi chat)',
    status: 'completed',
    startedAt: nowIso,
    completedAt: nowIso,
    durationMs: tools.reduce((acc, t) => acc + (Number(t.durationMs) || 240), 0) || 450,
    steps: tools.map((t, idx) => ({
      id: `adhoc-step-${idx + 1}`,
      tool: t.tool || 'tool',
      label: t.label || t.tool || `Langkah #${idx + 1}`,
      detailTitle: t.label || t.tool || `Langkah #${idx + 1}`,
      status: t.ok === false ? 'error' : 'done',
      argsPreview: t.argsPreview || `Tool: ${t.tool || 'eksekusi'}\nLangkah: ${t.label || ''}`,
      outputPreview: t.outputPreview || (t.ok === false ? 'Eksekusi gagal.' : `Langkah "${t.label || t.tool}" selesai dijalankan.`),
      durationMs: t.durationMs || 0,
      at: nowIso
    })),
    summary: String(fallbackData.text || 'Selesai.')
  };
  openActivityDetailModal(adhocAct);
}

function openActivityDetailModal(act) {
  if (!act || !activityDetailModal) return;
  inspectedActivity = act;
  if (act.status === 'running' && Array.isArray(act.steps) && act.steps.length > 0) {
    inspectedNodeKey = act.steps[act.steps.length - 1].id;
  } else {
    inspectedNodeKey = 'summary';
  }
  island.classList.add('activity-detail-open');
  activityDetailModal.classList.remove('hidden');
  renderActivityDetailModalContent();
}

function closeActivityDetailModal() {
  if (!activityDetailModal) return;
  activityDetailModal.classList.add('hidden');
  island.classList.remove('activity-detail-open');
  inspectedActivity = null;
}

function renderActivityDetailModalContent() {
  if (!inspectedActivity || !actTimelineList || !actDetailPane) return;
  const isEn = currentLang === 'en';
  const act = inspectedActivity;
  const agObj = allAgents.find((a) => a.id === act.agentId);
  const agName = act.agentName || (agObj ? agObj.name : act.agentId || currentAiName);

  // Header status badge + title + meta
  const statusLabel = act.status === 'running'
    ? (isEn ? 'Running' : 'Berjalan')
    : act.status === 'error'
    ? (isEn ? 'Failed' : 'Gagal')
    : (isEn ? 'Completed' : 'Selesai');
  if (actModalStatusText) actModalStatusText.textContent = statusLabel;
  if (actModalStatusDot) {
    actModalStatusDot.className = `act-modal-status-dot ${act.status === 'running' ? 'running' : act.status === 'error' ? 'error' : ''}`;
  }
  if (actModalTitle) actModalTitle.textContent = act.title || (isEn ? 'Activity Details' : 'Detail Aktivitas');
  const sourceHuman = act.source === 'cron'
    ? 'Cronjob'
    : act.source === 'proactive'
    ? (isEn ? 'Proactive' : 'Proaktif')
    : act.source === 'telegram'
    ? 'Telegram Remote'
    : 'Chat';
  const durHuman = formatDurationHuman(act.durationMs);
  if (actModalMeta) {
    actModalMeta.textContent = `${agName} · ${sourceHuman} · ${getActivityDateGroupLabel(act.startedAt)} ${formatMuseTime(act.startedAt)}${durHuman !== '-' ? ` · ${durHuman}` : ''}`;
  }

  // Build Timeline Nodes: 1) Dimulai/Started -> 2..N) Tool Steps -> Final) Selesai / Ringkasan
  const steps = Array.isArray(act.steps) ? act.steps : [];
  const timelineNodes = [
    {
      key: 'start',
      type: 'start',
      label: isEn ? 'Started' : 'Dimulai',
      sub: formatMuseTime(act.startedAt),
      status: 'start'
    },
    ...steps.map((s, idx) => ({
      key: s.id || `step-${idx + 1}`,
      type: 'step',
      stepIndex: idx + 1,
      stepObj: s,
      label: s.label || s.tool || (isEn ? `Step ${idx + 1}` : `Langkah ${idx + 1}`),
      sub: s.durationMs ? `${s.durationMs}ms` : (s.tool || 'tool'),
      status: s.status === 'error' ? 'error' : s.status === 'running' ? 'running' : 'done'
    })),
    {
      key: 'summary',
      type: 'summary',
      label: act.status === 'running'
        ? (isEn ? 'Running...' : 'Sedang berjalan...')
        : act.status === 'error'
        ? (isEn ? 'Stopped / Failed' : 'Terhenti / Gagal')
        : (isEn ? 'Completed' : 'Selesai'),
      sub: act.completedAt ? formatMuseTime(act.completedAt) : (isEn ? 'Result summary' : 'Ringkasan hasil'),
      status: act.status === 'running' ? 'running' : act.status === 'error' ? 'error' : 'done'
    }
  ];

  if (!timelineNodes.some((n) => n.key === inspectedNodeKey)) {
    inspectedNodeKey = 'summary';
  }

  actTimelineList.innerHTML = '';
  timelineNodes.forEach((node) => {
    const row = document.createElement('div');
    row.className = `act-tl-item${node.key === inspectedNodeKey ? ' active' : ''}`;
    const nodeIconHtml = node.type === 'start'
      ? '<span class="act-tl-node-dot"></span>'
      : getActivityStatusIconSvg(node.status, 9.5);

    row.innerHTML = `
      <div class="act-tl-rail">
        <div class="act-tl-line-top"></div>
        <div class="act-tl-node">${nodeIconHtml}</div>
        <div class="act-tl-line-bottom"></div>
      </div>
      <div class="act-tl-content">
        <div class="act-tl-label">${escapeHtml(node.label)}</div>
        <div class="act-tl-sub">${escapeHtml(node.sub || '')}</div>
      </div>
    `;

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      inspectedNodeKey = node.key;
      renderActivityDetailModalContent();
    });

    actTimelineList.appendChild(row);
  });

  // Render Right Column Inspector based on selected timeline node
  const selectedNode = timelineNodes.find((n) => n.key === inspectedNodeKey) || timelineNodes[timelineNodes.length - 1];
  actDetailPane.innerHTML = '';

  if (selectedNode.type === 'step' && selectedNode.stepObj) {
    const st = selectedNode.stepObj;
    const stStatusLabel = st.status === 'error'
      ? (isEn ? 'Failed' : 'Gagal')
      : st.status === 'running'
      ? (isEn ? 'Running' : 'Sedang Berjalan')
      : (isEn ? 'Success' : 'Berhasil');
    actDetailPane.innerHTML = `
      <div class="act-detail-head">
        <div class="act-detail-heading">${escapeHtml(st.detailTitle || st.label || st.tool)}</div>
        <div class="act-detail-badges">
          <span class="act-detail-meta-pill">${isEn ? 'Step' : 'Langkah'} #${selectedNode.stepIndex}</span>
          <span class="act-detail-meta-pill">Tool: ${escapeHtml(st.tool || 'internal')}</span>
          <span class="act-detail-meta-pill">Status: ${escapeHtml(stStatusLabel)}</span>
          ${st.durationMs ? `<span class="act-detail-meta-pill">${isEn ? 'Duration' : 'Durasi'}: ${escapeHtml(formatDurationHuman(st.durationMs))}</span>` : ''}
        </div>
      </div>

      <div class="act-detail-section">
        <div class="act-detail-section-label">${isEn ? 'Parameters / Input' : 'Parameter / Input'}</div>
        <div class="act-code-box">${escapeHtml(st.argsPreview || `Tool: ${st.tool || '-'}`)}</div>
      </div>

      <div class="act-detail-section">
        <div class="act-detail-section-label">${isEn ? 'Output / Execution Result' : 'Output / Hasil Eksekusi'}</div>
        <div class="act-code-box">${escapeHtml(st.outputPreview || (isEn ? 'No detailed output.' : 'Tidak ada output detail.'))}</div>
      </div>
    `;
    return;
  }

  if (selectedNode.type === 'start') {
    actDetailPane.innerHTML = `
      <div class="act-detail-head">
        <div class="act-detail-heading">${isEn ? 'Initial Instruction (Started)' : 'Instruksi Awal (Dimulai)'}</div>
        <div class="act-detail-badges">
          <span class="act-detail-meta-pill">Agent: ${escapeHtml(agName)}</span>
          <span class="act-detail-meta-pill">${isEn ? 'Source' : 'Sumber'}: ${escapeHtml(sourceHuman)}</span>
          <span class="act-detail-meta-pill">${escapeHtml(formatMuseFullTime(act.startedAt))}</span>
        </div>
      </div>

      <div class="act-detail-section">
        <div class="act-detail-section-label">${isEn ? 'Prompt / Task Trigger' : 'Prompt / Pemicu Tugas'}</div>
        <div class="act-code-box">${escapeHtml(act.prompt || act.title || '-')}</div>
      </div>

      <div class="act-detail-section">
        <div class="act-detail-section-label">${isEn ? 'Total Steps' : 'Total Langkah'}</div>
        <div class="act-detail-summary">${steps.length > 0 ? (isEn ? `${steps.length} tool steps executed by ${escapeHtml(agName)}. Click any step on the left timeline to inspect its input and output.` : `${steps.length} langkah tool dieksekusi oleh ${escapeHtml(agName)}. Klik salah satu langkah di timeline kiri untuk melihat input dan output detailnya.`) : (isEn ? 'Answered directly by the agent without external tool calls.' : 'Dijawab langsung oleh agent tanpa pemanggilan tool eksternal.')}</div>
      </div>
    `;
    return;
  }

  // Default: 'summary' (Ringkasan)
  const cleanSum = cleanMarkdown(act.summary || act.subtitle || (isEn ? 'Task completed.' : 'Tugas selesai dijalankan.'));
  actDetailPane.innerHTML = `
    <div class="act-detail-head">
      <div class="act-detail-heading">${isEn ? 'Summary' : 'Ringkasan'}</div>
      <div class="act-detail-badges">
        <span class="act-detail-meta-pill">Agent: ${escapeHtml(agName)}</span>
        <span class="act-detail-meta-pill">${steps.length} ${isEn ? 'tool steps' : 'langkah tool'}</span>
        ${durHuman !== '-' ? `<span class="act-detail-meta-pill">Total: ${escapeHtml(durHuman)}</span>` : ''}
      </div>
    </div>

    <div class="act-detail-summary">${escapeHtml(cleanSum)}</div>

    ${act.prompt ? `
      <div class="act-detail-section">
        <div class="act-detail-section-label">${isEn ? 'Initial Prompt' : 'Perintah Awal'}</div>
        <div class="act-code-box">${escapeHtml(act.prompt)}</div>
      </div>
    ` : ''}
  `;
}

if (activityScopeBar) {
  activityScopeBar.querySelectorAll('.conn-filter-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      activeActivityScope = tab.dataset.scope || 'agent';
      activityScopeBar.querySelectorAll('.conn-filter-tab').forEach((t) => t.classList.toggle('active', t === tab));
      renderActivityLogList();
    });
  });
}

if (activitySearchInput) {
  activitySearchInput.addEventListener('input', () => {
    renderActivityLogList();
  });
}

if (btnClearActivities) {
  btnClearActivities.addEventListener('click', async (e) => {
    e.stopPropagation();
    const agentActs = allActivities.filter((a) => a.agentId === activeAgentId);
    if (agentActs.length === 0) return;
    const confirmed = await askIslandConfirm({
      title: `Bersihkan log aktivitas ${currentAiName}?`,
      desc: `Semua catatan log aktivitas milik ${currentAiName} akan dikosongkan. Riwayat chat dan memori agent tetap aman.`,
      okText: 'Bersihkan'
    });
    if (!confirmed) return;
    await window.islandAPI.clearActivities(activeAgentId);
    await refreshAllActivities();
  });
}

if (btnCloseActModal) {
  btnCloseActModal.addEventListener('click', (e) => {
    e.stopPropagation();
    closeActivityDetailModal();
  });
}

if (activityDetailModal) {
  activityDetailModal.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target === activityDetailModal) {
      closeActivityDetailModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && inspectedActivity && !pendingConfirmResolver) {
    e.stopPropagation();
    closeActivityDetailModal();
  }
});

if (window.islandAPI.onActivityUpdated) {
  window.islandAPI.onActivityUpdated((payload) => {
    if (!payload) return;
    if (payload.activity) {
      const agObj = allAgents.find((a) => a.id === payload.agentId);
      const enriched = {
        ...payload.activity,
        agentName: payload.activity.agentName || (agObj ? agObj.name : payload.agentId),
        agentAvatar: payload.activity.agentAvatar || (agObj ? agObj.avatar : 'hancow')
      };
      const idx = allActivities.findIndex((a) => a.id === enriched.id);
      if (idx !== -1) {
        allActivities[idx] = enriched;
      } else {
        allActivities.unshift(enriched);
      }
      renderActivityLogList();
      if (inspectedActivity && inspectedActivity.id === enriched.id) {
        inspectedActivity = enriched;
        renderActivityDetailModalContent();
      }
    } else {
      refreshAllActivities();
    }
  });
}

// ===== SEGMENTED NAVIGATION & LAUNCH BANNER =====
const segIndicator = document.getElementById('segIndicator');

function moveSegIndicator() {
  const active = document.querySelector('.mode-dot.active');
  if (!active) return;
  segIndicator.style.left = `${active.offsetLeft}px`;
  segIndicator.style.width = `${active.offsetWidth}px`;
}

function switchTab(targetId) {
  if (targetId !== 'tab-hermes' && inspectedActivity) {
    closeActivityDetailModal();
  }
  modeDots.forEach((d) => {
    d.classList.toggle('active', d.getAttribute('data-target') === targetId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === targetId);
  });
  moveSegIndicator();
  updateJeanAvatarVisibility();

  island.classList.toggle('hermes-mode', targetId === 'tab-hermes');
  island.classList.toggle('system-mode', targetId === 'tab-system');
  island.classList.toggle('hub-mode', targetId === 'tab-hub');
  island.classList.toggle('settings-mode', targetId === 'tab-settings');
  island.classList.toggle('lyrics-open', targetId === 'tab-media' && isLyricsOpen);
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();

  if (targetId === 'tab-hermes') {
    window.islandAPI.focusWindow();
    if (document.getElementById('subview-chat').classList.contains('active')) {
      setTimeout(() => hermesInput.focus(), 60);
    }
  }
}

modeDots.forEach((dot) => {
  dot.addEventListener('click', (e) => {
    e.stopPropagation();
    switchTab(dot.getAttribute('data-target'));
  });
});

function openFromBanner(targetId) {
  hideBanner();
  isExpanded = true;
  window.islandAPI.setMousePassthrough(false);
  setIslandState('expanded');
  switchTab(targetId);
}

document.getElementById('bannerMusicBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  openFromBanner('tab-media');
});

document.getElementById('bannerAskBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  openFromBanner('tab-hermes');
});

document.getElementById('bannerContent').addEventListener('click', () => {
  openFromBanner('tab-hermes');
});

function playLaunchAnimation() {
  setTimeout(() => island.classList.remove('boot'), 120);
  setTimeout(() => {
    isBanner = true;
    setIslandState('banner');
  }, 700);
  bannerTimer = setTimeout(() => {
    if (!isBanner) return;
    hideBanner();
    if (!isExpanded) {
      setIslandState('collapsed');
      window.islandAPI.setMousePassthrough(true);
    }
  }, 4500);
}

// ===== SETTINGS: THEME, AUTO-START & AI GATEWAY CONFIGURATION =====

function applyThemeUI(theme, autoStart) {
  currentTheme = theme === 'notch' ? 'notch' : 'island';
  document.body.classList.toggle('theme-notch', currentTheme === 'notch');
  if (themeCardIsland) themeCardIsland.classList.toggle('active', currentTheme === 'island');
  if (themeCardNotch) themeCardNotch.classList.toggle('active', currentTheme === 'notch');
  if (typeof autoStart === 'boolean' && btnAutoStart) {
    btnAutoStart.classList.toggle('active', autoStart);
    btnAutoStart.setAttribute('aria-checked', String(autoStart));
  }
  syncLyricsState();
  updateCollapsedNotchLyricUI();
}

function applyGatewayUI(gw) {
  if (!gw) return;
  gwProviderSelect.value = gw.provider || '9router';
  gwBaseUrlInput.value = gw.baseUrl || 'http://127.0.0.1:20128/v1';
  gwApiKeyInput.value = gw.apiKey || '';
  gwModelInput.value = gw.model || 'claude-fable-5';
  currentModelName = gw.model || 'claude-fable-5';
  gwStatusBadge.textContent = `${gw.provider || '9router'} · ${currentModelName}`;
  syncActiveAgentBusyUI();
}

gwProviderSelect.addEventListener('change', () => {
  const p = gwProviderSelect.value;
  if (GATEWAY_PRESET_URLS[p]) {
    gwBaseUrlInput.value = GATEWAY_PRESET_URLS[p].baseUrl;
    gwModelInput.value = GATEWAY_PRESET_URLS[p].model;
  }
});

btnToggleGwKey.addEventListener('click', (e) => {
  e.stopPropagation();
  const isPwd = gwApiKeyInput.type === 'password';
  gwApiKeyInput.type = isPwd ? 'text' : 'password';
  btnToggleGwKey.textContent = isPwd ? 'Tutup' : 'Lihat';
});

btnFetchModels.addEventListener('click', async (e) => {
  e.stopPropagation();
  gwTestResultText.textContent = 'Memuat daftar model...';
  const res = await window.islandAPI.fetchGatewayModels({
    provider: gwProviderSelect.value,
    baseUrl: gwBaseUrlInput.value.trim(),
    apiKey: gwApiKeyInput.value.trim()
  });
  if (res && res.ok && Array.isArray(res.models) && res.models.length > 0) {
    gwModelDatalist.innerHTML = res.models.map((m) => `<option value="${escapeHtml(m)}"></option>`).join('');
    if (!gwModelInput.value.trim()) gwModelInput.value = res.models[0];
    gwTestResultText.textContent = `${res.models.length} model tersedia (klik kolom Model)`;
  } else {
    gwTestResultText.textContent = (res && res.error) || 'Model tidak ditemukan, ketik manual';
  }
});

btnTestGateway.addEventListener('click', async (e) => {
  e.stopPropagation();
  gwTestResultText.textContent = 'Mengetes gateway...';
  const res = await window.islandAPI.testGateway({
    provider: gwProviderSelect.value,
    baseUrl: gwBaseUrlInput.value.trim(),
    apiKey: gwApiKeyInput.value.trim(),
    model: gwModelInput.value.trim()
  });
  if (res && res.ok) {
    gwTestResultText.textContent = `Terhubung (${res.latencyMs}ms · ${res.model})`;
  } else {
    gwTestResultText.textContent = `Gagal: ${(res && res.error) || 'cek URL/Key'}`;
  }
});

btnSaveGateway.addEventListener('click', async (e) => {
  e.stopPropagation();
  const saved = await window.islandAPI.setGateway({
    provider: gwProviderSelect.value,
    baseUrl: gwBaseUrlInput.value.trim(),
    apiKey: gwApiKeyInput.value.trim(),
    model: gwModelInput.value.trim()
  });
  applyGatewayUI(saved);
  gwTestResultText.textContent = 'Gateway & model berhasil disimpan!';
});

if (btnOpenAgentStudio) {
  btnOpenAgentStudio.addEventListener('click', (e) => {
    e.stopPropagation();
    switchTab('tab-settings');
    switchSettingsSection('agents');
    switchManagePane('list');
  });
}

themeCardIsland.addEventListener('click', (e) => {
  e.stopPropagation();
  applyThemeUI('island');
  window.islandAPI.setTheme('island');
});

themeCardNotch.addEventListener('click', (e) => {
  e.stopPropagation();
  applyThemeUI('notch');
  window.islandAPI.setTheme('notch');
});

btnAutoStart.addEventListener('click', (e) => {
  e.stopPropagation();
  const nextVal = !btnAutoStart.classList.contains('active');
  applyThemeUI(currentTheme, nextVal);
  window.islandAPI.setAutoStart(nextVal);
});

const btnAiToggle = document.getElementById('btnAiToggle');
const aiToggleLabel = document.getElementById('aiToggleLabel');
let isAiEnabled = true;

function applyAiEnabledUI(enabled) {
  isAiEnabled = enabled !== false;
  if (btnAiToggle) {
    btnAiToggle.classList.toggle('active', isAiEnabled);
    btnAiToggle.setAttribute('aria-checked', String(isAiEnabled));
  }
  if (aiToggleLabel) {
    aiToggleLabel.textContent = isAiEnabled
      ? (currentLang === 'en' ? 'Active' : 'Aktif')
      : (currentLang === 'en' ? 'Disabled' : 'Nonaktif');
  }

  // Toggle mode dot in bottom segmented bar
  const hermesDot = document.querySelector('.mode-dot[data-target="tab-hermes"]');
  if (hermesDot) {
    hermesDot.classList.toggle('hidden', !isAiEnabled);
  }

  // Toggle mini avatar badge in collapsed pill
  const miniBadge = document.getElementById('miniAvatarBadge');
  if (miniBadge) {
    miniBadge.classList.toggle('hidden', !isAiEnabled);
  }

  // Toggle ask button in banner
  if (bannerAskBtn) {
    bannerAskBtn.classList.toggle('hidden', !isAiEnabled);
  }

  // Toggle settings tabs for agents and provider
  const navAgents = document.querySelector('#settingsNav .settings-nav-btn[data-section="agents"]');
  const navProvider = document.querySelector('#settingsNav .settings-nav-btn[data-section="provider"]');
  if (navAgents) navAgents.classList.toggle('hidden', !isAiEnabled);
  if (navProvider) navProvider.classList.toggle('hidden', !isAiEnabled);

  // If on tab-hermes and AI is disabled, switch to tab-media
  const tabHermes = document.getElementById('tab-hermes');
  if (!isAiEnabled && tabHermes && tabHermes.classList.contains('active')) {
    if (typeof switchTab === 'function') switchTab('tab-media');
  }

  // Reposition segmented indicator
  if (typeof moveSegIndicator === 'function') {
    requestAnimationFrame(moveSegIndicator);
  }

  // Video resource management: destroy vs recreate
  if (!isAiEnabled) {
    if (jeanAvatar) {
      try {
        jeanAvatar.destroy();
      } catch (err) {
        console.warn('Avatar destroy error:', err);
      }
      jeanAvatar = null;
    }
    if (typeof window.gc === 'function') {
      try { window.gc(); } catch (_) {}
    }
  } else {
    if (!jeanAvatar) {
      try {
        const hermesContainer = document.querySelector('.hermes-avatar');
        if (hermesContainer) {
          const assets = (typeof getAvatarAssetsForAgent === 'function' && typeof activeAgentDetail !== 'undefined' && activeAgentDetail)
            ? getAvatarAssetsForAgent(activeAgentDetail)
            : (AVATAR_PRESETS[currentAiAvatar] || AVATAR_PRESETS.hancow);
          jeanAvatar = new AvatarVideo(hermesContainer, assets);
          updateJeanAvatarVisibility();
        }
      } catch (err) {
        console.warn('Avatar recreate error:', err);
      }
    }
  }
}

if (btnAiToggle) {
  btnAiToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextVal = !btnAiToggle.classList.contains('active');
    applyAiEnabledUI(nextVal);
    if (window.islandAPI && window.islandAPI.setAiEnabled) {
      window.islandAPI.setAiEnabled(nextVal);
    }
  });
}

if (window.islandAPI.onSettingsUpdated) {
  window.islandAPI.onSettingsUpdated((s) => {
    if (s) {
      applyThemeUI(s.theme, s.autoStart);
      if (typeof s.aiEnabled === 'boolean') applyAiEnabledUI(s.aiEnabled);
      if (s.language && typeof applyLanguageUI === 'function') applyLanguageUI(s.language);
      if (s.powerMode) currentPowerMode = s.powerMode;
      if (s.visualMode) currentVisualMode = s.visualMode;
      renderSystemModesUI();
    }
  });
}

// ===== BOOTSTRAP PLATFORM =====
async function initMultiAgentPlatform() {
  try {
    const boot = await window.islandAPI.bootstrapAgents();
    if (!boot || !boot.ok) return;

    allAgents = boot.agents || [];
    allSkills = boot.skills || [];
    connectorsState = boot.connectors || { items: [] };
    allCronjobs = boot.cronjobs || [];
    allActivities = boot.activities || [];

    if (boot.settings) {
      applyThemeUI(boot.settings.theme, boot.settings.autoStart);
      if (typeof boot.settings.aiEnabled === 'boolean') {
        applyAiEnabledUI(boot.settings.aiEnabled);
      }
      if (boot.settings.language && typeof applyLanguageUI === 'function') {
        applyLanguageUI(boot.settings.language);
      }
      if (boot.settings.powerMode) currentPowerMode = boot.settings.powerMode;
      if (boot.settings.visualMode) currentVisualMode = boot.settings.visualMode;
      renderSystemModesUI();
    }
    if (boot.gateway) {
      applyGatewayUI(boot.gateway);
      window.islandAPI.fetchGatewayModels().then((mRes) => {
        if (mRes && Array.isArray(mRes.models)) {
          gwModelDatalist.innerHTML = mRes.models.map((m) => `<option value="${escapeHtml(m)}"></option>`).join('');
        }
      }).catch(() => {});
    }

    const proOn = boot.proactiveEnabled !== false;
    btnProactiveToggle.classList.toggle('active', proOn);
    btnProactiveToggle.setAttribute('aria-checked', String(proOn));

    if (boot.activeAgent) {
      applyActiveAgentVisuals(boot.activeAgent);
      renderAgentHistory(boot.activeAgent);
    }
    renderConnectorsList();
    renderCronList();
    renderSkillsList();
    refreshAllActivities();
  } catch (_err) {}
}

// ===== 5 NEW FEATURES: SMART HUB, QUICK COMMAND (Alt+Space), LIVE TOAST, FOCUS TIMER, REACTIVE AVATAR =====

const miniAvatarBadge = document.getElementById('miniAvatarBadge');
const liveTimerPill = document.getElementById('liveTimerPill');
const liveTimerText = document.getElementById('liveTimerText');

const quickCmdForm = document.getElementById('quickCmdForm');
const quickCmdInput = document.getElementById('quickCmdInput');
const btnQuickVoice = document.getElementById('btnQuickVoice');

const liveToastAvatar = document.getElementById('liveToastAvatar');
const liveToastTag = document.getElementById('liveToastTag');
const liveToastTitle = document.getElementById('liveToastTitle');
const liveToastSub = document.getElementById('liveToastSub');
const btnLiveToastAction = document.getElementById('btnLiveToastAction');
const btnLiveToastClose = document.getElementById('btnLiveToastClose');

const hubNav = document.getElementById('hubNav');
const trayFileInput = document.getElementById('trayFileInput');
const btnTrayAddFile = document.getElementById('btnTrayAddFile');
const btnTrayClear = document.getElementById('btnTrayClear');
const trayListContainer = document.getElementById('trayListContainer');

const clipSearchInput = document.getElementById('clipSearchInput');
const btnClipClear = document.getElementById('btnClipClear');
const clipAiStatus = document.getElementById('clipAiStatus');
const clipListContainer = document.getElementById('clipListContainer');

const focusTimeBig = document.getElementById('focusTimeBig');
const focusStateSub = document.getElementById('focusStateSub');
const focusTaskInput = document.getElementById('focusTaskInput');
const btnFocusStartPause = document.getElementById('btnFocusStartPause');
const btnFocusReset = document.getElementById('btnFocusReset');

let trayItemsCache = [];
let clipItemsCache = [];
let liveToastActionFn = null;

// --- 1. Smart Live Toast ---
function showLiveToast({ tag = '', title = '', sub = '', actionLabel = '', onAction = null, durationMs = 5200 }) {
  if (isExpanded || isQuickCmd) return;
  if (liveToastTimer) clearTimeout(liveToastTimer);
  isLiveToast = true;
  if (liveToastAvatar && activeAgentDetail) {
    liveToastAvatar.src = getAgentThumbSrc(activeAgentDetail);
  }
  if (liveToastTag) liveToastTag.textContent = '';
  const mainMessage = cleanMarkdown(title || sub || '');
  const subMessage = title && sub ? cleanMarkdown(sub) : '';
  if (liveToastTitle) liveToastTitle.textContent = mainMessage;
  if (liveToastSub) {
    liveToastSub.textContent = subMessage;
    liveToastSub.classList.toggle('hidden', !subMessage);
  }
  liveToastActionFn = onAction;
  if (btnLiveToastAction) {
    const isEn = currentLang === 'en';
    btnLiveToastAction.textContent = actionLabel || (isEn ? 'Open' : 'Buka');
    btnLiveToastAction.classList.toggle('hidden', !actionLabel);
  }
  setIslandState('live-toast');
  liveToastTimer = setTimeout(() => {
    hideLiveToast();
  }, durationMs);
}

function hideLiveToast() {
  if (liveToastTimer) {
    clearTimeout(liveToastTimer);
    liveToastTimer = null;
  }
  isLiveToast = false;
  liveToastActionFn = null;
  if (!isExpanded && !isQuickCmd) {
    setIslandState('collapsed');
    window.islandAPI.setMousePassthrough(true);
  }
}

if (btnLiveToastClose) {
  btnLiveToastClose.addEventListener('click', (e) => {
    e.stopPropagation();
    hideLiveToast();
  });
}

if (btnLiveToastAction) {
  btnLiveToastAction.addEventListener('click', (e) => {
    e.stopPropagation();
    const fn = liveToastActionFn;
    hideLiveToast();
    if (typeof fn === 'function') fn();
  });
}

// --- 2. Reactive Mini-Avatar Companion & Smart Thermal/Night Alerts ---
let lastThermalAlertAt = 0;
let lateNightGreetedToday = false;
let latestThermalHot = false;

function updateMiniAvatarMood() {
  if (!miniAvatarBadge || !isAiEnabled) return;
  const busy = isAgentBusy();
  const playing = Boolean(mediaState && mediaState.hasMedia && mediaState.status === 'Playing');
  const hr = new Date().getHours();
  const isLateNight = hr >= 0 && hr < 5;

  miniAvatarBadge.classList.toggle('mood-busy', busy);
  miniAvatarBadge.classList.toggle('mood-hot', !busy && latestThermalHot);
  miniAvatarBadge.classList.toggle('mood-music', !busy && !latestThermalHot && playing);
  miniAvatarBadge.classList.toggle('mood-night', !busy && !latestThermalHot && !playing && isLateNight);

  if (isLateNight && !lateNightGreetedToday && hr >= 1) {
    lateNightGreetedToday = true;
    const isEn = currentLang === 'en';
    showLiveToast({
      title: isEn
        ? 'Past midnight bre, don\'t forget to save your work & get some rest!'
        : 'Udah lewat tengah malam bre, jangan lupa save kerjaan & istirahat!',
      durationMs: 6000
    });
  } else if (hr >= 6) {
    lateNightGreetedToday = false;
  }
}

window.islandAPI.onSystemUpdate((sys) => {
  if (!sys) return;
  const maxTemp = Math.max(sys.cpuTemp || 0, sys.gpuTemp || 0);
  latestThermalHot = maxTemp >= 82 || (sys.ramPercent || 0) >= 92;
  updateMiniAvatarMood();

  const now = Date.now();
  if (maxTemp >= 86 && now - lastThermalAlertAt > 180000) {
    lastThermalAlertAt = now;
    const isEn = currentLang === 'en';
    showLiveToast({
      title: isEn
        ? `Laptop temperature reached ${maxTemp}°C — check & optimize heavy processes now?`
        : `Suhu laptop mencapai ${maxTemp}°C — cek & optimalkan proses terberat sekarang?`,
      actionLabel: isEn ? 'Optimize' : 'Optimalkan',
      onAction: () => {
        isExpanded = true;
        window.islandAPI.setMousePassthrough(false);
        setIslandState('expanded');
        switchTab('tab-hermes');
        switchSubView('chat');
        sendPromptToActiveAgent(
          isEn
            ? 'My laptop temperature is high. Check the heaviest CPU/RAM processes right now and recommend optimizations.'
            : 'Suhu laptopku lagi tinggi. Cek proses CPU/RAM terberat sekarang dan beri rekomendasi optimasi.',
          []
        );
      }
    });
  }
});

setInterval(updateMiniAvatarMood, 3000);

// --- 3. Quick Command / Push-to-Talk Bar (Alt + Space) ---
let speechRec = null;
let isSpeechListening = false;

function openQuickCommandBar() {
  hideBanner();
  hideLiveToast();
  isExpanded = false;
  isQuickCmd = true;
  window.islandAPI.setMousePassthrough(false);
  window.islandAPI.focusWindow();
  setIslandState('quick-cmd');
  setTimeout(() => {
    if (quickCmdInput) quickCmdInput.focus();
  }, 30);
}

function closeQuickCommandBar() {
  if (isSpeechListening && speechRec) {
    try { speechRec.stop(); } catch (_e) {}
  }
  isQuickCmd = false;
  setIslandState('collapsed');
  window.islandAPI.setMousePassthrough(true);
}

if (window.islandAPI.onQuickCommandToggle) {
  window.islandAPI.onQuickCommandToggle(() => {
    if (isQuickCmd) {
      closeQuickCommandBar();
    } else {
      openQuickCommandBar();
    }
  });
}

if (quickCmdInput) {
  quickCmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeQuickCommandBar();
    }
  });
}

if (quickCmdForm) {
  quickCmdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = (quickCmdInput && quickCmdInput.value.trim()) || '';
    if (!text) return;
    quickCmdInput.value = '';
    closeQuickCommandBar();

    if (!isAiEnabled) {
      showLiveToast({
        title: currentLang === 'en' ? 'AI features are disabled in Settings' : 'Fitur AI sedang dinonaktifkan di Setelan',
        durationMs: 4000
      });
      return;
    }

    await sendPromptToActiveAgent(text, []);
  });
}

if (btnQuickVoice) {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognitionCtor) {
    speechRec = new SpeechRecognitionCtor();
    speechRec.lang = 'id-ID';
    speechRec.interimResults = true;
    speechRec.continuous = false;

    speechRec.onstart = () => {
      isSpeechListening = true;
      btnQuickVoice.classList.add('listening');
      if (quickCmdInput) quickCmdInput.placeholder = 'Mendengarkan... silakan bicara';
    };
    speechRec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (quickCmdInput) quickCmdInput.value = transcript;
    };
    speechRec.onend = () => {
      isSpeechListening = false;
      btnQuickVoice.classList.remove('listening');
      if (quickCmdInput) {
        quickCmdInput.placeholder = `Perintah cepat ke ${currentAiName}... (Enter = kirim, Esc = tutup)`;
        quickCmdInput.focus();
      }
    };
    speechRec.onerror = () => {
      isSpeechListening = false;
      btnQuickVoice.classList.remove('listening');
    };
  }

  btnQuickVoice.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!speechRec) {
      if (quickCmdInput) quickCmdInput.focus();
      return;
    }
    if (isSpeechListening) {
      try { speechRec.stop(); } catch (_e) {}
    } else {
      try { speechRec.start(); } catch (_e) {}
    }
  });
}

// --- 4. Smart Hub Navigation (Drop Tray | Clipboard AI | Focus Timer) ---
function switchHubSection(hubName) {
  if (hubNav) {
    hubNav.querySelectorAll('.settings-nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.hub === hubName);
    });
  }
  document.querySelectorAll('#tab-hub .settings-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `hub-${hubName}`);
  });
  if (hubName === 'tray') renderDropTrayList();
  if (hubName === 'clipboard') renderClipboardList();
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
}

if (hubNav) {
  hubNav.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchHubSection(btn.dataset.hub);
    });
  });
}

// --- 5. Smart Drop Tray (File Shelf) ---
function formatBytesShort(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

let lastTrayPopInCount = 0;

async function addBrowserFilesToTray(fileList, animateCount = 1) {
  if (!fileList || fileList.length === 0) return;
  for (const file of Array.from(fileList)) {
    const nativePath = window.islandAPI.getPathForFile(file);
    let payload;
    if (nativePath) {
      payload = { filePath: nativePath, fileName: file.name };
    } else {
      const dataUrl = await readFileAsDataUrl(file);
      payload = { base64Data: dataUrl, fileName: file.name || `tray-${Date.now()}.png` };
    }
    const res = await window.islandAPI.addTrayItem(payload);
    if (res && res.ok && Array.isArray(res.items)) {
      trayItemsCache = res.items;
    }
  }
  lastTrayPopInCount = Math.max(1, Number(animateCount) || fileList.length || 1);
  renderDropTrayList();
}

function renderDropTrayList() {
  if (!trayListContainer) return;
  trayListContainer.innerHTML = '';
  const isEn = currentLang === 'en';
  if (!trayItemsCache || trayItemsCache.length === 0) {
    trayListContainer.innerHTML = `<div class="lyrics-empty">${isEn
      ? 'No files in Drop Tray yet. Drag any file or image to Dynamic Island to hold it here!'
      : 'Belum ada file di Drop Tray. Drag file/gambar apa saja ke Dynamic Island untuk dititipkan di sini!'}</div>`;
    if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
    return;
  }
  const popLimit = lastTrayPopInCount;
  lastTrayPopInCount = 0;
  trayItemsCache.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = `tray-row${idx < popLimit ? ' pop-in' : ''}`;
    row.draggable = true;
    row.title = isEn
      ? 'Drag out to drop into WhatsApp / Browser / Explorer'
      : 'Drag keluar untuk menaruh file ke WhatsApp / Browser / Folder lain';
    row.innerHTML = `
      ${item.isImage && item.thumbDataUrl
        ? `<img class="tray-thumb" src="${item.thumbDataUrl}" alt="" draggable="false" />`
        : `<div class="tray-thumb">${escapeHtml((item.ext || 'FILE').slice(0, 4))}</div>`
      }
      <div class="tray-info">
        <div class="tray-name">${escapeHtml(item.name)}</div>
        <div class="tray-meta">${escapeHtml(formatBytesShort(item.sizeBytes))} · ${isEn ? 'Drag out to other apps' : 'Drag keluar ke aplikasi lain'}</div>
      </div>
      <div class="tray-actions">
        ${item.isImage ? '<button type="button" class="mini-btn tray-convert-btn" title="Compress to JPG">JPG</button>' : ''}
        <button type="button" class="mini-btn primary tray-ask-btn" title="${isEn ? 'Send to AI Agent' : 'Kirim ke Agent AI'}">${isEn ? 'Ask AI' : 'Tanya AI'}</button>
        <button type="button" class="mini-btn ghost tray-open-btn" title="${isEn ? 'Show in Explorer' : 'Buka di Explorer'}">Folder</button>
        <button type="button" class="mini-btn ghost tray-del-btn" title="${isEn ? 'Remove from Tray' : 'Hapus dari Tray'}">×</button>
      </div>
    `;

    row.addEventListener('dragstart', (e) => {
      e.preventDefault();
      window.islandAPI.startTrayDrag(item.filePath);
    });

    const convBtn = row.querySelector('.tray-convert-btn');
    if (convBtn) {
      convBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        convBtn.textContent = '...';
        const res = await window.islandAPI.convertTrayImage(item.id);
        if (res && res.ok && Array.isArray(res.items)) {
          trayItemsCache = res.items;
          renderDropTrayList();
        } else {
          convBtn.textContent = 'JPG';
        }
      });
    }

    row.querySelector('.tray-ask-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const st = await window.islandAPI.stageAttachment({ filePath: item.filePath, fileName: item.name });
      if (st && st.ok && st.attachment) {
        stagedAttachments.push(st.attachment);
        renderAttachmentStrip();
        switchTab('tab-hermes');
        switchSubView('chat');
        window.islandAPI.focusWindow();
        setTimeout(() => hermesInput.focus(), 30);
      }
    });

    row.querySelector('.tray-open-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      window.islandAPI.revealTrayFile(item.filePath);
    });

    row.querySelector('.tray-del-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await window.islandAPI.removeTrayItem(item.id);
      if (res && res.ok && Array.isArray(res.items)) {
        trayItemsCache = res.items;
        renderDropTrayList();
      }
    });

    trayListContainer.appendChild(row);
  });
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
}

if (btnTrayAddFile && trayFileInput) {
  btnTrayAddFile.addEventListener('click', (e) => {
    e.stopPropagation();
    isFileDialogOpen = true;
    trayFileInput.click();
  });
  trayFileInput.addEventListener('change', async () => {
    isFileDialogOpen = false;
    if (trayFileInput.files && trayFileInput.files.length > 0) {
      await addBrowserFilesToTray(trayFileInput.files);
    }
    trayFileInput.value = '';
  });
}

if (btnTrayClear) {
  btnTrayClear.addEventListener('click', async (e) => {
    e.stopPropagation();
    const res = await window.islandAPI.clearTray();
    if (res && res.ok) {
      trayItemsCache = [];
      renderDropTrayList();
    }
  });
}

// --- 6. Smart Clipboard History + Instant AI ---
function renderClipboardList() {
  if (!clipListContainer) return;
  const isEn = currentLang === 'en';
  const q = ((clipSearchInput && clipSearchInput.value) || '').trim().toLowerCase();
  const filtered = clipItemsCache.filter((c) => !q || String(c.text || '').toLowerCase().includes(q));
  clipListContainer.innerHTML = '';
  if (filtered.length === 0) {
    clipListContainer.innerHTML = `<div class="lyrics-empty">${isEn
      ? 'No Ctrl+C history yet. Any text you copy is automatically saved here!'
      : 'Belum ada riwayat Ctrl+C. Setiap teks yang kamu copy otomatis tersimpan di sini!'}</div>`;
    if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'clip-row';
    const preview = String(item.text || '').replace(/\s+/g, ' ').trim();
    row.innerHTML = `
      <div class="clip-info" title="${escapeHtml(item.text)}">
        <div class="clip-text">${item.pinned ? '📌 ' : ''}${escapeHtml(preview.slice(0, 80))}</div>
        <div class="clip-meta">${escapeHtml(formatSessionTime(item.updatedAt) || (isEn ? 'Just now' : 'Baru saja'))} · ${item.text.length} ${isEn ? 'chars' : 'karakter'}</div>
      </div>
      <div class="clip-actions">
        <button type="button" class="mini-btn clip-copy-btn" title="${isEn ? 'Copy to Clipboard' : 'Copy ulang ke Clipboard'}">Copy</button>
        <button type="button" class="mini-btn clip-tr-btn" title="${isEn ? 'Auto-translate (ID ↔ EN) & Copy' : 'Terjemahkan otomatis (ID ↔ EN) & Copy'}">Translate</button>
        <button type="button" class="mini-btn clip-fix-btn" title="${isEn ? 'Polish grammar & Copy' : 'Rapikan bahasa & Copy'}">${isEn ? 'Polish' : 'Rapikan'}</button>
        <button type="button" class="mini-btn primary clip-ask-btn" title="${isEn ? 'Ask AI Agent about this text' : 'Tanyakan teks ini ke Agent'}">AI</button>
        <button type="button" class="mini-btn ghost clip-pin-btn" title="Pin item">${item.pinned ? 'Unpin' : 'Pin'}</button>
        <button type="button" class="mini-btn ghost clip-del-btn" title="${isEn ? 'Delete' : 'Hapus'}">×</button>
      </div>
    `;

    row.querySelector('.clip-copy-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.islandAPI.copyClipboard(item.text);
      const b = row.querySelector('.clip-copy-btn');
      b.textContent = 'Copied!';
      setTimeout(() => { b.textContent = 'Copy'; }, 1000);
    });

    const runClipAi = async (mode, btnEl) => {
      const orig = btnEl.textContent;
      btnEl.textContent = '...';
      if (clipAiStatus) {
        clipAiStatus.textContent = mode === 'translate'
          ? (isEn ? 'Translating & copying to clipboard...' : 'Menerjemahkan & menyalin ke clipboard...')
          : (isEn ? 'Polishing text & copying to clipboard...' : 'Merapikan teks & menyalin ke clipboard...');
        clipAiStatus.classList.remove('hidden');
      }
      const res = await window.islandAPI.aiTransformClipboard({ text: item.text, mode });
      btnEl.textContent = orig;
      if (res && res.ok) {
        if (Array.isArray(res.items)) clipItemsCache = res.items;
        renderClipboardList();
        if (clipAiStatus) {
          clipAiStatus.textContent = isEn
            ? 'Done! Result copied to clipboard (press Ctrl+V).'
            : 'Berhasil! Hasil sudah otomatis di-copy (tinggal Ctrl+V).';
          setTimeout(() => clipAiStatus.classList.add('hidden'), 3200);
        }
      } else if (clipAiStatus) {
        clipAiStatus.textContent = `${isEn ? 'Failed' : 'Gagal'}: ${(res && res.error) || (isEn ? 'Check gateway connection' : 'Cek koneksi gateway')}`;
        setTimeout(() => clipAiStatus.classList.add('hidden'), 3200);
      }
    };

    row.querySelector('.clip-tr-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      runClipAi('translate', e.currentTarget);
    });

    row.querySelector('.clip-fix-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      runClipAi('polish', e.currentTarget);
    });

    row.querySelector('.clip-ask-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      switchTab('tab-hermes');
      switchSubView('chat');
      hermesInput.value = isEn
        ? `Explain or help me with the following text:\n\n${item.text}`
        : `Jelaskan atau bantu tangani teks berikut:\n\n${item.text}`;
      window.islandAPI.focusWindow();
      setTimeout(() => hermesInput.focus(), 30);
    });

    row.querySelector('.clip-pin-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await window.islandAPI.pinClipboard(item.id);
      if (res && res.ok && Array.isArray(res.items)) {
        clipItemsCache = res.items;
        renderClipboardList();
      }
    });

    row.querySelector('.clip-del-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await window.islandAPI.deleteClipboard(item.id);
      if (res && res.ok && Array.isArray(res.items)) {
        clipItemsCache = res.items;
        renderClipboardList();
      }
    });

    clipListContainer.appendChild(row);
  });
  if (typeof syncIslandDynamicHeight === 'function') syncIslandDynamicHeight();
}

if (clipSearchInput) {
  clipSearchInput.addEventListener('input', renderClipboardList);
}

if (btnClipClear) {
  btnClipClear.addEventListener('click', async (e) => {
    e.stopPropagation();
    const res = await window.islandAPI.clearClipboard();
    if (res && res.ok && Array.isArray(res.items)) {
      clipItemsCache = res.items;
      renderClipboardList();
    }
  });
}

if (window.islandAPI.onClipboardUpdated) {
  window.islandAPI.onClipboardUpdated((data) => {
    if (data && Array.isArray(data.items)) {
      clipItemsCache = data.items;
      renderClipboardList();
    }
  });
}

// --- 7. Live Focus / Pomodoro Timer (2-Column Circular Dial) ---
const focusRingCircle = document.getElementById('focusRingCircle');
const focusBadgeText = document.getElementById('focusBadgeText');
const btnFocusPlus5 = document.getElementById('btnFocusPlus5');
const FOCUS_RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 -> ~326.72

let focusTotalSeconds = 25 * 60;
let focusRemainingSeconds = 25 * 60;
let focusIntervalId = null;
let focusPresetLabel = 'POMODORO';

function formatTimerMMSS(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function renderFocusTimerUI() {
  const isEn = currentLang === 'en';
  const formatted = formatTimerMMSS(focusRemainingSeconds);
  if (focusTimeBig) focusTimeBig.textContent = formatted;
  if (liveTimerText) liveTimerText.textContent = formatted;
  const isRunning = Boolean(focusIntervalId);
  if (liveTimerPill) liveTimerPill.classList.toggle('hidden', !isRunning);
  island.classList.toggle('has-live-timer', isRunning);

  if (focusRingCircle) {
    const ratio = focusTotalSeconds > 0 ? Math.max(0, Math.min(1, focusRemainingSeconds / focusTotalSeconds)) : 1;
    const offset = FOCUS_RING_CIRCUMFERENCE * (1 - ratio);
    focusRingCircle.style.strokeDasharray = `${FOCUS_RING_CIRCUMFERENCE.toFixed(2)}`;
    focusRingCircle.style.strokeDashoffset = `${offset.toFixed(2)}`;
  }

  if (focusBadgeText) {
    focusBadgeText.textContent = isRunning ? (isEn ? 'FOCUS ACTIVE' : 'FOKUS AKTIF') : focusPresetLabel;
  }

  if (btnFocusStartPause) {
    btnFocusStartPause.classList.toggle('running', isRunning);
    const labelText = isRunning
      ? (isEn ? 'Pause Focus' : 'Jeda Fokus')
      : (focusRemainingSeconds < focusTotalSeconds ? (isEn ? 'Resume' : 'Lanjutkan') : (isEn ? 'Start Focus' : 'Mulai Fokus'));
    const iconSvg = isRunning
      ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>'
      : '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
    btnFocusStartPause.innerHTML = `${iconSvg}<span>${labelText}</span>`;
  }
}

document.querySelectorAll('.focus-preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isEn = currentLang === 'en';
    document.querySelectorAll('.focus-preset-btn').forEach((b) => b.classList.toggle('active', b === btn));
    const mins = parseInt(btn.dataset.mins, 10) || 25;
    focusPresetLabel = btn.dataset.label || 'POMODORO';
    if (focusIntervalId) {
      clearInterval(focusIntervalId);
      focusIntervalId = null;
    }
    focusTotalSeconds = mins * 60;
    focusRemainingSeconds = focusTotalSeconds;
    if (focusStateSub) focusStateSub.textContent = isEn ? `${mins} mins ready` : `${mins} menit siap`;
    renderFocusTimerUI();
  });
});

if (btnFocusPlus5) {
  btnFocusPlus5.addEventListener('click', (e) => {
    e.stopPropagation();
    const isEn = currentLang === 'en';
    focusTotalSeconds += 5 * 60;
    focusRemainingSeconds += 5 * 60;
    if (focusStateSub) focusStateSub.textContent = isEn ? '+5 mins added' : '+5 menit ditambahkan';
    renderFocusTimerUI();
  });
}

if (btnFocusStartPause) {
  btnFocusStartPause.addEventListener('click', (e) => {
    e.stopPropagation();
    const isEn = currentLang === 'en';
    if (focusIntervalId) {
      clearInterval(focusIntervalId);
      focusIntervalId = null;
      if (focusStateSub) focusStateSub.textContent = isEn ? 'Paused' : 'Dijeda sementara';
      renderFocusTimerUI();
      return;
    }
    const taskName = (focusTaskInput && focusTaskInput.value.trim()) || (isEn ? 'Focus Session' : 'Sesi Fokus');
    if (focusStateSub) focusStateSub.textContent = `Target: ${taskName}`;
    focusIntervalId = setInterval(() => {
      focusRemainingSeconds = Math.max(0, focusRemainingSeconds - 1);
      renderFocusTimerUI();
      if (focusRemainingSeconds <= 0) {
        clearInterval(focusIntervalId);
        focusIntervalId = null;
        focusRemainingSeconds = focusTotalSeconds;
        if (focusStateSub) focusStateSub.textContent = isEn ? `Done: ${taskName}` : `Tuntas: ${taskName}`;
        renderFocusTimerUI();
        showLiveToast({
          title: isEn
            ? `Session "${taskName}" is complete. Time for a quick break!`
            : `Sesi "${taskName}" sudah selesai. Waktunya istirahat sejenak!`,
          durationMs: 7000
        });
      }
    }, 1000);
    renderFocusTimerUI();
  });
}

if (btnFocusReset) {
  btnFocusReset.addEventListener('click', (e) => {
    e.stopPropagation();
    if (focusIntervalId) {
      clearInterval(focusIntervalId);
      focusIntervalId = null;
    }
    focusRemainingSeconds = focusTotalSeconds;
    if (focusStateSub) focusStateSub.textContent = currentLang === 'en' ? 'Ready to start' : 'Siap mulai';
    renderFocusTimerUI();
  });
}

const trayDropZoneEl = document.getElementById('trayDropZone');
if (trayDropZoneEl && trayFileInput) {
  trayDropZoneEl.addEventListener('click', (e) => {
    e.stopPropagation();
    isFileDialogOpen = true;
    trayFileInput.click();
  });
}

// --- 8. Dynamic Content-Aware Frame Height (No Wasted Screen Space) ---
function syncIslandDynamicHeight() {
  if (!island.classList.contains('expanded')) {
    island.style.height = '';
    return;
  }

  // Smart Hub (#tab-hub)
  if (island.classList.contains('hub-mode')) {
    const focusActive = document.getElementById('hub-focus')?.classList.contains('active');
    const trayActive = document.getElementById('hub-tray')?.classList.contains('active');
    if (focusActive) {
      island.style.height = '284px';
      return;
    }
    if (trayActive) {
      // Enlarged Drop Tray frame height to fit the interactive magnetic dropzone + items comfortably
      const count = (trayItemsCache && trayItemsCache.length) || 0;
      const h = count === 0 ? 288 : Math.min(456, 246 + count * 56);
      island.style.height = `${h}px`;
      return;
    }
    // Clipboard AI
    const q = ((clipSearchInput && clipSearchInput.value) || '').trim().toLowerCase();
    const clipCount = (clipItemsCache || []).filter((c) => !q || String(c.text || '').toLowerCase().includes(q)).length;
    const ch = clipCount === 0 ? 218 : Math.min(432, 166 + clipCount * 54);
    island.style.height = `${ch}px`;
    return;
  }

  // Settings (#tab-settings)
  if (island.classList.contains('settings-mode')) {
    if (createAgentModal && !createAgentModal.classList.contains('hidden')) {
      island.style.height = '382px';
      return;
    }
    const appSec = document.getElementById('settings-appearance')?.classList.contains('active');
    const provSec = document.getElementById('settings-provider')?.classList.contains('active');
    if (appSec) {
      island.style.height = '296px';
      return;
    }
    if (provSec) {
      island.style.height = '344px';
      return;
    }
    // Kelola Agent (#settings-agents)
    const listPane = document.getElementById('pane-agentlist')?.classList.contains('active');
    if (listPane) {
      const agCount = (allAgents && allAgents.length) || 3;
      const ah = Math.min(436, Math.max(240, 148 + agCount * 52));
      island.style.height = `${ah}px`;
      return;
    }
    island.style.height = '468px';
    return;
  }

  // System Monitor (#tab-system)
  if (island.classList.contains('system-mode')) {
    island.style.height = '402px';
    return;
  }

  island.style.height = '';
}

// --- 9. Charger Connected & Peripheral Device HUD (Mouse, Earphone, Keyboard, Bluetooth) ---
const hwHudIconBox = document.getElementById('hwHudIconBox');
const hwHudTag = document.getElementById('hwHudTag');
const hwHudTitle = document.getElementById('hwHudTitle');
const hwHudBarWrap = document.getElementById('hwHudBarWrap');
const hwHudBarFill = document.getElementById('hwHudBarFill');
const hwHudSub = document.getElementById('hwHudSub');
const hwHudBadge = document.getElementById('hwHudBadge');

const HW_ICONS = {
  charger: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
  mouse: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="6"/><line x1="12" y1="7" x2="12" y2="11"/></svg>',
  audio: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="9" x2="6" y2="9"/><line x1="10" y1="9" x2="10" y2="9"/><line x1="14" y1="9" x2="14" y2="9"/><line x1="18" y1="9" x2="18" y2="9"/><line x1="8" y1="15" x2="16" y2="15"/></svg>',
  bluetooth: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>',
  usb: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="1"/><circle cx="4" cy="20" r="1"/><path d="M4.7 19.3 19 5"/><path d="m21 3-3 1 2 2Z"/><path d="M9.26 7.68 5 12l2 5"/><path d="m10 14 5 2 3.5-3.5"/></svg>'
};

function showHardwareHud({ mode, pct, category, name }) {
  if (isExpanded || isQuickCmd) return;
  const isEn = currentLang === 'en';
  clearTimeout(hwHudTimer);

  if (hwHudIconBox) {
    hwHudIconBox.className = 'hw-hud-icon-box';
  }
  if (hwHudTag) hwHudTag.className = 'hw-hud-tag';
  if (hwHudBadge) hwHudBadge.className = 'hw-hud-badge';

  if (mode === 'charger-in') {
    const level = Math.max(1, Math.min(100, Number(pct) || 85));
    if (hwHudIconBox) hwHudIconBox.innerHTML = HW_ICONS.charger;
    if (hwHudTag) hwHudTag.textContent = isEn ? 'CHARGING CONNECTED' : 'CHARGER TERHUBUNG';
    if (hwHudTitle) hwHudTitle.textContent = isEn ? 'Fast Charging Active' : 'Mengisi Daya Cepat';
    if (hwHudBarWrap) hwHudBarWrap.classList.remove('hidden');
    if (hwHudSub) hwHudSub.classList.add('hidden');
    if (hwHudBarFill) {
      hwHudBarFill.style.width = '0%';
      setTimeout(() => {
        hwHudBarFill.style.width = `${level}%`;
      }, 45);
    }
    if (hwHudBadge) hwHudBadge.textContent = `${level}%`;
  } else if (mode === 'charger-out') {
    const level = Math.max(1, Math.min(100, Number(pct) || 85));
    if (hwHudIconBox) {
      hwHudIconBox.classList.add('unplugged-theme');
      hwHudIconBox.innerHTML = HW_ICONS.charger;
    }
    if (hwHudTag) {
      hwHudTag.classList.add('unplugged-theme');
      hwHudTag.textContent = isEn ? 'ON BATTERY POWER' : 'CHARGER DILEPAS';
    }
    if (hwHudTitle) hwHudTitle.textContent = isEn ? 'Running on Battery' : 'Mode Baterai Aktif';
    if (hwHudBarWrap) hwHudBarWrap.classList.remove('hidden');
    if (hwHudSub) hwHudSub.classList.add('hidden');
    if (hwHudBarFill) hwHudBarFill.style.width = `${level}%`;
    if (hwHudBadge) {
      hwHudBadge.classList.add('unplugged-theme');
      hwHudBadge.textContent = `${level}%`;
    }
  } else {
    const cat = category || 'usb';
    if (hwHudIconBox) {
      hwHudIconBox.classList.add('device-theme');
      hwHudIconBox.innerHTML = HW_ICONS[cat] || HW_ICONS.usb;
    }
    const catLabelMap = isEn
      ? { mouse: 'MOUSE CONNECTED', audio: 'AUDIO CONNECTED', keyboard: 'KEYBOARD CONNECTED', bluetooth: 'BLUETOOTH CONNECTED', usb: 'DEVICE CONNECTED' }
      : { mouse: 'MOUSE TERHUBUNG', audio: 'EARPHONE / AUDIO TERHUBUNG', keyboard: 'KEYBOARD TERHUBUNG', bluetooth: 'BLUETOOTH TERHUBUNG', usb: 'PERANGKAT TERHUBUNG' };
    if (hwHudTag) {
      hwHudTag.classList.add('device-theme');
      hwHudTag.textContent = catLabelMap[cat] || catLabelMap.usb;
    }
    if (hwHudTitle) hwHudTitle.textContent = name || (isEn ? 'External Device' : 'Perangkat Eksternal');
    if (hwHudBarWrap) hwHudBarWrap.classList.add('hidden');
    if (hwHudSub) {
      hwHudSub.classList.remove('hidden');
      hwHudSub.textContent = isEn ? 'Ready to use on Windows' : 'Siap digunakan di sistem';
    }
    if (hwHudBadge) {
      hwHudBadge.classList.add('device-theme');
      hwHudBadge.textContent = isEn ? 'Connected' : 'Aktif';
    }
  }

  isHwHud = true;
  window.islandAPI.setMousePassthrough(false);
  setIslandState('hw-hud');

  hwHudTimer = setTimeout(() => {
    isHwHud = false;
    if (!isExpanded && !isQuickCmd && !isLiveToast) {
      setIslandState('collapsed');
      window.islandAPI.setMousePassthrough(true);
    }
  }, 3400);
}

const hwHudContentEl = document.getElementById('hwHudContent');
if (hwHudContentEl) {
  hwHudContentEl.addEventListener('click', () => {
    clearTimeout(hwHudTimer);
    isHwHud = false;
    if (!isExpanded) {
      setIslandState('collapsed');
      window.islandAPI.setMousePassthrough(true);
    }
  });
}

if (window.islandAPI.onDeviceUpdate) {
  window.islandAPI.onDeviceUpdate((dev) => {
    if (!dev || dev.event !== 'connected') return;
    showHardwareHud({
      mode: 'device',
      category: dev.category || 'usb',
      name: dev.name || (currentLang === 'en' ? 'External Device' : 'Perangkat Eksternal')
    });
  });
}

// Instant WebAudio/MediaDevices hotplug detection for Earphones / Headsets / Mics
let knownAudioDeviceIds = null;
async function syncAudioDevicesSnapshot(triggerHud = false) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    const relevant = list.filter((d) => (d.kind === 'audiooutput' || d.kind === 'audioinput') && d.deviceId !== 'default' && d.deviceId !== 'communications');
    const currentMap = new Map(relevant.map((d) => [d.deviceId, d.label || 'Audio Device']));
    if (knownAudioDeviceIds && triggerHud) {
      for (const [id, label] of currentMap.entries()) {
        if (!knownAudioDeviceIds.has(id)) {
          showHardwareHud({
            mode: 'device',
            category: 'audio',
            name: label.replace(/\s*\([^)]*\)\s*$/, '').trim() || 'Earphone / Headset'
          });
          break;
        }
      }
    }
    knownAudioDeviceIds = currentMap;
  } catch (_e) {}
}
syncAudioDevicesSnapshot(false);
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    syncAudioDevicesSnapshot(true);
  });
}

// --- 10. Language Switcher (Bahasa Indonesia / English) ---
const btnLangId = document.getElementById('btnLangId');
const btnLangEn = document.getElementById('btnLangEn');

const I18N_MAP = {
  id: {
    '#bannerAskBtn': 'Tanya AI',
    '.lyrics-title': 'Lirik Sinkron',
    '#tab-system .sys-card:nth-child(3) .sys-name': 'Suhu CPU',
    '#tab-system .sys-card:nth-child(4) .sys-name': 'Suhu GPU',
    '#powerModeLabel': 'Power Mode',
    '#visualModeLabel': 'Visual Adjustment',
    '#dropOverlay span': 'Lepas file atau gambar ke Agent',
    '#agentSubNav .subnav-btn[data-subview="chat"]': 'Chat',
    '#agentSubNav .subnav-btn[data-subview="activity"]': 'Aktivitas',
    '#agentSubNav .subnav-btn[data-subview="cron"]': 'Cronjob',
    '#sessionsDrawerTitle': 'Riwayat Chat',
    '#btnDrawerNewChat': '+ Chat Baru',
    '#btnCloseSessionsDrawer': 'Tutup',
    '#btnClearActivities': 'Bersihkan',
    '#actDetailModal .act-tl-header': 'Timeline Eksekusi',
    '#btnProactiveToggle .autostart-label': 'Info Proaktif Otomatis',
    '#btnToggleNewCron': '+ Buat Jadwal',
    '#btnSaveNewCron': 'Tambah Cronjob',
    '#hubNav .settings-nav-btn[data-hub="tray"]': 'Drop Tray',
    '#hubNav .settings-nav-btn[data-hub="clipboard"]': 'Clipboard AI',
    '#hubNav .settings-nav-btn[data-hub="focus"]': 'Focus Timer',
    '#trayHintText': 'Drag file ke pulau untuk transit, atau drag keluar ke WA/Browser',
    '#btnTrayAddFile': '+ Pilih File',
    '#btnTrayClear': 'Bersihkan',
    '#btnClipClear': 'Bersihkan',
    '.focus-preset-btn[data-mins="5"]': '5m Rehat',
    '#settingsNav .settings-nav-btn[data-section="appearance"]': 'Tampilan',
    '#settingsNav .settings-nav-btn[data-section="provider"]': 'Provider',
    '#settingsNav .settings-nav-btn[data-section="agents"]': 'Kelola Agent',
    '#settings-appearance .settings-header .media-tag': 'TAMPILAN & SISTEM',
    '#themeCardIsland .theme-card-name': 'Dynamic Island',
    '#themeCardIsland .theme-card-desc': 'Mengambang · Liquid Glass',
    '#themeCardNotch .theme-card-name': 'Poni (Notch)',
    '#themeCardNotch .theme-card-desc': 'Menempel Atas · Live Lirik',
    '#aiToggleTitle': 'Fitur AI & Avatar Animasi',
    '#aiToggleDesc': 'Aktifkan karakter avatar dan bot AI. Matikan untuk Mode Lite (hemat ~120 MB RAM).',
    '#aiToggleBadge': 'Multi-Agent',
    '#langLabelTag': 'BAHASA / LANGUAGE',
    '#settings-provider .studio-top-grid .studio-field:nth-child(1) label': 'Provider Gateway',
    '#settings-provider .studio-top-grid .studio-field:nth-child(2) label': 'Model Aktif',
    '#btnFetchModels': 'Ambil Daftar',
    '#btnTestGateway': 'Tes Koneksi',
    '#btnSaveGateway': 'Simpan Gateway',
    '#manageSubNav .conn-filter-tab[data-pane="list"]': 'List Agent',
    '#manageSubNav .conn-filter-tab[data-pane="skills"]': 'Skill',
    '#manageSubNav .conn-filter-tab[data-pane="connectors"]': 'Konektor',
    '#btnCreateAgentOpen': '+ Buat Agent',
    '#btnBackToAgentList': '← Daftar Agent',
    '#cfgPaneTitle': 'Konfigurasi Agent',
    '#btnDeleteAgent': 'Hapus Agent',
    '#subview-config .studio-top-grid .studio-field:nth-child(1) label': 'Nama Agent',
    '#subview-config .studio-top-grid .studio-field:nth-child(2) label': 'Avatar',
    '#subview-config .studio-scroll > .studio-field label': 'Peran / Spesialisasi',
    '#cfgAgentAvatar option[value="pipo"]': 'Winnie (Hijau)',
    '#btnUploadAvatar': 'Pilih Foto',
    '#cfgDocTabs .doc-tab[data-doc="instructions"]': '1. Instruksi',
    '#cfgDocTabs .doc-tab[data-doc="memory"]': '2. Memori Agent',
    '#cfgDocTabs .doc-tab[data-doc="soul"]': '3. soul.md',
    '#cfgDocTabs .doc-tab[data-doc="identity"]': '4. identity.md',
    '#cfgDocTabs .doc-tab[data-doc="globalMemory"]': 'Memori Utama',
    '#btnSaveAgent': 'Simpan Agent',
    '#btnToggleNewSkill': '+ Skill Baru',
    '#btnCreateSkillSave': 'Simpan Skill',
    '#connFilterBar .conn-filter-tab[data-cat="all"]': 'Semua',
    '#connFilterBar .conn-filter-tab[data-cat="connected"]': 'Terhubung',
    '#connFilterBar .conn-filter-tab[data-cat="pesan"]': 'Pesan',
    '#connFilterBar .conn-filter-tab[data-cat="workspace"]': 'Workspace',
    '#connFilterBar .conn-filter-tab[data-cat="produktivitas"]': 'Kerja',
    '#connFilterBar .conn-filter-tab[data-cat="dev"]': 'Dev',
    '#connFilterBar .conn-filter-tab[data-cat="media"]': 'Media',
    '#createAgentModal .ca-title': 'Buat Agent',
    '#createAgentModal .ca-label': 'Nama Agent',
    '#caAvatarPicker .ca-picker-head span': 'Pilih Avatar',
    '#btnCaCancel': 'Batal',
    '#btnCaCreate': 'Buat Agent',
    '#btnConfirmCancel': 'Batal'
  },
  en: {
    '#bannerAskBtn': 'Ask AI',
    '.lyrics-title': 'Synced Lyrics',
    '#tab-system .sys-card:nth-child(3) .sys-name': 'CPU Temp',
    '#tab-system .sys-card:nth-child(4) .sys-name': 'GPU Temp',
    '#powerModeLabel': 'Power Mode',
    '#visualModeLabel': 'Visual Adjustment',
    '#dropOverlay span': 'Drop files or images to Agent',
    '#agentSubNav .subnav-btn[data-subview="chat"]': 'Chat',
    '#agentSubNav .subnav-btn[data-subview="activity"]': 'Activity',
    '#agentSubNav .subnav-btn[data-subview="cron"]': 'Cronjobs',
    '#sessionsDrawerTitle': 'Chat History',
    '#btnDrawerNewChat': '+ New Chat',
    '#btnCloseSessionsDrawer': 'Close',
    '#btnClearActivities': 'Clear',
    '#actDetailModal .act-tl-header': 'Execution Timeline',
    '#btnProactiveToggle .autostart-label': 'Auto Proactive Info',
    '#btnToggleNewCron': '+ New Schedule',
    '#btnSaveNewCron': 'Add Cronjob',
    '#hubNav .settings-nav-btn[data-hub="tray"]': 'Drop Tray',
    '#hubNav .settings-nav-btn[data-hub="clipboard"]': 'Clipboard AI',
    '#hubNav .settings-nav-btn[data-hub="focus"]': 'Focus Timer',
    '#trayHintText': 'Drag files to the island to hold, or drag out to WA/Browser',
    '#btnTrayAddFile': '+ Browse File',
    '#btnTrayClear': 'Clear All',
    '#btnClipClear': 'Clear',
    '.focus-preset-btn[data-mins="5"]': '5m Break',
    '#settingsNav .settings-nav-btn[data-section="appearance"]': 'Appearance',
    '#settingsNav .settings-nav-btn[data-section="provider"]': 'Provider',
    '#settingsNav .settings-nav-btn[data-section="agents"]': 'Manage Agents',
    '#settings-appearance .settings-header .media-tag': 'APPEARANCE & SYSTEM',
    '#themeCardIsland .theme-card-name': 'Dynamic Island',
    '#themeCardIsland .theme-card-desc': 'Floating · Liquid Glass',
    '#themeCardNotch .theme-card-name': 'Notch Mode',
    '#themeCardNotch .theme-card-desc': 'Top-Docked · Live Lyrics',
    '#aiToggleTitle': 'AI Features & Avatar Animation',
    '#aiToggleDesc': 'Enable avatar animations and AI bots. Turn off for Lite Mode (saves ~120 MB RAM).',
    '#aiToggleBadge': 'Multi-Agent',
    '#langLabelTag': 'LANGUAGE',
    '#settings-provider .studio-top-grid .studio-field:nth-child(1) label': 'Gateway Provider',
    '#settings-provider .studio-top-grid .studio-field:nth-child(2) label': 'Active Model',
    '#btnFetchModels': 'Fetch Models',
    '#btnTestGateway': 'Test Connection',
    '#btnSaveGateway': 'Save Gateway',
    '#manageSubNav .conn-filter-tab[data-pane="list"]': 'Agent List',
    '#manageSubNav .conn-filter-tab[data-pane="skills"]': 'Skills',
    '#manageSubNav .conn-filter-tab[data-pane="connectors"]': 'Connectors',
    '#btnCreateAgentOpen': '+ Create Agent',
    '#btnBackToAgentList': '← Agent List',
    '#cfgPaneTitle': 'Agent Configuration',
    '#btnDeleteAgent': 'Delete Agent',
    '#subview-config .studio-top-grid .studio-field:nth-child(1) label': 'Agent Name',
    '#subview-config .studio-top-grid .studio-field:nth-child(2) label': 'Avatar',
    '#subview-config .studio-scroll > .studio-field label': 'Role / Specialization',
    '#cfgAgentAvatar option[value="pipo"]': 'Winnie (Green)',
    '#btnUploadAvatar': 'Upload Photo',
    '#cfgDocTabs .doc-tab[data-doc="instructions"]': '1. Instructions',
    '#cfgDocTabs .doc-tab[data-doc="memory"]': '2. Agent Memory',
    '#cfgDocTabs .doc-tab[data-doc="soul"]': '3. soul.md',
    '#cfgDocTabs .doc-tab[data-doc="identity"]': '4. identity.md',
    '#cfgDocTabs .doc-tab[data-doc="globalMemory"]': 'Global Memory',
    '#btnSaveAgent': 'Save Agent',
    '#btnToggleNewSkill': '+ New Skill',
    '#btnCreateSkillSave': 'Save Skill',
    '#connFilterBar .conn-filter-tab[data-cat="all"]': 'All',
    '#connFilterBar .conn-filter-tab[data-cat="connected"]': 'Connected',
    '#connFilterBar .conn-filter-tab[data-cat="pesan"]': 'Messaging',
    '#connFilterBar .conn-filter-tab[data-cat="workspace"]': 'Workspace',
    '#connFilterBar .conn-filter-tab[data-cat="produktivitas"]': 'Work',
    '#connFilterBar .conn-filter-tab[data-cat="dev"]': 'Dev',
    '#connFilterBar .conn-filter-tab[data-cat="media"]': 'Media',
    '#createAgentModal .ca-title': 'Create Agent',
    '#createAgentModal .ca-label': 'Agent Name',
    '#caAvatarPicker .ca-picker-head span': 'Choose Avatar',
    '#btnCaCancel': 'Cancel',
    '#btnCaCreate': 'Create Agent',
    '#btnConfirmCancel': 'Cancel'
  }
};

function applyLanguageUI(lang) {
  currentLang = lang === 'en' ? 'en' : 'id';
  const isEn = currentLang === 'en';
  if (btnLangId) btnLangId.classList.toggle('active', !isEn);
  if (btnLangEn) btnLangEn.classList.toggle('active', isEn);

  const dict = I18N_MAP[currentLang];
  Object.entries(dict).forEach(([selector, text]) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  });

  // Update placeholders & tooltips
  if (hermesInput) {
    hermesInput.placeholder = isEn
      ? `Command ${currentAiName}... (Upload / Drag / Paste files)`
      : `Perintahkan ${currentAiName}... (Upload / Drag / Paste file)`;
  }
  if (activitySearchInput) {
    activitySearchInput.placeholder = isEn
      ? 'Search activity logs, tools, or commands...'
      : 'Cari riwayat aktivitas, tool, atau perintah...';
  }
  if (skillSearchInput) {
    skillSearchInput.placeholder = isEn
      ? 'Search 85+ Hermes skills (github, research, nextjs, pdf...)'
      : 'Cari dari 85+ skill Hermes (github, research, nextjs, pdf...)';
  }
  if (newSkillName) {
    newSkillName.placeholder = isEn ? 'Skill name (e.g. deploy-vercel)' : 'Nama skill (contoh: deploy-vercel)';
  }
  if (newSkillDesc) {
    newSkillDesc.placeholder = isEn ? 'Short skill description' : 'Deskripsi singkat skill';
  }
  if (newSkillContent) {
    newSkillContent.placeholder = isEn
      ? 'Step-by-step instructions for the agent when using this skill...'
      : 'Instruksi langkah-demi-langkah untuk agent saat memakai skill ini...';
  }
  if (newCronName) {
    newCronName.placeholder = isEn ? 'Schedule name (e.g. Morning Briefing)' : 'Nama jadwal (contoh: Rangkuman Pagi)';
  }
  if (newCronPrompt) {
    newCronPrompt.placeholder = isEn
      ? 'Task prompt for the agent (e.g. Check disk C:, heavy processes & weather, then summarize)...'
      : 'Perintah tugas untuk agent (contoh: Cek disk C:, proses berat, dan cuaca hari ini lalu beri kabar singkat)...';
  }
  if (caAgentName) {
    caAgentName.placeholder = isEn ? 'e.g. Nova, Atlas, Jarvis...' : 'Contoh: Nova, Atlas, Jarvis...';
  }
  if (cfgAgentName) {
    cfgAgentName.placeholder = isEn ? 'e.g. Muse / Cue' : 'Misal: Muse / Cue';
  }
  if (cfgAgentRole) {
    cfgAgentRole.placeholder = isEn ? 'e.g. Research & Automation Bot' : 'Misal: Research & Automation Bot';
  }
  if (cfgDocEditor) {
    cfgDocEditor.placeholder = isEn ? 'Write agent configuration here...' : 'Tulis konfigurasi agent di sini...';
  }
  if (clipSearchInput) {
    clipSearchInput.placeholder = isEn ? 'Search clipboard history...' : 'Cari riwayat teks...';
  }
  if (focusTaskInput) {
    focusTaskInput.placeholder = isEn ? 'Target: Finish UI design...' : 'Target: Selesaikan desain UI...';
  }
  if (quickCmdInput) {
    quickCmdInput.placeholder = isEn
      ? `Quick command for ${currentAiName}... (Enter = send, Esc = close)`
      : `Perintah cepat ke ${currentAiName}... (Enter = kirim, Esc = tutup)`;
  }
  if (btnToggleGwKey) {
    const isPwd = gwApiKeyInput && gwApiKeyInput.type === 'password';
    btnToggleGwKey.textContent = isPwd ? (isEn ? 'Show' : 'Lihat') : (isEn ? 'Hide' : 'Tutup');
  }
  if (focusStateSub && !focusIntervalId) {
    focusStateSub.textContent = isEn ? 'Ready to focus' : 'Siap mulai';
  }
  if (aiToggleLabel) {
    aiToggleLabel.textContent = isAiEnabled
      ? (isEn ? 'Active' : 'Aktif')
      : (isEn ? 'Disabled' : 'Nonaktif');
  }

  // Re-render all dynamic views so active language is reflected everywhere immediately
  renderMediaUI();
  if (activeAgentDetail) {
    applyActiveAgentVisuals(activeAgentDetail);
    renderAgentHistory(activeAgentDetail);
    const editingAgent = (studioEditingId && allAgents && allAgents.find((a) => a.id === studioEditingId)) || activeAgentDetail;
    loadAgentIntoStudio(editingAgent);
  } else {
    renderAgentPills();
    renderSettingsAgentGrid();
  }
  if (isSessionsDrawerOpen) renderSessionsDrawer();
  renderSkillsList();
  renderConnectorsList();
  renderCronList();
  renderActivityLogList();
  if (inspectedActivity) renderActivityDetailModalContent();
  setTrayDropZoneInteractiveState('idle');
  renderDropTrayList();
  renderClipboardList();
  renderFocusTimerUI();
  renderSystemModesUI();
}

if (btnLangId) {
  btnLangId.addEventListener('click', (e) => {
    e.stopPropagation();
    applyLanguageUI('id');
    if (window.islandAPI.setLanguage) window.islandAPI.setLanguage('id');
  });
}

if (btnLangEn) {
  btnLangEn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyLanguageUI('en');
    if (window.islandAPI.setLanguage) window.islandAPI.setLanguage('en');
  });
}

async function initSmartHubFeatures() {
  try {
    const [tr, cl] = await Promise.all([
      window.islandAPI.listTray(),
      window.islandAPI.listClipboard()
    ]);
    if (tr && Array.isArray(tr.items)) trayItemsCache = tr.items;
    if (cl && Array.isArray(cl.items)) clipItemsCache = cl.items;
    renderDropTrayList();
    renderClipboardList();
    renderFocusTimerUI();
  } catch (_e) {}
}

initMultiAgentPlatform();
initSmartHubFeatures();
renderMediaUI();
moveSegIndicator();
playLaunchAnimation();
