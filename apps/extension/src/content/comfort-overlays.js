(() => {
  if (globalThis.HolmetaComfortOverlays) return;

  const IDS = {
    root: "holmeta-comfort-root",
    dimmer: "holmeta-comfort-dimmer",
    warm: "holmeta-comfort-warm",
    white: "holmeta-comfort-white",
    soft: "holmeta-comfort-soft",
    focus: "holmeta-comfort-focus"
  };

  const LAYERS = ["dimmer", "warm", "white", "soft", "focus"];

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function createLayer(name) {
    const node = document.createElement("div");
    node.className = "hm-comfort-layer";
    node.id = IDS[name];
    return node;
  }

  function ensureRoot() {
    let root = document.getElementById(IDS.root);
    if (root) return root;

    root = document.createElement("div");
    root.id = IDS.root;
    for (const name of LAYERS) root.appendChild(createLayer(name));

    (document.documentElement || document.body || document).appendChild(root);
    return root;
  }

  function getLayer(name) {
    const root = ensureRoot();
    return root.querySelector(`#${IDS[name]}`);
  }

  function setOpacity(name, value) {
    const node = getLayer(name);
    if (!node) return;
    node.style.opacity = String(clamp(value, 0, 0.95));
  }

  function update(config = {}) {
    ensureRoot();

    const dimmer = clamp(config.brightnessDimmer, 0, 60);
    const warmth = clamp(config.warmLightFilter, 0, 70);
    const whiteIntensity = clamp(config.whiteIntensity, 0, 70);
    const reduceWhites = Boolean(config.reduceWhiteIntensity);
    const contrastSoftening = String(config.contrastSoftening || "off");
    const focusFade = String(config.focusFade || "off");

    setOpacity("dimmer", dimmer / 120);
    setOpacity("warm", warmth / 250);
    setOpacity("white", reduceWhites ? (whiteIntensity / 280) : 0);

    const softOpacity = contrastSoftening === "medium"
      ? 0.14
      : contrastSoftening === "low"
        ? 0.08
        : 0;
    setOpacity("soft", softOpacity);

    const focusOpacity = focusFade === "medium"
      ? 0.34
      : focusFade === "low"
        ? 0.22
        : 0;
    setOpacity("focus", focusOpacity);

    return {
      dimmerOpacity: dimmer / 120,
      warmthOpacity: warmth / 250,
      whiteOpacity: reduceWhites ? (whiteIntensity / 280) : 0,
      softOpacity,
      focusOpacity
    };
  }

  function clear() {
    const root = document.getElementById(IDS.root);
    root?.remove?.();
  }

  globalThis.HolmetaComfortOverlays = {
    IDS,
    update,
    clear
  };
})();
