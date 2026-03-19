(() => {
  if (globalThis.HolmetaMediaProtection) return;

  const ATTR_MEDIA = "data-hm-comfort-media";
  const ATTR_REASON = "data-hm-comfort-reason";

  const IMAGE_SELECTOR = "img, picture, canvas, svg";
  const VIDEO_SELECTOR = "video";
  const ALWAYS_SAFE_SELECTOR = "iframe, object, embed";

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function markNode(node, reason) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR_MEDIA, "1");
    node.setAttribute(ATTR_REASON, reason);
  }

  function clear(scope = document) {
    scope.querySelectorAll?.(`[${ATTR_MEDIA}]`).forEach((node) => {
      if (!(node instanceof Element)) return;
      node.removeAttribute(ATTR_MEDIA);
      node.removeAttribute(ATTR_REASON);
      node.style.removeProperty("filter");
    });
  }

  function applyMarks(scope = document, options = {}) {
    const preserveImages = options.preserveImages !== false;
    const preserveVideos = options.preserveVideos !== false;

    clear(scope);

    let images = 0;
    let videos = 0;
    let embeds = 0;

    if (preserveImages) {
      scope.querySelectorAll?.(IMAGE_SELECTOR).forEach((node) => {
        markNode(node, "image");
        images += 1;
      });
    }

    if (preserveVideos) {
      scope.querySelectorAll?.(VIDEO_SELECTOR).forEach((node) => {
        markNode(node, "video");
        videos += 1;
      });
    }

    scope.querySelectorAll?.(ALWAYS_SAFE_SELECTOR).forEach((node) => {
      markNode(node, "embed");
      embeds += 1;
    });

    return {
      images,
      videos,
      embeds,
      total: images + videos + embeds
    };
  }

  function compensationCss(options = {}) {
    const preserveImages = options.preserveImages !== false;
    const preserveVideos = options.preserveVideos !== false;

    if (!preserveImages && !preserveVideos) return "";

    const dimmer = clamp(options.brightnessDimmer, 0, 60);
    const warmth = clamp(options.warmLightFilter, 0, 70);
    const whiteIntensity = Boolean(options.reduceWhiteIntensity)
      ? clamp(options.whiteIntensity, 0, 70)
      : 0;

    const brightness = (1 + (dimmer / 100) * 0.64 + (whiteIntensity / 100) * 0.26).toFixed(3);
    const saturation = (1 + (warmth / 100) * 0.30 + (whiteIntensity / 100) * 0.12).toFixed(3);

    const selectors = [];
    if (preserveImages) selectors.push(`${IMAGE_SELECTOR}`);
    if (preserveVideos) selectors.push(`${VIDEO_SELECTOR}`);

    if (!selectors.length) return "";

    return `
html[data-hm-comfort='1'] :where(${selectors.join(",")}) {
  filter: brightness(${brightness}) saturate(${saturation}) !important;
}
`;
  }

  globalThis.HolmetaMediaProtection = {
    ATTR_MEDIA,
    ATTR_REASON,
    applyMarks,
    clear,
    compensationCss
  };
})();
