(() => {
  if (globalThis.HolmetaAppearanceSiteClassifier) return;

  function classifyFromHost(host = "") {
    const safeHost = String(host || "").toLowerCase();

    if (
      /(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|linkedin\.com|reddit\.com|threads\.net)$/.test(safeHost)
      || /(^|\.)(discord\.com|telegram\.org)$/.test(safeHost)
    ) {
      return { siteClass: "social", reason: "social-host" };
    }

    if (
      /(^|\.)(stripe\.com|linear\.app|notion\.so|figma\.com|airtable\.com|asana\.com|trello\.com|slack\.com|mail\.google\.com)$/.test(safeHost)
      || /(^|\.)(docs\.google\.com)$/.test(safeHost)
    ) {
      return { siteClass: "dashboard", reason: "app-host" };
    }

    if (
      /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|developer\.mozilla\.org|stackoverflow\.com)$/.test(safeHost)
      || /(^|\.)(readthedocs\.io|npmjs\.com)$/.test(safeHost)
    ) {
      return { siteClass: "docs_editor", reason: "docs-host" };
    }

    if (
      /(^|\.)(youtube\.com|vimeo\.com|twitch\.tv|spotify\.com|soundcloud\.com)$/.test(safeHost)
      || /(^|\.)(netflix\.com|hulu\.com|primevideo\.com)$/.test(safeHost)
      || /(^|\.)(espn\.com|bleacherreport\.com|theathletic\.com)$/.test(safeHost)
    ) {
      return { siteClass: "media", reason: "media-host" };
    }

    if (
      /(^|\.)(amazon\.com|ebay\.com|etsy\.com|walmart\.com|shopify\.com)$/.test(safeHost)
      || /(^|\.)(target\.com|bestbuy\.com)$/.test(safeHost)
    ) {
      return { siteClass: "ecommerce", reason: "commerce-host" };
    }

    if (
      /(^|\.)(wikipedia\.org|nytimes\.com|bbc\.com|cnn\.com|theguardian\.com)$/.test(safeHost)
    ) {
      return { siteClass: "content", reason: "content-host" };
    }

    return { siteClass: "general", reason: "default-host" };
  }

  function classify({ host = "", siteType = "general", pageTone = { tone: "mixed" } } = {}) {
    const direct = classifyFromHost(host);
    if (direct.siteClass !== "general") return direct;

    if (siteType === "dashboard_app") return { siteClass: "dashboard", reason: "site-type-dashboard" };
    if (siteType === "docs_code") return { siteClass: "docs_editor", reason: "site-type-docs" };
    if (siteType === "article") return { siteClass: "content", reason: "site-type-article" };
    if (siteType === "ecommerce") return { siteClass: "ecommerce", reason: "site-type-commerce" };
    if (siteType === "media") return { siteClass: "media", reason: "site-type-media" };

    if (pageTone?.tone === "dark") return { siteClass: "app_shell", reason: "tone-dark" };
    return { siteClass: "general", reason: "default" };
  }

  globalThis.HolmetaAppearanceSiteClassifier = {
    classify,
    classifyFromHost
  };
})();
