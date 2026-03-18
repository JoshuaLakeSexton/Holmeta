const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScript(context, filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  vm.runInContext(code, context, { filename: filePath });
}

function loadEngine() {
  const context = vm.createContext({
    console,
    URL,
    Date,
    Math
  });
  context.globalThis = context;
  const filePath = path.join(__dirname, "..", "insight", "page-insight-engine.js");
  loadScript(context, filePath);
  return context.HolmetaPageInsightEngine;
}

function baseNormalized() {
  return {
    page: {
      title: "Example",
      hostname: "example.com",
      pathname: "/",
      protocol: "https:",
      lang: "en",
      charset: "UTF-8",
      canonical: "",
      metaDescription: "",
      metaRobots: "",
      ogTitle: "",
      ogDescription: "",
      pathDepth: 0,
      pathSegments: [],
      isEmbedded: false
    },
    structure: {
      headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 1 },
      hasMain: true,
      hasArticle: false,
      hasNav: false,
      hasAside: false,
      hasHeader: true,
      hasFooter: true,
      hasDominantArticle: false,
      hasMultipleCards: false,
      hasFeedLikeList: false,
      hasSidebar: false,
      hasTables: false,
      tableCount: 0,
      hasCodeBlocks: false,
      codeBlockCount: 0,
      hasSearchInput: false,
      hasDashboardShell: false,
      cardSignalCount: 0,
      iframeCount: 0
    },
    forms: {
      totalForms: 0,
      inputCount: 0,
      inputControlCount: 0,
      hasPassword: false,
      hasEmailInput: false,
      hasCheckoutCues: false,
      hasSearchForm: false,
      loginCueCount: 0,
      checkoutCueCount: 0
    },
    commerce: {
      hasPriceSignals: false,
      hasCartSignals: false,
      hasProductSignals: false,
      currencySignalCount: 0,
      priceSignalCount: 0,
      productSignalCount: 0,
      cartSignalCount: 0
    },
    reading: {
      paragraphCount: 1,
      longParagraphCount: 0,
      wordEstimate: 60,
      hasToc: false,
      hasLongFormStructure: false,
      docsCueCount: 0
    },
    navigation: {
      internalLinkCount: 4,
      externalLinkCount: 0,
      hasPagination: false,
      hasForumCues: false,
      forumCueCount: 0,
      hasDirectoryCues: false,
      resultsCueCount: 0
    },
    media: {
      imageCount: 1,
      videoCount: 0,
      audioCount: 0,
      embedCount: 0,
      hasVideo: false,
      hasAudio: false,
      hasGalleryLikePattern: false,
      hasHeroMedia: false
    },
    content: {
      topHeadings: ["Example heading"],
      topButtons: [],
      topKeywords: ["example"],
      textSample: "Example text sample"
    }
  };
}

test("site insight classifier detects login/account pages from strong auth signals", () => {
  const engine = loadEngine();
  assert.ok(engine, "HolmetaPageInsightEngine should exist");

  const normalized = baseNormalized();
  normalized.page.pathname = "/account/login";
  normalized.page.pathSegments = ["account", "login"];
  normalized.page.pathDepth = 2;
  normalized.forms.totalForms = 1;
  normalized.forms.inputCount = 3;
  normalized.forms.inputControlCount = 4;
  normalized.forms.hasPassword = true;
  normalized.forms.hasEmailInput = true;
  normalized.forms.loginCueCount = 3;

  const classification = engine.classifySignals(normalized);
  assert.equal(classification.key, "login");
  assert.equal(classification.pageType, "Login / Account Page");
});

test("site insight classifier detects documentation pages from code and nav structure", () => {
  const engine = loadEngine();

  const normalized = baseNormalized();
  normalized.page.pathname = "/docs/api/reference";
  normalized.page.pathSegments = ["docs", "api", "reference"];
  normalized.page.pathDepth = 3;
  normalized.structure.hasNav = true;
  normalized.structure.hasSidebar = true;
  normalized.structure.hasCodeBlocks = true;
  normalized.structure.codeBlockCount = 8;
  normalized.structure.headingCounts = { h1: 1, h2: 6, h3: 3, h4: 0, h5: 0, h6: 0, total: 10 };
  normalized.reading.docsCueCount = 4;
  normalized.reading.wordEstimate = 850;

  const classification = engine.classifySignals(normalized);
  assert.equal(classification.key, "docs");
  assert.equal(classification.pageType, "Documentation Page");
});

test("site insight classifier falls back to unknown when page signals are weak", () => {
  const engine = loadEngine();
  const normalized = baseNormalized();

  const classification = engine.classifySignals(normalized);
  assert.equal(classification.key, "unknown");
  assert.equal(classification.pageType, "Unknown / Mixed Page");
});

test("site insight payload includes security note for non-HTTPS pages", () => {
  const engine = loadEngine();
  const normalized = baseNormalized();
  normalized.page.protocol = "http:";

  const payload = engine.buildInsightPayloadFromNormalized(normalized);
  assert.equal(typeof payload.summary, "string");
  assert.ok(payload.summary.length > 0, "summary should exist");
  assert.ok(payload.securityNote.includes("HTTP"), "security note should flag HTTP pages");
  assert.ok(Array.isArray(payload.essentials));
  assert.ok(payload.essentials.some((row) => row.startsWith("Title: ")));
  assert.ok(payload.copyText.includes("Page Type:"));
});
