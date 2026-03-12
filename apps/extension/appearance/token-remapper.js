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
    ACCENT_SAFE: "data-holmeta-accent-safe",
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
  font-family: var(--holmeta-appearance-sans-family, inherit) !important;
  font-size: calc(var(--holmeta-appearance-sans-size, 13) * 1px) !important;
}

html[${ATTR.ACTIVE}='1'] :where(code, pre, kbd, samp, [class*='code' i], [data-testid*='code']) {
  font-family: var(--holmeta-appearance-code-family, ui-monospace) !important;
  font-size: calc(var(--holmeta-appearance-code-size, 12) * 1px) !important;
}

html[${ATTR.ACTIVE}='1'][data-holmeta-pointer-cursors='1'] :where(
  button,
  [role='button'],
  [role='tab'],
  [role='menuitem'],
  a[href],
  summary,
  [aria-expanded],
  [aria-controls]
) {
  cursor: pointer !important;
}

html[${ATTR.ACTIVE}='1'][data-holmeta-opaque-window='1'] {
  backdrop-filter: none !important;
}

html[${ATTR.ACTIVE}='1'][data-holmeta-opaque-window='1'] :where(
  body,
  header,
  nav,
  aside,
  main,
  footer,
  section,
  article,
  [${ATTR.SURFACE}='1'],
  [class*='glass' i],
  [class*='frost' i],
  [class*='blur' i],
  [style*='backdrop-filter' i],
  [style*='background: transparent' i],
  [style*='background-color: transparent' i]
) {
  backdrop-filter: none !important;
  background-image: none !important;
  background-color: color-mix(
    in srgb,
    var(--holmeta-appearance-panel-background) 92%,
    var(--holmeta-appearance-page-background) 8%
  ) !important;
  opacity: 1 !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :is(
  body > div,
  body > main,
  body > section,
  body > article,
  body > [role='main'],
  body > [id='root'],
  body > [id='app'],
  body > [class*='layout' i],
  body > [class*='page' i],
  body > [class*='shell' i]
) {
  background-color: var(--holmeta-appearance-page-background-alt) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1']:not([${ATTR.ACCENT_SAFE}='1']) {
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
  background-color: color-mix(in srgb, var(--holmeta-appearance-table-row-background) 20%, transparent) !important;
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

html[${ATTR.ACTIVE}='1'] :where(
  button,
  [type='button'],
  [type='submit'],
  [type='reset'],
  [${ATTR.COMPONENT}='button'],
  [${ATTR.COMPONENT}='input'],
  [role='tab']
):not([${ATTR.ACCENT_SAFE}='1']) {
  background-color: var(--holmeta-appearance-control-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-button-border) !important;
}

html[${ATTR.ACTIVE}='1'] :where(
  button,
  [type='button'],
  [type='submit'],
  [type='reset'],
  [${ATTR.COMPONENT}='button'],
  [role='tab']
):hover,
html[${ATTR.ACTIVE}='1'] :where(
  button,
  [type='button'],
  [type='submit'],
  [type='reset'],
  [${ATTR.COMPONENT}='button'],
  [role='tab']
):focus-visible,
html[${ATTR.ACTIVE}='1'] :where(
  button,
  [type='button'],
  [type='submit'],
  [type='reset'],
  [${ATTR.COMPONENT}='button'],
  [role='tab']
)[aria-current='page'],
html[${ATTR.ACTIVE}='1'] :where(
  button,
  [type='button'],
  [type='submit'],
  [type='reset'],
  [${ATTR.COMPONENT}='button'],
  [role='tab']
)[aria-selected='true'],
html[${ATTR.ACTIVE}='1'] :where(
  button,
  [type='button'],
  [type='submit'],
  [type='reset'],
  [${ATTR.COMPONENT}='button'],
  [role='tab']
).active:not([${ATTR.ACCENT_SAFE}='1']) {
  background-color: var(--holmeta-appearance-selected-background) !important;
  color: var(--holmeta-appearance-selected-text) !important;
  border-color: var(--holmeta-appearance-accent-strong) !important;
}

/* Keep generic role=button elements readable without forcing boxed patches. */
html[${ATTR.ACTIVE}='1'] :where([role='button']):not([${ATTR.ACCENT_SAFE}='1']) {
  background-color: transparent !important;
  border-color: transparent !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] :where([role='button'][aria-selected='true'], [role='button'][aria-current='page'], [role='button'][aria-pressed='true']):not([${ATTR.ACCENT_SAFE}='1']) {
  background-color: color-mix(in srgb, var(--holmeta-appearance-selected-background) 72%, transparent) !important;
  border-color: var(--holmeta-appearance-border-subtle) !important;
}

html[${ATTR.ACTIVE}='1'] :where([role='tab'][aria-selected='true'], [aria-current='page']) {
  background-color: var(--holmeta-appearance-selected-background) !important;
  color: var(--holmeta-appearance-selected-text) !important;
  border-color: var(--holmeta-appearance-accent-strong) !important;
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

html[${ATTR.ACTIVE}='1'] :where(table tr:nth-child(odd), [role='row']:nth-child(odd), [${ATTR.COMPONENT}='listitem']:nth-child(odd)) {
  background-color: color-mix(in srgb, var(--holmeta-appearance-table-row-background) 22%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] :where(table tr:nth-child(even), [role='row']:nth-child(even), [${ATTR.COMPONENT}='listitem']:nth-child(even)) {
  background-color: color-mix(in srgb, var(--holmeta-appearance-table-row-alt) 14%, transparent) !important;
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

html[${ATTR.ACTIVE}='1'] :where([class*='search'], [role='search'], [class*='filter'], [class*='toolbar']) {
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(
  header,
  [role='banner'],
  nav,
  [class*='navbar'],
  [class*='menu-bar'],
  [class*='topbar'],
  [class*='appbar'],
  [class*='masthead']
) {
  background-color: var(--holmeta-appearance-nav-harmonized-background) !important;
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(
  header,
  [role='banner'],
  nav,
  [class*='navbar'],
  [class*='menu-bar'],
  [class*='topbar'],
  [class*='appbar'],
  [class*='masthead']
) :where(a, p, span, strong, em, i, b, label, button) {
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='light'] :where(
  header,
  [role='banner'],
  nav,
  [class*='navbar'],
  [class*='menu-bar'],
  [class*='topbar'],
  [class*='appbar'],
  [class*='masthead']
) {
  background-color: var(--holmeta-appearance-nav-harmonized-background) !important;
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='light'] :where(
  header,
  [role='banner'],
  nav,
  [class*='navbar'],
  [class*='menu-bar'],
  [class*='topbar'],
  [class*='appbar'],
  [class*='masthead']
) :where(a, p, span, strong, em, i, b, label, button) {
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
}

/* Conservative fallback: only correct large structural shells with explicit inline light backgrounds. */
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(body, main, [role='main'], header, nav, footer, section, article, aside)[style*='background-color: rgb(255' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(body, main, [role='main'], header, nav, footer, section, article, aside)[style*='background-color: rgba(255' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(body, main, [role='main'], header, nav, footer, section, article, aside)[style*='background-color:#fff' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(body, main, [role='main'], header, nav, footer, section, article, aside)[style*='background:#fff' i] {
  background-color: var(--holmeta-appearance-card-background) !important;
  border-color: var(--holmeta-appearance-border-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color: rgb(0' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color: rgb(1' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color: rgb(2' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color: rgb(3' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color:#000' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color:#111' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color:#222' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color:#333' i] {
  color: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(main, section, article, aside, div, li, td, th, header, nav, footer, button, input, textarea, select)[style*='border-color: rgb(255' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(main, section, article, aside, div, li, td, th, header, nav, footer, button, input, textarea, select)[style*='border-color:#fff' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(main, section, article, aside, div, li, td, th, header, nav, footer, button, input, textarea, select)[style*='border-top-color: rgb(255' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='dark'] :where(main, section, article, aside, div, li, td, th, header, nav, footer, button, input, textarea, select)[style*='border-bottom-color: rgb(255' i] {
  border-color: var(--holmeta-appearance-row-separator) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='light'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color: rgb(255' i],
html[${ATTR.ACTIVE}='1'][${ATTR.MODE}='light'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, button, li, td, th, strong, em, b, i):not([${ATTR.ACCENT_SAFE}='1'])[style*='color:#fff' i] {
  color: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'],
html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(a, p, span, strong, em, i, b, label, button, svg) {
  color: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(svg [fill]:not([fill='none'])) {
  fill: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(svg [stroke]:not([stroke='none'])) {
  stroke: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'],
html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(a, p, span, strong, em, i, b, label, button, svg) {
  color: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(svg [fill]:not([fill='none'])) {
  fill: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(svg [stroke]:not([stroke='none'])) {
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

/* Keep explicit contrast markers stronger than generic icon recoloring. */
html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(svg, svg *) {
  color: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(svg [fill]:not([fill='none'])) {
  fill: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='light'] :where(svg [stroke]:not([stroke='none'])) {
  stroke: var(--holmeta-appearance-contrast-on-dark) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(svg, svg *) {
  color: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(svg [fill]:not([fill='none'])) {
  fill: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.FORCE_TEXT}='dark'] :where(svg [stroke]:not([stroke='none'])) {
  stroke: var(--holmeta-appearance-contrast-on-light) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'],
html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'] * {
  color: var(--holmeta-appearance-logo-on-dark-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'] :where([fill]:not([fill='none'])) {
  fill: var(--holmeta-appearance-logo-on-dark-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='light'] :where([stroke]:not([stroke='none'])) {
  stroke: var(--holmeta-appearance-logo-on-dark-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'],
html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'] * {
  color: var(--holmeta-appearance-logo-on-light-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'] :where([fill]:not([fill='none'])) {
  fill: var(--holmeta-appearance-logo-on-light-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.LOGO_SVG}='dark'] :where([stroke]:not([stroke='none'])) {
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

html[${ATTR.ACTIVE}='1'][${ATTR.SITE_CLASS}='ecommerce'] :where([class*='cart'], [class*='checkout'], [class*='buy'], [data-testid*='buy'])[${ATTR.SURFACE}='1'] {
  background-color: var(--holmeta-appearance-card-background) !important;
  border-color: var(--holmeta-appearance-border-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  html,
  body,
  #react-root,
  main,
  [role='main'],
  [data-testid='AppTabBar_Home_Link'],
  [aria-label='Home timeline'],
  [aria-label='Timeline: Your Home Timeline'],
  [aria-label='Search and explore'],
  [data-testid='primaryColumn'] > div
) {
  background-color: var(--holmeta-appearance-page-background) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='sidebarColumn'],
  [data-testid='sidebarColumn'] > div,
  [data-testid='AppTabBar'],
  [data-testid='TopNavBar']
) {
  background-color: var(--holmeta-appearance-section-background) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='primaryColumn'] article,
  [data-testid='cellInnerDiv'],
  [data-testid='tweet'],
  [data-testid='placementTracking'],
  [data-testid='sidebarColumn'] section,
  [data-testid='sidebarColumn'] [role='region'],
  [data-testid='sidebarColumn'] [data-testid='trend'],
  [data-testid='tweetTextarea_0-label'],
  [data-testid='tweetTextarea_0'],
  [data-testid='ScrollSnap-List'],
  [aria-label='Who to follow'],
  [aria-label='Subscribe to Premium'],
  [aria-label='Timeline: Trending now']
) {
  background-color: var(--holmeta-appearance-panel-background) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='primaryColumn'] article:hover,
  [data-testid='sidebarColumn'] section:hover,
  [data-testid='placementTracking']:hover
) {
  background-color: var(--holmeta-appearance-card-background) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='sidebarColumn'],
  [data-testid='primaryColumn'],
  [data-testid='AppTabBar'],
  [data-testid='TopNavBar']
) [style*='background-color: rgb(0' i] {
  background-color: var(--holmeta-appearance-panel-background) !important;
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
  [data-testid='SideNav_NewTweet_Button']
) {
  background-color: var(--holmeta-appearance-control-background) !important;
}

/* X inline action counters should remain icon/text-only, without boxed patches. */
html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
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
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='reply'],
  [data-testid='retweet'],
  [data-testid='unretweet'],
  [data-testid='like'],
  [data-testid='unlike'],
  [data-testid='bookmark'],
  [data-testid='removeBookmark'],
  [data-testid='share'],
  [data-testid='UserCell'] [role='button']
):is(:hover, :focus-visible, :active, [aria-pressed='true']) {
  background-color: color-mix(
    in srgb,
    var(--holmeta-appearance-selected-background) 26%,
    transparent
  ) !important;
  border-color: transparent !important;
  box-shadow: none !important;
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

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  html,
  body,
  #a-page,
  #pageContent,
  #gw-layout,
  #gw-card-layout,
  #desktop-grid-1,
  #desktop-grid-2,
  #desktop-grid-3,
  #desktop-grid-4,
  #desktop-grid,
  [id^='desktop-grid-'],
  [id*='desktop-grid-'],
  #desktop-hero,
  #gw-desktop-herotator,
  #gw-content,
  #gw-main-container,
  #gw-main,
  #dp,
  #search,
  #searchTemplate,
  #search-main-wrapper,
  .s-main-slot,
  .s-desktop-content
) {
  background-color: var(--holmeta-appearance-page-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  .a-cardui:has(img),
  .a-box:has(img),
  .s-card-container:has(img),
  .sg-col-inner:has(img),
  [data-card-metrics-id]:has(img),
  [data-cel-widget]:has(img),
  [id^='CardInstance']:has(img),
  [id^='anonCarousel']:has(img)
) {
  background-color: revert !important;
  border-color: revert !important;
  color: revert !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  .a-cardui:has(img),
  .a-box:has(img),
  .s-card-container:has(img),
  [data-card-metrics-id]:has(img),
  [data-cel-widget]:has(img),
  [id^='CardInstance']:has(img)
) :is(
  [class*='header' i],
  [class*='title' i],
  h1,
  h2,
  h3,
  h4,
  .a-color-base,
  .a-link-normal,
  .a-size-base,
  .a-size-large
) {
  background-color: transparent !important;
  color: revert !important;
  text-shadow: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  #nav-logo-sprites,
  #nav-logo,
  #nav-logo .nav-logo-link,
  #nav-logo .nav-logo-base,
  #nav-logo .nav-logo-tagline,
  #nav-logo .nav-logo-ext,
  #nav-logo .nav-logo-locale,
  #nav-logo-sprites-background,
  #nav-logo-sprites-icon
) {
  filter: none !important;
  mix-blend-mode: normal !important;
  color: inherit !important;
  background-color: transparent !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] #nav-logo-sprites {
  opacity: 1 !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  .a-dynamic-image,
  .a-image-container,
  .a-link-normal img,
  .a-link-normal picture,
  [data-image-latency],
  [data-a-image-name],
  .a-carousel-card img,
  .a-carousel-card picture,
  .a-spacing-none img,
  .a-spacing-none picture
) {
  filter: none !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
  background-color: transparent !important;
  border-color: transparent !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  .a-dynamic-image,
  .a-image-container,
  [data-image-latency],
  [data-a-image-name]
) * {
  filter: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  #nav-belt,
  #nav-main,
  #nav-subnav,
  #navbar,
  #nav-tools,
  #nav-xshop,
  #nav-xshop-container,
  #nav-swm-holiday,
  #nav-swmslot,
  #nav-swm-right,
  [id*='nav-swm']
) {
  background-color: color-mix(
    in srgb,
    var(--holmeta-appearance-page-background) 78%,
    var(--holmeta-appearance-elevated-background) 22%
  ) !important;
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  #nav-belt,
  #nav-main,
  #nav-subnav,
  #nav-tools,
  #nav-xshop
) :is(a, span, strong, em, label, div) {
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  #nav-search,
  #nav-search-bar-form,
  .nav-search-field,
  #twotabsearchtextbox,
  #searchDropdownBox,
  #nav-search-submit-button
) {
  background-color: var(--holmeta-appearance-input-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-input-border) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] #twotabsearchtextbox::placeholder {
  color: var(--holmeta-appearance-text-muted) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  #nav-hamburger-menu,
  #nav-cart,
  #nav-link-accountList,
  #nav-orders,
  #icp-nav-flyout
) {
  background-color: transparent !important;
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
  border-color: transparent !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(
  #nav-hamburger-menu,
  #nav-cart,
  #nav-link-accountList,
  #nav-orders,
  #icp-nav-flyout
) :is(svg, i, [class*='icon' i], [class*='nav-icon' i]) {
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(#nav-subnav, #nav-xshop) :is(a, .nav-a) {
  background-color: transparent !important;
  border-color: transparent !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(#nav-subnav, #nav-xshop) :is(a, .nav-a):hover,
html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='amazon'] :is(#nav-subnav, #nav-xshop) :is(a, .nav-a)[aria-current='page'] {
  background-color: color-mix(in srgb, var(--holmeta-appearance-selected-background) 76%, transparent) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='claude'] :is(
  main,
  [role='main'],
  [class*='layout' i],
  [class*='container' i],
  [class*='pane' i],
  [class*='panel' i],
  [class*='thread' i],
  [class*='composer' i],
  [class*='sidebar' i],
  [data-testid*='pane' i],
  [data-testid*='panel' i],
  [data-testid*='thread' i],
  [data-testid*='composer' i]
) {
  background-color: color-mix(
    in srgb,
    var(--holmeta-appearance-page-background-alt) 86%,
    var(--holmeta-appearance-panel-background) 14%
  ) !important;
  border-color: var(--holmeta-appearance-line-subtle) !important;
  box-shadow: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='claude'] :where(
  [class*='panel' i],
  [class*='pane' i],
  [class*='container' i],
  [data-testid*='panel' i],
  [data-testid*='pane' i]
):not(button):not([type='button']):not([role='button']) {
  background-image: none !important;
  border-radius: inherit !important;
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

  function applyRootTokens(root, tokens, compatibilityMode = "normal", siteKey = "", siteClass = "general", options = {}) {
    if (!root || !tokens) return;
    const safeOptions = options && typeof options === "object" ? options : {};
    const sanitizeSize = (value, fallback) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(10, Math.min(24, Math.round(n)));
    };
    const sanitizeFamily = (value, fallback) => {
      const raw = String(value ?? "").trim();
      if (!raw) return fallback;
      const safe = raw.replace(/[<>`]/g, "").slice(0, 220);
      return safe || fallback;
    };
    const sansFontSize = sanitizeSize(safeOptions.sansFontSize, 13);
    const sansFontFamily = sanitizeFamily(
      safeOptions.sansFontFamily,
      "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    );
    const codeFontSize = sanitizeSize(safeOptions.codeFontSize, 12);
    const codeFontFamily = sanitizeFamily(
      safeOptions.codeFontFamily,
      "ui-monospace, \"SFMono-Regular\", Menlo, Consolas, monospace"
    );

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
    root.style.setProperty("--holmeta-appearance-sans-size", String(sansFontSize));
    root.style.setProperty("--holmeta-appearance-sans-family", sansFontFamily);
    root.style.setProperty("--holmeta-appearance-code-size", String(codeFontSize));
    root.style.setProperty("--holmeta-appearance-code-family", codeFontFamily);

    root.setAttribute(ATTR.ACTIVE, "1");
    root.setAttribute(ATTR.MODE, tokens.mode === "light" ? "light" : "dark");
    root.setAttribute(ATTR.COMPAT, compatibilityMode || "normal");
    root.setAttribute(ATTR.SITE_CLASS, siteClass || "general");
    if (safeOptions.opaqueBackground) root.setAttribute("data-holmeta-opaque-window", "1");
    else root.removeAttribute("data-holmeta-opaque-window");
    if (safeOptions.pointerCursors) root.setAttribute("data-holmeta-pointer-cursors", "1");
    else root.removeAttribute("data-holmeta-pointer-cursors");
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
    root.removeAttribute("data-holmeta-opaque-window");
    root.removeAttribute("data-holmeta-pointer-cursors");

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
      "--holmeta-appearance-logo-on-light-text",
      "--holmeta-appearance-sans-size",
      "--holmeta-appearance-sans-family",
      "--holmeta-appearance-code-size",
      "--holmeta-appearance-code-family"
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
