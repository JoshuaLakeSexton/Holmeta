(() => {
  const SOUND_FILES = {
    hm_hover_01: "hm_hover_01.ogg",
    hm_hover_02: "hm_hover_02.ogg",
    hm_click_01: "hm_click_01.ogg",
    hm_click_02: "hm_click_02.ogg",
    hm_toggle_on: "hm_toggle_on.ogg",
    hm_toggle_off: "hm_toggle_off.ogg",
    hm_save: "hm_save.ogg",
    hm_success: "hm_success.ogg",
    hm_warn: "hm_warn.ogg",
    hm_error: "hm_error.ogg",
    hm_test_ping: "hm_test_ping.ogg",
    hm_focus_start: "hm_focus_start.ogg",
    hm_focus_end: "hm_focus_end.ogg",
    hm_eye: "hm_eye.ogg",
    hm_move: "hm_move.ogg",
    hm_water: "hm_water.ogg",
    hm_breath_in: "hm_breath_in.ogg",
    hm_breath_out: "hm_breath_out.ogg"
  };

  const DEBOUNCE_MS = 120;
  const FADE_SEC = 0.01;

  let audioContext = null;
  let unlockBound = false;

  const bufferCache = new Map();
  const inflightBuffers = new Map();
  const lastPlayedAt = new Map();

  function clamp(value, min = 0, max = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return min;
    }
    return Math.max(min, Math.min(max, num));
  }

  function ensureContext() {
    if (audioContext) {
      return audioContext;
    }

    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) {
      return null;
    }

    audioContext = new Ctx();
    return audioContext;
  }

  async function resumeContext(context) {
    if (!context) {
      return false;
    }

    if (context.state === "running") {
      return true;
    }

    try {
      await context.resume();
    } catch (_) {
      // no-op
    }

    return context.state === "running";
  }

  function runtimeAssetUrl(key) {
    const file = SOUND_FILES[key] || null;
    if (!file || !globalThis.chrome?.runtime?.getURL) {
      return null;
    }
    return globalThis.chrome.runtime.getURL(`assets/sfx/${file}`);
  }

  function fallbackToneForKey(key) {
    if (String(key).includes("error")) return 180;
    if (String(key).includes("warn")) return 320;
    if (String(key).includes("save")) return 520;
    if (String(key).includes("success")) return 640;
    if (String(key).includes("focus")) return 420;
    if (String(key).includes("breath")) return 260;
    if (String(key).includes("eye")) return 360;
    if (String(key).includes("move")) return 280;
    if (String(key).includes("water")) return 300;
    if (String(key).includes("toggle")) return 460;
    if (String(key).includes("hover")) return 560;
    return 480;
  }

  async function decodeBuffer(key, context) {
    if (!context) {
      return null;
    }

    if (bufferCache.has(key)) {
      return bufferCache.get(key);
    }

    if (inflightBuffers.has(key)) {
      return inflightBuffers.get(key);
    }

    const promise = (async () => {
      const url = runtimeAssetUrl(key);
      if (!url) {
        return null;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`SFX fetch failed (${response.status})`);
      }

      const bufferData = await response.arrayBuffer();
      const decoded = await context.decodeAudioData(bufferData.slice(0));
      bufferCache.set(key, decoded);
      return decoded;
    })()
      .catch(() => null)
      .finally(() => {
        inflightBuffers.delete(key);
      });

    inflightBuffers.set(key, promise);
    return promise;
  }

  function playFallbackTone(context, key, volume) {
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = "triangle";
      osc.frequency.value = fallbackToneForKey(key);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + FADE_SEC);
      gain.gain.linearRampToValueAtTime(0, now + FADE_SEC * 6);

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start(now);
      osc.stop(now + FADE_SEC * 6.5);
      return true;
    } catch (_) {
      return false;
    }
  }

  function playBuffer(context, buffer, volume) {
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = buffer;

    const gain = context.createGain();
    const duration = Math.max(FADE_SEC * 2 + 0.01, Number(buffer.duration || 0.08));

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + FADE_SEC);
    gain.gain.setValueAtTime(volume, now + Math.max(FADE_SEC, duration - FADE_SEC));
    gain.gain.linearRampToValueAtTime(0, now + duration);

    source.connect(gain);
    gain.connect(context.destination);

    source.start(now);
    source.stop(now + duration + 0.02);
    return true;
  }

  async function initAudioUnlock() {
    const context = ensureContext();
    if (!context) {
      return false;
    }

    return resumeContext(context);
  }

  function bindUnlockOnGesture() {
    if (unlockBound) {
      return;
    }

    unlockBound = true;
    const unlock = () => {
      initAudioUnlock();
    };

    ["pointerdown", "keydown", "touchstart", "click"].forEach((eventName) => {
      document.addEventListener(eventName, unlock, {
        capture: true,
        passive: true
      });
    });
  }

  async function playSfx(key, options = {}) {
    const soundKey = String(key || "").trim();
    if (!soundKey) {
      return false;
    }

    const nowMs = Date.now();
    const lastMs = Number(lastPlayedAt.get(soundKey) || 0);
    if (nowMs - lastMs < DEBOUNCE_MS) {
      return false;
    }
    lastPlayedAt.set(soundKey, nowMs);

    const context = ensureContext();
    if (!context) {
      return false;
    }

    const resumed = await resumeContext(context);
    if (!resumed) {
      return false;
    }

    const volume = clamp(options.volume ?? 0.6, 0, 1);
    if (volume <= 0.001) {
      return false;
    }

    const buffer = await decodeBuffer(soundKey, context);
    if (buffer) {
      try {
        return playBuffer(context, buffer, volume);
      } catch (_) {
        // continue to fallback tone
      }
    }

    return playFallbackTone(context, soundKey, Math.min(volume, 0.22));
  }

  globalThis.HolmetaAudio = {
    SOUND_FILES,
    initAudioUnlock,
    bindUnlockOnGesture,
    playSfx
  };
})();
