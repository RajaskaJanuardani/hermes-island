# Hermes Island 🏝️

> **iOS-style Dynamic Island & Top-Docked Notch for Windows 11**  
> Fluid Liquid Glass UI with Global Media Session, Live Synced Lyrics, Hardware Monitoring, Smart Hub, and Autonomous Multi-Agent AI.

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-0078D4?logo=windows)](https://github.com/RajaskaJanuardani/hermes-island)
[![Electron](https://img.shields.io/badge/Framework-Electron%2033-47848F?logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Highlights & Features

### 1. 🏝️ Dual Display Modes
- **Dynamic Island Mode**: Floating pill at the top-center of your screen with smooth physics, glass sheen, and spring animations.
- **Poni (Notch) Mode**: Docks seamlessly to the top bezel with concave notch ears (`Lively Obsidian Glass`), perfect for clean desktop setups.

### 2. 🎵 Global Media Controls & Live Synced Lyrics
- **Universal Windows SMTC Integration**: Automatic tracking of Spotify, YouTube, Apple Music, browsers, and media players.
- **Live Synced Lyrics**: Real-time line-by-line LRC parser and synchronized lyrics scrolling display.
- **Interactive Audio Waveform**: Fluid audio visualizer with track progress seeking, play/pause, next/prev, and volume control.

### 3. ⚡ Hardware & System Monitor
- **Real-Time Thermal & Resource Gauges**: CPU temperature, GPU temperature, and RAM usage percentage.
- **Battery Status**: Live battery percentage with charging bolt glow indicator.
- **Power Mode Switcher**: Quick toggle between Quiet, Balanced, and Performance modes.
- **Universal Visual Adjustment**: Dual-engine display gamma adjustment (Standard, Low Blue Light / Warm, Movie Contrast, Photo) compatible with Acer and all Windows monitors.

### 4. 🗂️ Smart Hub
- **Drop Tray**: Magnetic drag-and-drop file holding zone for quick transit between folders, WhatsApp, or browsers.
- **Clipboard AI**: Smart clipboard history with instant search and one-click copy.
- **Focus Timer**: Customizable Pomodoro timer (25m Focus, 5m Break, 50m Deep Work) with live pill countdown.

### 5. 🤖 Hermes Autonomous Multi-Agent Platform
- **Animated 3D-Style Avatars**: Muse-style looping video avatars with Idle and Working states (Hancow, Winnie, Wana, Cowboy, Wizard, Hero, Astro, Hoodie, Ninja, Lab).
- **Multi-Provider AI Gateway**: Connect to OpenAI, Anthropic Claude, Groq, Ollama, OpenRouter, Google Gemini, or custom local OpenAI-compatible endpoints.
- **85+ Skills & 25+ Connectors**: Autonomous agent execution for web search, GitHub, Spotify, WhatsApp, Notion, Linear, Slack, filesystem operations, and scheduled cronjobs.
- **Quick Command (`Alt + Space`)**: Instant spotlight-style prompt bar to command your active agent from anywhere.

### 6. 🪶 Lite Mode (RAM Saver)
- Built-in toggle switch under **Settings ➔ Appearance** to disable AI features & avatar animations.
- Slashes standby background memory consumption down to **~160 MB** for maximum efficiency during gaming or heavy workloads.

### 7. 🌐 Bilingual Support
- Instant one-click toggle between **Bahasa Indonesia 🇮🇩** and **English 🇬🇧**.

---

## 🚀 Getting Started

### Prerequisites
- **Windows 10 / 11** (64-bit)
- **Node.js 18+** & **npm**
- PowerShell 5.1+ (pre-installed on Windows)

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/RajaskaJanuardani/hermes-island.git
   cd hermes-island
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the app:
   ```bash
   npm start
   ```

---

## 🧠 Setting Up Hermes AI Agent

Hermes Island features a built-in multi-agent autonomous system. You can connect it to your preferred cloud LLM or run it 100% locally and offline:

### Step 1: Open Provider Settings
1. Click the Island or press **`Alt + Space`** to expand the window.
2. Click the **Settings & Gateway** tab (gear icon at the bottom right).
3. Select the **Provider** sub-tab.

### Step 2: Choose Your AI Provider
You can choose from popular pre-configured presets or enter any custom OpenAI-compatible endpoint:

| Provider | Endpoint | Recommended Models | Notes |
|---|---|---|---|
| **Ollama** *(Offline & Free)* | `http://127.0.0.1:11434/v1` | `qwen2.5-coder:7b`, `llama3.3:8b` | Completely private, runs on local GPU/CPU |
| **Groq** *(Ultra Fast)* | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Blazing fast inference speeds |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini` | Official OpenAI API |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash` | Fast multimodal reasoning |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `anthropic/claude-3.7-sonnet` | Access to Claude, DeepSeek & all models |
| **Custom / Local** | `http://localhost:<port>/v1` | Any model name | Compatible with vLLM, LM Studio, 9router |

### Step 3: Connect & Save
1. Paste your **API Key** (leave blank for local Ollama / LM Studio).
2. Click **Fetch Models** (`Ambil Daftar`) to automatically retrieve all models available on your account.
3. Click **Test Connection** (`Tes Koneksi`) to verify ping latency.
4. Click **Save Gateway** (`Simpan Gateway`).

### Step 4: Interact with Your Agent
- **Full Chat UI**: Click the **Multi-Agent AI** tab (sparkle icon) on the bottom navbar to chat, inspect agent execution timelines, view skills, and configure background cronjobs.
- **Global Quick Command**: Press **`Alt + Space`** from any application or game to summon the instant floating prompt bar.
- **File Drag-and-Drop**: Drag images, PDFs, code files, or text directly onto the island to pass them directly to your agent.

---

## ⌨️ Shortcuts & Controls

| Action | Control |
|---|---|
| **Expand Island / Notch** | Hover cursor or click on collapsed pill |
| **Collapse Island** | Move cursor outside the island window |
| **Quick Command Bar** | `Alt + Space` |
| **Switch Tabs** | Click bottom segmented dots (Media, System, AI Hermes, Smart Hub, Settings) |
| **Pin Island Open** | Click the Pin icon inside the expanded header |

---

## 📂 Project Architecture

```
hermes-island/
├── index.html            # Main UI DOM layout (Island, Notch, Hub, Settings)
├── style.css             # Liquid glass aesthetic, transitions & themes
├── renderer.js           # Frontend logic, state management & UI bindings
├── avatar-video.js       # Video decoder & crossfade engine for animated avatars
├── agent-manager.js      # Hermes agent orchestrator, skills, connectors & cronjobs
├── main.js               # Electron main process, window management & system IPC
├── preload.js            # Secure context bridge API
├── media-bridge.ps1      # PowerShell SMTC media, audio devices & gamma ramp bridge
└── public/
    ├── assets/           # Video avatars (WebM) & static fallback posters
    └── connectors/       # Third-party platform brand SVG icons
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
