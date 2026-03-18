(() => {
  if (globalThis.HolmetaPageInsightEngine) return;

  const LIMITS = {
    textSampleChars: 14000,
    headingSample: 20,
    buttonSample: 28,
    linkSample: 1200,
    maxSignals: 5,
    maxEssentials: 8,
    maxKeywords: 8
  };

  const STOP_WORDS = new Set([
    "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "has", "have", "will",
    "not", "but", "all", "any", "can", "our", "their", "its", "about", "into", "out", "more", "new", "use", "using",
    "home", "page", "site", "www", "http", "https", "com", "org", "net", "info", "help", "learn", "read", "click",
    "terms", "privacy", "cookie", "cookies", "contact", "support", "menu", "search", "result", "results", "login", "sign"
  ]);

  const PAGE_TYPE_LABELS = {
    article: "Article / Reading Page",
    docs: "Documentation Page",
    product: "Product Page",
    store: "Store / Commerce Page",
    checkout: "Checkout / Cart Page",
    login: "Login / Account Page",
    dashboard: "Dashboard / Web App",
    marketing: "Marketing Landing Page",
    search: "Search / Results Page",
    directory: "Directory / Listing Page",
    forum: "Forum / Community Page",
    media: "Media / Gallery Page",
    homepage: "Homepage / General Site Page",
    unknown: "Unknown / Mixed Page"
  };

  const PAGE_PURPOSE_LABELS = {
    article: "Informational reading",
    docs: "Reference or documentation",
    product: "Transactional product evaluation",
    store: "Transactional browsing",
    checkout: "Transactional checkout flow",
    login: "Account access",
    dashboard: "Operational app workflow",
    marketing: "Promotional or conversion-focused",
    search: "Navigation and discovery",
    directory: "Navigation and listing exploration",
    forum: "Community discussion",
    media: "Media consumption",
    homepage: "General site entry point",
    unknown: "Mixed or unclear intent"
  };

  function safeText(value, max = 240) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function lowerText(value) {
    return safeText(value, LIMITS.textSampleChars).toLowerCase();
  }

  function countWords(text) {
    if (!text) return 0;
    const matches = String(text).trim().match(/\b[\p{L}\p{N}'-]+\b/gu);
    return matches ? matches.length : 0;
  }

  function countSelector(root, selector) {
    try {
      return root.querySelectorAll(selector).length;
    } catch {
      return 0;
    }
  }

  function hasSelector(root, selector) {
    try {
      return Boolean(root.querySelector(selector));
    } catch {
      return false;
    }
  }

  function normalizeHost(input) {
    try {
      const parsed = new URL(String(input || ""));
      return String(parsed.hostname || "").replace(/^www\./i, "").toLowerCase();
    } catch {
      return String(input || "")
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
    }
  }

  function normalizePath(pathname) {
    const path = String(pathname || "/").split(/[?#]/)[0] || "/";
    return path.startsWith("/") ? path : `/${path}`;
  }

  function getMetaContent(doc, names = []) {
    for (const rawName of names) {
      const name = String(rawName || "").trim();
      if (!name) continue;
      try {
        const node = doc.querySelector(`meta[name="${name}"]`) || doc.querySelector(`meta[property="${name}"]`);
        const value = safeText(node?.getAttribute("content") || "", 320);
        if (value) return value;
      } catch {
        // ignore malformed selectors
      }
    }
    return "";
  }

  function uniqueNonEmpty(list, max = 12) {
    const seen = new Set();
    const out = [];
    for (const item of list || []) {
      const value = safeText(item, 120);
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
      if (out.length >= max) break;
    }
    return out;
  }

  function topKeywords(parts) {
    const bag = new Map();
    const combined = (parts || [])
      .map((part) => safeText(part, 800))
      .join(" ")
      .toLowerCase();
    const tokens = combined.match(/\b[a-z][a-z0-9-]{2,}\b/g) || [];
    for (const token of tokens) {
      if (STOP_WORDS.has(token)) continue;
      if (/^\d+$/.test(token)) continue;
      bag.set(token, (bag.get(token) || 0) + 1);
    }
    return [...bag.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, LIMITS.maxKeywords)
      .map(([token]) => token);
  }

  function getHeadingCounts(doc) {
    const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const key = `h${level}`;
      counts[key] = countSelector(doc, key);
      counts.total += counts[key];
    }
    return counts;
  }

  function collectTopHeadings(doc) {
    const list = [];
    const nodes = Array.from(doc.querySelectorAll("h1, h2, h3")).slice(0, LIMITS.headingSample);
    for (const node of nodes) {
      const text = safeText(node.textContent || "", 100);
      if (text) list.push(text);
    }
    return uniqueNonEmpty(list, 8);
  }

  function collectTopButtons(doc) {
    const list = [];
    const nodes = Array.from(doc.querySelectorAll("button, a[role='button'], input[type='submit'], input[type='button']")).slice(0, LIMITS.buttonSample);
    for (const node of nodes) {
      const text = safeText(node.textContent || node.value || node.getAttribute("aria-label") || "", 70);
      if (!text) continue;
      if (text.length < 2) continue;
      list.push(text);
    }
    return uniqueNonEmpty(list, 10);
  }

  function detectHeroMedia(doc) {
    const candidates = Array.from(doc.querySelectorAll("img, video")).slice(0, 24);
    for (const node of candidates) {
      try {
        const rect = node.getBoundingClientRect();
        if (!rect || rect.width < 420 || rect.height < 180) continue;
        if (rect.top > 700) continue;
        return true;
      } catch {
        // ignore layout read failure
      }
    }
    return false;
  }

  function sampleMainText(doc) {
    const roots = [
      doc.querySelector("main"),
      doc.querySelector("article"),
      doc.querySelector("[role='main']"),
      doc.body
    ].filter(Boolean);

    for (const root of roots) {
      const text = safeText(root?.innerText || "", LIMITS.textSampleChars);
      if (countWords(text) >= 80) return text;
    }

    return safeText(doc.body?.innerText || "", LIMITS.textSampleChars);
  }

  function extractRawSignals(doc = document, loc = location) {
    const hostname = normalizeHost(String(loc.hostname || ""));
    const pathname = normalizePath(String(loc.pathname || "/"));
    const pathSegments = pathname.split("/").filter(Boolean).slice(0, 12);
    const canonical = (() => {
      try {
        const link = doc.querySelector("link[rel='canonical']");
        const href = safeText(link?.getAttribute("href") || "", 320);
        if (!href) return "";
        return String(new URL(href, loc.href));
      } catch {
        return "";
      }
    })();

    const metaDescription = getMetaContent(doc, ["description", "og:description", "twitter:description"]);
    const ogTitle = getMetaContent(doc, ["og:title", "twitter:title"]);
    const ogDescription = getMetaContent(doc, ["og:description", "twitter:description"]);
    const metaRobots = getMetaContent(doc, ["robots"]);

    const headingCounts = getHeadingCounts(doc);
    const topHeadings = collectTopHeadings(doc);
    const topButtons = collectTopButtons(doc);
    const textSample = sampleMainText(doc);
    const textLower = lowerText(textSample);

    const paragraphCount = countSelector(doc, "p");
    const longParagraphCount = Array.from(doc.querySelectorAll("p")).slice(0, 120)
      .reduce((sum, node) => {
        const wc = countWords(safeText(node.textContent || "", 800));
        return sum + (wc >= 35 ? 1 : 0);
      }, 0);

    const forms = countSelector(doc, "form");
    const inputCount = countSelector(doc, "input, select, textarea");
    const controlCount = countSelector(doc, "input, select, textarea, button");
    const passwordInputs = countSelector(doc, "input[type='password']");
    const emailInputs = countSelector(doc, "input[type='email'], input[name*='email' i], input[id*='email' i]");
    const searchInputs = countSelector(doc, "input[type='search'], form[role='search'], [name*='search' i], [aria-label*='search' i]");

    const hasMain = hasSelector(doc, "main, [role='main']");
    const hasArticle = hasSelector(doc, "article");
    const hasNav = hasSelector(doc, "nav, [role='navigation']");
    const hasAside = hasSelector(doc, "aside, [class*='sidebar' i], [id*='sidebar' i]");
    const hasHeader = hasSelector(doc, "header, [role='banner']");
    const hasFooter = hasSelector(doc, "footer, [role='contentinfo']");
    const hasTables = countSelector(doc, "table, [role='table'], [class*='grid' i]") > 0;
    const codeBlockCount = countSelector(doc, "pre, code, [class*='code' i], [class*='highlight' i]");
    const hasCodeBlocks = codeBlockCount > 0;

    const cardSignals = countSelector(doc, "[class*='card' i], [class*='result' i], [class*='product' i], [class*='item' i], article");
    const hasMultipleCards = cardSignals >= 8;
    const hasFeedLikeList = hasMultipleCards && countSelector(doc, "[role='list'], ul, ol") >= 1;

    const imageCount = countSelector(doc, "img");
    const videoCount = countSelector(doc, "video, iframe[src*='youtube.com'], iframe[src*='vimeo.com']");
    const audioCount = countSelector(doc, "audio");
    const iframeCount = countSelector(doc, "iframe");
    const gallerySignals = countSelector(doc, "[class*='gallery' i], [class*='carousel' i], [data-gallery], [aria-roledescription='carousel']");

    const headingText = topHeadings.join(" ").toLowerCase();
    const buttonText = topButtons.join(" ").toLowerCase();
    const titleText = `${safeText(doc.title || "", 220)} ${metaDescription}`.toLowerCase();
    const intentText = `${titleText} ${headingText} ${buttonText} ${textLower}`;

    const loginCueCount = (intentText.match(/\b(sign in|log in|login|register|password|forgot password|two-factor|2fa|account)\b/g) || []).length;
    const checkoutCueCount = (intentText.match(/\b(checkout|billing|payment|card number|shipping|order summary|place order)\b/g) || []).length;
    const resultCueCount = (intentText.match(/\b(results|filter|sort by|no results|showing)\b/g) || []).length;
    const docsCueCount = (intentText.match(/\b(api|reference|endpoint|sdk|installation|changelog|documentation|guide)\b/g) || []).length;
    const forumCueCount = (intentText.match(/\b(reply|replies|thread|discussion|community|comment|moderator)\b/g) || []).length;

    const currencySignalCount = (textSample.match(/\$|€|£|\bUSD\b|\bEUR\b|\bGBP\b|\bJPY\b|\bCAD\b/gi) || []).length;
    const priceSignalCount = (textSample.match(/(?:\$|€|£)\s?\d[\d,.]*(?:\.\d{2})?/g) || []).length;
    const productSignalCount = (intentText.match(/\b(product|sku|specifications|variant|in stock|out of stock)\b/g) || []).length;
    const cartSignalCount = (intentText.match(/\b(add to cart|cart|bag|buy now|purchase|wishlist)\b/g) || []).length;

    const hasDashboardShell = Boolean(
      hasNav
      && hasAside
      && (controlCount >= 12 || hasTables || countSelector(doc, "[role='tablist'], [role='grid'], [class*='panel' i]") >= 2)
    );

    const hasDominantArticle = Boolean(
      hasArticle
      || (hasMain && paragraphCount >= 8 && countWords(textSample) >= 700)
      || (longParagraphCount >= 6 && headingCounts.h1 >= 1)
    );

    const allAnchors = Array.from(doc.querySelectorAll("a[href]")).slice(0, LIMITS.linkSample);
    let internalLinkCount = 0;
    let externalLinkCount = 0;
    for (const anchor of allAnchors) {
      const href = String(anchor.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      try {
        const parsed = new URL(href, String(loc.href || ""));
        if (!/^https?:$/i.test(parsed.protocol)) continue;
        if (normalizeHost(parsed.hostname) === hostname) internalLinkCount += 1;
        else externalLinkCount += 1;
      } catch {
        // skip malformed links
      }
    }

    const hasPagination = hasSelector(doc, "[rel='next'], nav[aria-label*='pagination' i], [class*='pagination' i]");
    const hasForumCues = forumCueCount >= 2 || hasSelector(doc, "[class*='comment' i], [class*='thread' i], [class*='reply' i], [data-testid*='comment' i]");

    return {
      page: {
        title: safeText(doc.title || "Untitled page", 180),
        hostname,
        pathname,
        pathSegments,
        pathDepth: pathSegments.length,
        protocol: String(loc.protocol || ""),
        lang: safeText(doc.documentElement?.lang || "", 24) || safeText(getMetaContent(doc, ["og:locale", "content-language"]), 24) || "und",
        charset: safeText(doc.characterSet || "", 24) || "unknown",
        canonical,
        metaDescription,
        metaRobots,
        ogTitle,
        ogDescription,
        isEmbedded: (() => {
          try {
            return globalThis.top !== globalThis.self;
          } catch {
            return false;
          }
        })()
      },
      structure: {
        headingCounts,
        hasMain,
        hasArticle,
        hasNav,
        hasAside,
        hasHeader,
        hasFooter,
        hasDominantArticle,
        hasMultipleCards,
        hasFeedLikeList,
        hasSidebar: hasAside,
        hasTables,
        hasCodeBlocks,
        codeBlockCount,
        hasSearchInput: searchInputs > 0,
        hasDashboardShell,
        tableCount: countSelector(doc, "table, [role='table'], [class*='grid' i]"),
        cardSignalCount: cardSignals,
        iframeCount
      },
      forms: {
        totalForms: forms,
        inputCount,
        inputControlCount: controlCount,
        hasPassword: passwordInputs > 0,
        hasEmailInput: emailInputs > 0,
        hasCheckoutCues: checkoutCueCount >= 2,
        hasSearchForm: searchInputs > 0,
        loginCueCount,
        checkoutCueCount
      },
      commerce: {
        hasPriceSignals: priceSignalCount >= 1 || currencySignalCount >= 3,
        hasCartSignals: cartSignalCount >= 1,
        hasProductSignals: productSignalCount >= 2,
        currencySignalCount,
        priceSignalCount,
        productSignalCount,
        cartSignalCount
      },
      reading: {
        paragraphCount,
        longParagraphCount,
        wordEstimate: countWords(textSample),
        hasToc: hasSelector(doc, "nav[aria-label*='table of contents' i], [class*='toc' i], [id*='toc' i]"),
        hasLongFormStructure: hasDominantArticle,
        docsCueCount
      },
      navigation: {
        internalLinkCount,
        externalLinkCount,
        hasPagination,
        hasForumCues,
        forumCueCount,
        hasDirectoryCues: hasMultipleCards && hasPagination,
        resultsCueCount: resultCueCount
      },
      media: {
        imageCount,
        videoCount,
        audioCount,
        embedCount: iframeCount,
        hasVideo: videoCount > 0,
        hasAudio: audioCount > 0,
        hasGalleryLikePattern: gallerySignals > 0 || (imageCount >= 14 && hasMultipleCards),
        hasHeroMedia: detectHeroMedia(doc)
      },
      content: {
        topHeadings,
        topButtons,
        topKeywords: topKeywords([
          doc.title,
          metaDescription,
          ogTitle,
          ogDescription,
          ...topHeadings,
          ...topButtons
        ]),
        textSample
      }
    };
  }

  function normalizeSignals(raw = {}) {
    const page = raw.page || {};
    const structure = raw.structure || {};
    const forms = raw.forms || {};
    const commerce = raw.commerce || {};
    const reading = raw.reading || {};
    const navigation = raw.navigation || {};
    const media = raw.media || {};
    const content = raw.content || {};

    const headingCounts = structure.headingCounts && typeof structure.headingCounts === "object"
      ? structure.headingCounts
      : { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };

    return {
      page: {
        title: safeText(page.title || "Untitled page", 180),
        hostname: safeText(page.hostname || "", 120),
        pathname: normalizePath(page.pathname || "/"),
        protocol: safeText(page.protocol || "", 16),
        lang: safeText(page.lang || "und", 24) || "und",
        charset: safeText(page.charset || "unknown", 24) || "unknown",
        canonical: safeText(page.canonical || "", 320),
        metaDescription: safeText(page.metaDescription || "", 260),
        metaRobots: safeText(page.metaRobots || "", 120),
        ogTitle: safeText(page.ogTitle || "", 180),
        ogDescription: safeText(page.ogDescription || "", 260),
        pathDepth: Math.max(0, Number(page.pathDepth || 0)),
        pathSegments: Array.isArray(page.pathSegments) ? page.pathSegments.map((part) => safeText(part, 40)).filter(Boolean).slice(0, 12) : [],
        isEmbedded: Boolean(page.isEmbedded)
      },
      structure: {
        headingCounts: {
          h1: Math.max(0, Number(headingCounts.h1 || 0)),
          h2: Math.max(0, Number(headingCounts.h2 || 0)),
          h3: Math.max(0, Number(headingCounts.h3 || 0)),
          h4: Math.max(0, Number(headingCounts.h4 || 0)),
          h5: Math.max(0, Number(headingCounts.h5 || 0)),
          h6: Math.max(0, Number(headingCounts.h6 || 0)),
          total: Math.max(0, Number(headingCounts.total || 0))
        },
        hasMain: Boolean(structure.hasMain),
        hasArticle: Boolean(structure.hasArticle),
        hasNav: Boolean(structure.hasNav),
        hasAside: Boolean(structure.hasAside),
        hasHeader: Boolean(structure.hasHeader),
        hasFooter: Boolean(structure.hasFooter),
        hasDominantArticle: Boolean(structure.hasDominantArticle),
        hasMultipleCards: Boolean(structure.hasMultipleCards),
        hasFeedLikeList: Boolean(structure.hasFeedLikeList),
        hasSidebar: Boolean(structure.hasSidebar),
        hasTables: Boolean(structure.hasTables),
        tableCount: Math.max(0, Number(structure.tableCount || 0)),
        hasCodeBlocks: Boolean(structure.hasCodeBlocks),
        codeBlockCount: Math.max(0, Number(structure.codeBlockCount || 0)),
        hasSearchInput: Boolean(structure.hasSearchInput),
        hasDashboardShell: Boolean(structure.hasDashboardShell),
        cardSignalCount: Math.max(0, Number(structure.cardSignalCount || 0)),
        iframeCount: Math.max(0, Number(structure.iframeCount || 0))
      },
      forms: {
        totalForms: Math.max(0, Number(forms.totalForms || 0)),
        inputCount: Math.max(0, Number(forms.inputCount || 0)),
        inputControlCount: Math.max(0, Number(forms.inputControlCount || 0)),
        hasPassword: Boolean(forms.hasPassword),
        hasEmailInput: Boolean(forms.hasEmailInput),
        hasCheckoutCues: Boolean(forms.hasCheckoutCues),
        hasSearchForm: Boolean(forms.hasSearchForm),
        loginCueCount: Math.max(0, Number(forms.loginCueCount || 0)),
        checkoutCueCount: Math.max(0, Number(forms.checkoutCueCount || 0))
      },
      commerce: {
        hasPriceSignals: Boolean(commerce.hasPriceSignals),
        hasCartSignals: Boolean(commerce.hasCartSignals),
        hasProductSignals: Boolean(commerce.hasProductSignals),
        currencySignalCount: Math.max(0, Number(commerce.currencySignalCount || 0)),
        priceSignalCount: Math.max(0, Number(commerce.priceSignalCount || 0)),
        productSignalCount: Math.max(0, Number(commerce.productSignalCount || 0)),
        cartSignalCount: Math.max(0, Number(commerce.cartSignalCount || 0))
      },
      reading: {
        paragraphCount: Math.max(0, Number(reading.paragraphCount || 0)),
        longParagraphCount: Math.max(0, Number(reading.longParagraphCount || 0)),
        wordEstimate: Math.max(0, Number(reading.wordEstimate || 0)),
        hasToc: Boolean(reading.hasToc),
        hasLongFormStructure: Boolean(reading.hasLongFormStructure),
        docsCueCount: Math.max(0, Number(reading.docsCueCount || 0))
      },
      navigation: {
        internalLinkCount: Math.max(0, Number(navigation.internalLinkCount || 0)),
        externalLinkCount: Math.max(0, Number(navigation.externalLinkCount || 0)),
        hasPagination: Boolean(navigation.hasPagination),
        hasForumCues: Boolean(navigation.hasForumCues),
        forumCueCount: Math.max(0, Number(navigation.forumCueCount || 0)),
        hasDirectoryCues: Boolean(navigation.hasDirectoryCues),
        resultsCueCount: Math.max(0, Number(navigation.resultsCueCount || 0))
      },
      media: {
        imageCount: Math.max(0, Number(media.imageCount || 0)),
        videoCount: Math.max(0, Number(media.videoCount || 0)),
        audioCount: Math.max(0, Number(media.audioCount || 0)),
        embedCount: Math.max(0, Number(media.embedCount || 0)),
        hasVideo: Boolean(media.hasVideo),
        hasAudio: Boolean(media.hasAudio),
        hasGalleryLikePattern: Boolean(media.hasGalleryLikePattern),
        hasHeroMedia: Boolean(media.hasHeroMedia)
      },
      content: {
        topHeadings: uniqueNonEmpty(content.topHeadings || [], 8),
        topButtons: uniqueNonEmpty(content.topButtons || [], 10),
        topKeywords: uniqueNonEmpty(content.topKeywords || [], LIMITS.maxKeywords),
        textSample: safeText(content.textSample || "", LIMITS.textSampleChars)
      }
    };
  }

  function classifySignals(normalized) {
    const scores = Object.fromEntries(Object.keys(PAGE_TYPE_LABELS).map((key) => [key, 0]));
    const evidence = Object.fromEntries(Object.keys(PAGE_TYPE_LABELS).map((key) => [key, []]));

    const add = (key, points, reason) => {
      if (!scores[key]) scores[key] = 0;
      scores[key] += points;
      if (reason && evidence[key].length < 6) {
        evidence[key].push(reason);
      }
    };

    const pathHint = `${normalized.page.pathname} ${normalized.page.pathSegments.join(" ")}`.toLowerCase();
    const ctaText = normalized.content.topButtons.join(" ").toLowerCase();

    if (normalized.forms.hasPassword) add("login", 10, "Password field detected");
    if (normalized.forms.loginCueCount >= 2) add("login", 4, "Authentication wording found");
    if (normalized.forms.hasEmailInput && normalized.forms.totalForms > 0) add("login", 2, "Email/account form input present");
    if (/(login|signin|sign-in|auth|account)/.test(pathHint)) add("login", 3, "Account-oriented URL path");

    if (normalized.forms.hasCheckoutCues) add("checkout", 6, "Checkout/payment cues detected");
    if (normalized.commerce.hasCartSignals) {
      add("checkout", 5, "Cart or buy actions detected");
      add("store", 3, "Commerce action controls detected");
    }
    if (/(checkout|cart|payment|billing|order)/.test(pathHint)) add("checkout", 5, "Checkout/cart URL path");

    if (normalized.commerce.hasProductSignals) add("product", 5, "Product-specific cues present");
    if (normalized.commerce.hasPriceSignals) {
      add("product", 4, "Price/currency markers detected");
      add("store", 3, "Commerce pricing signals present");
    }
    if (normalized.media.hasHeroMedia) add("product", 2, "Large hero media block present");
    if (/(product|sku|item)/.test(pathHint)) add("product", 3, "Product-oriented URL path");

    if (normalized.structure.hasMultipleCards) {
      add("store", 3, "Repeated card/listing structures detected");
      add("directory", 4, "Directory-like repeated listings detected");
    }

    if (normalized.structure.hasCodeBlocks) add("docs", 6, "Code or preformatted blocks present");
    if (normalized.reading.docsCueCount >= 2) add("docs", 4, "Documentation/reference wording found");
    if (normalized.structure.hasSidebar && normalized.structure.hasNav) add("docs", 2, "Sidebar plus navigation structure detected");
    if (normalized.structure.headingCounts.total >= 6) add("docs", 1, "Structured heading hierarchy detected");

    if (normalized.reading.hasLongFormStructure) add("article", 7, "Long-form reading structure detected");
    if (normalized.structure.hasDominantArticle) add("article", 5, "Dominant article/main content region present");
    if (normalized.reading.paragraphCount >= 8) add("article", 2, "High paragraph density detected");

    if (normalized.structure.hasDashboardShell) add("dashboard", 8, "App-like shell with nav/sidebar and controls detected");
    if (normalized.forms.inputControlCount >= 14) add("dashboard", 3, "High control density suggests app workflow");
    if (normalized.structure.hasTables) add("dashboard", 2, "Table/grid panel structures detected");
    if (/(dashboard|admin|console|workspace|portal|app)/.test(pathHint)) add("dashboard", 3, "App/dashboard URL path");

    if (normalized.structure.hasSearchInput || normalized.forms.hasSearchForm) add("search", 5, "Search input/form present");
    if (normalized.navigation.resultsCueCount >= 2) add("search", 4, "Results/filter wording detected");
    if (normalized.navigation.hasPagination) {
      add("search", 2, "Pagination controls detected");
      add("directory", 3, "Paginated listing pattern detected");
    }

    if (normalized.navigation.hasForumCues) add("forum", 7, "Thread/comment/community cues detected");
    if (normalized.navigation.forumCueCount >= 2) add("forum", 3, "Discussion wording detected");

    if (normalized.media.hasVideo) add("media", 4, "Video content detected");
    if (normalized.media.hasAudio) add("media", 2, "Audio content detected");
    if (normalized.media.hasGalleryLikePattern) add("media", 4, "Gallery/carousel media pattern detected");
    if (normalized.media.imageCount >= 20) add("media", 2, "Image-heavy page detected");

    if (
      normalized.page.pathDepth === 0
      && normalized.structure.hasNav
      && normalized.navigation.internalLinkCount >= 8
    ) {
      add("homepage", 3, "Top-level path with broad navigation structure");
    }
    if (
      normalized.page.pathDepth <= 1
      && normalized.structure.hasHeader
      && normalized.structure.hasFooter
      && normalized.navigation.internalLinkCount >= 10
      && normalized.forms.totalForms <= 1
    ) {
      add("homepage", 2, "Shallow page with full site shell and broad internal navigation");
    }

    const ctaCount = (ctaText.match(/\b(get started|start free|book demo|request demo|contact sales|sign up|try free)\b/g) || []).length;
    if (ctaCount >= 2) add("marketing", 4, "Conversion-focused call-to-action language detected");
    if (normalized.structure.hasMain && normalized.forms.totalForms <= 2 && normalized.page.pathDepth <= 1) add("marketing", 1, "Landing-page style layout detected");

    const ordered = Object.entries(scores)
      .filter(([key]) => key !== "unknown")
      .sort((a, b) => b[1] - a[1]);

    const [topKey, topScore] = ordered[0] || ["unknown", 0];
    const secondScore = ordered[1]?.[1] || 0;
    const delta = topScore - secondScore;

    const lowSignal = topScore < 5;
    const ambiguous = topScore < 8 && delta < 2;

    const resolvedKey = lowSignal || ambiguous ? "unknown" : topKey;
    const confidenceRaw = topScore <= 0
      ? 0
      : Math.min(1, ((topScore / 14) * 0.65) + (Math.max(0, delta) / 10) * 0.35);
    const confidence = Math.max(0, Math.min(1, Number(confidenceRaw.toFixed(2))));

    return {
      key: resolvedKey,
      pageType: PAGE_TYPE_LABELS[resolvedKey] || PAGE_TYPE_LABELS.unknown,
      appearsToBe: PAGE_PURPOSE_LABELS[resolvedKey] || PAGE_PURPOSE_LABELS.unknown,
      confidence,
      topScore,
      secondScore,
      evidence: (evidence[resolvedKey] || evidence[topKey] || []).slice(0, 4),
      allScores: scores
    };
  }

  function buildSecurityNote(normalized) {
    if (String(normalized.page.protocol || "").toLowerCase() !== "https:") {
      return "Connection is HTTP (not HTTPS). Avoid entering sensitive data on this page.";
    }
    if (normalized.page.isEmbedded) {
      return "This page appears to be embedded in another context.";
    }
    if (normalized.structure.iframeCount >= 12) {
      return "This page is iframe-heavy, which usually means substantial embedded third-party content.";
    }
    return "";
  }

  function buildKeySignals(normalized, classification) {
    const signals = [];
    const push = (line) => {
      const text = safeText(line, 170);
      if (!text) return;
      if (!signals.includes(text)) signals.push(text);
    };

    for (const reason of classification.evidence || []) {
      push(reason);
      if (signals.length >= LIMITS.maxSignals) return signals;
    }

    if (normalized.forms.hasPassword) push("Password input is present.");
    if (normalized.forms.hasSearchForm) push("Search form or search input detected.");
    if (normalized.commerce.hasPriceSignals) push("Pricing/currency markers are visible.");
    if (normalized.commerce.hasCartSignals) push("Cart or purchase action text is present.");
    if (normalized.reading.hasLongFormStructure) push("Long-form reading structure is present.");
    if (normalized.structure.hasCodeBlocks) push("Code/reference blocks are present.");
    if (normalized.structure.hasDashboardShell) push("App-like shell layout with controls is detected.");
    if (normalized.navigation.hasForumCues) push("Discussion/community cues are present.");
    if (normalized.navigation.hasPagination && normalized.structure.hasMultipleCards) push("Paginated listing/results structure detected.");
    if (normalized.media.hasGalleryLikePattern) push("Gallery-style media layout detected.");
    if (!signals.length) push("Limited structural cues were available on this page.");

    return signals.slice(0, LIMITS.maxSignals);
  }

  function buildSummary(normalized, classification, keySignals) {
    const signalLead = keySignals[0] ? keySignals[0].replace(/\.$/, "") : "page-structure signals";

    if (classification.key === "unknown") {
      if (normalized.reading.wordEstimate < 120 && normalized.forms.totalForms === 0 && normalized.structure.headingCounts.total <= 1) {
        return "Signals are limited on this page, so classification remains intentionally conservative.";
      }
      return `This page has mixed signals; the strongest cue is ${signalLead.toLowerCase()}.`;
    }

    if (["product", "store", "checkout"].includes(classification.key)) {
      return `This appears to be a commerce-oriented page, supported by ${signalLead.toLowerCase()}.`;
    }

    if (classification.key === "login") {
      return "This appears to be an account-access page with authentication-oriented inputs and cues.";
    }

    if (classification.key === "docs") {
      return `This looks like documentation/reference content, supported by ${signalLead.toLowerCase()}.`;
    }

    if (classification.key === "article") {
      return "This appears to be a long-form reading page centered on a primary content narrative.";
    }

    if (classification.key === "dashboard") {
      return "This appears to be an app/dashboard interface intended for operational workflows.";
    }

    if (classification.key === "search" || classification.key === "directory") {
      return "This appears to be a discovery/listing page with search or result-oriented structure.";
    }

    if (classification.key === "forum") {
      return "This appears to be a community discussion page with thread/reply-style signals.";
    }

    if (classification.key === "media") {
      return "This appears to be a media-focused page with strong visual or playback content signals.";
    }

    if (classification.key === "marketing") {
      return "This appears to be a marketing/landing page focused on conversion-oriented actions.";
    }

    if (classification.key === "homepage") {
      return "This appears to be a general site entry page with broad navigation and overview signals.";
    }

    return `This appears to be a ${classification.pageType.toLowerCase()} based on page-structure signals.`;
  }

  function buildEssentials(normalized) {
    const rows = [
      `Title: ${normalized.page.title || "unavailable"}`,
      `Domain: ${normalized.page.hostname || "unavailable"}`,
      `Path: ${normalized.page.pathname || "/"}`,
      `Language: ${normalized.page.lang || "und"}`
    ];

    if (normalized.page.metaDescription) {
      rows.push(`Description: ${normalized.page.metaDescription}`);
    }

    if (normalized.page.canonical) {
      try {
        const canonicalUrl = new URL(normalized.page.canonical);
        const canonicalHost = normalizeHost(canonicalUrl.hostname);
        if (!normalized.page.hostname || canonicalHost !== normalized.page.hostname || canonicalUrl.pathname !== normalized.page.pathname) {
          rows.push(`Canonical: ${normalized.page.canonical}`);
        }
      } catch {
        // ignore invalid canonical URLs
      }
    }

    if (normalized.page.charset && normalized.page.charset !== "unknown") {
      rows.push(`Charset: ${normalized.page.charset}`);
    }

    return rows.slice(0, LIMITS.maxEssentials);
  }

  function buildCopyText(payload) {
    const lines = [
      `Page Type: ${payload.pageType}`,
      `Appears To Be: ${payload.appearsToBe}`,
      `Summary: ${payload.summary}`
    ];

    if (payload.securityNote) {
      lines.push(`Security Note: ${payload.securityNote}`);
    }

    lines.push(...payload.essentials);

    if (payload.signals.length) {
      lines.push("Key Signals:");
      for (const signal of payload.signals) {
        lines.push(`- ${signal}`);
      }
    }

    return lines.join("\n");
  }

  function buildInsightPayloadFromNormalized(normalized) {
    const classification = classifySignals(normalized);
    const signals = buildKeySignals(normalized, classification);
    const securityNote = buildSecurityNote(normalized);
    const summary = buildSummary(normalized, classification, signals);
    const essentials = buildEssentials(normalized);

    const payload = {
      pageType: classification.pageType,
      appearsToBe: classification.appearsToBe,
      summary,
      signals,
      securityNote,
      essentials,
      confidence: classification.confidence
    };

    return {
      ...payload,
      copyText: buildCopyText(payload),
      normalized,
      classifier: {
        key: classification.key,
        confidence: classification.confidence,
        topScore: classification.topScore,
        secondScore: classification.secondScore
      }
    };
  }

  function fallbackPayload(reason = "analysis unavailable") {
    const text = safeText(reason, 120);
    const payload = {
      pageType: PAGE_TYPE_LABELS.unknown,
      appearsToBe: PAGE_PURPOSE_LABELS.unknown,
      summary: `Insight is limited right now (${text}).`,
      signals: ["Limited page data was available."],
      securityNote: "",
      essentials: ["Title: unavailable", "Domain: unavailable", "Path: /", "Language: und"],
      confidence: 0
    };
    return {
      ...payload,
      copyText: buildCopyText(payload),
      normalized: null,
      classifier: { key: "unknown", confidence: 0, topScore: 0, secondScore: 0 }
    };
  }

  function collect(doc = document, loc = location) {
    try {
      const raw = extractRawSignals(doc, loc);
      const normalized = normalizeSignals(raw);
      return buildInsightPayloadFromNormalized(normalized);
    } catch (error) {
      return fallbackPayload(String(error?.message || "collect_failed"));
    }
  }

  globalThis.HolmetaPageInsightEngine = {
    collect,
    extractRawSignals,
    normalizeSignals,
    classifySignals,
    buildInsightPayloadFromNormalized,
    fallbackPayload
  };
})();
