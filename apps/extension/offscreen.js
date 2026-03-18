(() => {
  let audioContext = null;
  let meditationSession = null;
  let meditationNoiseBuffer = null;

  function getAudioContext() {
    if (audioContext) return audioContext;
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
    return audioContext;
  }

  function ensureMeditationNoiseBuffer(ctx) {
    if (meditationNoiseBuffer) return meditationNoiseBuffer;
    const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastBrown = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      lastBrown = (lastBrown + (0.02 * white)) / 1.02;
      data[index] = lastBrown * 3.4;
    }
    meditationNoiseBuffer = buffer;
    return meditationNoiseBuffer;
  }

  function meditationAmbientProfile(ambient) {
    const profiles = {
      brown_hush: {
        drones: [96, 144],
        shimmer: 288,
        filter: 840,
        noise: 0.34,
        lfoRate: 0.042,
        lfoDepth: 120
      },
      rain_atrium: {
        drones: [132, 198],
        shimmer: 396,
        filter: 1260,
        noise: 0.5,
        lfoRate: 0.06,
        lfoDepth: 160
      },
      cloud_drift: {
        drones: [174, 261],
        shimmer: 522,
        filter: 1520,
        noise: 0.22,
        lfoRate: 0.08,
        lfoDepth: 180
      },
      night_tide: {
        drones: [108, 162],
        shimmer: 324,
        filter: 940,
        noise: 0.42,
        lfoRate: 0.05,
        lfoDepth: 140
      }
    };
    return profiles[String(ambient || "brown_hush")] || profiles.brown_hush;
  }

  function stopMeditationSession() {
    if (!meditationSession) return { ok: true };
    const session = meditationSession;
    if (session.stopTimer) clearTimeout(session.stopTimer);
    if (session.master) {
      try {
        const nowTime = session.ctx?.currentTime || 0;
        session.master.gain.cancelScheduledValues(nowTime);
        session.master.gain.setTargetAtTime(0.0001, nowTime, 0.18);
      } catch {}
    }
    meditationSession = null;
    setTimeout(() => {
      (session.cleanup || []).forEach((entry) => {
        try {
          if (typeof entry.stop === "function") entry.stop();
        } catch {}
        try {
          if (typeof entry.disconnect === "function") entry.disconnect();
        } catch {}
      });
    }, 260);
    return { ok: true };
  }

  async function startMeditationSession(payload = {}) {
    const ctx = getAudioContext();
    if (!ctx) return { ok: false, error: "audio_context_unavailable" };
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch (error) {
      return { ok: false, error: String(error?.message || error || "audio_resume_failed") };
    }

    stopMeditationSession();

    const ambient = String(payload.ambient || "brown_hush");
    const volume = Math.max(0.04, Math.min(0.38, Number(payload.volume || 0.48) * 0.42));
    const durationMs = Math.max(8000, Number(payload.durationMs || 10 * 60 * 1000));
    const profile = meditationAmbientProfile(ambient);
    const nowTime = ctx.currentTime;
    const cleanup = [];

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, nowTime);
    master.gain.linearRampToValueAtTime(volume, nowTime + 1.8);
    master.connect(ctx.destination);
    cleanup.push(master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(profile.filter, nowTime);
    filter.Q.setValueAtTime(0.42, nowTime);
    filter.connect(master);
    cleanup.push(filter);

    profile.drones.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(frequency, nowTime);
      gain.gain.setValueAtTime(index === 0 ? 0.42 : 0.24, nowTime);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(nowTime);
      cleanup.push(gain, osc);
    });

    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(profile.shimmer, nowTime);
    shimmerGain.gain.setValueAtTime(0.035, nowTime);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(filter);
    shimmer.start(nowTime);
    cleanup.push(shimmerGain, shimmer);

    const noise = ctx.createBufferSource();
    noise.buffer = ensureMeditationNoiseBuffer(ctx);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(profile.filter * 0.84, nowTime);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(profile.noise * 0.12, nowTime);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(nowTime);
    cleanup.push(noiseGain, noiseFilter, noise);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(profile.lfoRate, nowTime);
    lfoGain.gain.setValueAtTime(profile.lfoDepth, nowTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(nowTime);
    cleanup.push(lfoGain, lfo);

    meditationSession = {
      ctx,
      master,
      cleanup,
      stopTimer: setTimeout(() => {
        stopMeditationSession();
      }, durationMs)
    };

    return { ok: true };
  }

  function profileForKind(kind) {
    const map = {
      eye: { base: 612, overtone: 918, accent: 1236, waveform: "sine", overtoneWaveform: "triangle", pulseLength: 0.2, glide: 10 },
      posture: { base: 432, overtone: 648, accent: 864, waveform: "triangle", overtoneWaveform: "sine", pulseLength: 0.22, glide: 8 },
      burnout: { base: 288, overtone: 432, accent: 576, waveform: "triangle", overtoneWaveform: "sine", pulseLength: 0.26, glide: 5 },
      hydration: { base: 516, overtone: 774, accent: 1032, waveform: "sine", overtoneWaveform: "triangle", pulseLength: 0.19, glide: 9 },
      blink: { base: 684, overtone: 1026, accent: 1368, waveform: "sine", overtoneWaveform: "triangle", pulseLength: 0.16, glide: 11 },
      movement: { base: 384, overtone: 576, accent: 768, waveform: "triangle", overtoneWaveform: "triangle", pulseLength: 0.2, glide: 7 }
    };
    return map[String(kind || "eye")] || map.eye;
  }

  function pulsePlan(pattern) {
    if (pattern === "single") return [{ offset: 0, accent: true, gain: 0.94 }];
    if (pattern === "triple") {
      return [
        { offset: 0, gain: 0.7 },
        { offset: 0.22, gain: 0.74, detune: 10 },
        { offset: 0.5, accent: true, gain: 0.98, detune: -8 }
      ];
    }
    if (pattern === "beacon") {
      return [
        { offset: 0, gain: 0.76 },
        { offset: 0.34, accent: true, gain: 1, detune: -16, lengthMult: 1.45 }
      ];
    }
    if (pattern === "watchtower") {
      return [
        { offset: 0, gain: 0.7 },
        { offset: 0.2, gain: 0.72, detune: 12 },
        { offset: 0.58, accent: true, gain: 0.96, detune: -10, lengthMult: 1.28 }
      ];
    }
    if (pattern === "relay") {
      return [
        { offset: 0, gain: 0.64 },
        { offset: 0.16, gain: 0.68, detune: 10 },
        { offset: 0.32, gain: 0.72, detune: 18 },
        { offset: 0.62, accent: true, gain: 0.96, detune: -8, lengthMult: 1.18 }
      ];
    }
    if (pattern === "klaxon") {
      return [
        { offset: 0, accent: true, gain: 1, detune: -18, lengthMult: 1.45 },
        { offset: 0.44, accent: true, gain: 1, detune: 16, lengthMult: 1.45 }
      ];
    }
    return [
      { offset: 0, gain: 0.82 },
      { offset: 0.26, accent: true, gain: 0.96, detune: 8 }
    ];
  }

  function shapePulse(ctx, startAt, profile, level, options = {}) {
    const accent = Boolean(options.accent);
    const lengthMult = Math.max(0.8, Number(options.lengthMult || 1));
    const detune = Number(options.detune || 0);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(accent ? 2550 : 2250, startAt);
    filter.Q.setValueAtTime(0.8, startAt);

    const master = ctx.createGain();
    const pulseLength = (accent ? profile.pulseLength * 1.08 : profile.pulseLength) * lengthMult;
    const peak = level * (accent ? 1.08 : 0.94) * Math.max(0.45, Number(options.gain || 1));

    master.gain.setValueAtTime(0.0001, startAt);
    master.gain.linearRampToValueAtTime(peak, startAt + 0.014);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.58), startAt + pulseLength * 0.48);
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + pulseLength);

    filter.connect(master);
    master.connect(ctx.destination);

    const layers = [
      { frequency: profile.base, gain: 1, type: profile.waveform },
      { frequency: profile.overtone, gain: 0.28, type: profile.overtoneWaveform },
      { frequency: profile.accent, gain: accent ? 0.14 : 0.08, type: "sine" }
    ];

    layers.forEach((layer, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = layer.type;
      osc.frequency.setValueAtTime(Math.max(80, layer.frequency + detune), startAt);
      osc.frequency.linearRampToValueAtTime(
        Math.max(80, layer.frequency + detune - profile.glide * (index + 1)),
        startAt + pulseLength
      );
      gain.gain.setValueAtTime(layer.gain, startAt);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(startAt);
      osc.stop(startAt + pulseLength + 0.03);
    });
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
    const volume = Math.max(0.08, Math.min(0.92, Number(payload.volume || 0.35) * 1.28));
    const pattern = String(payload.pattern || "double");
    const profile = profileForKind(kind);
    const plan = pulsePlan(pattern);
    const startAt = ctx.currentTime;

    plan.forEach((step) => {
      shapePulse(ctx, startAt + step.offset, profile, volume, step);
    });

    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "holmeta:offscreen-meditation") {
      const payload = message.payload || {};
      if (payload.action === "stop") {
        sendResponse(stopMeditationSession());
        return false;
      }
      startMeditationSession(payload)
        .then((result) => sendResponse(result))
        .catch((error) => {
          sendResponse({ ok: false, error: String(error?.message || error || "offscreen_meditation_failed") });
        });
      return true;
    }

    if (message?.type !== "holmeta:offscreen-sound") return;
    playPattern(message.payload || {})
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({ ok: false, error: String(error?.message || error || "offscreen_sound_failed") });
      });
    return true;
  });
})();
