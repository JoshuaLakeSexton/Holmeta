(() => {
  if (globalThis.HolmetaAppearanceTokenRemapper) return;

  const appearanceState = globalThis.HolmetaAppearanceState;
  const ATTR = appearanceState?.ATTR || {
    ACTIVE: "data-holmeta-appearance-active",
    MODE: "data-holmeta-appearance-mode",
    COMPAT: "data-holmeta-appearance-compat",
    SITE: "data-holmeta-appearance-site",
    SURFACE: "data-holmeta-ui-surface",
    COMPONENT: "data-holmeta-ui-component",
    INNER: "data-holmeta-ui-inner",
    MEDIA_SAFE: "data-holmeta-media-safe"
  };

  function cssText() {
    return `
html[${ATTR.ACTIVE}='1'] {
  color-scheme: var(--holmeta-appearance-scheme, dark) !important;
  background-color: var(--holmeta-appearance-page-base) !important;
}

html[${ATTR.ACTIVE}='1'] body {
  background-color: var(--holmeta-appearance-page-base) !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'] {
  background-color: var(--holmeta-appearance-surface-2) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-soft) !important;
  box-shadow: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.COMPAT}='media-safe'] [${ATTR.SURFACE}='1'] {
  background-color: color-mix(in srgb, var(--holmeta-appearance-surface-2) 90%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='card'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='nav'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='listitem'] {
  background-color: var(--holmeta-appearance-card-bg) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='input'] {
  background-color: var(--holmeta-appearance-input-bg) !important;
  border-color: var(--holmeta-appearance-input-border) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'] {
  background-color: var(--holmeta-appearance-button-bg) !important;
  color: var(--holmeta-appearance-button-text) !important;
  border-color: var(--holmeta-appearance-border-strong) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'] *:not([${ATTR.MEDIA_SAFE}]):not(svg):not(path):not(img):not(video):not(canvas):not(iframe),
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='input'] *:not([${ATTR.MEDIA_SAFE}]):not(svg):not(path):not(img):not(video):not(canvas):not(iframe) {
  background-color: transparent !important;
  background-image: none !important;
  color: inherit !important;
  border-color: inherit !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'] :where(div, span, p, strong, em, b, i, label, small),
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='input'] :where(div, span, p, strong, em, b, i, label, small) {
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  color: inherit !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'] :where(div, span, p, strong, em, b, i, label, small)::before,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'] :where(div, span, p, strong, em, b, i, label, small)::after,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='input'] :where(div, span, p, strong, em, b, i, label, small)::before,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='input'] :where(div, span, p, strong, em, b, i, label, small)::after {
  background-color: transparent !important;
  border-color: inherit !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button']:hover,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button']:focus-visible,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'][aria-pressed='true'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'][aria-current='page'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='button'][aria-selected='true'] {
  background-color: var(--holmeta-appearance-interactive-hover) !important;
  color: var(--holmeta-appearance-selected-text) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'] [${ATTR.INNER}='1'],
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1'] > :is(div, span, strong, em, b, i, label, small, p, ul, ol, li) {
  background-color: transparent !important;
  color: inherit !important;
  border-color: color-mix(in srgb, var(--holmeta-appearance-border-soft) 75%, transparent) !important;
}

html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1']::before,
html[${ATTR.ACTIVE}='1'] [${ATTR.SURFACE}='1']::after {
  color: inherit !important;
  border-color: var(--holmeta-appearance-border-soft) !important;
}

html[${ATTR.ACTIVE}='1'] :where(input, textarea, select, button, [role='button'], [role='tab']) {
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] :where(input, textarea, select) {
  background-color: var(--holmeta-appearance-input-bg) !important;
  border-color: var(--holmeta-appearance-input-border) !important;
}

html[${ATTR.ACTIVE}='1'] :where([role='search'], [type='search']) {
  background-color: var(--holmeta-appearance-input-bg) !important;
  border-color: var(--holmeta-appearance-input-border) !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

html[${ATTR.ACTIVE}='1'] :where(a, a:visited) {
  color: var(--holmeta-appearance-link) !important;
}

html[${ATTR.ACTIVE}='1'] :where(hr, [role='separator']) {
  border-color: var(--holmeta-appearance-border-soft) !important;
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

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='SearchBox_Search_Input'],
  [data-testid='SearchBox_Search_Input'] *,
  [data-testid='tweetButtonInline'],
  [data-testid='tweetButtonInline'] *,
  [data-testid='SideNav_NewTweet_Button'],
  [data-testid='SideNav_NewTweet_Button'] *,
  [data-testid='placementTracking'] [role='button'],
  [data-testid='placementTracking'] [role='button'] *
) {
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-soft) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='SearchBox_Search_Input'],
  [data-testid='tweetButtonInline'],
  [data-testid='SideNav_NewTweet_Button'],
  [data-testid='placementTracking'] [role='button']
) {
  background-color: var(--holmeta-appearance-input-bg) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  [data-testid='SearchBox_Search_Input'] *,
  [data-testid='tweetButtonInline'] *,
  [data-testid='SideNav_NewTweet_Button'] *,
  [data-testid='placementTracking'] [role='button'] *
) {
  background-color: transparent !important;
  background-image: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  main [role='button'],
  main [role='button'] *,
  main a[role='link'][data-testid],
  main a[role='link'][data-testid] *
) {
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-soft) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  main [role='button'],
  main a[role='link'][data-testid]
) {
  background-color: var(--holmeta-appearance-button-bg) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='x'] :is(
  main [role='button'] *,
  main a[role='link'][data-testid] *
) {
  background-color: transparent !important;
  background-image: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='youtube'] :is(
  ytd-searchbox,
  ytd-searchbox *,
  .ytSearchboxComponentHost,
  .ytSearchboxComponentHost *,
  .ytSearchboxComponentInputBox,
  .ytSearchboxComponentSearchButton,
  #search-form,
  #search-form *,
  #search-icon-legacy,
  #search-icon-legacy *
) {
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-soft) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='youtube'] :is(
  ytd-searchbox,
  .ytSearchboxComponentHost,
  .ytSearchboxComponentInputBox,
  .ytSearchboxComponentSearchButton,
  #search-form,
  #search-icon-legacy
) {
  background-color: var(--holmeta-appearance-input-bg) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='youtube'] :is(
  ytd-searchbox *,
  .ytSearchboxComponentHost *,
  .ytSearchboxComponentInputBox *,
  .ytSearchboxComponentSearchButton *,
  #search-form *,
  #search-icon-legacy *
) {
  background-color: transparent !important;
  background-image: none !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='github'] :is(
  .Header,
  .Header *,
  .header-search-wrapper,
  .header-search-wrapper *,
  [data-target='qbsearch-input.inputButtonText'],
  [data-target='qbsearch-input.inputButtonText'] *,
  .Button,
  .Button *
) {
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-border-soft) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='github'] :is(
  .header-search-wrapper,
  [data-target='qbsearch-input.inputButtonText'],
  .Button
) {
  background-color: var(--holmeta-appearance-input-bg) !important;
}

html[${ATTR.ACTIVE}='1'][${ATTR.SITE}='github'] :is(
  .header-search-wrapper *,
  [data-target='qbsearch-input.inputButtonText'] *,
  .Button *
) {
  background-color: transparent !important;
  background-image: none !important;
}

html[${ATTR.ACTIVE}='1'] body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483638;
  background: var(--holmeta-appearance-overlay-tint);
}
`;
  }

  function applyRootTokens(root, tokens, compatibilityMode = "normal", siteKey = "") {
    if (!root || !tokens) return;
    root.style.setProperty("--holmeta-appearance-scheme", tokens.mode === "light" ? "light" : "dark");
    root.style.setProperty("--holmeta-appearance-page-base", tokens.pageBase);
    root.style.setProperty("--holmeta-appearance-surface-1", tokens.surface1);
    root.style.setProperty("--holmeta-appearance-surface-2", tokens.surface2);
    root.style.setProperty("--holmeta-appearance-surface-3", tokens.surface3);
    root.style.setProperty("--holmeta-appearance-text-primary", tokens.textPrimary);
    root.style.setProperty("--holmeta-appearance-text-secondary", tokens.textSecondary);
    root.style.setProperty("--holmeta-appearance-text-muted", tokens.textMuted);
    root.style.setProperty("--holmeta-appearance-border-soft", tokens.borderSoft);
    root.style.setProperty("--holmeta-appearance-border-strong", tokens.borderStrong);
    root.style.setProperty("--holmeta-appearance-interactive-bg", tokens.interactiveBg);
    root.style.setProperty("--holmeta-appearance-interactive-hover", tokens.interactiveHover);
    root.style.setProperty("--holmeta-appearance-selected-bg", tokens.selectedBg);
    root.style.setProperty("--holmeta-appearance-selected-text", tokens.selectedText);
    root.style.setProperty("--holmeta-appearance-input-bg", tokens.inputBg);
    root.style.setProperty("--holmeta-appearance-input-border", tokens.inputBorder);
    root.style.setProperty("--holmeta-appearance-card-bg", tokens.cardBg);
    root.style.setProperty("--holmeta-appearance-menu-bg", tokens.menuBg);
    root.style.setProperty("--holmeta-appearance-badge-bg", tokens.badgeBg);
    root.style.setProperty("--holmeta-appearance-button-bg", tokens.buttonBg);
    root.style.setProperty("--holmeta-appearance-button-text", tokens.buttonText);
    root.style.setProperty("--holmeta-appearance-link", tokens.link);
    root.style.setProperty("--holmeta-appearance-shadow", tokens.shadow);
    root.style.setProperty("--holmeta-appearance-overlay-tint", tokens.overlayTint);

    root.setAttribute(ATTR.ACTIVE, "1");
    root.setAttribute(ATTR.MODE, tokens.mode === "light" ? "light" : "dark");
    root.setAttribute(ATTR.COMPAT, compatibilityMode || "normal");
    if (siteKey) root.setAttribute(ATTR.SITE, siteKey);
    else root.removeAttribute(ATTR.SITE);
  }

  function clearRootTokens(root) {
    if (!root) return;
    root.removeAttribute(ATTR.ACTIVE);
    root.removeAttribute(ATTR.MODE);
    root.removeAttribute(ATTR.COMPAT);
    root.removeAttribute(ATTR.SITE);

    const keys = [
      "--holmeta-appearance-scheme",
      "--holmeta-appearance-page-base",
      "--holmeta-appearance-surface-1",
      "--holmeta-appearance-surface-2",
      "--holmeta-appearance-surface-3",
      "--holmeta-appearance-text-primary",
      "--holmeta-appearance-text-secondary",
      "--holmeta-appearance-text-muted",
      "--holmeta-appearance-border-soft",
      "--holmeta-appearance-border-strong",
      "--holmeta-appearance-interactive-bg",
      "--holmeta-appearance-interactive-hover",
      "--holmeta-appearance-selected-bg",
      "--holmeta-appearance-selected-text",
      "--holmeta-appearance-input-bg",
      "--holmeta-appearance-input-border",
      "--holmeta-appearance-card-bg",
      "--holmeta-appearance-menu-bg",
      "--holmeta-appearance-badge-bg",
      "--holmeta-appearance-button-bg",
      "--holmeta-appearance-button-text",
      "--holmeta-appearance-link",
      "--holmeta-appearance-shadow",
      "--holmeta-appearance-overlay-tint"
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
