(() => {
  let audioContext = null;

  function getAudioContext() {
    if (audioContext) return audioContext;
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
    return audioContext;
  }

  function toneForKind(kind) {
    if (kind === "posture") return 460;
    if (kind === "burnout") return 300;
    if (kind === "hydration") return 500;
    if (kind === "blink") return 560;
    if (kind === "movement") return 420;
    return 540;
  }

  async function playPattern(payload = {}) {
    const ctx = getAudioContext();
    if (!ctx) return { ok: false, error: "audio_context_unavailable" };
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch (error) {
      return { ok: false, error: String(error?.message || error || "audio_resume_failed") };
    }

    const kind = String(payload.kind || "eye");
    const volume = Math.max(0.05, Math.min(0.9, Number(payload.volume || 0.35)));
    const pattern = String(payload.pattern || "double");
    const pulses = pattern === "triple" ? 3 : pattern === "single" ? 1 : 2;
    const base = toneForKind(kind);
    const pulseLength = 0.22;
    const gap = 0.14;
    const startAt = ctx.currentTime;

    for (let i = 0; i < pulses; i += 1) {
      const begin = startAt + i * (pulseLength + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(base + i * 12, begin);
      gain.gain.setValueAtTime(0.0001, begin);
      gain.gain.linearRampToValueAtTime(volume, begin + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, begin + pulseLength);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(begin);
      osc.stop(begin + pulseLength + 0.02);
    }

    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "holmeta:offscreen-sound") return;
    playPattern(message.payload || {})
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({ ok: false, error: String(error?.message || error || "offscreen_sound_failed") });
      });
    return true;
  });
})();
