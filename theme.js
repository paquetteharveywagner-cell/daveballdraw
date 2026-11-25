(() => {
  const DEFAULT_THEME = {
    preset: "emerald",
    backgroundHex: "#0f3b2a",
    surfaceHex: "#154634",
    accentHex: "#f4c430",
  };

  const PRESET_LIST = [
    ["emerald", "Emerald & Gold", "#0f3b2a", "#154634", "#f4c430"],
    ["navy", "Royal Navy & Gold", "#0c1e3a", "#132a4f", "#f5c542"],
    ["crimson", "Crimson & Gold", "#3b0d1b", "#4d1426", "#f5c542"],
    ["charcoal", "Obsidian & Gold", "#14171c", "#1e232b", "#f5c542"],
    ["purple", "Royal Purple & Gold", "#24113b", "#31194f", "#f5c542"],
    ["emerald-silver", "Emerald & Silver", "#0f3b2a", "#154634", "#e2e8f0"],
    ["shamrock", "Shamrock & Lime", "#0b4628", "#115733", "#a3e635"],
    ["forest-amber", "Forest & Amber", "#102a1d", "#173b29", "#f59e0b"],
    ["pine-mint", "Pine & Mint", "#0d332e", "#14453f", "#34d399"],
    ["teal-gold", "Teal Ocean & Gold", "#0b3942", "#114b57", "#fbbf24"],
    ["teal-coral", "Teal & Coral", "#0e3a40", "#144d54", "#fb7185"],
    ["petrol-cyan", "Petrol & Cyan", "#0c2d3e", "#123c52", "#22d3ee"],
    ["midnight-sky", "Midnight & Sky", "#091833", "#102447", "#38bdf8"],
    ["cobalt-white", "Cobalt & White", "#142e66", "#1b3d85", "#f8fafc"],
    ["sapphire-champagne", "Sapphire & Champagne", "#10254d", "#173366", "#fde68a"],
    ["indigo-mint", "Indigo & Mint", "#1b184a", "#262163", "#2dd4bf"],
    ["indigo-rose", "Indigo & Rose", "#1f1645", "#2c205e", "#f472b6"],
    ["plum-peach", "Plum & Peach", "#331238", "#451a4b", "#fdba74"],
    ["aubergine-gold", "Aubergine & Gold", "#2c102e", "#3d1740", "#facc15"],
    ["berry-cream", "Berry & Cream", "#4a102e", "#5e163b", "#fef3c7"],
    ["ruby-gold", "Ruby Red & Gold", "#4f0d16", "#66131e", "#f5c542"],
    ["scarlet-silver", "Scarlet & Silver", "#541111", "#6b1818", "#e5e7eb"],
    ["wine-rosegold", "Wine & Rose Gold", "#380f1c", "#4a1526", "#f5b895"],
    ["burgundy-mint", "Burgundy & Mint", "#3d1220", "#52192c", "#6ee7b7"],
    ["espresso-gold", "Espresso & Gold", "#261710", "#362118", "#f5c542"],
    ["mahogany-copper", "Mahogany & Copper", "#33160f", "#472017", "#fb923c"],
    ["chocolate-cream", "Chocolate & Sun", "#2b1b14", "#3b261d", "#fde047"],
    ["bronze-amber", "Bronze & Amber", "#2d2111", "#3d2d18", "#f59e0b"],
    ["olive-gold", "Olive & Gold", "#242e12", "#313e19", "#eab308"],
    ["moss-sunburst", "Moss & Sunburst", "#1b2e19", "#263f23", "#fde047"],
    ["slate-cyan", "Slate & Cyan", "#182230", "#223042", "#22d3ee"],
    ["graphite-lime", "Graphite & Lime", "#1c1e22", "#282b30", "#84cc16"],
    ["carbon-orange", "Carbon & Orange", "#151517", "#212124", "#fb923c"],
    ["onyx-emerald", "Onyx & Emerald", "#111614", "#1a211e", "#10b981"],
    ["charcoal-rose", "Charcoal & Rose", "#1c191f", "#29242e", "#fb7185"],
    ["steel-yellow", "Steel & Yellow", "#1e293b", "#29374f", "#facc15"],
    ["lagoon-aqua", "Lagoon & Aqua", "#083344", "#0e455c", "#5eead4"],
    ["marine-tangerine", "Marine & Tangerine", "#0a2a43", "#103a5c", "#fb923c"],
    ["violet-blue", "Violet & Sky", "#29134f", "#381b69", "#60a5fa"],
    ["magenta-gold", "Magenta & Gold", "#470f38", "#5e164a", "#f5c542"],
    ["jade-gold", "Jade & Gold", "#0b4032", "#125442", "#f4c430"],
    ["irish-tricolour", "Irish Night & Orange", "#0d3b26", "#134d32", "#ff8c1a"],
    ["midnight-pearl", "Midnight & Pearl", "#12131c", "#1c1e2b", "#f8fafc"],
    ["plum-lavender", "Plum & Lavender", "#2a1536", "#3a1e4a", "#d8b4fe"],
  ];

  const THEME_PRESETS = {};
  PRESET_LIST.forEach(([id, name, backgroundHex, surfaceHex, accentHex]) => {
    THEME_PRESETS[id] = { id, name, backgroundHex, surfaceHex, accentHex };
  });

  function normalizeHex(hex, fallback) {
    if (typeof hex !== "string") return fallback;
    const clean = hex.trim();
    return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean.toLowerCase() : fallback;
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return (
      "#" +
      [clamp(r), clamp(g), clamp(b)]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  function mixHex(hexA, hexB, weightB) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return rgbToHex(
      a.r * (1 - weightB) + b.r * weightB,
      a.g * (1 - weightB) + b.g * weightB,
      a.b * (1 - weightB) + b.b * weightB
    );
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function getContrastForeground(hex) {
    return getLuminance(hex) > 0.56 ? "#10241c" : "#f8fafc";
  }

  function resolveTheme(input) {
    const source = input && typeof input === "object" ? input : DEFAULT_THEME;
    const presetKey =
      typeof source.preset === "string" && THEME_PRESETS[source.preset]
        ? source.preset
        : source.preset === "custom"
        ? "custom"
        : "emerald";

    if (presetKey !== "custom") {
      const p = THEME_PRESETS[presetKey];
      return {
        preset: p.id,
        backgroundHex: p.backgroundHex,
        surfaceHex: p.surfaceHex,
        accentHex: p.accentHex,
      };
    }

    return {
      preset: "custom",
      backgroundHex: normalizeHex(
        source.backgroundHex,
        DEFAULT_THEME.backgroundHex
      ),
      surfaceHex: normalizeHex(source.surfaceHex, DEFAULT_THEME.surfaceHex),
      accentHex: normalizeHex(source.accentHex, DEFAULT_THEME.accentHex),
    };
  }

  function applyRaceysTheme(themeInput) {
    const theme = resolveTheme(themeInput);
    const root = document.documentElement;

    if (theme.preset === "emerald") {
      const props = [
        "--background",
        "--foreground",
        "--surface",
        "--surface-glass",
        "--popover",
        "--input-bg",
        "--border",
        "--input",
        "--muted",
        "--muted-foreground",
        "--gold",
        "--gold-foreground",
        "--ball-taken",
        "--ball-taken-foreground",
        "--gradient-hero",
        "--gradient-gold",
        "--gradient-ball-picked",
        "--shadow-gold",
      ];
      props.forEach((p) => root.style.removeProperty(p));
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", DEFAULT_THEME.backgroundHex);
      return theme;
    }

    const bg = theme.backgroundHex;
    const surface = theme.surfaceHex;
    const accent = theme.accentHex;
    const isLightBg = getLuminance(bg) > 0.56;

    const fg = isLightBg ? "#111827" : "#f8f6ee";
    const heroTop = isLightBg
      ? mixHex(bg, "#000000", 0.08)
      : mixHex(bg, "#ffffff", 0.14);
    const popover = mixHex(bg, surface, 0.72);
    const inputBg = isLightBg
      ? mixHex(surface, "#ffffff", 0.4)
      : mixHex(bg, "#000000", 0.14);
    const border = isLightBg
      ? mixHex(surface, "#000000", 0.16)
      : mixHex(surface, "#ffffff", 0.18);
    const muted = isLightBg
      ? mixHex(surface, "#000000", 0.08)
      : mixHex(surface, "#ffffff", 0.08);
    const mutedFg = isLightBg
      ? mixHex(bg, "#000000", 0.62)
      : mixHex(bg, "#ffffff", 0.68);
    const accentLight = mixHex(accent, "#ffffff", 0.28);
    const accentHighlight = mixHex(accent, "#ffffff", 0.62);
    const accentDeep = mixHex(accent, "#000000", 0.2);
    const accentFg = getContrastForeground(accent);

    root.style.setProperty("--background", bg);
    root.style.setProperty("--foreground", fg);
    root.style.setProperty("--surface", surface);
    root.style.setProperty("--surface-glass", rgba(surface, 0.76));
    root.style.setProperty("--popover", popover);
    root.style.setProperty("--input-bg", inputBg);
    root.style.setProperty("--border", border);
    root.style.setProperty(
      "--input",
      isLightBg ? mixHex(surface, "#000000", 0.2) : mixHex(surface, "#ffffff", 0.22)
    );
    root.style.setProperty("--muted", muted);
    root.style.setProperty("--muted-foreground", mutedFg);
    root.style.setProperty("--gold", accent);
    root.style.setProperty("--gold-foreground", accentFg);
    root.style.setProperty("--ball-taken", muted);
    root.style.setProperty(
      "--ball-taken-foreground",
      isLightBg ? rgba("#1f2937", 0.55) : rgba("#e2e8f0", 0.6)
    );
    root.style.setProperty(
      "--gradient-hero",
      `radial-gradient(120% 80% at 50% 0%, ${heroTop} 0%, ${bg} 62%)`
    );
    root.style.setProperty(
      "--gradient-gold",
      `linear-gradient(135deg, ${accentLight}, ${accentDeep})`
    );
    root.style.setProperty(
      "--gradient-ball-picked",
      `radial-gradient(circle at 32% 28%, ${accentHighlight} 0%, ${accent} 48%, ${accentDeep} 100%)`
    );
    root.style.setProperty(
      "--shadow-gold",
      `0 10px 30px -8px ${rgba(accent, 0.52)}`
    );

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", bg);

    return theme;
  }

  function getApiBase() {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "";
    }
    let configured = "";
    if (typeof window.RACEYS_API_BASE === "string" && window.RACEYS_API_BASE) {
      configured = window.RACEYS_API_BASE.replace(/\/+$/, "");
    } else {
      const meta = document.querySelector('meta[name="api-base"]');
      if (meta) {
        const val = (meta.getAttribute("content") || "").trim();
        if (val) configured = val.replace(/\/+$/, "");
      }
    }
    if (!configured || window.location.origin === configured) {
      return "";
    }
    return configured;
  }

  window.RACEYS_DEFAULT_THEME = DEFAULT_THEME;
  window.RACEYS_THEME_PRESETS = THEME_PRESETS;
  window.resolveRaceysTheme = resolveTheme;
  window.applyRaceysTheme = applyRaceysTheme;
  window.getRaceysApiBase = getApiBase;
})();
