(() => {
  if (globalThis.HolmetaAppearanceSiteProfile) return;

  function hashString(input) {
    let hash = 5381;
    const text = String(input || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function inferPageType(siteType, scanSummary = {}) {
    if (siteType === "dashboard_app") return "dashboard";
    if (siteType === "ecommerce") return "ecommerce";
    if (siteType === "docs_code") return "docs";
    if (siteType === "article") return "article";
    if (siteType === "social") return "social";
    if (scanSummary.interactive >= 90) return "app";
    if (scanSummary.mediaContainers >= 18) return "media";
    if (scanSummary.monospaceBlocks >= 10) return "editor";
    return "general";
  }

  function build(input = {}) {
    const host = String(input.host || "").toLowerCase();
    const pageTone = String(input.pageTone || input.pageToneValue || "mixed");
    const siteType = String(input.siteType || "general");
    const siteClass = String(input.siteClass || "general");
    const scanSummary = input.scanSummary && typeof input.scanSummary === "object"
      ? input.scanSummary
      : {};
    const tokenDetection = input.tokenDetection && typeof input.tokenDetection === "object"
      ? input.tokenDetection
      : {};
    const media = input.media && typeof input.media === "object"
      ? input.media
      : {};

    const pageType = inferPageType(siteType, scanSummary);
    const fingerprintSource = JSON.stringify({
      host,
      pageTone,
      siteType,
      siteClass,
      pageType,
      nodes: Number(scanSummary.nodes || 0),
      interactive: Number(scanSummary.interactive || 0),
      mediaContainers: Number(scanSummary.mediaContainers || 0),
      tokenSignals: Number(scanSummary.tokenSignals || 0),
      tokenConfidence: Number(tokenDetection.confidence || 0),
      mediaCount: Number(media.mediaCount || 0),
      canvasCount: Number(media.canvasCount || 0)
    });

    return {
      host,
      pageTone,
      siteType,
      siteClass,
      pageType,
      fingerprint: hashString(fingerprintSource),
      scanSummary: {
        nodes: Number(scanSummary.nodes || 0),
        interactive: Number(scanSummary.interactive || 0),
        mediaContainers: Number(scanSummary.mediaContainers || 0),
        largeLightSurfaces: Number(scanSummary.largeLightSurfaces || 0),
        largeDarkSurfaces: Number(scanSummary.largeDarkSurfaces || 0),
        headers: Number(scanSummary.headers || 0),
        tokenSignals: Number(scanSummary.tokenSignals || 0),
        averageLuminance: Number(scanSummary.averageLuminance || 0.5)
      },
      tokenConfidence: Number(tokenDetection.confidence || 0),
      media: {
        mediaCount: Number(media.mediaCount || 0),
        canvasCount: Number(media.canvasCount || 0),
        iframeCount: Number(media.iframeCount || 0)
      }
    };
  }

  globalThis.HolmetaAppearanceSiteProfile = {
    build,
    hashString
  };
})();
