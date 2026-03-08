// HOLMETA v3.0 content runtime
// - Light engine orchestration
// - Health toasts/sound helpers
// - Site Insight popup (local-only heuristics, no external API calls)

(() => {
  if (window.__HOLMETA_V3__) return;
  window.__HOLMETA_V3__ = true;

  if (!/^https?:$/.test(location.protocol)) return;

  const IDS = {
    STYLE: "holmeta-content-style-v3",
    TOAST_HOST: "holmeta-toast-host-v3",
    INSIGHT_HOST: "holmeta-site-insight-host-v3"
  };

  const SITE_INSIGHT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const SITE_INSIGHT_LOCAL_THROTTLE_MS = 10000;

  const state = {
    settings: null,
    licensePremium: false,
    effective: {
      lightActive: false,
      blockerActive: false,
      deepWorkActive: false
    },
    diagnostics: null,
    audioCtx: null,
    morphObserver: null,
    morphDebounce: null,
    biofeedbackTimer: null,
    siteInsight: {
      hostNode: null,
      shadow: null,
      lastShownAt: 0,
      lastRenderUrl: "",
      lastRequestedUrl: "",
      navHooked: false,
      autoMinimizeTimer: null,
      pinned: false,
      minimized: false,
      config: null,
      summaryData: null
    }
  };

  function debug() {
    return Boolean(state.settings?.meta?.debug);
  }

  function log(level, event, data = {}) {
    if (level !== "error" && !debug()) return;
    const prefix = "[Holmeta content]";
    if (level === "error") console.error(prefix, event, data);
    else console.info(prefix, event, data);
  }

  function normalizeHost(input) {
    try {
      const parsed = new URL(String(input || location.href));
      if (!/^https?:$/.test(parsed.protocol)) return "";
      return parsed.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      const raw = String(input || "")
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .trim()
        .toLowerCase();
      return raw || "";
    }
  }

  function currentHost() {
    return normalizeHost(location.href);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, error: err.message || "runtime_error" });
            return;
          }
          resolve(response || { ok: false, error: "empty_response" });
        });
      } catch (error) {
        resolve({ ok: false, error: String(error?.message || "runtime_throw") });
      }
    });
  }

  function ensureStyle() {
    if (document.getElementById(IDS.STYLE)) return;
    const style = document.createElement("style");
    style.id = IDS.STYLE;
    style.textContent = `
      #${IDS.TOAST_HOST} {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 2147483646;
        display: grid;
        gap: 8px;
        pointer-events: none;
      }

      .holmeta-toast {
        min-width: 240px;
        max-width: min(360px, 90vw);
        border: 1px solid rgba(255, 179, 0, 0.36);
        background: rgba(20, 17, 15, 0.94);
        color: #f3f3f4;
        padding: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        pointer-events: auto;
      }

      .holmeta-toast .title {
        font-weight: 700;
        margin-bottom: 4px;
      }

      .holmeta-toast .actions {
        margin-top: 8px;
        display: flex;
        gap: 8px;
      }

      .holmeta-toast button {
        border: 1px solid rgba(243, 243, 244, 0.2);
        background: rgba(20, 17, 15, 0.92);
        color: #f3f3f4;
        font-size: 11px;
        min-height: 28px;
        padding: 0 8px;
        cursor: pointer;
      }

      html.holmeta-morph [class*="sidebar"],
      html.holmeta-morph [id*="sidebar"],
      html.holmeta-morph aside,
      html.holmeta-morph [role="complementary"] {
        display: none !important;
      }

      html.holmeta-morph [aria-label*="Shorts"],
      html.holmeta-morph ytd-reel-shelf-renderer,
      html.holmeta-morph #related,
      html.holmeta-morph [class*="recommend"],
      html.holmeta-morph [class*="reel"] {
        display: none !important;
      }

      html.holmeta-morph main {
        max-width: 920px !important;
        margin: 0 auto !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .holmeta-toast {
          transition: none !important;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureToastHost() {
    ensureStyle();
    let host = document.getElementById(IDS.TOAST_HOST);
    if (host) return host;
    host = document.createElement("div");
    host.id = IDS.TOAST_HOST;
    document.documentElement.appendChild(host);
    return host;
  }

  function showToast(payload = {}) {
    const host = ensureToastHost();
    const toast = document.createElement("article");
    toast.className = "holmeta-toast";
    toast.innerHTML = `
      <div class="title">${String(payload.title || "HOLMETA")}</div>
      <div>${String(payload.body || "")}</div>
      <div class="actions">
        <button data-action="dismiss">Dismiss</button>
        <button data-action="snooze">Snooze 10m</button>
      </div>
    `;

    toast.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.getAttribute("data-action");
      if (action === "snooze") {
        sendRuntimeMessage({ type: "holmeta:snooze-alerts", minutes: 10 });
      }
      toast.remove();
    });

    host.appendChild(toast);
    setTimeout(() => toast.remove(), 9000);
  }

  function getAudioContext() {
    if (state.audioCtx) return state.audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    state.audioCtx = new Ctx();
    return state.audioCtx;
  }

  async function playAlertSound(kind = "eye", volume = 0.25) {
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return false;
    }

    const frequencies = {
      eye: 540,
      posture: 460,
      burnout: 300
    };

    const hz = frequencies[kind] || 520;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(hz, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(Math.max(0.04, Math.min(0.5, Number(volume || 0.25))), t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.29);
    return true;
  }

  function applyMorphing(enabled) {
    const root = document.documentElement;
    root.classList.toggle("holmeta-morph", Boolean(enabled));

    if (enabled) ensureMorphObserver();
    else disconnectMorphObserver();
  }

  function ensureMorphObserver() {
    if (state.morphObserver) return;
    state.morphObserver = new MutationObserver(() => {
      if (state.morphDebounce) clearTimeout(state.morphDebounce);
      state.morphDebounce = setTimeout(() => {
        applyMorphing(Boolean(state.licensePremium && state.settings?.advanced?.morphing));
      }, 900);
    });

    state.morphObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function disconnectMorphObserver() {
    if (state.morphObserver) {
      state.morphObserver.disconnect();
      state.morphObserver = null;
    }
    if (state.morphDebounce) {
      clearTimeout(state.morphDebounce);
      state.morphDebounce = null;
    }
  }

  function runBiofeedbackFallback() {
    if (state.biofeedbackTimer) return;
    state.biofeedbackTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!state.settings?.advanced?.biofeedback || !state.licensePremium) return;
      showToast({
        title: "Biofeedback Beta",
        body: "Posture check: shoulders down, chin neutral, unclench jaw."
      });
    }, 5 * 60 * 1000);
  }

  function stopBiofeedbackFallback() {
    if (!state.biofeedbackTimer) return;
    clearInterval(state.biofeedbackTimer);
    state.biofeedbackTimer = null;
  }

  function applyLightEngine() {
    const engine = globalThis.HolmetaLightEngine;
    if (!engine || typeof engine.apply !== "function") {
      log("error", "light_engine_missing");
      return;
    }

    state.diagnostics = engine.apply({
      settings: state.settings,
      effective: state.effective,
      license: { premium: state.licensePremium }
    });
  }

  function sampleNodes(selector, maxCount = 30) {
    try {
      return [...document.querySelectorAll(selector)].slice(0, maxCount);
    } catch {
      return [];
    }
  }

  function safeText(input, max = 180) {
    return String(input || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function escapeSelectorValue(value) {
    const text = String(value || "");
    if (!text) return "";
    if (globalThis.CSS && typeof globalThis.CSS.escape === "function") {
      return globalThis.CSS.escape(text);
    }
    return text.replace(/["\\#.:;,[\]()=+*>~'`]/g, "\\$&");
  }

  function buildPageTextSample() {
    const chunks = [];
    const push = (value) => {
      const text = safeText(value, 220);
      if (!text) return;
      if (chunks.join(" ").length > 5000) return;
      chunks.push(text);
    };

    push(document.title);
    push(document.querySelector("meta[name='description']")?.getAttribute("content"));
    push(document.querySelector("meta[property='og:description']")?.getAttribute("content"));
    sampleNodes("h1,h2,h3,[role='heading'],p,a,button,[aria-label]", 90).forEach((node) => {
      push(node.textContent || node.getAttribute("aria-label") || "");
    });
    return chunks.join(" ").toLowerCase();
  }

  function isDynamicFeedHost(host) {
    return /(youtube\.com|x\.com|twitter\.com|reddit\.com|google\.[a-z.]+|bing\.com|duckduckgo\.com)/.test(host);
  }

  function feedBucket(host, pathName, searchPart) {
    const path = String(pathName || "").toLowerCase();
    const search = String(searchPart || "").toLowerCase();

    if (/youtube\.com/.test(host)) {
      if (/\/feed\/subscriptions/.test(path)) return "yt_subscriptions";
      if (/\/feed\/trending/.test(path)) return "yt_trending";
      if (/\/results/.test(path) || /[?&]search_query=/.test(search)) return "yt_search";
      if (/\/shorts/.test(path)) return "yt_shorts";
      if (/\/watch/.test(path)) return "yt_watch";
      return "yt_home";
    }

    if (/x\.com|twitter\.com/.test(host)) {
      if (/for_you/.test(path + search)) return "x_for_you";
      if (/following/.test(path + search) || /[?&]f=live/.test(search)) return "x_following";
      if (/\/explore/.test(path)) return "x_explore";
      return "x_home";
    }

    if (/reddit\.com/.test(host)) {
      if (/\/new/.test(path)) return "reddit_new";
      if (/\/top|\/hot|\/best/.test(path)) return "reddit_ranked";
      if (/\/search/.test(path) || /[?&]q=/.test(search)) return "reddit_search";
      return "reddit_home";
    }

    if (/google\.[a-z.]+|bing\.com|duckduckgo\.com/.test(host)) {
      if (/[?&]q=/.test(search) || /\/search/.test(path)) return "search_results";
      return "search_home";
    }

    if (/github\.com/.test(host)) {
      if (/\/notifications/.test(path)) return "gh_notifications";
      if (/\/pulls|\/issues/.test(path)) return "gh_work_queue";
      if (/\/search/.test(path) || /[?&]q=/.test(search)) return "gh_search";
      return "gh_home";
    }

    if (/figma\.com/.test(host)) {
      if (/\/file|\/design|\/proto/.test(path)) return "figma_canvas";
      return "figma_home";
    }

    return "generic";
  }

  function detectSiteType(host) {
    const path = location.pathname.toLowerCase();
    const search = location.search.toLowerCase();
    const text = buildPageTextSample();

    if (/github\.com|gitlab\.com|bitbucket\.org|stackoverflow\.com/.test(host)) return "developer";
    if (/figma\.com|dribbble\.com|behance\.net|canva\.com/.test(host)) return "design";
    if (/youtube\.com|vimeo\.com|twitch\.tv|netflix\.com/.test(host)) return "video";
    if (/x\.com|twitter\.com|facebook\.com|instagram\.com|reddit\.com|tiktok\.com/.test(host)) return "social";
    if (/docs\.google\.com|notion\.so|readthedocs|developer\.mozilla|confluence|atlassian/.test(host)) return "docs";
    if (/google\.[a-z.]+|bing\.com|duckduckgo\.com|perplexity\.ai/.test(host)) return "search";
    if (/amazon\.|shopify|etsy|checkout|cart/.test(host + path + search)) return "commerce";
    if (/news|article|opinion|breaking/.test(path) || document.querySelector("article time, [itemprop='datePublished']")) return "news";
    if (/search|results/.test(path) || /[?&](q|query)=/.test(search)) return "search";
    if (document.querySelector("form input[type='password']") && document.querySelector("nav, [role='navigation']")) return "webapp";
    if (document.querySelector("[data-testid*='feed'], [aria-label*='Feed'], .feed, [class*='infinite']")) return "social";
    if (/course|lesson|learn|curriculum/.test(path + " " + text)) return "education";
    if (/forum|community|discuss/.test(path + " " + text)) return "community";
    if (document.querySelector("[class*='pricing'], [href*='pricing'], [class*='hero']")) return "marketing";
    if (document.querySelector("[role='main']") && document.querySelector("button, input, select")) return "webapp";
    return "community";
  }

  function detectAlgorithmContext(host) {
    const path = location.pathname.toLowerCase();
    const search = location.search.toLowerCase();
    const text = buildPageTextSample();
    const bucket = feedBucket(host, path, search);

    const knownBuckets = {
      yt_subscriptions: {
        label: "Subscription/following feed",
        confidence: "high",
        explanation: "Detected YouTube subscriptions feed."
      },
      yt_trending: {
        label: "Trending/popularity",
        confidence: "high",
        explanation: "Detected YouTube trending feed."
      },
      yt_search: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected YouTube search results."
      },
      yt_shorts: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected YouTube Shorts recommendation stream."
      },
      yt_watch: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected watch page with recommendation modules."
      },
      yt_home: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected YouTube home recommendations."
      },
      x_for_you: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected For You timeline route."
      },
      x_following: {
        label: "Chronological feed",
        confidence: "medium",
        explanation: "Detected Following/live timeline route."
      },
      x_explore: {
        label: "Trending/popularity",
        confidence: "medium",
        explanation: "Detected explore/trending discovery route."
      },
      reddit_new: {
        label: "Chronological feed",
        confidence: "medium",
        explanation: "Detected Reddit new sorting route."
      },
      reddit_ranked: {
        label: "Trending/popularity",
        confidence: "high",
        explanation: "Detected Reddit ranked sorting route."
      },
      reddit_search: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected Reddit search results."
      },
      search_results: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected search query and ranked results."
      },
      gh_notifications: {
        label: "Subscription/following feed",
        confidence: "medium",
        explanation: "Detected GitHub notifications stream."
      },
      gh_search: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected GitHub search results."
      }
    };
    if (knownBuckets[bucket]) {
      return { ...knownBuckets[bucket], bucket };
    }

    let scoreRecommended = 0;
    let scoreFollowing = 0;
    let scoreTrending = 0;
    let scoreSearch = 0;
    let scoreAds = 0;

    if (/[?&](q|query)=/.test(search) || /\/search/.test(path)) scoreSearch += 3;
    if (/for you|recommended|because you watched|discover/.test(text)) scoreRecommended += 2;
    if (/following|subscriptions|subscribed/.test(text)) scoreFollowing += 2;
    if (/trending|top|hot/.test(text)) scoreTrending += 2;
    if (/sponsored|promoted|ad choices|ads/.test(text)) scoreAds += 2;

    if (document.querySelector("[aria-label*='For you' i], [data-testid*='for-you' i]")) scoreRecommended += 3;
    if (document.querySelector("[aria-label*='Following' i], [href*='subscriptions' i]")) scoreFollowing += 3;
    if (document.querySelector("[aria-label*='Trending' i], [href*='trending' i]")) scoreTrending += 3;
    if (document.querySelector("[aria-label*='Sponsored' i], [data-testid*='sponsored' i], [id*='ad' i], [class*='ad-' i]")) scoreAds += 2;
    if (document.querySelector("input[type='search'], [role='search']")) scoreSearch += 1;

    const ranked = [
      { key: "search", score: scoreSearch, label: "Search results ranking", explanation: "Detected search route and query cues." },
      { key: "recommended", score: scoreRecommended, label: "Recommendation feed", explanation: "Detected recommendation/feed modules." },
      { key: "following", score: scoreFollowing, label: "Subscription/following feed", explanation: "Detected following/subscription cues." },
      { key: "trending", score: scoreTrending, label: "Trending/popularity", explanation: "Detected trending/top ranking cues." },
      { key: "ads", score: scoreAds, label: "Ads/auction-driven", explanation: "Detected sponsored/ad placement markers." }
    ].sort((a, b) => b.score - a.score);

    if (ranked[0].score >= 4) return { label: ranked[0].label, confidence: "high", explanation: ranked[0].explanation, bucket };
    if (ranked[0].score >= 2) return { label: ranked[0].label, confidence: "medium", explanation: ranked[0].explanation, bucket };
    return { label: "Personalized home", confidence: "low", explanation: "No strong feed markers detected.", bucket };
  }

  function detectPurposeSummary(host, siteType) {
    const known = [
      [/youtube\.com/, "This site is primarily for video discovery and playback. Main action: watch content and follow recommendation chains."],
      [/github\.com/, "This site is primarily for code collaboration. Main action: review issues, PRs, and docs tied to repositories."],
      [/figma\.com/, "This site is primarily for design collaboration. Main action: edit files, inspect components, and comment on UI work."],
      [/notion\.so|docs\.google\.com/, "This site is primarily for documentation and team notes. Main action: read, edit, and organize structured information."],
      [/amazon\./, "This site is primarily for ecommerce. Main action: compare products, evaluate trust signals, and complete checkout."],
      [/reddit\.com/, "This site is primarily for community discussion. Main action: browse ranked threads and engage in conversations."]
    ];
    const knownSummary = known.find(([pattern]) => pattern.test(host));
    if (knownSummary) return knownSummary[1];

    const desc =
      document.querySelector("meta[name='description']")?.getAttribute("content") ||
      document.querySelector("meta[property='og:description']")?.getAttribute("content") ||
      "";
    const heading = safeText(document.querySelector("h1, h2")?.textContent || "", 120);
    const siteName =
      safeText(
        document.querySelector("meta[property='og:site_name']")?.getAttribute("content") ||
          document.querySelector("meta[name='application-name']")?.getAttribute("content") ||
          host,
        64
      );

    const mainAction = (() => {
      if (document.querySelector("[href*='checkout'], [class*='checkout'], [data-testid*='buy']")) return "purchase or compare options";
      if (document.querySelector("input[type='search'], [role='search']")) return "search and navigate results";
      if (document.querySelector("video")) return "watch video content";
      if (document.querySelector("article")) return "read long-form content";
      if (document.querySelector("form input[type='password']")) return "sign in and continue workflow";
      return "navigate key sections";
    })();

    const snippet = safeText(desc || heading, 150);
    if (snippet) {
      return `This site is primarily for ${siteType}. Main action: ${mainAction}. ${siteName}: ${snippet}`;
    }
    return `This site is primarily for ${siteType}. Main action: ${mainAction}.`;
  }

  function detectTrustSignals() {
    const hasPrivacy = Boolean(document.querySelector("a[href*='privacy']"));
    const hasTerms = Boolean(document.querySelector("a[href*='terms']"));
    const hasContact = Boolean(document.querySelector("a[href*='contact'], a[href*='about']"));
    const https = location.protocol === "https:";
    return { https, hasPrivacy, hasTerms, hasContact };
  }

  function detectNavHints() {
    return {
      hasMenu: Boolean(document.querySelector("nav, [role='navigation'], [aria-label*='menu' i]")),
      hasSearch: Boolean(document.querySelector("input[type='search'], [role='search'], form[action*='search']")),
      hasAuth: Boolean(document.querySelector("a[href*='login'], a[href*='signin'], button[aria-label*='log in' i]"))
    };
  }

  function detectAggressivePopup() {
    const fixedLarge = sampleNodes("div,section,aside", 120).filter((node) => {
      const style = window.getComputedStyle(node);
      if (style.position !== "fixed") return false;
      const rect = node.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 120) return false;
      const visible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0.2;
      return visible;
    });
    return fixedLarge.length > 0;
  }

  function detectTechStack(host) {
    const scripts = [...document.querySelectorAll("script[src]")].map((node) => String(node.getAttribute("src") || ""));
    const html = document.documentElement?.outerHTML?.slice(0, 120000) || "";

    const stack = [];
    if (window.__NEXT_DATA__ || scripts.some((src) => /_next\//.test(src))) stack.push("Next.js");
    if (window.__NUXT__ || scripts.some((src) => /_nuxt\//.test(src))) stack.push("Nuxt");
    if (document.querySelector("[ng-version]")) stack.push("Angular");
    if (scripts.some((src) => /vue(\.runtime)?(\.global)?\.js|\/vue\//i.test(src))) stack.push("Vue");
    if (scripts.some((src) => /svelte|sveltekit/i.test(src))) stack.push("Svelte");
    if (/wp-content|wp-includes/.test(html) || /wordpress/i.test(host)) stack.push("WordPress");
    if (/cdn\.shopify|shopify/i.test(html + scripts.join(" "))) stack.push("Shopify");
    if (/webflow/i.test(html + scripts.join(" "))) stack.push("Webflow");
    if (/wixstatic|wix\.com/.test(html + scripts.join(" "))) stack.push("Wix");
    if (!stack.length && scripts.some((src) => /react/i.test(src))) stack.push("React (heuristic)");
    return stack.slice(0, 4);
  }

  function detectPerformanceSnapshot() {
    const nav = performance.getEntriesByType("navigation")[0];
    if (!nav) return null;
    const ttfb = Math.max(0, Math.round((nav.responseStart || 0) - (nav.requestStart || 0)));
    const dcl = Math.max(0, Math.round(nav.domContentLoadedEventEnd || 0));
    const load = Math.max(0, Math.round(nav.loadEventEnd || 0));
    const resources = performance.getEntriesByType("resource");
    return {
      ttfb,
      dcl,
      load,
      requests: resources.length
    };
  }

  function detectScriptFootprint(host) {
    const scripts = [...document.querySelectorAll("script[src]")].map((node) => String(node.src || ""));
    const thirdParty = scripts.filter((src) => {
      const scriptHost = normalizeHost(src);
      if (!scriptHost) return false;
      if (scriptHost === host) return false;
      if (scriptHost.endsWith(`.${host}`)) return false;
      return true;
    });
    return {
      totalScripts: scripts.length,
      thirdPartyScripts: thirdParty.length
    };
  }

  function detectSecurityHints() {
    const cspMeta = Boolean(document.querySelector("meta[http-equiv='Content-Security-Policy']"));
    const robotsMeta = Boolean(document.querySelector("meta[name='robots']"));
    return {
      cspMeta,
      robotsMeta
    };
  }

  function detectFontsAndColors() {
    const nodes = sampleNodes("h1,h2,h3,p,a,button,input,label,main,section", 40);
    const fontFreq = new Map();
    const colorFreq = new Map();

    nodes.forEach((node) => {
      const style = window.getComputedStyle(node);
      const family = safeText(style.fontFamily || "", 64);
      if (family) fontFreq.set(family, (fontFreq.get(family) || 0) + 1);
      const bg = safeText(style.backgroundColor || "", 48);
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        colorFreq.set(bg, (colorFreq.get(bg) || 0) + 1);
      }
    });

    const topFonts = [...fontFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);
    const topColors = [...colorFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return { topFonts, topColors };
  }

  function detectLayoutHints() {
    const sample = sampleNodes("div,section,article,main,aside", 60);
    let gridCount = 0;
    let flexCount = 0;
    sample.forEach((node) => {
      const style = window.getComputedStyle(node);
      if (style.display.includes("grid")) gridCount += 1;
      if (style.display.includes("flex")) flexCount += 1;
    });
    const transitionNodes = sampleNodes("*", 120).filter((node) => {
      const style = window.getComputedStyle(node);
      const t = String(style.transitionDuration || "0s");
      const a = String(style.animationDuration || "0s");
      return !/^0s(,\s*0s)*$/.test(t) || !/^0s(,\s*0s)*$/.test(a);
    }).length;
    return { gridCount, flexCount, transitionNodes };
  }

  function detectAnalyticsTags() {
    const html = document.documentElement?.outerHTML?.slice(0, 200000).toLowerCase() || "";
    const scripts = [...document.querySelectorAll("script[src]")].map((n) => String(n.src || "").toLowerCase()).join(" ");
    const blob = `${html} ${scripts}`;
    const checks = [
      ["Google Analytics / gtag", /googletagmanager|gtag\(/],
      ["Segment", /segment\.com|analytics\.js/],
      ["Hotjar", /hotjar/],
      ["FullStory", /fullstory/],
      ["Microsoft Clarity", /clarity\.ms|microsoft clarity/],
      ["Optimizely", /optimizely/],
      ["VWO", /\bvwo\b|visual website optimizer/]
    ];
    return checks.filter(([, pattern]) => pattern.test(blob)).map(([name]) => name);
  }

  function detectFrictionAndA11y() {
    const popups = detectAggressivePopup() ? 1 : 0;
    const cookieBanner = Boolean(document.querySelector("[id*='cookie' i], [class*='cookie' i], [aria-label*='cookie' i]"));
    const primaryForm = document.querySelector("main form, form[action*='checkout'], form[action*='signup'], form[action*='login']") || document.querySelector("form");
    const formInputs = primaryForm ? primaryForm.querySelectorAll("input, select, textarea").length : 0;

    const images = sampleNodes("img", 120);
    const missingAlt = images.filter((img) => !img.hasAttribute("alt") || !safeText(img.getAttribute("alt"), 10)).length;

    const controls = sampleNodes("input,button,select,textarea", 120);
    const missingLabel = controls.filter((el) => {
      const id = el.id;
      if (id && document.querySelector(`label[for="${escapeSelectorValue(id)}"]`)) return false;
      if (el.closest("label")) return false;
      if (el.getAttribute("aria-label")) return false;
      return true;
    }).length;

    return {
      popups,
      cookieBanner,
      formInputs,
      missingAlt,
      missingLabel
    };
  }

  function guessSsrCsr() {
    const htmlLength = (document.documentElement?.innerHTML || "").length;
    const textLength = safeText(document.body?.innerText || "", 120000).length;
    const scriptCount = document.scripts.length;
    if (textLength > 1200 && htmlLength > 40000) return "SSR/Hybrid likely";
    if (scriptCount > 18 && textLength < 700) return "CSR-heavy likely";
    return "Hybrid likely";
  }

  function buildProfileBullets(summary) {
    const regular = [];
    regular.push(summary.purposeSummary);
    regular.push(`Main value: ${summary.metaSnippet || "Clear user action and navigation flow."}`);
    regular.push(
      `Trust signals: HTTPS ${summary.trustSignals.https ? "yes" : "no"} · Privacy ${
        summary.trustSignals.hasPrivacy ? "link found" : "not found"
      } · Contact/About ${summary.trustSignals.hasContact ? "visible" : "not obvious"}`
    );
    regular.push(
      `Navigation hints: menu ${summary.navHints.hasMenu ? "found" : "not obvious"} · search ${
        summary.navHints.hasSearch ? "found" : "not obvious"
      } · login ${summary.navHints.hasAuth ? "found" : "not obvious"}`
    );
    if (summary.aggressivePopup) {
      regular.push("Warning: large modal/overlay detected early in session.");
    }

    const dev = [];
    dev.push(`Stack hints: ${summary.stack.length ? summary.stack.join(", ") : "No strong framework signature detected"}`);
    if (summary.performance) {
      dev.push(
        `Performance snapshot: TTFB ${summary.performance.ttfb}ms · DCL ${summary.performance.dcl}ms · Load ${summary.performance.load}ms · Requests ${summary.performance.requests}`
      );
    }
    dev.push(
      `Script footprint: ${summary.scriptFootprint.thirdPartyScripts} third-party of ${summary.scriptFootprint.totalScripts} scripts`
    );
    dev.push(`Security hints: CSP meta ${summary.security.cspMeta ? "present" : "not in DOM"} · robots meta ${summary.security.robotsMeta ? "present" : "not in DOM"}`);
    dev.push(`Rendering model guess: ${summary.renderModel}`);
    dev.push(`Quick links: ${location.origin}/robots.txt · ${location.origin}/sitemap.xml`);
    dev.push(
      `Feed model: ${summary.algorithm.label} (${summary.algorithm.confidence}) — ${summary.algorithm.explanation}`
    );

    const design = [];
    design.push(`Fonts sampled: ${summary.design.topFonts.length ? summary.design.topFonts.join(" | ") : "No stable font sample yet"}`);
    design.push(`Palette sample: ${summary.design.topColors.length ? summary.design.topColors.join(" · ") : "No dominant colors sampled"}`);
    design.push(`Layout pattern: grid ${summary.layout.gridCount} · flex ${summary.layout.flexCount}`);
    design.push(`Motion signals: ${summary.layout.transitionNodes} elements with transitions/animations`);
    design.push(
      `Whitespace density: ${summary.layout.flexCount + summary.layout.gridCount > 18 ? "structured/dense" : "open/simple"}`
    );
    design.push(
      `A11y quick checks: missing alt ${summary.friction.missingAlt} · unlabeled controls ${summary.friction.missingLabel}`
    );

    const uxr = [];
    uxr.push(`Analytics tags: ${summary.analytics.length ? summary.analytics.join(", ") : "No common analytics tags detected"}`);
    uxr.push(`Friction cues: popups ${summary.friction.popups} · cookie banner ${summary.friction.cookieBanner ? "present" : "not detected"}`);
    uxr.push(`Form complexity: ${summary.friction.formInputs} controls in primary form`);
    uxr.push(`CTA density (above fold): ${summary.ctaCount}`);
    uxr.push(`Accessibility sample: missing alt ${summary.friction.missingAlt} · unlabeled controls ${summary.friction.missingLabel}`);
    uxr.push("Suggested question: What is the primary user goal on this page?");
    uxr.push("Suggested question: Is the CTA clear above the fold?");
    uxr.push("Suggested question: Is there friction before user value appears?");

    return { regular, dev, design, uxr };
  }

  function computeSiteInsightSummary(host) {
    const siteType = detectSiteType(host);
    const algorithm = detectAlgorithmContext(host);
    const purposeSummary = detectPurposeSummary(host, siteType);
    const trustSignals = detectTrustSignals();
    const navHints = detectNavHints();
    const aggressivePopup = detectAggressivePopup();
    const stack = detectTechStack(host);
    const performance = detectPerformanceSnapshot();
    const scriptFootprint = detectScriptFootprint(host);
    const security = detectSecurityHints();
    const design = detectFontsAndColors();
    const layout = detectLayoutHints();
    const analytics = detectAnalyticsTags();
    const friction = detectFrictionAndA11y();
    const renderModel = guessSsrCsr();
    const ctaCount = sampleNodes("button, a[role='button'], input[type='submit']", 80).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top <= Math.max(window.innerHeight, 1);
    }).length;

    const metaSnippet = safeText(
      document.querySelector("meta[name='description']")?.getAttribute("content") ||
        document.querySelector("meta[property='og:description']")?.getAttribute("content") ||
        document.querySelector("h1,h2")?.textContent ||
        "",
      120
    );

    const summary = {
      computedAt: Date.now(),
      host,
      url: location.href,
      bucket: feedBucket(host, location.pathname, location.search),
      siteType,
      algorithm,
      purposeSummary,
      metaSnippet,
      trustSignals,
      navHints,
      aggressivePopup,
      stack,
      performance,
      scriptFootprint,
      security,
      design,
      layout,
      analytics,
      friction,
      renderModel,
      ctaCount
    };

    summary.profiles = buildProfileBullets(summary);
    return summary;
  }

  function shouldUseCachedSummary(host, cachedSummary) {
    if (!cachedSummary || typeof cachedSummary !== "object") return false;
    if (normalizeHost(cachedSummary.host || "") !== host) return false;
    if (!isDynamicFeedHost(host)) return true;
    const currentBucket = feedBucket(host, location.pathname, location.search);
    const cachedBucket = String(cachedSummary.algorithm?.bucket || cachedSummary.bucket || "");
    return Boolean(currentBucket && cachedBucket && currentBucket === cachedBucket);
  }

  function ensureInsightUi() {
    if (state.siteInsight.hostNode?.isConnected && state.siteInsight.shadow) return state.siteInsight;

    let host = document.getElementById(IDS.INSIGHT_HOST);
    if (!host) {
      host = document.createElement("div");
      host.id = IDS.INSIGHT_HOST;
      host.style.position = "fixed";
      host.style.right = "12px";
      host.style.bottom = "12px";
      host.style.zIndex = "2147483645";
      host.style.pointerEvents = "auto";
      host.style.maxWidth = "min(392px, calc(100vw - 24px))";
      host.style.minWidth = "280px";
      host.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif";
      document.documentElement.appendChild(host);
    }

    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        .hm-wrap {
          all: initial;
          display: grid;
          gap: 8px;
          width: min(392px, calc(100vw - 24px));
          max-height: min(60vh, 520px);
        }

        .hm-panel {
          box-sizing: border-box;
          border: 1px solid rgba(243, 243, 244, 0.18);
          border-radius: 2px;
          background: linear-gradient(180deg, rgba(27, 25, 23, 0.96) 0%, rgba(34, 32, 29, 0.96) 100%);
          color: #f3f3f4;
          padding: 12px;
          display: grid;
          gap: 10px;
          box-shadow: 0 8px 24px rgba(20, 17, 15, 0.45);
          overflow: auto;
          max-height: min(60vh, 520px);
        }

        .hm-panel.minimized {
          display: none;
        }

        .hm-pill {
          border: 1px solid rgba(243, 243, 244, 0.2);
          border-radius: 2px;
          background: rgba(20, 17, 15, 0.96);
          color: #f3f3f4;
          min-height: 34px;
          padding: 0 12px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
        }

        .hm-pill.show {
          display: inline-flex;
        }

        .hm-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .hm-header {
          justify-content: space-between;
          gap: 10px;
        }

        .hm-host {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .hm-host strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hm-controls button,
        .hm-controls select {
          border: 1px solid rgba(243, 243, 244, 0.22);
          border-radius: 2px;
          background: rgba(20, 17, 15, 0.86);
          color: #f3f3f4;
          min-height: 30px;
          font-size: 11px;
          padding: 0 8px;
        }

        .hm-controls button {
          min-width: 30px;
          cursor: pointer;
        }

        .hm-controls {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .hm-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 11px;
          color: #d9c5b2;
        }

        .hm-chip {
          border: 1px solid rgba(243, 243, 244, 0.22);
          border-radius: 2px;
          padding: 2px 7px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 10px;
        }

        .hm-summary {
          margin: 0;
          color: #f3f3f4;
          font-size: 12px;
          line-height: 1.45;
        }

        .hm-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }

        .hm-list li {
          border: 1px solid rgba(243, 243, 244, 0.14);
          border-radius: 2px;
          background: rgba(20, 17, 15, 0.58);
          padding: 8px;
          font-size: 11px;
          line-height: 1.4;
          color: #d9c5b2;
        }

        .hm-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .hm-foot button {
          border: 1px solid rgba(243, 243, 244, 0.22);
          border-radius: 2px;
          background: rgba(20, 17, 15, 0.86);
          color: #f3f3f4;
          min-height: 30px;
          font-size: 11px;
          padding: 0 10px;
          cursor: pointer;
        }

        .hm-foot small {
          color: #d9c5b2;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        @media (prefers-reduced-motion: no-preference) {
          .hm-panel {
            transition: opacity 180ms ease, transform 180ms ease;
          }
          .hm-panel.minimized {
            opacity: 0;
            transform: translateY(4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hm-panel {
            transition: none;
          }
        }
      </style>
      <div class="hm-wrap" role="dialog" aria-label="Holmeta Site Insight">
        <section class="hm-panel" id="hmInsightPanel">
          <div class="hm-row hm-header">
            <div class="hm-host">
              <img id="hmInsightFavicon" width="16" height="16" alt="" />
              <strong id="hmInsightHost">site</strong>
            </div>
            <div class="hm-controls">
              <select id="hmInsightProfile" aria-label="Insight profile">
                <option value="regular">Regular</option>
                <option value="dev">Dev</option>
                <option value="design">Design</option>
                <option value="uxr">UXR</option>
              </select>
              <button id="hmInsightPin" title="Pin open" aria-label="Pin open">PIN</button>
              <button id="hmInsightSettings" title="Open settings" aria-label="Open settings">SET</button>
              <button id="hmInsightClose" title="Close" aria-label="Close">X</button>
            </div>
          </div>
          <div class="hm-meta">
            <span class="hm-chip" id="hmInsightType">site</span>
            <span class="hm-chip" id="hmInsightAlgo">algorithm</span>
            <span class="hm-chip" id="hmInsightConfidence">confidence</span>
          </div>
          <p class="hm-summary" id="hmInsightSummary"></p>
          <ul class="hm-list" id="hmInsightBullets"></ul>
          <div class="hm-foot">
            <small id="hmInsightStatus">Holmeta Insight</small>
            <button id="hmInsightDisableSite">Disable on this site</button>
          </div>
        </section>
        <button class="hm-pill" id="hmInsightPill">Holmeta Insight</button>
      </div>
    `;

    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    const profile = shadow.getElementById("hmInsightProfile");
    const closeBtn = shadow.getElementById("hmInsightClose");
    const pinBtn = shadow.getElementById("hmInsightPin");
    const settingsBtn = shadow.getElementById("hmInsightSettings");
    const disableBtn = shadow.getElementById("hmInsightDisableSite");

    closeBtn?.addEventListener("click", () => {
      minimizeInsight(true);
    });

    pill?.addEventListener("click", () => {
      restoreInsight();
    });

    pinBtn?.addEventListener("click", () => {
      state.siteInsight.pinned = !state.siteInsight.pinned;
      pinBtn.textContent = state.siteInsight.pinned ? "UNPIN" : "PIN";
      pinBtn.title = state.siteInsight.pinned ? "Pinned" : "Pin open";
      if (state.siteInsight.pinned && state.siteInsight.autoMinimizeTimer) {
        clearTimeout(state.siteInsight.autoMinimizeTimer);
        state.siteInsight.autoMinimizeTimer = null;
      }
    });

    settingsBtn?.addEventListener("click", () => {
      sendRuntimeMessage({ type: "holmeta:open-options" });
    });

    disableBtn?.addEventListener("click", async () => {
      const hostName = currentHost();
      if (!hostName) return;
      const response = await sendRuntimeMessage({ type: "holmeta:disable-site-insight-host", host: hostName });
      if (!response?.ok) {
        log("error", "site_insight_disable_failed", response);
        return;
      }
      minimizeInsight(false);
    });

    profile?.addEventListener("change", async () => {
      const selectedProfile = String(profile.value || "regular");
      const response = await sendRuntimeMessage({
        type: "holmeta:update-settings",
        patch: { siteInsight: { selectedProfile } }
      });
      if (response?.ok) {
        state.settings = response.state.settings;
        if (state.siteInsight.summaryData) {
          renderInsightPanel(state.siteInsight.summaryData, state.settings.siteInsight);
        }
      }
    });

    state.siteInsight.hostNode = host;
    state.siteInsight.shadow = shadow;
    return state.siteInsight;
  }

  function minimizeInsight(showPill) {
    const shadow = state.siteInsight.shadow;
    if (!shadow) return;
    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    if (!panel || !pill) return;
    panel.classList.add("minimized");
    state.siteInsight.minimized = true;
    const canShowPill = Boolean(showPill && state.siteInsight.config?.minimizedPill);
    pill.classList.toggle("show", canShowPill);
  }

  function restoreInsight() {
    const shadow = state.siteInsight.shadow;
    if (!shadow) return;
    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    if (!panel || !pill) return;
    panel.classList.remove("minimized");
    pill.classList.remove("show");
    state.siteInsight.minimized = false;
    scheduleInsightAutoMinimize();
  }

  function scheduleInsightAutoMinimize() {
    const cfg = state.siteInsight.config || {};
    if (state.siteInsight.autoMinimizeTimer) {
      clearTimeout(state.siteInsight.autoMinimizeTimer);
      state.siteInsight.autoMinimizeTimer = null;
    }
    if (!cfg.autoMinimize || state.siteInsight.pinned) return;
    const duration = Math.max(6000, Math.min(10000, Number(cfg.durationMs || 8000)));
    state.siteInsight.autoMinimizeTimer = setTimeout(() => {
      minimizeInsight(true);
      state.siteInsight.autoMinimizeTimer = null;
    }, duration);
  }

  function profileLabel(profile) {
    if (profile === "dev") return "Developers";
    if (profile === "design") return "Designers";
    if (profile === "uxr") return "UX Research / CRO";
    return "Regular / Visitor";
  }

  function resolveProfile(settings) {
    const profiles = settings?.enabledProfiles || {};
    const selected = String(settings?.selectedProfile || "regular");
    if (profiles[selected]) return selected;
    return ["regular", "dev", "design", "uxr"].find((key) => profiles[key]) || "regular";
  }

  function renderInsightPanel(summaryData, settings) {
    ensureInsightUi();
    const shadow = state.siteInsight.shadow;
    if (!shadow) return;

    const selected = resolveProfile(settings);
    const host = summaryData.host || currentHost();
    const algo = summaryData.algorithm || { label: "Unknown", confidence: "low", explanation: "" };
    const bullets = (summaryData.profiles?.[selected] || []).slice(0, selected === "regular" ? 6 : 10);

    shadow.getElementById("hmInsightHost").textContent = host;
    const fav = shadow.getElementById("hmInsightFavicon");
    fav.src = `${location.origin}/favicon.ico`;
    fav.onerror = () => {
      fav.style.display = "none";
    };

    const profileSelect = shadow.getElementById("hmInsightProfile");
    profileSelect.value = selected;
    [...profileSelect.options].forEach((opt) => {
      const key = String(opt.value || "");
      opt.disabled = !Boolean(settings?.enabledProfiles?.[key]);
    });

    shadow.getElementById("hmInsightType").textContent = String(summaryData.siteType || "site");
    shadow.getElementById("hmInsightAlgo").textContent = settings?.showAlgorithmLabel
      ? safeText(algo.label, 32)
      : "algorithm hidden";
    shadow.getElementById("hmInsightConfidence").textContent = safeText(algo.confidence || "low", 12);
    shadow.getElementById("hmInsightSummary").textContent = settings?.showPurposeSummary
      ? safeText(summaryData.purposeSummary || "", 220)
      : `Profile: ${profileLabel(selected)}`;
    shadow.getElementById("hmInsightStatus").textContent = `Profile: ${profileLabel(selected)}`;

    const list = shadow.getElementById("hmInsightBullets");
    list.innerHTML = bullets.map((line) => `<li>${safeText(line, 220)}</li>`).join("");

    const disableBtn = shadow.getElementById("hmInsightDisableSite");
    disableBtn.textContent = `Disable on ${host}`;

    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    panel.classList.remove("minimized");
    pill.classList.remove("show");
    state.siteInsight.minimized = false;
    state.siteInsight.summaryData = summaryData;
    state.siteInsight.config = settings;
    state.siteInsight.lastShownAt = Date.now();
    state.siteInsight.lastRenderUrl = location.href;

    scheduleInsightAutoMinimize();
  }

  async function showSiteInsight(payload = {}) {
    if (document.visibilityState !== "visible") return;
    if (!/^https?:$/.test(location.protocol)) return;

    const nowTs = Date.now();
    const throttleMs = Math.max(SITE_INSIGHT_LOCAL_THROTTLE_MS, Number(payload.throttleMs || SITE_INSIGHT_LOCAL_THROTTLE_MS));
    if (nowTs - state.siteInsight.lastShownAt < throttleMs && state.siteInsight.lastRenderUrl === location.href) {
      return;
    }

    const settings = payload.settings || state.settings?.siteInsight || null;
    if (!settings?.enabled || !settings?.showOnEverySite) return;

    const host = normalizeHost(payload.host || location.href);
    if (!host) return;
    if (settings.perSiteDisabled?.[host]) return;

    let summaryData = null;
    const cachedAt = Math.max(0, Number(payload.cachedAt || 0));
    if (
      payload.cachedSummary &&
      cachedAt > 0 &&
      nowTs - cachedAt < SITE_INSIGHT_CACHE_TTL_MS &&
      shouldUseCachedSummary(host, payload.cachedSummary)
    ) {
      summaryData = payload.cachedSummary;
    }

    if (!summaryData || !summaryData.profiles) {
      summaryData = computeSiteInsightSummary(host);
      sendRuntimeMessage({
        type: "holmeta:site-insight-cache-set",
        host,
        summaryData
      }).catch(() => {});
    }

    renderInsightPanel(summaryData, settings);
  }

  async function refreshSiteInsightFromBackground(reason = "navigation") {
    const url = location.href;
    if (!/^https?:/.test(url)) return;

    const nowTs = Date.now();
    if (state.siteInsight.lastRequestedUrl === url && nowTs - state.siteInsight.lastShownAt < SITE_INSIGHT_LOCAL_THROTTLE_MS) {
      return;
    }

    state.siteInsight.lastRequestedUrl = url;
    const response = await sendRuntimeMessage({
      type: "holmeta:get-site-insight-config",
      host: currentHost()
    });
    if (!response?.ok) return;

    await showSiteInsight({
      host: response.host || currentHost(),
      url,
      settings: response.settings,
      cachedSummary: response.cached?.summaryData || null,
      cachedAt: Number(response.cached?.computedAt || 0),
      throttleMs: SITE_INSIGHT_LOCAL_THROTTLE_MS,
      source: reason
    });
  }

  function bindSpaNavigationHooks() {
    if (state.siteInsight.navHooked) return;
    state.siteInsight.navHooked = true;

    const dispatch = () => {
      window.dispatchEvent(new CustomEvent("holmeta:spa-url-change"));
    };

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function pushStateProxy(...args) {
      const result = originalPush.apply(this, args);
      dispatch();
      return result;
    };

    history.replaceState = function replaceStateProxy(...args) {
      const result = originalReplace.apply(this, args);
      dispatch();
      return result;
    };

    let navTimer = null;
    const onChange = () => {
      if (navTimer) clearTimeout(navTimer);
      navTimer = setTimeout(() => {
        refreshSiteInsightFromBackground("spa");
        navTimer = null;
      }, 550);
    };

    window.addEventListener("holmeta:spa-url-change", onChange, { passive: true });
    window.addEventListener("popstate", onChange, { passive: true });
  }

  function applyState(payload = {}) {
    if (payload.settings && typeof payload.settings === "object") {
      state.settings = payload.settings;
    }

    if (payload.license && typeof payload.license === "object") {
      state.licensePremium = Boolean(payload.license.premium);
    }

    if (payload.effective && typeof payload.effective === "object") {
      state.effective = {
        ...state.effective,
        ...payload.effective
      };
    }

    if (!state.settings) return;

    applyLightEngine();
    applyMorphing(Boolean(state.licensePremium && state.settings.advanced?.morphing));

    if (state.licensePremium && state.settings.advanced?.biofeedback) {
      runBiofeedbackFallback();
    } else {
      stopBiofeedbackFallback();
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = String(message?.type || "");

    if (type === "holmeta:apply-state") {
      applyState(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:show-site-insight") {
      showSiteInsight(message.payload || {}).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (type === "holmeta:toast") {
      showToast(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:sound") {
      const payload = message.payload || {};
      playAlertSound(payload.kind, payload.volume).then((ok) => sendResponse({ ok }));
      return true;
    }

    if (type === "holmeta:get-light-diagnostics") {
      const diagnostics = globalThis.HolmetaLightEngine?.getDiagnostics?.() || state.diagnostics || null;
      sendResponse({ ok: true, diagnostics });
      return false;
    }

    if (type === "holmeta:set-spotlight-point") {
      const point = message.point || {};
      globalThis.HolmetaLightEngine?.setSpotlightPoint?.(point);
      applyLightEngine();
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:clear-spotlight-point") {
      globalThis.HolmetaLightEngine?.resetSpotlightPoint?.();
      applyLightEngine();
      sendResponse({ ok: true });
      return false;
    }

    sendResponse({ ok: false, error: "unknown_message" });
    return false;
  });

  chrome.runtime.sendMessage({ type: "holmeta:get-state" }, (response) => {
    const err = chrome.runtime.lastError;
    if (err || !response?.ok) return;

    applyState({
      settings: response.state.settings,
      license: response.state.license,
      effective: {
        lightActive: response.state.runtime.lightActive,
        blockerActive: response.state.runtime.blockerActive,
        deepWorkActive: Boolean(response.state.settings?.deepWork?.active)
      }
    });

    bindSpaNavigationHooks();
    setTimeout(() => {
      refreshSiteInsightFromBackground("boot");
    }, 950);
  });

  globalThis.__HOLMETA_CONTENT_TEST__ = {
    normalizeHost: globalThis.HolmetaLightEngine?.normalizeHost || normalizeHost
  };
})();
