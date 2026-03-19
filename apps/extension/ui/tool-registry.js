(() => {
  if (globalThis.HolmetaToolRegistry) return;

  const popup = [
    { id: "commandLinksPanel", title: "Command Links" },
    { id: "favoritesPanel", title: "Favorite Sites" },
    { id: "readingThemePanel", title: "Appearance Comfort" },
    { id: "lightPanel", title: "Light Filter Tool" },
    { id: "deepWorkFold", title: "Deep Work Protocol", headingTag: "summary" },
    { id: "screenEmulatorPanel", title: "Screen Resolution Emulator" },
    { id: "eyeDropperPanel", title: "Color Eye Dropper" },
    { id: "screenshotPanel", title: "Element Screenshot Tool" },
    { id: "translatePanel", title: "Translate Tool" },
    { id: "blockerPanel", title: "Site Blocker Tool" },
    { id: "alertsPanel", title: "Health Alert Popups" },
    { id: "meditationPanel", title: "Meditation Popup" },
    { id: "siteInsightPanel", title: "Site Insight Popup" },
    { id: "vaultPanel", title: "Vault" },
    { id: "advancedFold", title: "Advanced Lab (Premium)", headingTag: "summary" }
  ];

  const options = [
    { id: "optPanelLight", title: "Light Filter Tool" },
    { id: "optPanelAppearance", title: "Appearance Comfort" },
    { id: "optPanelBlocker", title: "Site Blocker Tool" },
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
