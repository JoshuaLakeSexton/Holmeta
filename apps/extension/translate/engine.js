// HOLMETA v3.0 translate engine
// Local-first translation UX with provider abstraction and reversible DOM translation.

(() => {
  if (globalThis.HolmetaTranslateEngine) return;
  if (!/^https?:$/.test(location.protocol)) {
    globalThis.HolmetaTranslateEngine = {
      applyState: () => {},
      handleMessage: async () => ({ ok: false, error: "unsupported_protocol" })
    };
    return;
  }

  const IDS = {
    STYLE: "holmeta-translate-style-v1",
    HOST: "holmeta-translate-host-v1"
  };

  const TRANSLATION_HISTORY_LIMIT = 120;
  const SAVED_PHRASES_LIMIT = 200;
  const NODE_TRANSLATION_LIMIT = 420;
  const TEXT_LENGTH_LIMIT = 4200;
  const CACHE_LIMIT = 2000;

  const LANGUAGES = [
    { code: "auto", label: "Auto" },
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
    { code: "fr", label: "French" },
    { code: "de", label: "German" },
    { code: "pt", label: "Portuguese" },
    { code: "it", label: "Italian" },
    { code: "nl", label: "Dutch" },
    { code: "sv", label: "Swedish" },
    { code: "no", label: "Norwegian" },
    { code: "da", label: "Danish" },
    { code: "fi", label: "Finnish" },
    { code: "ja", label: "Japanese" },
    { code: "ko", label: "Korean" },
    { code: "zh", label: "Chinese" }
  ];

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "CODE",
    "PRE",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "BUTTON",
    "SVG",
    "CANVAS",
    "VIDEO",
    "AUDIO"
  ]);

  const PHRASES = {
    "hello": { es: "hola", fr: "bonjour", de: "hallo", pt: "olá", it: "ciao", nl: "hallo" },
    "thank you": { es: "gracias", fr: "merci", de: "danke", pt: "obrigado", it: "grazie", nl: "dank je" },
    "please": { es: "por favor", fr: "s'il vous plaît", de: "bitte", pt: "por favor", it: "per favore", nl: "alsjeblieft" },
    "sign in": { es: "iniciar sesión", fr: "se connecter", de: "anmelden", pt: "entrar", it: "accedi", nl: "inloggen" },
    "sign up": { es: "registrarse", fr: "s'inscrire", de: "registrieren", pt: "cadastre-se", it: "registrati", nl: "registreren" },
    "add to cart": { es: "añadir al carrito", fr: "ajouter au panier", de: "in den warenkorb", pt: "adicionar ao carrinho", it: "aggiungi al carrello", nl: "toevoegen aan winkelwagen" },
    "buy now": { es: "comprar ahora", fr: "acheter maintenant", de: "jetzt kaufen", pt: "comprar agora", it: "acquista ora", nl: "nu kopen" },
    "learn more": { es: "saber más", fr: "en savoir plus", de: "mehr erfahren", pt: "saiba mais", it: "scopri di più", nl: "meer informatie" },
    "privacy policy": { es: "política de privacidad", fr: "politique de confidentialité", de: "datenschutzrichtlinie", pt: "política de privacidade", it: "informativa sulla privacy", nl: "privacybeleid" },
    "terms of service": { es: "términos de servicio", fr: "conditions d'utilisation", de: "nutzungsbedingungen", pt: "termos de serviço", it: "termini di servizio", nl: "servicevoorwaarden" },
    "contact us": { es: "contáctanos", fr: "nous contacter", de: "kontakt", pt: "fale conosco", it: "contattaci", nl: "contact opnemen" },
    "read more": { es: "leer más", fr: "lire plus", de: "mehr lesen", pt: "ler mais", it: "leggi di più", nl: "lees meer" },
    "view details": { es: "ver detalles", fr: "voir les détails", de: "details ansehen", pt: "ver detalhes", it: "vedi dettagli", nl: "details bekijken" }
  };

  const WORDS = {
    es: {
      account: "cuenta", active: "activo", add: "agregar", alerts: "alertas", article: "artículo",
      cart: "carrito", checkout: "pago", clear: "limpiar", close: "cerrar", color: "color",
      copy: "copiar", dashboard: "panel", date: "fecha", delete: "eliminar", disable: "desactivar",
      docs: "documentos", download: "descargar", edit: "editar", email: "correo", enable: "activar",
      error: "error", export: "exportar", filter: "filtro", focus: "enfoque", help: "ayuda",
      history: "historial", language: "idioma", light: "claro", mode: "modo", news: "noticias",
      open: "abrir", page: "página", password: "contraseña", premium: "premium", profile: "perfil",
      save: "guardar", search: "buscar", section: "sección", settings: "configuración", site: "sitio",
      start: "iniciar", stop: "detener", success: "éxito", summary: "resumen", support: "soporte",
      theme: "tema", translate: "traducir", update: "actualizar", user: "usuario", video: "video", warning: "aviso"
    },
    fr: {
      account: "compte", active: "actif", add: "ajouter", alerts: "alertes", article: "article",
      cart: "panier", checkout: "paiement", clear: "effacer", close: "fermer", color: "couleur",
      copy: "copier", dashboard: "tableau", date: "date", delete: "supprimer", disable: "désactiver",
      docs: "documents", download: "télécharger", edit: "modifier", email: "email", enable: "activer",
      error: "erreur", export: "exporter", filter: "filtre", focus: "concentration", help: "aide",
      history: "historique", language: "langue", light: "clair", mode: "mode", news: "actualités",
      open: "ouvrir", page: "page", password: "mot de passe", premium: "premium", profile: "profil",
      save: "enregistrer", search: "rechercher", section: "section", settings: "paramètres", site: "site",
      start: "démarrer", stop: "arrêter", success: "succès", summary: "résumé", support: "support",
      theme: "thème", translate: "traduire", update: "mise à jour", user: "utilisateur", video: "vidéo", warning: "alerte"
    },
    de: {
      account: "konto", active: "aktiv", add: "hinzufügen", alerts: "warnungen", article: "artikel",
      cart: "warenkorb", checkout: "kasse", clear: "löschen", close: "schließen", color: "farbe",
      copy: "kopieren", dashboard: "dashboard", date: "datum", delete: "löschen", disable: "deaktivieren",
      docs: "dokumente", download: "download", edit: "bearbeiten", email: "e-mail", enable: "aktivieren",
      error: "fehler", export: "exportieren", filter: "filter", focus: "fokus", help: "hilfe",
      history: "verlauf", language: "sprache", light: "hell", mode: "modus", news: "nachrichten",
      open: "öffnen", page: "seite", password: "passwort", premium: "premium", profile: "profil",
      save: "speichern", search: "suche", section: "abschnitt", settings: "einstellungen", site: "seite",
      start: "start", stop: "stopp", success: "erfolg", summary: "zusammenfassung", support: "support",
      theme: "thema", translate: "übersetzen", update: "aktualisieren", user: "benutzer", video: "video", warning: "warnung"
    },
    pt: {
      account: "conta", active: "ativo", add: "adicionar", alerts: "alertas", article: "artigo",
      cart: "carrinho", checkout: "pagamento", clear: "limpar", close: "fechar", color: "cor",
      copy: "copiar", dashboard: "painel", date: "data", delete: "excluir", disable: "desativar",
      docs: "documentos", download: "baixar", edit: "editar", email: "email", enable: "ativar",
      error: "erro", export: "exportar", filter: "filtro", focus: "foco", help: "ajuda",
      history: "histórico", language: "idioma", light: "claro", mode: "modo", news: "notícias",
      open: "abrir", page: "página", password: "senha", premium: "premium", profile: "perfil",
      save: "salvar", search: "buscar", section: "seção", settings: "configurações", site: "site",
      start: "iniciar", stop: "parar", success: "sucesso", summary: "resumo", support: "suporte",
      theme: "tema", translate: "traduzir", update: "atualizar", user: "usuário", video: "vídeo", warning: "aviso"
    },
    it: {
      account: "account", active: "attivo", add: "aggiungi", alerts: "avvisi", article: "articolo",
      cart: "carrello", checkout: "pagamento", clear: "cancella", close: "chiudi", color: "colore",
      copy: "copia", dashboard: "dashboard", date: "data", delete: "elimina", disable: "disattiva",
      docs: "documenti", download: "scarica", edit: "modifica", email: "email", enable: "attiva",
      error: "errore", export: "esporta", filter: "filtro", focus: "focus", help: "aiuto",
      history: "cronologia", language: "lingua", light: "chiaro", mode: "modalità", news: "notizie",
      open: "apri", page: "pagina", password: "password", premium: "premium", profile: "profilo",
      save: "salva", search: "cerca", section: "sezione", settings: "impostazioni", site: "sito",
      start: "avvia", stop: "ferma", success: "successo", summary: "riepilogo", support: "supporto",
      theme: "tema", translate: "traduci", update: "aggiorna", user: "utente", video: "video", warning: "avviso"
    },
    nl: {
      account: "account", active: "actief", add: "toevoegen", alerts: "meldingen", article: "artikel",
      cart: "winkelwagen", checkout: "afrekenen", clear: "wissen", close: "sluiten", color: "kleur",
      copy: "kopiëren", dashboard: "dashboard", date: "datum", delete: "verwijderen", disable: "uitschakelen",
      docs: "documenten", download: "downloaden", edit: "bewerken", email: "e-mail", enable: "inschakelen",
      error: "fout", export: "exporteren", filter: "filter", focus: "focus", help: "hulp",
      history: "geschiedenis", language: "taal", light: "licht", mode: "modus", news: "nieuws",
      open: "openen", page: "pagina", password: "wachtwoord", premium: "premium", profile: "profiel",
      save: "opslaan", search: "zoeken", section: "sectie", settings: "instellingen", site: "site",
      start: "start", stop: "stop", success: "succes", summary: "samenvatting", support: "ondersteuning",
      theme: "thema", translate: "vertalen", update: "bijwerken", user: "gebruiker", video: "video", warning: "waarschuwing"
    }
  };

  const state = {
    settings: null,
    host: "",
    styleReady: false,
    hostNode: null,
    shadow: null,
    selectionChipVisible: false,
    selectionRange: null,
    selectionText: "",
    translatedRecords: [],
    translatedActive: false,
    translating: false,
    cacheMap: new Map(),
    routeBound: false,
    lastUrl: location.href,
    lastResult: null,
    initialized: false,
    lastSelectionShownAt: 0,
    lastPageMode: "none"
  };

  const defaultSettings = {
    enabled: true,
    autoShowSelectionChip: true,
    targetLanguage: "en",
    sourceLanguage: "auto",
    recentLanguages: ["en", "es", "fr"],
    preserveCodeBlocks: true,
    preserveBrandTerms: true,
    showOriginalOnHover: false,
    enableSideBySide: false,
    perSitePreferences: {},
    historyEnabled: true,
    provider: "local_lite",
    providerConfig: {
      endpoint: "",
      apiKey: "",
      headers: {}
    }
  };

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

  function toSafeText(value, max = 5000) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function now() {
    return Date.now();
  }

  function normalizeLanguageCode(code, fallback = "auto") {
    const raw = String(code || "").trim().toLowerCase();
    if (LANGUAGES.some((row) => row.code === raw)) return raw;
    return fallback;
  }

  function normalizeTranslateSettings(input) {
    const raw = input && typeof input === "object" ? input : {};
    const perSitePreferences = raw.perSitePreferences && typeof raw.perSitePreferences === "object"
      ? Object.fromEntries(
          Object.entries(raw.perSitePreferences)
            .map(([host, pref]) => [normalizeHost(host), pref])
            .filter(([host, pref]) => Boolean(host && pref && typeof pref === "object"))
            .map(([host, pref]) => [
              host,
              {
                disabled: Boolean(pref.disabled),
                autoShowSelectionChip: pref.autoShowSelectionChip !== false,
                autoTranslateArticles: Boolean(pref.autoTranslateArticles),
                mode: String(pref.mode || "default").slice(0, 24)
              }
            ])
        )
      : {};

    const recentLanguages = Array.isArray(raw.recentLanguages)
      ? [...new Set(raw.recentLanguages.map((item) => normalizeLanguageCode(item, "")).filter(Boolean))].slice(0, 8)
      : defaultSettings.recentLanguages;

    return {
      ...defaultSettings,
      ...raw,
      enabled: Boolean(raw.enabled ?? defaultSettings.enabled),
      autoShowSelectionChip: raw.autoShowSelectionChip !== false,
      targetLanguage: normalizeLanguageCode(raw.targetLanguage, defaultSettings.targetLanguage),
      sourceLanguage: normalizeLanguageCode(raw.sourceLanguage, defaultSettings.sourceLanguage),
      recentLanguages: recentLanguages.length ? recentLanguages : [...defaultSettings.recentLanguages],
      preserveCodeBlocks: raw.preserveCodeBlocks !== false,
      preserveBrandTerms: raw.preserveBrandTerms !== false,
      showOriginalOnHover: Boolean(raw.showOriginalOnHover),
      enableSideBySide: Boolean(raw.enableSideBySide),
      perSitePreferences,
      historyEnabled: raw.historyEnabled !== false,
      provider: ["local_lite", "remote_api"].includes(String(raw.provider || ""))
        ? String(raw.provider)
        : defaultSettings.provider,
      providerConfig: {
        endpoint: String(raw.providerConfig?.endpoint || "").trim(),
        apiKey: String(raw.providerConfig?.apiKey || ""),
        headers: raw.providerConfig?.headers && typeof raw.providerConfig.headers === "object"
          ? raw.providerConfig.headers
          : {}
      }
    };
  }

  state.settings = normalizeTranslateSettings(defaultSettings);

  function detectLanguageHeuristic(text) {
    const sample = String(text || "").trim();
    if (!sample) return { sourceLang: "en", confidence: "low" };
    if (/[\u3040-\u30ff]/.test(sample)) return { sourceLang: "ja", confidence: "high" };
    if (/[\u4e00-\u9fff]/.test(sample)) return { sourceLang: "zh", confidence: "high" };
    if (/[\uac00-\ud7af]/.test(sample)) return { sourceLang: "ko", confidence: "high" };
    if (/[\u0400-\u04ff]/.test(sample)) return { sourceLang: "ru", confidence: "high" };

    const lower = sample.toLowerCase();
    const hints = [
      { lang: "es", words: [" el ", " la ", " de ", " para ", " que ", " una "] },
      { lang: "fr", words: [" le ", " la ", " et ", " pour ", " avec ", " une "] },
      { lang: "de", words: [" der ", " die ", " und ", " mit ", " ist ", " das "] },
      { lang: "pt", words: [" de ", " para ", " com ", " uma ", " não ", " que "] },
      { lang: "it", words: [" il ", " la ", " con ", " per ", " che ", " una "] },
      { lang: "nl", words: [" de ", " het ", " een ", " voor ", " met ", " en "] }
    ];

    let best = { lang: "en", score: 0 };
    for (const row of hints) {
      let score = 0;
      for (const token of row.words) {
        if (lower.includes(token)) score += 1;
      }
      if (score > best.score) best = { lang: row.lang, score };
    }

    return {
      sourceLang: best.lang,
      confidence: best.score >= 3 ? "high" : best.score >= 2 ? "medium" : "low"
    };
  }

  async function detectLanguage(text, preferred = "auto") {
    const normalizedPreferred = normalizeLanguageCode(preferred, "auto");
    if (normalizedPreferred !== "auto") {
      return { sourceLang: normalizedPreferred, confidence: "high", method: "manual" };
    }

    const trimmed = String(text || "").trim();
    if (!trimmed) {
      return { sourceLang: "en", confidence: "low", method: "empty" };
    }

    if (chrome.i18n?.detectLanguage) {
      try {
        const detected = await new Promise((resolve) => {
          chrome.i18n.detectLanguage(trimmed.slice(0, 1800), (result) => {
            const err = chrome.runtime.lastError;
            if (err || !result) {
              resolve(null);
              return;
            }
            resolve(result);
          });
        });

        const best = Array.isArray(detected?.languages)
          ? [...detected.languages].sort((a, b) => Number(b.percentage || 0) - Number(a.percentage || 0))[0]
          : null;
        if (best?.language) {
          return {
            sourceLang: normalizeLanguageCode(best.language, "en"),
            confidence: Number(best.percentage || 0) >= 70 ? "high" : Number(best.percentage || 0) >= 45 ? "medium" : "low",
            method: "chrome_i18n"
          };
        }
      } catch {
        // Fall through to heuristic.
      }
    }

    const fallback = detectLanguageHeuristic(trimmed);
    return { ...fallback, method: "heuristic" };
  }

  function getWordMap(targetLang) {
    return WORDS[targetLang] || {};
  }

  function reverseWordMap(lang) {
    const map = WORDS[lang] || {};
    const out = {};
    for (const [enWord, localWord] of Object.entries(map)) {
      const token = String(localWord || "").toLowerCase();
      if (!token) continue;
      if (!out[token]) out[token] = enWord;
    }
    return out;
  }

  function preserveCase(sourceWord, translatedWord) {
    if (!translatedWord) return translatedWord;
    if (sourceWord.toUpperCase() === sourceWord) return translatedWord.toUpperCase();
    if (sourceWord[0] && sourceWord[0].toUpperCase() === sourceWord[0]) {
      return translatedWord.charAt(0).toUpperCase() + translatedWord.slice(1);
    }
    return translatedWord;
  }

  function translateViaDictionary(text, sourceLang, targetLang) {
    if (!text) return text;
    if (sourceLang === targetLang) return text;

    let working = ` ${String(text)} `;
    const phraseEntries = Object.entries(PHRASES);

    for (const [englishPhrase, translations] of phraseEntries) {
      if (!translations[targetLang]) continue;
      let sourcePhrase = englishPhrase;
      if (sourceLang !== "en") {
        const sourceTranslation = translations[sourceLang];
        if (!sourceTranslation) continue;
        sourcePhrase = sourceTranslation;
      }
      const escaped = sourcePhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      working = working.replace(regex, (match) => preserveCase(match, translations[targetLang]));
    }

    const tokenRegex = /([A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-ӿ]+)/g;

    const sourceToEnglish = sourceLang === "en" ? null : reverseWordMap(sourceLang);
    const englishToTarget = targetLang === "en" ? null : getWordMap(targetLang);

    const output = working.replace(tokenRegex, (token) => {
      const lower = token.toLowerCase();
      let englishToken = lower;

      if (sourceToEnglish) {
        englishToken = sourceToEnglish[lower] || lower;
      }

      let finalToken = englishToken;
      if (englishToTarget) {
        finalToken = englishToTarget[englishToken] || englishToken;
      }

      return preserveCase(token, finalToken);
    });

    return output.trim();
  }

  const providerRegistry = {
    local_lite: {
      id: "local_lite",
      label: "Local Lite",
      isConfigured: () => true,
      async translate(text, sourceLang, targetLang) {
        const translated = translateViaDictionary(text, sourceLang, targetLang);
        const changed = translated !== text;
        return {
          ok: true,
          provider: "local_lite",
          translatedText: translated,
          quality: changed ? "heuristic" : "pass_through",
          note: changed
            ? "Translated with local phrase and term dictionary."
            : "No local dictionary hit for this text; output preserved."
        };
      }
    },
    remote_api: {
      id: "remote_api",
      label: "Remote API",
      isConfigured(settings) {
        return Boolean(settings?.providerConfig?.endpoint);
      },
      async translate(text, sourceLang, targetLang, settings) {
        const endpoint = String(settings?.providerConfig?.endpoint || "").trim();
        if (!endpoint) {
          return { ok: false, error: "provider_not_configured" };
        }
        const headers = {
          "Content-Type": "application/json",
          ...(settings?.providerConfig?.headers && typeof settings.providerConfig.headers === "object"
            ? settings.providerConfig.headers
            : {})
        };
        if (settings?.providerConfig?.apiKey) {
          headers.Authorization = `Bearer ${settings.providerConfig.apiKey}`;
        }

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({ text, sourceLang, targetLang })
          });
          if (!response.ok) {
            return { ok: false, error: `provider_http_${response.status}` };
          }
          const data = await response.json();
          const translatedText = String(data?.translatedText || data?.translation || "").trim();
          if (!translatedText) {
            return { ok: false, error: "provider_empty" };
          }
          return {
            ok: true,
            provider: "remote_api",
            translatedText,
            quality: "remote"
          };
        } catch {
          return { ok: false, error: "provider_request_failed" };
        }
      }
    }
  };

  function translationCacheKey(text, sourceLang, targetLang, provider) {
    return `${provider}::${sourceLang}::${targetLang}::${text}`;
  }

  function getCachedTranslation(text, sourceLang, targetLang, provider) {
    const key = translationCacheKey(text, sourceLang, targetLang, provider);
    if (!state.cacheMap.has(key)) return "";
    return String(state.cacheMap.get(key) || "");
  }

  function putCachedTranslation(text, sourceLang, targetLang, provider, translatedText) {
    const key = translationCacheKey(text, sourceLang, targetLang, provider);
    state.cacheMap.set(key, String(translatedText || ""));
    if (state.cacheMap.size > CACHE_LIMIT) {
      const first = state.cacheMap.keys().next().value;
      if (first) state.cacheMap.delete(first);
    }
  }

  function ensureStyle() {
    if (document.getElementById(IDS.STYLE)) return;
    const style = document.createElement("style");
    style.id = IDS.STYLE;
    style.textContent = `
      #${IDS.HOST} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483645;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
        color: #f3f3f4;
      }

      #${IDS.HOST} .hm-tr-chip {
        position: fixed;
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid rgba(196, 32, 33, 0.78);
        box-shadow: 0 0 0 1px rgba(196, 32, 33, 0.18), 0 0 14px rgba(196, 32, 33, 0.26);
        background: rgba(20, 17, 15, 0.95);
        color: #f3f3f4;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        pointer-events: auto;
        cursor: pointer;
      }

      #${IDS.HOST} .hm-tr-chip .lang {
        color: #ffb300;
        font-weight: 700;
      }

      #${IDS.HOST} .hm-tr-card {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: min(420px, calc(100vw - 20px));
        max-height: min(78vh, 680px);
        border: 1px solid rgba(243, 243, 244, 0.22);
        background: rgba(20, 17, 15, 0.98);
        box-shadow: 0 0 0 1px rgba(255, 179, 0, 0.16), 0 12px 30px rgba(0, 0, 0, 0.35);
        display: grid;
        gap: 10px;
        padding: 12px;
        pointer-events: auto;
      }

      #${IDS.HOST} .hm-tr-head {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
      }

      #${IDS.HOST} .hm-tr-head .kicker {
        margin: 0;
        font-size: 10px;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: #d9c5b2;
      }

      #${IDS.HOST} .hm-tr-close {
        min-height: 30px;
        min-width: 30px;
        border: 1px solid rgba(243, 243, 244, 0.25);
        background: rgba(20, 17, 15, 0.84);
        color: #f3f3f4;
        cursor: pointer;
      }

      #${IDS.HOST} .hm-tr-meta {
        margin: 0;
        font-size: 11px;
        color: #d9c5b2;
      }

      #${IDS.HOST} .hm-tr-block {
        border: 1px solid rgba(243, 243, 244, 0.22);
        background: rgba(20, 17, 15, 0.75);
        padding: 8px;
        display: grid;
        gap: 6px;
      }

      #${IDS.HOST} .hm-tr-block .label {
        font-size: 10px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: #d9c5b2;
      }

      #${IDS.HOST} .hm-tr-block p {
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
        color: #f3f3f4;
        max-height: 160px;
        overflow: auto;
        white-space: pre-wrap;
      }

      #${IDS.HOST} .hm-tr-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      #${IDS.HOST} .hm-tr-actions button,
      #${IDS.HOST} .hm-tr-overlay button {
        min-height: 34px;
        border: 1px solid rgba(196, 32, 33, 0.82);
        background: rgba(196, 32, 33, 0.14);
        color: #f3f3f4;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
      }

      #${IDS.HOST} .hm-tr-actions button.secondary {
        border-color: rgba(255, 179, 0, 0.78);
        box-shadow: 0 0 0 1px rgba(255, 179, 0, 0.14);
      }

      #${IDS.HOST} .hm-tr-overlay {
        position: fixed;
        left: 16px;
        bottom: 16px;
        width: min(430px, calc(100vw - 20px));
        max-height: min(72vh, 640px);
        border: 1px solid rgba(255, 179, 0, 0.42);
        background: rgba(20, 17, 15, 0.97);
        padding: 10px;
        display: grid;
        gap: 8px;
        overflow: hidden;
        pointer-events: auto;
      }

      #${IDS.HOST} .hm-tr-overlay .rows {
        display: grid;
        gap: 8px;
        overflow: auto;
      }

      #${IDS.HOST} .hm-tr-overlay .row {
        border: 1px solid rgba(243, 243, 244, 0.18);
        padding: 8px;
        display: grid;
        gap: 4px;
      }

      #${IDS.HOST} .hm-tr-overlay .row .src,
      #${IDS.HOST} .hm-tr-overlay .row .dst {
        margin: 0;
        font-size: 12px;
        line-height: 1.45;
        white-space: pre-wrap;
      }

      #${IDS.HOST} .hm-tr-overlay .row .src {
        color: #d9c5b2;
      }

      #${IDS.HOST} .hm-tr-overlay .row .dst {
        color: #f3f3f4;
      }

      @media (max-width: 540px) {
        #${IDS.HOST} .hm-tr-card,
        #${IDS.HOST} .hm-tr-overlay {
          right: 8px;
          left: 8px;
          width: auto;
          bottom: 8px;
        }

        #${IDS.HOST} .hm-tr-actions {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureHost() {
    ensureStyle();
    if (state.hostNode && document.contains(state.hostNode)) return state.hostNode;
    const host = document.createElement("div");
    host.id = IDS.HOST;
    document.documentElement.appendChild(host);
    state.hostNode = host;
    return host;
  }

  function getSitePreference() {
    const host = normalizeHost(location.href);
    if (!host) return {};
    return state.settings?.perSitePreferences?.[host] || {};
  }

  function isFeatureEnabledOnSite() {
    if (!state.settings?.enabled) return false;
    const pref = getSitePreference();
    if (pref.disabled) return false;
    return true;
  }

  function shouldShowSelectionChipOnSite() {
    if (!isFeatureEnabledOnSite()) return false;
    const pref = getSitePreference();
    if (pref.autoShowSelectionChip === false) return false;
    return Boolean(state.settings?.autoShowSelectionChip);
  }

  function clearSelectionChip() {
    const host = state.hostNode;
    if (!host) return;
    const chip = host.querySelector(".hm-tr-chip");
    if (chip) chip.remove();
    state.selectionChipVisible = false;
  }

  function closeResultCard() {
    const host = state.hostNode;
    if (!host) return;
    const card = host.querySelector(".hm-tr-card");
    if (card) card.remove();
  }

  function closeOverlayPanel() {
    const host = state.hostNode;
    if (!host) return;
    const panel = host.querySelector(".hm-tr-overlay");
    if (panel) panel.remove();
  }

  function isEditableNode(node) {
    const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.closest("[contenteditable='true']")) return true;
    if (el.closest("input, textarea, select")) return true;
    return false;
  }

  function getSelectionSnapshot() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const text = toSafeText(selection.toString(), TEXT_LENGTH_LIMIT);
    if (!text) return null;

    let range;
    try {
      range = selection.getRangeAt(0).cloneRange();
    } catch {
      return null;
    }

    const anchor = selection.anchorNode;
    if (isEditableNode(anchor)) return null;

    const rect = range.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    return {
      text,
      range,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      }
    };
  }

  function placeChip(chip, rect) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const chipWidth = 130;
    const chipHeight = 34;

    let left = rect.right + 8;
    let top = rect.top - 2;

    if (left + chipWidth > viewportWidth - 8) {
      left = Math.max(8, rect.left - chipWidth - 8);
    }
    if (top + chipHeight > viewportHeight - 8) {
      top = Math.max(8, rect.top - chipHeight - 8);
    }
    if (top < 8) top = Math.min(viewportHeight - chipHeight - 8, rect.bottom + 8);

    chip.style.left = `${Math.round(left)}px`;
    chip.style.top = `${Math.round(top)}px`;
  }

  function showSelectionChip(snapshot, targetLanguage) {
    const host = ensureHost();
    let chip = host.querySelector(".hm-tr-chip");
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.className = "hm-tr-chip";
      chip.innerHTML = `<span>Translate</span><span class="lang"></span>`;
      chip.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await translateSelectionAndShow({ forceSnapshot: true });
      });
      host.appendChild(chip);
    }

    chip.querySelector(".lang").textContent = String(targetLanguage || state.settings.targetLanguage || "en").toUpperCase();
    placeChip(chip, snapshot.rect);

    state.selectionRange = snapshot.range;
    state.selectionText = snapshot.text;
    state.selectionChipVisible = true;
    state.lastSelectionShownAt = now();
  }

  function handleSelectionChanged() {
    if (!shouldShowSelectionChipOnSite()) {
      clearSelectionChip();
      return;
    }

    const snapshot = getSelectionSnapshot();
    if (!snapshot || snapshot.text.length < 2) {
      clearSelectionChip();
      return;
    }
    if (snapshot.text.length > TEXT_LENGTH_LIMIT) {
      clearSelectionChip();
      return;
    }

    showSelectionChip(snapshot, state.settings.targetLanguage);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      return true;
    } catch {
      return false;
    }
  }

  function buildTranslationEntry({ originalText, translatedText, sourceLang, targetLang, domain }) {
    return {
      id: `tr_${now()}_${Math.random().toString(36).slice(2, 8)}`,
      originalText: toSafeText(originalText, 2200),
      translatedText: toSafeText(translatedText, 2200),
      sourceLang: normalizeLanguageCode(sourceLang, "auto"),
      targetLang: normalizeLanguageCode(targetLang, "en"),
      domain: normalizeHost(domain || location.href),
      timestamp: now()
    };
  }

  function notifyHistory(entry) {
    if (!state.settings?.historyEnabled) return;
    chrome.runtime.sendMessage({ type: "holmeta:translate-log", entry }, () => {
      void chrome.runtime.lastError;
    });
  }

  function notifySavedPhrase(entry) {
    chrome.runtime.sendMessage({ type: "holmeta:translate-save-phrase", entry }, () => {
      void chrome.runtime.lastError;
    });
  }

  async function translateText(text, sourceLang, targetLang) {
    const normalizedText = String(text || "").trim().slice(0, TEXT_LENGTH_LIMIT);
    if (!normalizedText) return { ok: false, error: "empty_text" };

    const providerId = String(state.settings?.provider || "local_lite");
    const provider = providerRegistry[providerId] || providerRegistry.local_lite;

    const detection = await detectLanguage(normalizedText, sourceLang || state.settings.sourceLanguage || "auto");
    const detectedSource = normalizeLanguageCode(detection.sourceLang, "en");
    const target = normalizeLanguageCode(targetLang || state.settings.targetLanguage || "en", "en");

    if (detectedSource === target) {
      return {
        ok: true,
        translatedText: normalizedText,
        sourceLang: detectedSource,
        targetLang: target,
        provider: provider.id,
        confidence: detection.confidence || "high",
        note: "Source and target languages match."
      };
    }

    if (!provider.isConfigured(state.settings)) {
      return { ok: false, error: "provider_not_configured", sourceLang: detectedSource, targetLang: target, provider: provider.id };
    }

    const cached = getCachedTranslation(normalizedText, detectedSource, target, provider.id);
    if (cached) {
      return {
        ok: true,
        translatedText: cached,
        sourceLang: detectedSource,
        targetLang: target,
        provider: provider.id,
        confidence: detection.confidence || "medium",
        note: "Cached translation"
      };
    }

    const translated = await provider.translate(normalizedText, detectedSource, target, state.settings);
    if (!translated.ok) {
      return {
        ok: false,
        error: translated.error || "translation_failed",
        sourceLang: detectedSource,
        targetLang: target,
        provider: provider.id
      };
    }

    const translatedText = String(translated.translatedText || "");
    putCachedTranslation(normalizedText, detectedSource, target, provider.id, translatedText);

    return {
      ok: true,
      translatedText,
      sourceLang: detectedSource,
      targetLang: target,
      provider: provider.id,
      confidence: detection.confidence || "medium",
      note: translated.note || ""
    };
  }

  async function translateTextsBatch(items, sourceLang, targetLang) {
    const out = [];
    for (const row of items) {
      // Keep sequential execution to avoid blocking high-volume pages.
      // eslint-disable-next-line no-await-in-loop
      const translated = await translateText(row.text, sourceLang, targetLang);
      out.push({ ...row, translated });
    }
    return out;
  }

  function isNodeVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") <= 0.02) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
    return true;
  }

  function shouldSkipNode(node) {
    if (!node || !node.parentElement) return true;
    const parent = node.parentElement;
    if (SKIP_TAGS.has(parent.tagName)) return true;
    if (state.settings?.preserveCodeBlocks && parent.closest("code, pre")) return true;
    if (parent.closest("script, style, noscript")) return true;
    if (parent.closest("[data-holmeta-ignore-translate='true']")) return true;
    if (parent.isContentEditable || parent.closest("[contenteditable='true']")) return true;
    const text = String(node.nodeValue || "");
    if (!text.trim()) return true;
    if (text.trim().length < 2) return true;
    return false;
  }

  function collectTextNodes(root, options = {}) {
    const nodes = [];
    const visibleOnly = Boolean(options.visibleOnly);
    const maxNodes = Math.max(20, Math.min(NODE_TRANSLATION_LIMIT, Number(options.maxNodes || NODE_TRANSLATION_LIMIT)));
    if (!root || !document.contains(root)) return nodes;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        if (visibleOnly && !isNodeVisible(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode() && nodes.length < maxNodes) {
      const node = walker.currentNode;
      nodes.push({
        node,
        text: String(node.nodeValue || ""),
        parent: node.parentElement
      });
    }

    return nodes;
  }

  function clearTranslatedRecords() {
    for (const record of state.translatedRecords) {
      const node = record.node;
      if (!node || !node.isConnected) continue;
      node.nodeValue = record.original;
      if (record.parent && record.parent.isConnected) {
        record.parent.removeAttribute("data-holmeta-translated");
        if (record.hadTitle) {
          record.parent.setAttribute("title", record.originalTitle || "");
        } else {
          record.parent.removeAttribute("title");
        }
      }
    }
    state.translatedRecords = [];
    state.translatedActive = false;
    state.lastPageMode = "none";
    closeOverlayPanel();
  }

  async function applyNodeTranslations(nodeRows, sourceLang, targetLang) {
    if (!Array.isArray(nodeRows) || !nodeRows.length) {
      return { ok: false, error: "no_nodes" };
    }

    const batchInput = nodeRows.map((row, index) => ({ id: index, text: row.text }));
    const translated = await translateTextsBatch(batchInput, sourceLang, targetLang);

    let applied = 0;
    const records = [];
    for (let i = 0; i < translated.length; i += 1) {
      const result = translated[i];
      const row = nodeRows[i];
      if (!row?.node?.isConnected) continue;
      if (!result?.translated?.ok) continue;

      const original = String(row.node.nodeValue || "");
      const translatedText = String(result.translated.translatedText || original);
      if (!translatedText || translatedText === original) continue;

      let finalText = translatedText;
      if (state.settings.enableSideBySide) {
        finalText = `${translatedText}\n${original}`;
      }

      row.node.nodeValue = finalText;
      if (row.parent) {
        row.parent.setAttribute("data-holmeta-translated", "true");
        if (state.settings.showOriginalOnHover) {
          const existingTitle = row.parent.getAttribute("title");
          row.parent.setAttribute("title", original);
          records.push({
            node: row.node,
            parent: row.parent,
            original,
            hadTitle: existingTitle !== null,
            originalTitle: existingTitle || ""
          });
        } else {
          records.push({
            node: row.node,
            parent: row.parent,
            original,
            hadTitle: false,
            originalTitle: ""
          });
        }
      } else {
        records.push({ node: row.node, parent: null, original, hadTitle: false, originalTitle: "" });
      }
      applied += 1;
    }

    state.translatedRecords.push(...records);
    state.translatedActive = applied > 0;
    return {
      ok: true,
      applied,
      sourceLang: translated.find((item) => item.translated?.sourceLang)?.translated?.sourceLang || "auto",
      targetLang: translated.find((item) => item.translated?.targetLang)?.translated?.targetLang || targetLang
    };
  }

  function getArticleRoot() {
    return document.querySelector("article")
      || document.querySelector("main article")
      || document.querySelector("main")
      || document.body;
  }

  function inferContentType() {
    if (document.querySelector("article time, article [itemprop='articleBody']")) return "article";
    if (document.querySelector("[data-testid*='dashboard'], [class*='dashboard'], [role='grid']")) return "dashboard";
    if (document.querySelector("pre code, code[class*='language-']")) return "docs";
    if (document.querySelector("[itemprop='price'], .price, [data-testid*='price']")) return "ecommerce";
    return "generic";
  }

  function resolveSectionRootFromSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const base = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
      if (base instanceof Element) {
        return base.closest("article, section, main, div, li, table") || base;
      }
    }

    const centerEl = document.elementFromPoint(window.innerWidth * 0.5, window.innerHeight * 0.4);
    if (centerEl instanceof Element) {
      return centerEl.closest("article, section, main, div") || centerEl;
    }

    return document.body;
  }

  async function translateSelectionAndShow(options = {}) {
    if (!isFeatureEnabledOnSite()) {
      return { ok: false, error: "disabled_on_site" };
    }

    const snapshot = options.forceSnapshot
      ? { text: state.selectionText, range: state.selectionRange }
      : getSelectionSnapshot();

    const text = toSafeText(snapshot?.text || "", TEXT_LENGTH_LIMIT);
    if (!text) {
      return { ok: false, error: "no_selection" };
    }

    const translated = await translateText(text, state.settings.sourceLanguage, state.settings.targetLanguage);
    if (!translated.ok) {
      showTranslationError(translated.error);
      return translated;
    }

    const entry = buildTranslationEntry({
      originalText: text,
      translatedText: translated.translatedText,
      sourceLang: translated.sourceLang,
      targetLang: translated.targetLang,
      domain: location.href
    });

    notifyHistory(entry);
    renderResultCard({
      entry,
      note: translated.note || "",
      selectionRange: snapshot?.range || state.selectionRange
    });
    state.lastResult = { entry, note: translated.note || "" };
    clearSelectionChip();

    return {
      ok: true,
      entry,
      note: translated.note || ""
    };
  }

  function showTranslationError(code) {
    const host = ensureHost();
    closeResultCard();
    const card = document.createElement("section");
    card.className = "hm-tr-card";

    let message = "Translation unavailable right now.";
    if (code === "provider_not_configured") {
      message = "Translation provider not configured. Use Local Lite or configure Remote API in settings.";
    } else if (code === "no_selection") {
      message = "Select text first, then run Translate Selection.";
    } else if (code === "no_nodes") {
      message = "No translatable text found in this region.";
    }

    card.innerHTML = `
      <div class="hm-tr-head">
        <p class="kicker">HOLMETA Translate</p>
        <button class="hm-tr-close" type="button" aria-label="Close">×</button>
      </div>
      <p class="hm-tr-meta">${message}</p>
    `;

    card.querySelector(".hm-tr-close")?.addEventListener("click", () => card.remove());
    host.appendChild(card);
  }

  function renderResultCard({ entry, note = "", selectionRange = null }) {
    const host = ensureHost();
    closeResultCard();

    const card = document.createElement("section");
    card.className = "hm-tr-card";
    card.innerHTML = `
      <div class="hm-tr-head">
        <p class="kicker">HOLMETA Translate</p>
        <button class="hm-tr-close" type="button" aria-label="Close">×</button>
      </div>
      <p class="hm-tr-meta">${entry.sourceLang.toUpperCase()} → ${entry.targetLang.toUpperCase()} · ${entry.domain || "current site"}</p>
      <section class="hm-tr-block">
        <span class="label">Original</span>
        <p>${escapeHtml(entry.originalText)}</p>
      </section>
      <section class="hm-tr-block">
        <span class="label">Translated</span>
        <p>${escapeHtml(entry.translatedText)}</p>
      </section>
      ${note ? `<p class="hm-tr-meta">${escapeHtml(note)}</p>` : ""}
      <div class="hm-tr-actions">
        <button type="button" class="secondary" data-action="copy">Copy</button>
        <button type="button" class="secondary" data-action="save">Save</button>
        <button type="button" data-action="replace">Replace</button>
        <button type="button" data-action="close">Close</button>
      </div>
    `;

    card.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = String(button.getAttribute("data-action") || "");
      if (action === "close") {
        card.remove();
        return;
      }
      if (action === "copy") {
        await copyText(entry.translatedText);
        return;
      }
      if (action === "save") {
        notifySavedPhrase({
          ...entry,
          note: ""
        });
        return;
      }
      if (action === "replace") {
        const range = selectionRange && typeof selectionRange.cloneRange === "function"
          ? selectionRange.cloneRange()
          : state.selectionRange;
        if (range) {
          try {
            range.deleteContents();
            range.insertNode(document.createTextNode(entry.translatedText));
            card.remove();
          } catch {
            // Keep panel open on replace failure.
          }
        }
      }
    });

    host.appendChild(card);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  async function runPageTranslation(mode = "full") {
    if (!isFeatureEnabledOnSite()) {
      return { ok: false, error: "disabled_on_site" };
    }

    if (state.translatedActive) {
      clearTranslatedRecords();
    }

    let root = document.body;
    let visibleOnly = false;

    if (mode === "section") {
      root = resolveSectionRootFromSelection();
    } else if (mode === "article") {
      root = getArticleRoot();
    } else if (mode === "visible") {
      root = document.body;
      visibleOnly = true;
    }

    const nodeRows = collectTextNodes(root, {
      visibleOnly,
      maxNodes: mode === "visible" ? 220 : NODE_TRANSLATION_LIMIT
    });

    if (!nodeRows.length) {
      showTranslationError("no_nodes");
      return { ok: false, error: "no_nodes" };
    }

    const applied = await applyNodeTranslations(nodeRows, state.settings.sourceLanguage, state.settings.targetLanguage, { mode });
    if (!applied.ok) {
      showTranslationError(applied.error);
      return applied;
    }

    state.lastPageMode = mode;

    const summaryText = `Translated ${applied.applied} text nodes (${mode}).`;
    const entry = buildTranslationEntry({
      originalText: `${mode} translation`,
      translatedText: summaryText,
      sourceLang: applied.sourceLang,
      targetLang: applied.targetLang,
      domain: location.href
    });
    notifyHistory(entry);

    return {
      ok: true,
      applied: applied.applied,
      sourceLang: applied.sourceLang,
      targetLang: applied.targetLang,
      mode
    };
  }

  async function runOverlayTranslation() {
    if (!isFeatureEnabledOnSite()) {
      return { ok: false, error: "disabled_on_site" };
    }

    closeOverlayPanel();

    const rows = collectTextNodes(document.body, { visibleOnly: true, maxNodes: 24 });
    if (!rows.length) {
      showTranslationError("no_nodes");
      return { ok: false, error: "no_nodes" };
    }

    const payload = rows.map((row, index) => ({ id: index, text: toSafeText(row.text, 260) }));
    const translated = await translateTextsBatch(payload, state.settings.sourceLanguage, state.settings.targetLanguage);

    const host = ensureHost();
    const panel = document.createElement("section");
    panel.className = "hm-tr-overlay";
    panel.innerHTML = `
      <div class="hm-tr-head">
        <p class="kicker">HOLMETA Translate Overlay</p>
        <button type="button" data-action="close">Close</button>
      </div>
      <div class="rows"></div>
    `;

    const rowsHost = panel.querySelector(".rows");
    translated.forEach((row) => {
      if (!row?.translated?.ok) return;
      const block = document.createElement("article");
      block.className = "row";
      block.innerHTML = `
        <p class="src">${escapeHtml(row.text)}</p>
        <p class="dst">${escapeHtml(row.translated.translatedText || row.text)}</p>
      `;
      rowsHost.appendChild(block);
    });

    panel.querySelector("button[data-action='close']")?.addEventListener("click", () => panel.remove());
    host.appendChild(panel);

    return {
      ok: true,
      mode: "overlay",
      rows: rowsHost.childElementCount
    };
  }

  function restorePageTranslation() {
    clearTranslatedRecords();
    return { ok: true, restored: true };
  }

  async function translateInputText(payload = {}) {
    if (!isFeatureEnabledOnSite()) {
      return { ok: false, error: "disabled_on_site" };
    }

    const text = toSafeText(payload.text || "", TEXT_LENGTH_LIMIT);
    if (!text) return { ok: false, error: "empty_text" };

    const translated = await translateText(text, payload.sourceLang || state.settings.sourceLanguage, payload.targetLang || state.settings.targetLanguage);
    if (!translated.ok) {
      return translated;
    }

    const entry = buildTranslationEntry({
      originalText: text,
      translatedText: translated.translatedText,
      sourceLang: translated.sourceLang,
      targetLang: translated.targetLang,
      domain: location.href
    });

    notifyHistory(entry);
    state.lastResult = { entry, note: translated.note || "" };

    return {
      ok: true,
      entry,
      note: translated.note || "",
      provider: translated.provider,
      confidence: translated.confidence
    };
  }

  async function maybeAutoTranslateArticle() {
    const pref = getSitePreference();
    if (!pref.autoTranslateArticles) return;
    if (state.lastUrl === location.href && state.translatedActive) return;
    const contentType = inferContentType();
    if (!["article", "docs"].includes(contentType)) return;
    state.lastUrl = location.href;
    await runPageTranslation("article");
  }

  function bindGlobalEvents() {
    if (state.initialized) return;
    state.initialized = true;

    document.addEventListener("mouseup", () => {
      window.requestAnimationFrame(handleSelectionChanged);
    }, { passive: true });

    document.addEventListener("keyup", (event) => {
      if (event.key === "Escape") {
        clearSelectionChip();
        closeResultCard();
        closeOverlayPanel();
      }
      if (event.key === "Shift" || event.key === "Alt") {
        window.requestAnimationFrame(handleSelectionChanged);
      }
    }, { passive: true });

    window.addEventListener("scroll", () => {
      if (!state.selectionChipVisible) return;
      const snapshot = getSelectionSnapshot();
      if (!snapshot) {
        clearSelectionChip();
        return;
      }
      const chip = state.hostNode?.querySelector(".hm-tr-chip");
      if (chip) placeChip(chip, snapshot.rect);
    }, { passive: true });

    window.addEventListener("holmeta:spa-url-change", () => {
      clearSelectionChip();
      closeResultCard();
      closeOverlayPanel();
      clearTranslatedRecords();
      setTimeout(() => {
        maybeAutoTranslateArticle();
      }, 280);
    }, { passive: true });
  }

  function applyState(payload = {}) {
    const incoming = payload?.settings && typeof payload.settings === "object" ? payload.settings : payload;
    state.settings = normalizeTranslateSettings(incoming || defaultSettings);
    state.host = normalizeHost(location.href);

    bindGlobalEvents();

    if (!isFeatureEnabledOnSite()) {
      clearSelectionChip();
      closeResultCard();
      closeOverlayPanel();
      clearTranslatedRecords();
      return;
    }

    maybeAutoTranslateArticle();
  }

  async function handleMessage(message = {}) {
    const type = String(message?.type || "");
    const payload = message.payload || {};

    if (!type.startsWith("holmeta:translate")) {
      return { ok: false, error: "unknown_translate_message" };
    }

    if (type === "holmeta:translate-selection") {
      return translateSelectionAndShow(payload || {});
    }

    if (type === "holmeta:translate-text") {
      return translateInputText(payload || {});
    }

    if (type === "holmeta:translate-page") {
      return runPageTranslation("full");
    }

    if (type === "holmeta:translate-section") {
      return runPageTranslation("section");
    }

    if (type === "holmeta:translate-visible") {
      return runPageTranslation("visible");
    }

    if (type === "holmeta:translate-overlay") {
      return runOverlayTranslation();
    }

    if (type === "holmeta:translate-restore") {
      return restorePageTranslation();
    }

    if (type === "holmeta:translate-save-current") {
      if (state.lastResult?.entry) {
        notifySavedPhrase({ ...state.lastResult.entry, note: String(payload.note || "") });
        return { ok: true };
      }
      return { ok: false, error: "no_last_result" };
    }

    return { ok: false, error: "unknown_translate_message" };
  }

  globalThis.HolmetaTranslateEngine = {
    applyState,
    handleMessage,
    getLanguages: () => [...LANGUAGES],
    getCapabilities: () => ({
      providers: Object.keys(providerRegistry),
      historyLimit: TRANSLATION_HISTORY_LIMIT,
      savedPhrasesLimit: SAVED_PHRASES_LIMIT
    })
  };
})();
