/**
 * AvatarVideo — Muse-style animated chat avatar.
 *
 * Two looping MP4s rendered inside a circular frame:
 *   - "idle"    : avatar facing the camera (greeting / waiting for input)
 *   - "working" : avatar with headset typing (agent is processing)
 *
 * Behaviour:
 *   - Both videos are preloaded on init so switching has no delay.
 *   - Switching crossfades opacity over 300ms (see .av-slot in style.css).
 *   - Only the visible video plays; the other is paused to save resources.
 *   - If a video fails to load, its static poster image is shown instead.
 *   - prefers-reduced-motion: posters only, nothing autoplays.
 *
 * Usage:
 *   const avatar = new AvatarVideo(containerEl, {
 *     idleSrc, workingSrc, idlePoster, workingPoster
 *   });
 *   avatar.setState('working'); // or 'idle'
 *   avatar.setVisible(false);   // pause everything while hidden
 */
(function (global) {
  'use strict';

  const STATES = ['idle', 'working'];
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function createSlot(name, src, poster) {
    const slot = document.createElement('div');
    slot.className = `av-slot av-${name}`;

    // Static poster: shown until the video is ready, on error, or with reduced motion.
    const img = document.createElement('img');
    img.className = 'av-poster';
    img.src = poster;
    img.alt = '';
    img.draggable = false;

    const video = document.createElement('video');
    video.className = 'av-video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    slot.append(img, video);
    return { name, src, slot, img, video, failed: false, loaded: false };
  }

  class AvatarVideo {
    constructor(container, options) {
      if (!container) throw new Error('AvatarVideo: container element is required');

      this.container = container;
      this.state = 'idle';
      this.visible = true;
      this.reduced = reducedMotionQuery.matches;
      this._currentOptions = { ...options };

      container.classList.add('av-root');
      container.replaceChildren();

      this.slots = {
        idle: createSlot('idle', options.idleSrc, options.idlePoster),
        working: createSlot('working', options.workingSrc, options.workingPoster)
      };

      for (const s of Object.values(this.slots)) {
        s.video.addEventListener('error', () => this._markFailed(s));
        s.video.addEventListener('loadeddata', () => s.slot.classList.add('av-ready'));
        container.appendChild(s.slot);
      }

      this._onMotionChange = (e) => {
        this.reduced = e.matches;
        this._applyMotionPreference();
      };
      reducedMotionQuery.addEventListener('change', this._onMotionChange);

      this._applyMotionPreference();
      this._render();
    }

    /** Switch between 'idle' and 'working'. */
    setState(state) {
      if (!STATES.includes(state) || state === this.state) return;
      this.state = state;
      this._render();
    }

    /** Pause all playback while the avatar is off-screen. */
    setVisible(visible) {
      this.visible = Boolean(visible);
      this._syncPlayback();
    }

    /** Hot-swap the idle/working video and poster assets without losing state or visibility. */
    setAssets(options) {
      if (!options) return;
      if (
        this._currentOptions &&
        this._currentOptions.idleSrc === options.idleSrc &&
        this._currentOptions.workingSrc === options.workingSrc &&
        this._currentOptions.idlePoster === options.idlePoster &&
        this._currentOptions.workingPoster === options.workingPoster
      ) {
        return;
      }
      this._currentOptions = { ...options };

      for (const s of Object.values(this.slots)) {
        s.video.pause();
        s.video.removeAttribute('src');
        s.video.load();
      }
      this.container.replaceChildren();

      this.slots = {
        idle: createSlot('idle', options.idleSrc, options.idlePoster),
        working: createSlot('working', options.workingSrc, options.workingPoster)
      };

      for (const s of Object.values(this.slots)) {
        s.video.addEventListener('error', () => this._markFailed(s));
        s.video.addEventListener('loadeddata', () => s.slot.classList.add('av-ready'));
        this.container.appendChild(s.slot);
      }

      this._applyMotionPreference();
      this._render();
    }

    destroy() {
      reducedMotionQuery.removeEventListener('change', this._onMotionChange);
      for (const s of Object.values(this.slots)) {
        s.video.pause();
        s.video.removeAttribute('src');
        s.video.load();
      }
      this.container.replaceChildren();
      this.container.classList.remove('av-root', 'av-reduced');
    }

    // ---- internals ----

    _applyMotionPreference() {
      this.container.classList.toggle('av-reduced', this.reduced);
      if (!this.reduced) {
        // Preload both videos up front so later switches are instant.
        for (const s of Object.values(this.slots)) {
          if (!s.src) {
            this._markFailed(s);
            continue;
          }
          if (!s.loaded && !s.failed) {
            s.loaded = true;
            s.video.src = s.src;
            s.video.load();
          }
        }
      }
      this._syncPlayback();
    }

    _markFailed(s) {
      s.failed = true;
      s.slot.classList.add('av-failed');
      s.video.pause();
    }

    _render() {
      for (const s of Object.values(this.slots)) {
        s.slot.classList.toggle('av-active', s.name === this.state);
      }
      this._syncPlayback();
    }

    _syncPlayback() {
      for (const s of Object.values(this.slots)) {
        const shouldPlay =
          s.name === this.state && this.visible && !this.reduced && !s.failed && s.loaded;

        if (shouldPlay) {
          s.video.autoplay = true;
          const p = s.video.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          s.video.autoplay = false;
          if (!s.video.paused) s.video.pause();
        }
      }
    }
  }

  global.AvatarVideo = AvatarVideo;
})(window);
