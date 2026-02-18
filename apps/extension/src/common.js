(() => {
  const DEFAULT_SETTINGS = {
    filterPreset: "nightWarm",
    filterIntensity: 0.65,
    wakeTime: "07:00",
    sleepTime: "23:00",
    rampMinutes: 60,
    eyeBreakIntervalMin: 20,
    hydrationIntervalMin: 60,
    hydrationGoalGlasses: 8,
    stillnessThresholdMin: 50,
    reminderNotifications: true,
    audioCues: false,
    speechCues: false,
    webcamPostureOptIn: false,
    devBypassPremium: true,
    entitlementUrl: "",
    checkoutUrl: "",
    disabledDomains: [],
    distractorDomains: ["youtube.com", "x.com", "reddit.com"]
  };

  const DEFAULT_RUNTIME = {
    focusSession: null,
    lastActivityTs: Date.now(),
    lastStillnessNudgeTs: 0,
    lastEyeBreakTs: 0,
    lastHydrationReminderTs: 0
  };

  const FILTER_PRESETS = {
    neutral: { r: 1, g: 1, b: 1 },
    blueBlocker: { r: 1, g: 0.92, b: 0.28 },
    redBlocker: { r: 0.35, g: 1, b: 1 },
    nightWarm: { r: 1, g: 0.78, b: 0.2 }
  };

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function parseClock(value) {
    const [h = "0", m = "0"] = String(value || "0:0").split(":");
    const hours = Number(h);
    const minutes = Number(m);
    return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
  }

  function todayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function minutesSinceMidnight(date = new Date()) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function inWindow(now, start, end) {
    if (start <= end) {
      return now >= start && now <= end;
    }
    return now >= start || now <= end;
  }

  function circadianBoost(settings, date = new Date()) {
    const wake = parseClock(settings.wakeTime || DEFAULT_SETTINGS.wakeTime);
    const sleep = parseClock(settings.sleepTime || DEFAULT_SETTINGS.sleepTime);
    const now = minutesSinceMidnight(date);
    const ramp = Math.max(10, Number(settings.rampMinutes || DEFAULT_SETTINGS.rampMinutes));

    const windDownStart = (sleep - ramp + 1440) % 1440;
    const wakeRampEnd = (wake + ramp) % 1440;

    if (inWindow(now, windDownStart, sleep)) {
      const elapsed = now >= windDownStart ? now - windDownStart : now + 1440 - windDownStart;
      return clamp(elapsed / ramp);
    }

    if (inWindow(now, wake, wakeRampEnd)) {
      const elapsed = now >= wake ? now - wake : now + 1440 - wake;
      return clamp(1 - elapsed / ramp);
    }

    if (inWindow(now, sleep, wake)) {
      return 1;
    }

    return 0;
  }

  function buildColorMatrix(preset, intensity, settings, date = new Date()) {
    const profile = FILTER_PRESETS[preset] || FILTER_PRESETS.neutral;
    const circadian = circadianBoost(settings || DEFAULT_SETTINGS, date);
    const effectiveIntensity = clamp(Number(intensity)) * (0.35 + 0.65 * circadian);

    const r = 1 - (1 - profile.r) * effectiveIntensity;
    const g = 1 - (1 - profile.g) * effectiveIntensity;
    const b = 1 - (1 - profile.b) * effectiveIntensity;

    return [
      r, 0, 0, 0, 0,
      0, g, 0, 0, 0,
      0, 0, b, 0, 0,
      0, 0, 0, 1, 0
    ];
  }

  function matrixToString(matrix) {
    return matrix.map((value) => Number(value).toFixed(4)).join(" ");
  }

  function normalizeDomain(domain) {
    return String(domain || "").trim().toLowerCase().replace(/^\*\./, "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  function domainMatches(hostname, domain) {
    const safeHost = normalizeDomain(hostname);
    const safeDomain = normalizeDomain(domain);
    if (!safeHost || !safeDomain) {
      return false;
    }
    return safeHost === safeDomain || safeHost.endsWith(`.${safeDomain}`);
  }

  function computeHydrationStreak(hydrationByDate) {
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = todayKey(cursor);
      if (!hydrationByDate[key] || hydrationByDate[key] <= 0) {
        break;
      }
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function computeFilterPayload(settings, date = new Date()) {
    const preset = settings.filterPreset || DEFAULT_SETTINGS.filterPreset;
    const intensity = clamp(Number(settings.filterIntensity ?? DEFAULT_SETTINGS.filterIntensity));
    const matrix = buildColorMatrix(preset, intensity, settings, date);
    const circadian = circadianBoost(settings, date);
    const brightness = clamp(1 - circadian * 0.16, 0.78, 1);

    return {
      preset,
      intensity,
      circadian,
      brightness,
      matrix,
      matrixString: matrixToString(matrix),
      disabledDomains: Array.isArray(settings.disabledDomains) ? settings.disabledDomains : []
    };
  }

  function parseDomainList(raw) {
    return String(raw || "")
      .split(/\n|,/) 
      .map((entry) => normalizeDomain(entry))
      .filter(Boolean)
      .filter((domain, index, all) => all.indexOf(domain) === index);
  }

  function formatMinutes(totalMinutes) {
    const min = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(min / 60);
    const minutes = min % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }
    return `${minutes}m`;
  }

  globalThis.HolmetaCommon = {
    DEFAULT_SETTINGS,
    DEFAULT_RUNTIME,
    FILTER_PRESETS,
    clamp,
    parseClock,
    todayKey,
    minutesSinceMidnight,
    circadianBoost,
    buildColorMatrix,
    matrixToString,
    normalizeDomain,
    domainMatches,
    computeHydrationStreak,
    computeFilterPayload,
    parseDomainList,
    formatMinutes
  };
})();
