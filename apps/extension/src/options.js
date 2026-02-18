(() => {
  const HC = globalThis.HolmetaCommon;

  const state = {
    settings: { ...HC.DEFAULT_SETTINGS },
    runtime: { ...HC.DEFAULT_RUNTIME },
    entitlement: { active: false },
    trends: { dailyLogs: [], hydration: {}, calm: {} },
    auditPhotoDataUrl: "",
    selectedLog: {
      energy: 3,
      mood: 3,
      sleepQuality: 3
    },
    cameraStream: null,
    postureTimer: null,
    faceDetector: null
  };

  const $ = (id) => document.getElementById(id);

  function send(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve(response || {});
      });
    });
  }

  function isPremium() {
    return Boolean(state.settings.devBypassPremium || state.entitlement.active);
  }

  function setStatus(text) {
    $("statusLine").textContent = text;
  }

  function bindRatingRows() {
    document.querySelectorAll(".rating-row").forEach((row) => {
      const metric = row.dataset.metric;
      row.innerHTML = "";

      for (let value = 1; value <= 5; value += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(value);
        button.dataset.value = String(value);
        if (value === state.selectedLog[metric]) {
          button.classList.add("active");
        }
        button.addEventListener("click", () => {
          state.selectedLog[metric] = value;
          row.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
          button.classList.add("active");
        });
        row.appendChild(button);
      }
    });
  }

  function applyStateToForm() {
    $("filterPreset").value = state.settings.filterPreset;
    $("filterIntensity").value = String(Math.round(Number(state.settings.filterIntensity) * 100));
    $("filterIntensityValue").textContent = `${Math.round(Number(state.settings.filterIntensity) * 100)}%`;
    $("wakeTime").value = state.settings.wakeTime;
    $("sleepTime").value = state.settings.sleepTime;
    $("rampMinutes").value = String(state.settings.rampMinutes);

    $("eyeBreakInterval").value = String(state.settings.eyeBreakIntervalMin);
    $("hydrationInterval").value = String(state.settings.hydrationIntervalMin);
    $("stillnessThreshold").value = String(state.settings.stillnessThresholdMin);
    $("hydrationGoal").value = String(state.settings.hydrationGoalGlasses);
    $("reminderNotifications").checked = Boolean(state.settings.reminderNotifications);
    $("audioCues").checked = Boolean(state.settings.audioCues);
    $("speechCues").checked = Boolean(state.settings.speechCues);

    $("distractorDomains").value = (state.settings.distractorDomains || []).join("\n");

    $("webcamPostureOptIn").checked = Boolean(state.settings.webcamPostureOptIn);

    $("entitlementUrl").value = state.settings.entitlementUrl || "";
    $("checkoutUrl").value = state.settings.checkoutUrl || "";
    $("devBypassPremium").checked = Boolean(state.settings.devBypassPremium);

    const premiumStatus = $("premiumStatus");
    if (isPremium()) {
      premiumStatus.className = "status-chip status-active";
      premiumStatus.textContent = state.settings.devBypassPremium
        ? "STATUS: DEV BYPASS"
        : "STATUS: PREMIUM ACTIVE";
    } else {
      premiumStatus.className = "status-chip status-locked";
      premiumStatus.textContent = "STATUS: LOCKED";
    }

    document.querySelectorAll("[data-premium]").forEach((el) => {
      el.disabled = !isPremium();
    });

    if (!isPremium()) {
      $("postureStatus").textContent = "STATUS: LOCKED (PREMIUM)";
    }

    const hydrationToday = state.trends.hydration[HC.todayKey()] || 0;
    const calmToday = state.trends.calm[HC.todayKey()] || 0;
    $("hydrationStats").textContent = `HYDRATION: ${hydrationToday} / ${state.settings.hydrationGoalGlasses}`;
    $("calmStats").textContent = `CALM MINUTES: ${calmToday}`;
  }

  function collectSettingsPatch() {
    return {
      filterPreset: $("filterPreset").value,
      filterIntensity: Number($("filterIntensity").value) / 100,
      wakeTime: $("wakeTime").value,
      sleepTime: $("sleepTime").value,
      rampMinutes: Number($("rampMinutes").value || 60),
      eyeBreakIntervalMin: Number($("eyeBreakInterval").value || 20),
      hydrationIntervalMin: Number($("hydrationInterval").value || 60),
      stillnessThresholdMin: Number($("stillnessThreshold").value || 50),
      hydrationGoalGlasses: Number($("hydrationGoal").value || 8),
      reminderNotifications: Boolean($("reminderNotifications").checked),
      audioCues: Boolean($("audioCues").checked),
      speechCues: Boolean($("speechCues").checked),
      webcamPostureOptIn: Boolean($("webcamPostureOptIn").checked),
      distractorDomains: HC.parseDomainList($("distractorDomains").value),
      entitlementUrl: $("entitlementUrl").value.trim(),
      checkoutUrl: $("checkoutUrl").value.trim(),
      devBypassPremium: Boolean($("devBypassPremium").checked)
    };
  }

  function drawTrends() {
    const canvas = $("trendsCanvas");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#F4F1E8";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(17,19,24,0.14)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i += 1) {
      const y = 24 + (height - 50) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(44, y);
      ctx.lineTo(width - 18, y);
      ctx.stroke();
    }

    const logs = [...state.trends.dailyLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    if (!logs.length) {
      ctx.fillStyle = "#111318";
      ctx.font = "14px ui-monospace";
      ctx.fillText("NO TREND DATA YET", 52, height / 2);
      return;
    }

    const xStart = 58;
    const xEnd = width - 30;
    const yTop = 26;
    const yBottom = height - 24;

    function xForIndex(index) {
      if (logs.length === 1) return (xStart + xEnd) / 2;
      return xStart + ((xEnd - xStart) * index) / (logs.length - 1);
    }

    function yForValue(value) {
      const normalized = (Number(value) - 1) / 4;
      return yBottom - normalized * (yBottom - yTop);
    }

    function drawSeries(key, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      logs.forEach((log, index) => {
        const x = xForIndex(index);
        const y = yForValue(log[key]);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
    }

    drawSeries("energy", "#FF4D1A");
    drawSeries("mood", "#00D4FF");
    drawSeries("sleepQuality", "#111318");

    ctx.fillStyle = "#111318";
    ctx.font = "12px ui-monospace";
    ctx.fillText("ENERGY", width - 190, 24);
    ctx.fillText("MOOD", width - 120, 24);
    ctx.fillText("SLEEP", width - 64, 24);

    ctx.fillStyle = "#FF4D1A";
    ctx.fillRect(width - 205, 14, 8, 8);
    ctx.fillStyle = "#00D4FF";
    ctx.fillRect(width - 132, 14, 8, 8);
    ctx.fillStyle = "#111318";
    ctx.fillRect(width - 74, 14, 8, 8);
  }

  function attachPhotoReader() {
    $("auditPhoto").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        state.auditPhotoDataUrl = "";
        $("auditPreview").style.display = "none";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.auditPhotoDataUrl = String(reader.result || "");
        if (state.auditPhotoDataUrl) {
          $("auditPreview").src = state.auditPhotoDataUrl;
          $("auditPreview").style.display = "block";
        }
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadAudit() {
    const response = await send({ type: "holmeta-get-audit" });
    const audit = response.audit;
    if (!audit) {
      return;
    }

    $("monitorHeight").value = audit.monitorHeight || "aligned";
    $("monitorDistance").value = audit.monitorDistance || "arm";
    $("chairSupport").value = audit.chairSupport || "good";
    $("wristNeutral").value = audit.wristNeutral || "neutral";
    $("lighting").value = audit.lighting || "balanced";

    if (audit.photoDataUrl) {
      state.auditPhotoDataUrl = audit.photoDataUrl;
      $("auditPreview").src = audit.photoDataUrl;
      $("auditPreview").style.display = "block";
    }
  }

  async function saveAudit() {
    const payload = {
      savedAt: new Date().toISOString(),
      monitorHeight: $("monitorHeight").value,
      monitorDistance: $("monitorDistance").value,
      chairSupport: $("chairSupport").value,
      wristNeutral: $("wristNeutral").value,
      lighting: $("lighting").value,
      photoDataUrl: state.auditPhotoDataUrl || ""
    };

    await send({ type: "holmeta-save-audit", payload });
    $("auditStatus").textContent = `STATUS: SAVED ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  async function requestVideoPermission() {
    return new Promise((resolve) => {
      chrome.permissions.request({ permissions: ["videoCapture"] }, (granted) => {
        resolve(Boolean(granted));
      });
    });
  }

  function stopPostureMonitor() {
    if (state.postureTimer) {
      clearInterval(state.postureTimer);
      state.postureTimer = null;
    }

    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((track) => track.stop());
      state.cameraStream = null;
    }

    const video = $("postureVideo");
    video.srcObject = null;
    video.style.display = "none";
    $("postureStatus").textContent = "STATUS: IDLE";
  }

  async function startPostureMonitor() {
    if (!isPremium()) {
      $("postureStatus").textContent = "STATUS: LOCKED";
      return;
    }

    const optIn = Boolean($("webcamPostureOptIn").checked);
    if (!optIn) {
      $("postureStatus").textContent = "STATUS: ENABLE WEBCAM TO START";
      return;
    }

    const granted = await requestVideoPermission();
    if (!granted) {
      $("postureStatus").textContent = "STATUS: CAMERA PERMISSION DENIED";
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 360
        },
        audio: false
      });

      state.cameraStream = stream;
      const video = $("postureVideo");
      video.srcObject = stream;
      video.style.display = "block";
      await video.play();

      if ("FaceDetector" in window) {
        state.faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        $("postureStatus").textContent = "STATUS: FACE DETECTOR ACTIVE";

        state.postureTimer = setInterval(async () => {
          if (!state.faceDetector) return;
          try {
            const faces = await state.faceDetector.detect(video);
            if (!faces.length) {
              $("postureStatus").textContent = "STATUS: FACE LOST - RESET POSTURE";
              return;
            }

            const box = faces[0].boundingBox;
            const centerY = box.y + box.height / 2;
            const frameCenter = video.videoHeight / 2;
            const offset = Math.abs(centerY - frameCenter) / Math.max(1, frameCenter);
            if (offset > 0.18) {
              $("postureStatus").textContent = "STATUS: ADJUST MONITOR / CHAIR HEIGHT";
            } else {
              $("postureStatus").textContent = "STATUS: POSTURE STABLE";
            }
          } catch (_) {
            $("postureStatus").textContent = "STATUS: FACE DETECTION ERROR";
          }
        }, 4000);
      } else {
        $("postureStatus").textContent = "STATUS: FALLBACK MODE (MANUAL PROMPTS)";
        state.postureTimer = setInterval(() => {
          const prompts = [
            "CHECK SHOULDER TENSION",
            "ROLL SHOULDERS + RESET CHIN",
            "STAND FOR 60 SECONDS"
          ];
          const idx = Math.floor(Math.random() * prompts.length);
          $("postureStatus").textContent = `STATUS: ${prompts[idx]}`;
        }, 45000);
      }
    } catch (_) {
      $("postureStatus").textContent = "STATUS: CAMERA INIT FAILED";
    }
  }

  async function refreshState() {
    const [stateResponse, trendsResponse] = await Promise.all([
      send({ type: "holmeta-request-state" }),
      send({ type: "holmeta-get-trends" })
    ]);

    if (stateResponse.settings) state.settings = stateResponse.settings;
    if (stateResponse.runtime) state.runtime = stateResponse.runtime;
    if (stateResponse.entitlement) state.entitlement = stateResponse.entitlement;

    state.trends.dailyLogs = trendsResponse.dailyLogs || [];
    state.trends.hydration = trendsResponse.hydration || {};
    state.trends.calm = trendsResponse.calm || {};

    applyStateToForm();
    drawTrends();

    setStatus(`STATUS: ${isPremium() ? "ACTIVE" : "FREE MODE"} · LOCAL TIME: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }

  function bindEvents() {
    $("filterIntensity").addEventListener("input", (event) => {
      const percent = Number(event.target.value || 0);
      $("filterIntensityValue").textContent = `${percent}%`;
    });

    $("saveSettings").addEventListener("click", async () => {
      const patch = collectSettingsPatch();
      const response = await send({
        type: "holmeta-update-settings",
        patch
      });

      if (response.settings) {
        state.settings = response.settings;
      }

      await refreshState();
      setStatus(`STATUS: CONFIG SAVED · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    });

    $("saveDailyLog").addEventListener("click", async () => {
      await send({
        type: "holmeta-save-daily-log",
        payload: {
          date: HC.todayKey(),
          energy: state.selectedLog.energy,
          mood: state.selectedLog.mood,
          sleepQuality: state.selectedLog.sleepQuality
        }
      });

      $("dailyLogStatus").textContent = "LOG SAVED.";
      await refreshState();
    });

    $("saveAudit").addEventListener("click", async () => {
      await saveAudit();
    });

    $("startPostureMonitor").addEventListener("click", async () => {
      await startPostureMonitor();
    });

    $("stopPostureMonitor").addEventListener("click", () => {
      stopPostureMonitor();
    });

    $("refreshEntitlement").addEventListener("click", async () => {
      await send({ type: "holmeta-refresh-entitlement" });
      await refreshState();
    });

    $("openCheckout").addEventListener("click", async () => {
      const checkoutUrl = $("checkoutUrl").value.trim() || "https://holmeta.app/pricing";
      await chrome.tabs.create({ url: checkoutUrl });
    });

    window.addEventListener("beforeunload", () => {
      stopPostureMonitor();
    });
  }

  async function bootstrap() {
    bindRatingRows();
    bindEvents();
    attachPhotoReader();
    await loadAudit();
    await refreshState();
  }

  bootstrap();
})();
