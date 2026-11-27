(() => {
  const PIN_SESSION_KEY = "raceys_admin_pin_v1";
  const API_BASE =
    typeof window.getRaceysApiBase === "function"
      ? window.getRaceysApiBase()
      : "";

  const loginSection = document.getElementById("admin-login-section");
  const loginForm = document.getElementById("admin-login-form");
  const pinInput = document.getElementById("admin-pin-input");
  const pinErrorEl = document.getElementById("admin-pin-error");
  const logoutBtn = document.getElementById("admin-logout-btn");

  const dashboardEl = document.getElementById("admin-dashboard");
  const drawSummaryEl = document.getElementById("admin-draw-summary");
  const entriesTableEl = document.getElementById("entries-table");
  const entriesTbodyEl = document.getElementById("entries-tbody");
  const entriesEmptyEl = document.getElementById("entries-empty");
  const storageModeNoteEl = document.getElementById("storage-mode-note");

  const refreshAllBtn = document.getElementById("admin-refresh-all-btn");
  const refreshModalEl = document.getElementById("admin-refresh-modal");
  const confirmRefreshBtn = document.getElementById("confirm-admin-refresh-btn");
  const cancelRefreshBtn = document.getElementById("cancel-admin-refresh-btn");

  const presetGridEl = document.getElementById("preset-grid");
  const activeThemeBadgeEl = document.getElementById("active-theme-badge");
  const colorBgInput = document.getElementById("color-bg");
  const colorSurfaceInput = document.getElementById("color-surface");
  const colorAccentInput = document.getElementById("color-accent");
  const colorBgHexEl = document.getElementById("color-bg-hex");
  const colorSurfaceHexEl = document.getElementById("color-surface-hex");
  const colorAccentHexEl = document.getElementById("color-accent-hex");
  const applyCustomThemeBtn = document.getElementById("apply-custom-theme-btn");

  const toastContainer = document.getElementById("toast-container");

  let adminPin = sessionStorage.getItem(PIN_SESSION_KEY) || "";
  let currentState = {
    entries: {},
    theme: { ...window.RACEYS_DEFAULT_THEME },
    storageMode: "local",
  };

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  async function apiAdmin(method, payload) {
    const options = {
      method,
      headers: {
        "x-admin-pin": adminPin,
      },
      cache: "no-store",
    };

    if (payload !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }

    const res = await fetch(`${API_BASE}/api/admin`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || `Request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  function renderEntries(entries) {
    const keys = Object.keys(entries || {}).sort(
      (a, b) => Number(a) - Number(b)
    );
    const sold = keys.length;
    drawSummaryEl.textContent = `${sold} of 45 sold · ${45 - sold} left`;

    entriesTbodyEl.innerHTML = "";
    if (sold === 0) {
      entriesTableEl.classList.add("hidden");
      entriesEmptyEl.classList.remove("hidden");
      return;
    }

    entriesTableEl.classList.remove("hidden");
    entriesEmptyEl.classList.add("hidden");

    for (const num of keys) {
      const item = entries[num];
      const tr = document.createElement("tr");

      const tdBall = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "ball-pill-mini lotto-ball-picked";
      badge.textContent = num;
      tdBall.appendChild(badge);

      const tdName = document.createElement("td");
      tdName.textContent = item.name || item.firstName || "Player";

      const tdMobile = document.createElement("td");
      tdMobile.textContent = item.mobile || "—";

      const tdAction = document.createElement("td");
      const releaseBtn = document.createElement("button");
      releaseBtn.type = "button";
      releaseBtn.className = "btn-release";
      releaseBtn.textContent = "Free";
      releaseBtn.addEventListener("click", () => releaseSingleNumber(num));
      tdAction.appendChild(releaseBtn);

      tr.appendChild(tdBall);
      tr.appendChild(tdName);
      tr.appendChild(tdMobile);
      tr.appendChild(tdAction);
      entriesTbodyEl.appendChild(tr);
    }
  }

  function syncColorInputs(theme) {
    const resolved = window.resolveRaceysTheme(theme);
    colorBgInput.value = resolved.backgroundHex;
    colorSurfaceInput.value = resolved.surfaceHex;
    colorAccentInput.value = resolved.accentHex;
    colorBgHexEl.textContent = resolved.backgroundHex;
    colorSurfaceHexEl.textContent = resolved.surfaceHex;
    colorAccentHexEl.textContent = resolved.accentHex;

    if (resolved.preset === "custom") {
      activeThemeBadgeEl.textContent = "Custom Colours";
    } else {
      const preset = window.RACEYS_THEME_PRESETS[resolved.preset];
      activeThemeBadgeEl.textContent = preset ? preset.name : "Custom";
    }

    const presetButtons = presetGridEl.querySelectorAll(".preset-btn");
    presetButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.preset === resolved.preset);
    });
  }

  function renderPresets() {
    presetGridEl.innerHTML = "";
    Object.values(window.RACEYS_THEME_PRESETS).forEach((preset) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn";
      btn.dataset.preset = preset.id;

      const swatches = document.createElement("span");
      swatches.className = "preset-swatches";
      [preset.backgroundHex, preset.surfaceHex, preset.accentHex].forEach(
        (hex) => {
          const dot = document.createElement("span");
          dot.className = "swatch-dot";
          dot.style.backgroundColor = hex;
          swatches.appendChild(dot);
        }
      );

      const label = document.createElement("span");
      label.textContent = preset.name;

      btn.appendChild(swatches);
      btn.appendChild(label);
      btn.addEventListener("click", () =>
        saveTheme({
          preset: preset.id,
          backgroundHex: preset.backgroundHex,
          surfaceHex: preset.surfaceHex,
          accentHex: preset.accentHex,
        })
      );
      presetGridEl.appendChild(btn);
    });
  }

  function renderState(data) {
    currentState = data;
    renderEntries(data.entries || {});
    const applied = window.applyRaceysTheme(data.theme);
    syncColorInputs(applied);

    if (data.storageMode === "kv") {
      storageModeNoteEl.textContent =
        "Storage: Persistent cloud Redis connected.";
    } else if (data.storageMode === "file") {
      storageModeNoteEl.textContent = window.location.hostname.endsWith(
        ".onrender.com"
      )
        ? "Storage: Render local file (resets if free instance sleeps/redeploys). Add UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN in Render Environment Variables for permanent storage."
        : "Storage: Local server file (data/state.json).";
    } else {
      storageModeNoteEl.textContent =
        "Storage: Serverless memory mode. Connect Upstash Redis / Vercel KV for permanent multi-device persistence.";
    }
  }

  async function saveTheme(themePayload) {
    try {
      const data = await apiAdmin("POST", {
        action: "theme",
        theme: themePayload,
      });
      renderState({ ...currentState, ...data });
      showToast("Frontend colours updated.");
    } catch (err) {
      showToast(err.message || "Could not update colours.");
    }
  }

  async function releaseSingleNumber(num) {
    try {
      const data = await apiAdmin("POST", {
        action: "release",
        number: Number(num),
      });
      renderState({ ...currentState, ...data });
      showToast(`Number ${num} is free again.`);
    } catch (err) {
      showToast(err.message || "Failed to release number.");
    }
  }

  async function refreshAllNumbers() {
    confirmRefreshBtn.disabled = true;
    try {
      const data = await apiAdmin("POST", { action: "refresh" });
      renderState({ ...currentState, ...data });
      refreshModalEl.classList.add("hidden");
      showToast("All 45 numbers refreshed.");
    } catch (err) {
      showToast(err.message || "Failed to refresh numbers.");
    } finally {
      confirmRefreshBtn.disabled = false;
    }
  }

  async function unlockDashboard() {
    const data = await apiAdmin("GET");
    sessionStorage.setItem(PIN_SESSION_KEY, adminPin);
    loginSection.classList.add("hidden");
    dashboardEl.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    renderState(data);
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    pinErrorEl.textContent = "";
    adminPin = pinInput.value.trim();

    if (!adminPin) {
      pinErrorEl.textContent = "Please enter the admin PIN";
      return;
    }

    try {
      await unlockDashboard();
      pinInput.value = "";
    } catch (err) {
      adminPin = "";
      sessionStorage.removeItem(PIN_SESSION_KEY);
      pinErrorEl.textContent =
        err.status === 401
          ? "Incorrect admin PIN"
          : err.message || "Unable to connect to backend";
    }
  });

  logoutBtn.addEventListener("click", () => {
    adminPin = "";
    sessionStorage.removeItem(PIN_SESSION_KEY);
    dashboardEl.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    loginSection.classList.remove("hidden");
    window.applyRaceysTheme(window.RACEYS_DEFAULT_THEME);
  });

  refreshAllBtn.addEventListener("click", () => {
    refreshModalEl.classList.remove("hidden");
  });

  cancelRefreshBtn.addEventListener("click", () => {
    refreshModalEl.classList.add("hidden");
  });

  confirmRefreshBtn.addEventListener("click", refreshAllNumbers);

  refreshModalEl.addEventListener("click", (event) => {
    if (event.target === refreshModalEl) {
      refreshModalEl.classList.add("hidden");
    }
  });

  [
    [colorBgInput, colorBgHexEl],
    [colorSurfaceInput, colorSurfaceHexEl],
    [colorAccentInput, colorAccentHexEl],
  ].forEach(([input, label]) => {
    input.addEventListener("input", () => {
      label.textContent = input.value.toLowerCase();
      window.applyRaceysTheme({
        preset: "custom",
        backgroundHex: colorBgInput.value,
        surfaceHex: colorSurfaceInput.value,
        accentHex: colorAccentInput.value,
      });
    });
  });

  applyCustomThemeBtn.addEventListener("click", () => {
    saveTheme({
      preset: "custom",
      backgroundHex: colorBgInput.value,
      surfaceHex: colorSurfaceInput.value,
      accentHex: colorAccentInput.value,
    });
  });

  renderPresets();

  if (adminPin) {
    unlockDashboard().catch(() => {
      adminPin = "";
      sessionStorage.removeItem(PIN_SESSION_KEY);
    });
  }
})();
