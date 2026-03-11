(() => {
  if (globalThis.HolmetaToolRegistry) return;

  const popup = [
    { id: "lightPanel", title: "Light Filter Tool" },
    { id: "readingThemePanel", title: "Day / Night Appearance" },
    { id: "adaptiveThemePanel", title: "Adaptive Site Theme" },
    { id: "blockerPanel", title: "Site Blocker Tool" },
    { id: "alertsPanel", title: "Health Alert Popups" },
    { id: "deepWorkFold", title: "Deep Work Protocol", headingTag: "summary" },
    { id: "siteInsightPanel", title: "Site Insight Popup" },
    { id: "screenshotPanel", title: "Element Screenshot Tool" },
    { id: "eyeDropperPanel", title: "Color Eye Dropper" },
    { id: "translatePanel", title: "Translate Tool" },
    { id: "favoritesPanel", title: "Favorite Sites" },
    { id: "secureTunnelPanel", title: "Secure Tunnel" },
    { id: "screenEmulatorPanel", title: "Screen Resolution Emulator" },
    { id: "sharedVisualActionsPanel", title: "Shared Site Actions" },
    { id: "hotkeysPanel", title: "Hotkeys" },
    { id: "commandLinksPanel", title: "Command Links" },
    { id: "advancedFold", title: "Advanced Lab", headingTag: "summary" }
  ];

  const options = [
    { id: "optPanelLight", title: "Light Filter Tool" },
    { id: "optPanelAppearance", title: "Day / Night Appearance" },
    { id: "optPanelAdaptive", title: "Adaptive Site Theme" },
    { id: "optPanelBlocker", title: "Site Blocker Tool" },
    { id: "optPanelTunnel", title: "Secure Tunnel" },
    { id: "optPanelAlerts", title: "Health Alert Popups" },
    { id: "optPanelInsight", title: "Site Insight Popup" },
    { id: "optPanelDeepWork", title: "Deep Work Mode" },
    { id: "optPanelAccess", title: "Subscription Access" },
    { id: "optPanelStats", title: "Local Dashboard" },
    { id: "optPanelData", title: "Data + Debug" }
  ];

  globalThis.HolmetaToolRegistry = {
    popup,
    options
  };
})();
