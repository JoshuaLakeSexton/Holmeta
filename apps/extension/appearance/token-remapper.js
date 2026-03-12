(() => {
  if (globalThis.HolmetaAppearanceTokenRemapper) return;

  const appearanceState = globalThis.HolmetaAppearanceState;
  const ATTR = appearanceState?.ATTR || {
    ACTIVE: "data-holmeta-appearance-active",
    MODE: "data-holmeta-appearance-mode",
    COMPAT: "data-holmeta-appearance-compat",
    SITE: "data-holmeta-appearance-site",
    SITE_CLASS: "data-holmeta-site-class",
    SURFACE: "data-holmeta-ui-surface",
    COMPONENT: "data-holmeta-ui-component",
    INNER: "data-holmeta-ui-inner",
    MEDIA_SAFE: "data-holmeta-media-safe",
    FORCE_TEXT: "data-holmeta-force-text",
    LOGO_WORDMARK: "data-holmeta-logo-wordmark",
    LOGO_SAFE_BG: "data-holmeta-logo-safe-bg",
    LOGO_SVG: "data-holmeta-logo-svg"
  };

  function cssText() {
    return `
html[${ATTR.ACTIVE}='1'] {
  color-scheme: var(--holmeta-appearance-scheme, dark) !important;
  background-color: var(--holmeta-appearance-page-background) !important;
}

html[${ATTR.ACTIVE}='1'] body {
  background-color: var(--holmeta-appearance-page-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'] {
  background-color: var(--holmeta-appearance-panel-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-subtle) !important;
  box-shadow: none !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='card'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='surface'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='panel'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='buy_panel'] {
  background-color: var(--holmeta-appearance-card-background) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='nav'] {
  background-color: var(--holmeta-appearance-sidebar-background) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='header'] {
  background-color: var(--holmeta-appearance-header-background) !important;
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='footer'] {
  background-color: var(--holmeta-appearance-section-background) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='accordion'] {
  background-color: var(--holmeta-appearance-panel-background) !important;
  border-color: var(--holmeta-appearance-row-separator) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='toolbar'] {
  background-color: var(--holmeta-appearance-section-background) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='listitem'] {
  background-color: var(--holmeta-appearance-table-row-background) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='table'] {
  background-color: var(--holmeta-appearance-section-background) !important;
  border-color: var(--holmeta-appearance-row-separator) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='chip'] {
  background-color: var(--holmeta-appearance-chip-background) !important;
  border-color: var(--holmeta-appearance-chip-border) !important;
  color: var(--holmeta-appearance-chip-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='dropdown'] {
  background-color: var(--holmeta-appearance-dropdown-background) !important;
  border-color: var(--holmeta-appearance-dropdown-border) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='separator'] {
  background-color: transparent !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='input'] {
  background-color: var(--holmeta-appearance-input-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-strong) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'] {
  background-color: var(--holmeta-appearance-control-background) !important;
  color: var(--holmeta-appearance-control-text) !important;
  border-color: var(--holmeta-appearance-button-border) !important;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--holmeta-appearance-line-subtle) 40%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button']:hover,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button']:focus-visible,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'][aria-current='page'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'][aria-selected='true'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'][data-state='active'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'].active {
  background-color: var(--holmeta-appearance-selected-background) !important;
  color: var(--holmeta-appearance-selected-text) !important;
  border-color: var(--holmeta-appearance-accent-strong) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='input']:focus-within,
html[${ATTR.ACTIVE}='1'] :where(input, textarea, select):focus-visible {
  outline: 2px solid var(--holmeta-appearance-focus-ring) !important;
  outline-offset: 1px !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'] [${ATTR.INNER}='1'] {
  background-color: transparent !important;
  background-image: none !important;
  color: inherit !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'] [${ATTR.INNER}='1']::before,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'] [${ATTR.INNER}='1']::after {
  background-color: transparent !important;
  border-color: transparent !important;
}

html[${ATTR.ACTIVE}='1'] :where(input, textarea, select, [role='textbox'], [type='search']) {
  background-color: var(--holmeta-appearance-input-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-input-border) !important;
}

html[${ATTR.ACTIVE}='1'] :where(button, [role='button'], [role='tab']) {
  background-color: var(--holmeta-appearance-control-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-button-border) !important;
}

html[${ATTR.ACTIVE}='1'] :where(button, [role='button'], [role='tab']):hover,
html[${ATTR.ACTIVE}='1'] :where(button, [role='button'], [role='tab']):focus-visible,
html[${ATTR.ACTIVE}='1'] :where(button, [role='button'], [role='tab'])[aria-current='page'],
html[${ATTR.ACTIVE}='1'] :where(button, [role='button'], [role='tab'])[aria-selected='true'],
html[${ATTR.ACTIVE}='1'] :where(button, [role='button'], [role='tab']).active {
  background-color: var(--holmeta-appearance-selected-background) !important;
  color: var(--holmeta-appearance-selected-text) !important;
  border-color: var(--holmeta-appearance-accent-strong) !important;
}

html[${ATTR.ACTIVE}='1'] :where(p, li, dt, dd, label, td, figcaption, blockquote) {
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] :where([role='tab'][aria-selected='true'], [aria-current='page']) {
  background-color: var(--holmeta-appearance-selected-background) !important;
  color: var(--holmeta-appearance-selected-text) !important;
  border-color: var(--holmeta-appearance-accent-strong) !important;
}

html[${ATTR.ACTIVE}='1'] :where(a, a:visited) {
  color: var(--holmeta-appearance-text-primary) !important;
  text-decoration-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] :where(h1, h2, h3, h4, h5, h6, strong) {
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] :where(small, time, figcaption, [data-testid*='subtext']) {
  color: var(--holmeta-appearance-text-muted) !important;
}

html[${ATTR.ACTIVE}='1'] :where(hr, [role='separator']) {
  border-color: var(--holmeta-appearance-line-subtle) !important;
  background-color: transparent !important;
}

html[${ATTR.ACTIVE}='1'] :where(table, thead, tbody, tfoot, tr, th, td) {
  border-color: var(--holmeta-appearance-row-separator) !important;
}

html[${ATTR.ACTIVE}='1'] :where(thead, th) {
  background-color: var(--holmeta-appearance-table-header-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] :where(tr:nth-child(odd), li:nth-child(odd), [role='row']:nth-child(odd)) {
  background-color: color-mix(in srgb, var(--holmeta-appearance-table-row-background) 78%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] :where(tr:nth-child(even), [role='row']:nth-child(even)) {
  background-color: color-mix(in srgb, var(--holmeta-appearance-table-row-alt) 72%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] :where([class*='divider'], [class*='separator'], [data-testid*='divider']) {
  border-color: var(--holmeta-appearance-line-subtle) !important;
  background-color: transparent !important;
}

html[${ATTR.ACTIVE}='1'] :where([class*='footer'], footer, [role='contentinfo']) {
  background-color: var(--holmeta-appearance-section-background) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] :where([class*='accordion'], [data-testid*='accordion'], details, summary, [aria-expanded]) {
  border-color: var(--holmeta-appearance-row-separator) !important;
}

html[${ATTR.ACTIVE}='1'] :where([class*='accordion'], details, summary, [aria-expanded='true']) {
  background-color: color-mix(in srgb, var(--holmeta-appearance-card-background) 88%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] :where([class*='panel'], [class*='card'], [class*='module'], [class*='tile'], [data-testid*='panel']) {
  background-color: var(--holmeta-appearance-card-background) !important;
  border-color: var(--holmeta-appearance-border-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] :where([class*='search'], [role='search'], [class*='filter'], [class*='toolbar']) {
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(
  header,
  [role='banner'],
  nav,
  [class*='header'],
  [class*='navbar'],
  [class*='menu-bar'],
  [class*='topbar'],
  [class*='appbar'],
  [data-testid*='header']
) {
  background-color: var(--holmeta-appearance-nav-harmonized-background) !important;
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(
  header,
  [role='banner'],
  nav,
  [class*='header'],
  [class*='navbar'],
  [class*='menu-bar'],
  [class*='topbar'],
  [class*='appbar'],
  [data-testid*='header']
) :where(a, p, span, strong, em, i, b, label, button) {
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'],
html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(a, p, span, strong, em, i, b, label, button, svg, path, circle, rect, polygon, line) {
  color: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(svg path, svg circle, svg rect, svg polygon, svg line) {
  fill: var(--holmeta-appearance-contrast-on-dark) !important;
  stroke: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'],
html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(a, p, span, strong, em, i, b, label, button, svg, path, circle, rect, polygon, line) {
  color: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(svg path, svg circle, svg rect, svg polygon, svg line) {
  fill: var(--holmeta-appearance-contrast-on-light) !important;
  stroke: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_WORDMARK}='light'] {
  color: var(--holmeta-appearance-logo-on-dark-text) !important;
  text-shadow: 0 0 0.5px color-mix(in srgb, var(--holmeta-appearance-logo-on-dark-text) 45%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_WORDMARK}='dark'] {
  color: var(--holmeta-appearance-logo-on-light-text) !important;
  text-shadow: none !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'],
html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'] * {
  fill: var(--holmeta-appearance-logo-on-dark-text) !important;
  stroke: var(--holmeta-appearance-logo-on-dark-text) !important;
  color: var(--holmeta-appearance-logo-on-dark-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'],
html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'] * {
  fill: var(--holmeta-appearance-logo-on-light-text) !important;
  stroke: var(--holmeta-appearance-logo-on-light-text) !important;
  color: var(--holmeta-appearance-logo-on-light-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SAFE_BG}='light'] {
  background-color: var(--holmeta-appearance-logo-safe-background-light) !important;
  border: 1px solid var(--holmeta-appearance-line-subtle) !important;
  border-radius: 6px !important;
  padding: 2px 6px !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SAFE_BG}='dark'] {
  background-color: var(--holmeta-appearance-logo-safe-background-dark) !important;
  border: 1px solid var(--holmeta-appearance-line-subtle) !important;
  border-radius: 6px !important;
  padding: 2px 6px !important;
}

/* Backward compatibility for older marker values from previous passes. */
html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='1'] {
  color: var(--holmeta-appearance-low-contrast-fix-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_WORDMARK}='1'] {
  color: var(--holmeta-appearance-logo-on-dark-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='1'],
html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='1'] * {
  fill: var(--holmeta-appearance-logo-on-dark-text) !important;
  stroke: var(--holmeta-appearance-logo-on-dark-text) !important;
  color: var(--holmeta-appearance-logo-on-dark-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SAFE_BG}='1'] {
  background-color: var(--holmeta-appearance-logo-safe-background-light) !important;
  border: 1px solid var(--holmeta-appearance-line-subtle) !important;
  border-radius: 6px !important;
  padding: 2px 6px !important;
}

html[${ATTR.ACTIVE}='1'] svg:not([${ATTR.MEDIA_SAFE}]) {
  color: var(--holmeta-appearance-icon-primary) !important;
}

html[${ATTR.ACTIVE}='1'] :where(svg path, svg circle, svg rect, svg polygon, svg line):not([${ATTR.MEDIA_SAFE}] *) {
  stroke: currentColor !important;
  fill: currentColor !important;
}

/* Keep explicit contrast markers stronger than generic icon recoloring. */
html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(svg, svg *, path, circle, rect, polygon, line) {
  color: var(--holmeta-appearance-contrast-on-dark) !important;
  fill: var(--holmeta-appearance-contrast-on-dark) !important;
  stroke: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(svg, svg *, path, circle, rect, polygon, line) {
  color: var(--holmeta-appearance-contrast-on-light) !important;
  fill: var(--holmeta-appearance-contrast-on-light) !important;
  stroke: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'],
html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'] * {
  color: var(--holmeta-appearance-logo-on-dark-text) !important;
  fill: var(--holmeta-appearance-logo-on-dark-text) !important;
  stroke: var(--holmeta-appearance-logo-on-dark-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'],
html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'] * {
  color: var(--holmeta-appearance-logo-on-light-text) !important;
  fill: var(--holmeta-appearance-logo-on-light-text) !important;
  stroke: var(--holmeta-appearance-logo-on-light-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.MEDIA_SAFE}='1'],
html[${ATTR.ACTIVE}='1'] [${ATTR.MEDIA_SAFE}='1'] * {
  filter: none !important;
  mix-blend-mode: normal !important;
  color-scheme: normal !important;
}

html[${ATTR.ACTIVE}='1'] :where(video, img, picture, canvas, iframe, embed, object) {
  opacity: 1 !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE_CLASS}='dashboard'] [${ATTR.SURFACE}='1'] {
  border-color: var(--holmeta-appearance-row-separator) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE_CLASS}='dashboard'] :where(th, td, tr, [role='row']) {
  border-color: var(--holmeta-appearance-row-separator) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE_CLASS}='social'] :where(article, [role='article'], [data-testid='cellInnerDiv']) {
  background-color: var(--holmeta-appearance-card-background) !important;
  border-color: var(--holmeta-appearance-border-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE_CLASS}='docs_editor'] :where(code, pre, kbd, samp) {
  background-color: color-mix(in srgb, var(--holmeta-appearance-panel-background) 85%, #000 15%) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE_CLASS}='ecommerce'] :where([class*='price'], [data-testid*='price']) {
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE_CLASS}='ecommerce'] :where([class*='cart'], [class*='checkout'], [class*='buy'], [data-testid*='buy']) {
  background-color: var(--holmeta-appearance-card-background) !important;
  border-color: var(--holmeta-appearance-border-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='SearchBox_Search_Input'],
  [data-testid='SearchBox_Search_Input'] *,
  [data-testid='tweetTextarea_0'],
  [data-testid='tweetTextarea_0'] *,
  [data-testid='tweetButtonInline'],
  [data-testid='tweetButtonInline'] *,
  [data-testid='tweetButton'],
  [data-testid='tweetButton'] *,
  [data-testid='SideNav_NewTweet_Button'],
  [data-testid='SideNav_NewTweet_Button'] *,
  [data-testid='reply'],
  [data-testid='reply'] *,
  [data-testid='retweet'],
  [data-testid='retweet'] *,
  [data-testid='unretweet'],
  [data-testid='unretweet'] *,
  [data-testid='like'],
  [data-testid='like'] *,
  [data-testid='unlike'],
  [data-testid='unlike'] *,
  [data-testid='bookmark'],
  [data-testid='bookmark'] *,
  [data-testid='removeBookmark'],
  [data-testid='removeBookmark'] *,
  [data-testid='share'],
  [data-testid='share'] *,
  [data-testid='UserCell'] [role='button'],
  [data-testid='UserCell'] [role='button'] *
) {
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-strong) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='SearchBox_Search_Input'],
  [data-testid='tweetTextarea_0']
) {
  background-color: var(--holmeta-appearance-input-background) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='tweetButtonInline'],
  [data-testid='tweetButton'],
  [data-testid='SideNav_NewTweet_Button'],
  [data-testid='reply'],
  [data-testid='retweet'],
  [data-testid='unretweet'],
  [data-testid='like'],
  [data-testid='unlike'],
  [data-testid='bookmark'],
  [data-testid='removeBookmark'],
  [data-testid='share'],
  [data-testid='UserCell'] [role='button']
) {
  background-color: var(--holmeta-appearance-control-background) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='youtube'] :is(
  ytd-searchbox,
  .ytSearchboxComponentHost,
  .ytSearchboxComponentInputBox,
  .ytSearchboxComponentSearchButton,
  #search-form,
  #search-icon-legacy
) {
  background-color: var(--holmeta-appearance-input-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-strong) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='github'] :is(
  .Header,
  .header-search-wrapper,
  [data-target='qbsearch-input.inputButtonText'],
  .Button
) {
  background-color: var(--holmeta-appearance-panel-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-strong) !important;
}

html[${ATTR.ACTIVE}='1']::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483638;
  background: var(--holmeta-appearance-overlay-tint);
}
`;
  }

  function applyRootTokens(root, tokens, compatibilityMode = "normal", siteKey = "", siteClass = "general") {
    if (!root || !tokens) return;

    root.style.setProperty("--holmeta-appearance-scheme", tokens.mode === "light" ? "light" : "dark");
    root.style.setProperty("--holmeta-appearance-page-background", tokens.pageBackground || tokens.pageBase);
    root.style.setProperty("--holmeta-appearance-page-background-alt", tokens.pageBackgroundAlt || tokens.pageBackground || tokens.pageBase);
    root.style.setProperty("--holmeta-appearance-sidebar-background", tokens.sidebarBackground || tokens.surface1 || tokens.pageBase);
    root.style.setProperty("--holmeta-appearance-section-background", tokens.sectionBackground || tokens.sectionBg || tokens.surface1 || tokens.surface2);
    root.style.setProperty("--holmeta-appearance-panel-background", tokens.panelBackground || tokens.surface1 || tokens.surface2);
    root.style.setProperty("--holmeta-appearance-card-background", tokens.cardBackground || tokens.cardBg || tokens.surface2);
    root.style.setProperty("--holmeta-appearance-elevated-background", tokens.elevatedBackground || tokens.surface3 || tokens.cardBg);
    root.style.setProperty("--holmeta-appearance-modal-background", tokens.modalBackground || tokens.surface3 || tokens.cardBg);
    root.style.setProperty("--holmeta-appearance-dropdown-background", tokens.dropdownBackground || tokens.menuBg || tokens.surface2);
    root.style.setProperty("--holmeta-appearance-dropdown-border", tokens.dropdownBorder || tokens.borderSubtle || tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-input-background", tokens.inputBackground || tokens.inputBg);
    root.style.setProperty("--holmeta-appearance-input-border", tokens.inputBorder || tokens.borderStrong || tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-button-border", tokens.buttonBorder || tokens.borderStrong || tokens.inputBorder);
    root.style.setProperty("--holmeta-appearance-selected-background", tokens.selectedBackground || tokens.selectedBg);
    root.style.setProperty("--holmeta-appearance-selected-text", tokens.selectedText || tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-hover-background", tokens.hoverBackground || tokens.interactiveHover);
    root.style.setProperty("--holmeta-appearance-border-subtle", tokens.borderSubtle || tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-border-strong", tokens.borderStrong || tokens.inputBorder);
    root.style.setProperty("--holmeta-appearance-text-primary", tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-text-secondary", tokens.textSecondary);
    root.style.setProperty("--holmeta-appearance-text-muted", tokens.textMuted);
    root.style.setProperty("--holmeta-appearance-icon-primary", tokens.iconPrimary || tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-icon-muted", tokens.iconMuted || tokens.textMuted);
    root.style.setProperty("--holmeta-appearance-accent", tokens.accent || tokens.link);
    root.style.setProperty("--holmeta-appearance-accent-soft", tokens.accentSoft || tokens.badgeBg);
    root.style.setProperty("--holmeta-appearance-accent-strong", tokens.accentStrong || tokens.link);
    root.style.setProperty("--holmeta-appearance-text-on-accent", tokens.textOnAccent || tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-divider", tokens.divider || tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-line-subtle", tokens.lineSubtle || tokens.borderSubtle || tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-line-strong", tokens.lineStrong || tokens.borderStrong || tokens.inputBorder);
    root.style.setProperty("--holmeta-appearance-row-separator", tokens.rowSeparator || tokens.borderSubtle || tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-table-row-background", tokens.tableRowBackground || tokens.tableRow || tokens.surface2);
    root.style.setProperty("--holmeta-appearance-table-row-alt", tokens.tableRowAlt || tokens.tableRow || tokens.surface2);
    root.style.setProperty("--holmeta-appearance-table-header-background", tokens.tableHeaderBackground || tokens.tableHeader || tokens.surface3);
    root.style.setProperty("--holmeta-appearance-chip-background", tokens.chipBackground || tokens.badgeBg || tokens.surface2);
    root.style.setProperty("--holmeta-appearance-chip-border", tokens.chipBorder || tokens.borderStrong || tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-chip-text", tokens.chipText || tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-success", tokens.success || "#3da86b");
    root.style.setProperty("--holmeta-appearance-warning", tokens.warning || "#c77f00");
    root.style.setProperty("--holmeta-appearance-danger", tokens.danger || "#c42021");
    root.style.setProperty("--holmeta-appearance-control-background", tokens.controlBackground || tokens.buttonBg);
    root.style.setProperty("--holmeta-appearance-control-text", tokens.controlText || tokens.buttonText);
    root.style.setProperty("--holmeta-appearance-focus-ring", tokens.focusRing || tokens.accentStrong || tokens.link);
    root.style.setProperty("--holmeta-appearance-overlay-tint", tokens.overlayTint);
    root.style.setProperty("--holmeta-appearance-header-background", tokens.headerBackground || tokens.panelBackground || tokens.surface1);
    root.style.setProperty("--holmeta-appearance-nav-background", tokens.navBackground || tokens.sidebarBackground || tokens.surface1);
    root.style.setProperty("--holmeta-appearance-nav-harmonized-background", tokens.navHarmonizedBackground || tokens.navBackground || tokens.panelBackground || tokens.surface1);
    root.style.setProperty("--holmeta-appearance-nav-harmonized-text", tokens.navHarmonizedText || tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-header-muted-accent", tokens.headerMutedAccent || tokens.accentSoft || tokens.lineSubtle);
    root.style.setProperty("--holmeta-appearance-low-contrast-fix-text", tokens.lowContrastFixText || tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-contrast-on-dark", tokens.contrastTextOnDark || tokens.logoOnDarkText || "#F7F7F8");
    root.style.setProperty("--holmeta-appearance-contrast-on-light", tokens.contrastTextOnLight || tokens.logoOnLightText || "#15181C");
    root.style.setProperty("--holmeta-appearance-logo-safe-background-light", tokens.logoSafeBackgroundLight || tokens.logoSafeBackground || "#FFFFFF");
    root.style.setProperty("--holmeta-appearance-logo-safe-background-dark", tokens.logoSafeBackgroundDark || "#11151B");
    root.style.setProperty("--holmeta-appearance-logo-on-dark-text", tokens.logoOnDarkText || tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-logo-on-light-text", tokens.logoOnLightText || "#15181C");

    root.setAttribute(ATTR.ACTIVE, "1");
    root.setAttribute(ATTR.MODE, tokens.mode === "light" ? "light" : "dark");
    root.setAttribute(ATTR.COMPAT, compatibilityMode || "normal");
    root.setAttribute(ATTR.SITE_CLASS, siteClass || "general");
    if (siteKey) root.setAttribute(ATTR.SITE, siteKey);
    else root.removeAttribute(ATTR.SITE);
  }

  function clearRootTokens(root) {
    if (!root) return;
    root.removeAttribute(ATTR.ACTIVE);
    root.removeAttribute(ATTR.MODE);
    root.removeAttribute(ATTR.COMPAT);
    root.removeAttribute(ATTR.SITE);
    root.removeAttribute(ATTR.SITE_CLASS);

    const keys = [
      "--holmeta-appearance-scheme",
      "--holmeta-appearance-page-background",
      "--holmeta-appearance-page-background-alt",
      "--holmeta-appearance-sidebar-background",
      "--holmeta-appearance-section-background",
      "--holmeta-appearance-panel-background",
      "--holmeta-appearance-card-background",
      "--holmeta-appearance-elevated-background",
      "--holmeta-appearance-modal-background",
      "--holmeta-appearance-dropdown-background",
      "--holmeta-appearance-dropdown-border",
      "--holmeta-appearance-input-background",
      "--holmeta-appearance-input-border",
      "--holmeta-appearance-button-border",
      "--holmeta-appearance-selected-background",
      "--holmeta-appearance-selected-text",
      "--holmeta-appearance-hover-background",
      "--holmeta-appearance-border-subtle",
      "--holmeta-appearance-border-strong",
      "--holmeta-appearance-text-primary",
      "--holmeta-appearance-text-secondary",
      "--holmeta-appearance-text-muted",
      "--holmeta-appearance-icon-primary",
      "--holmeta-appearance-icon-muted",
      "--holmeta-appearance-accent",
      "--holmeta-appearance-accent-soft",
      "--holmeta-appearance-accent-strong",
      "--holmeta-appearance-text-on-accent",
      "--holmeta-appearance-divider",
      "--holmeta-appearance-line-subtle",
      "--holmeta-appearance-line-strong",
      "--holmeta-appearance-row-separator",
      "--holmeta-appearance-table-row-background",
      "--holmeta-appearance-table-row-alt",
      "--holmeta-appearance-table-header-background",
      "--holmeta-appearance-chip-background",
      "--holmeta-appearance-chip-border",
      "--holmeta-appearance-chip-text",
      "--holmeta-appearance-success",
      "--holmeta-appearance-warning",
      "--holmeta-appearance-danger",
      "--holmeta-appearance-control-background",
      "--holmeta-appearance-control-text",
      "--holmeta-appearance-focus-ring",
      "--holmeta-appearance-overlay-tint",
      "--holmeta-appearance-header-background",
      "--holmeta-appearance-nav-background",
      "--holmeta-appearance-nav-harmonized-background",
      "--holmeta-appearance-nav-harmonized-text",
      "--holmeta-appearance-header-muted-accent",
      "--holmeta-appearance-low-contrast-fix-text",
      "--holmeta-appearance-contrast-on-dark",
      "--holmeta-appearance-contrast-on-light",
      "--holmeta-appearance-logo-safe-background-light",
      "--holmeta-appearance-logo-safe-background-dark",
      "--holmeta-appearance-logo-on-dark-text",
      "--holmeta-appearance-logo-on-light-text"
    ];
    for (const key of keys) {
      root.style.removeProperty(key);
    }
  }

  globalThis.HolmetaAppearanceTokenRemapper = {
    cssText,
    applyRootTokens,
    clearRootTokens
  };
})();
