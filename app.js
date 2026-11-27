(() => {
  const TOTAL_NUMBERS = 45;
  const STORAGE_KEY = "raceys_bonus_ball_entries_v1";
  const THEME_STORAGE_KEY = "raceys_bonus_ball_theme_v1";
  const API_BASE =
    typeof window.getRaceysApiBase === "function"
      ? window.getRaceysApiBase()
      : "";

  const ballGrid = document.getElementById("ball-grid");
  const soldCountEl = document.getElementById("sold-count");
  const remainingCountEl = document.getElementById("remaining-count");
  const progressBarEl = document.getElementById("progress-bar");
  const progressFillEl = document.getElementById("progress-fill");

  const modalBackdrop = document.getElementById("claim-modal-backdrop");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const stepClaimEl = document.getElementById("step-claim");
  const stepPaymentEl = document.getElementById("step-payment");

  const claimBallBadge = document.getElementById("claim-ball-badge");
  const modalTitle = document.getElementById("modal-title");
  const claimForm = document.getElementById("claim-form");
  const entryNameInput = document.getElementById("entry-name");
  const entryMobileInput = document.getElementById("entry-mobile");
  const errorNameEl = document.getElementById("error-name");
  const errorMobileEl = document.getElementById("error-mobile");
  const claimSubmitBtn = document.getElementById("claim-submit-btn");
  const claimBtnText = document.getElementById("claim-btn-text");

  const paymentHeading = document.getElementById("payment-heading");
  const paymentBallBadge = document.getElementById("payment-ball-badge");
  const backToBoardBtn = document.getElementById("back-to-board-btn");
  const toastContainer = document.getElementById("toast-container");

  const isHttpOrigin =
    window.location.protocol === "http:" ||
    window.location.protocol === "https:";

  let selectedNumber = null;
  let isSubmitting = false;
  let entries = isHttpOrigin ? {} : loadLocalEntries();
  let lastEntriesSnapshot = null;
  let lastThemeSnapshot = null;
  let lastRefreshVersion = loadLocalRefreshVersion();

  function loadLocalEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveLocalEntries(nextEntries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }

  function loadLocalTheme() {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLocalTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch {
      // Ignore storage errors
    }
  }

  function loadLocalRefreshVersion() {
    try {
      const v = Number(localStorage.getItem("raceys_refresh_version_v1"));
      return Number.isInteger(v) && v >= 1 ? v : null;
    } catch {
      return null;
    }
  }

  function saveLocalRefreshVersion(version) {
    try {
      localStorage.setItem("raceys_refresh_version_v1", String(version));
    } catch {
      // Ignore storage errors
    }
  }

  function serializeEntries(map) {
    const keys = Object.keys(map || {}).sort((a, b) => Number(a) - Number(b));
    return JSON.stringify(
      keys.map((k) => [k, map[k] && map[k].firstName ? map[k].firstName : ""])
    );
  }

  async function syncFromBackend(forceAnimate = false) {
    if (!modalBackdrop.classList.contains("hidden") || isSubmitting) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/state`, { cache: "no-store" });
      if (!res.ok) return;
      const state = await res.json();
      if (!state || typeof state !== "object") return;

      const serverVersion = Number(state.refreshVersion) || 1;
      const wasAdminRefresh =
        lastRefreshVersion !== null && serverVersion > lastRefreshVersion;

      if (state.entries && typeof state.entries === "object") {
        const nextSnapshot = serializeEntries(state.entries);
        if (wasAdminRefresh || nextSnapshot !== lastEntriesSnapshot) {
          entries = state.entries;
          lastEntriesSnapshot = nextSnapshot;
          saveLocalEntries(entries);
          renderBoard(forceAnimate || wasAdminRefresh);
        }
      }

      if (wasAdminRefresh) {
        showToast("Draw board refreshed by admin.");
      }
      lastRefreshVersion = serverVersion;
      saveLocalRefreshVersion(serverVersion);

      if (state.theme && typeof window.applyRaceysTheme === "function") {
        const nextThemeSnapshot = JSON.stringify(state.theme);
        if (nextThemeSnapshot !== lastThemeSnapshot) {
          const applied = window.applyRaceysTheme(state.theme);
          lastThemeSnapshot = nextThemeSnapshot;
          saveLocalTheme(applied);
        }
      }
    } catch {
      // Keep current state cleanly if backend is temporarily unreachable
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  function updateProgress() {
    const soldCount = Object.keys(entries).length;
    const remainingCount = Math.max(0, TOTAL_NUMBERS - soldCount);
    const pct = Math.round((soldCount / TOTAL_NUMBERS) * 100);

    soldCountEl.textContent = `${soldCount} of ${TOTAL_NUMBERS} sold`;
    remainingCountEl.textContent =
      soldCount >= TOTAL_NUMBERS
        ? "All sold – draw is on!"
        : `${remainingCount} left`;

    progressBarEl.setAttribute("aria-valuenow", String(soldCount));
    progressFillEl.style.width = `${pct}%`;
  }

  function renderBoard(animate = false) {
    ballGrid.innerHTML = "";

    for (let num = 1; num <= TOTAL_NUMBERS; num++) {
      const entry = entries[String(num)];
      const cell = document.createElement("div");
      cell.className = "ball-cell";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(num);

      if (animate) {
        btn.style.animationDelay = `${(num - 1) * 12}ms`;
      } else {
        btn.style.animation = "none";
      }

      const caption = document.createElement("span");
      caption.className = "ball-caption";

      if (entry) {
        btn.className = "ball-btn ball-btn--taken";
        btn.disabled = true;
        btn.setAttribute(
          "aria-label",
          `Number ${num}, taken by ${entry.firstName}`
        );
        caption.textContent = entry.firstName;
      } else {
        btn.className = "ball-btn lotto-ball-picked";
        btn.setAttribute("aria-label", `Pick number ${num}`);
        btn.addEventListener("click", () => openClaimModal(num));
        caption.classList.add("ball-caption--empty");
        caption.textContent = "free";
        caption.setAttribute("aria-hidden", "true");
      }

      cell.appendChild(btn);
      cell.appendChild(caption);
      ballGrid.appendChild(cell);
    }

    updateProgress();
  }

  function clearErrors() {
    errorNameEl.textContent = "";
    errorMobileEl.textContent = "";
    entryNameInput.removeAttribute("aria-invalid");
    entryMobileInput.removeAttribute("aria-invalid");
  }

  function setSubmitting(busy) {
    isSubmitting = busy;
    claimSubmitBtn.disabled = busy;
    claimSubmitBtn.setAttribute("aria-busy", busy ? "true" : "false");
    if (selectedNumber !== null) {
      claimBtnText.textContent = busy
        ? `Claiming number ${selectedNumber}...`
        : `Claim number ${selectedNumber}`;
    }
  }

  function openClaimModal(num) {
    if (entries[String(num)]) {
      showToast(`Sorry, number ${num} was just taken. Please pick another.`);
      return;
    }

    selectedNumber = num;
    clearErrors();
    claimForm.reset();
    setSubmitting(false);

    claimBallBadge.textContent = String(num);
    modalTitle.textContent = `Claim number ${num}`;
    claimBtnText.textContent = `Claim number ${num}`;

    stepPaymentEl.classList.add("hidden");
    stepClaimEl.classList.remove("hidden");
    modalBackdrop.classList.remove("hidden");

    setTimeout(() => {
      entryNameInput.focus();
    }, 50);
  }

  function closeModal() {
    modalBackdrop.classList.add("hidden");
    selectedNumber = null;
    setSubmitting(false);
  }

  function validateForm() {
    clearErrors();
    const rawName = entryNameInput.value.trim().replace(/\s+/g, " ");
    const rawMobile = entryMobileInput.value.trim();
    const digitCount = rawMobile.replace(/\D/g, "").length;
    let valid = true;

    if (rawName.length < 2) {
      errorNameEl.textContent = "Please enter your name";
      entryNameInput.setAttribute("aria-invalid", "true");
      valid = false;
    } else if (rawName.length > 60) {
      errorNameEl.textContent = "Name must be 60 characters or fewer";
      entryNameInput.setAttribute("aria-invalid", "true");
      valid = false;
    }

    if (
      !/^\+?[0-9 \-]{7,20}$/.test(rawMobile) ||
      digitCount < 7 ||
      digitCount > 15
    ) {
      errorMobileEl.textContent =
        "Enter a valid mobile number, e.g. 087 123 4567";
      entryMobileInput.setAttribute("aria-invalid", "true");
      valid = false;
    }

    return valid ? { name: rawName, mobile: rawMobile } : null;
  }

  entryNameInput.addEventListener("input", () => {
    if (errorNameEl.textContent) {
      errorNameEl.textContent = "";
      entryNameInput.removeAttribute("aria-invalid");
    }
  });

  entryMobileInput.addEventListener("input", () => {
    if (errorMobileEl.textContent) {
      errorMobileEl.textContent = "";
      entryMobileInput.removeAttribute("aria-invalid");
    }
  });

  claimForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (selectedNumber === null || isSubmitting) return;

    const validated = validateForm();
    if (!validated) return;

    const numberToClaim = selectedNumber;
    const key = String(numberToClaim);

    if (entries[key]) {
      showToast(
        `Sorry, number ${numberToClaim} was just taken. Please pick another.`
      );
      closeModal();
      renderBoard(false);
      return;
    }

    setSubmitting(true);

    let firstName = validated.name.split(" ")[0];
    let claimedAt = new Date().toISOString();

    if (isHttpOrigin) {
      try {
        const res = await fetch(`${API_BASE}/api/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: numberToClaim,
            name: validated.name,
            mobile: validated.mobile,
          }),
        });

        if (res.status === 409) {
          showToast(
            `Sorry, number ${numberToClaim} was just taken. Please pick another.`
          );
          closeModal();
          await syncFromBackend(false);
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(
            err.error || "Could not save your number. Please try again."
          );
          setSubmitting(false);
          return;
        }

        const data = await res.json();
        firstName = data.firstName || firstName;
        claimedAt = data.claimedAt || claimedAt;
      } catch {
        showToast("Server is waking up or unreachable. Please tap Claim again.");
        setSubmitting(false);
        return;
      }
    }

    entries[key] = {
      firstName,
      claimedAt,
    };
    lastEntriesSnapshot = serializeEntries(entries);
    saveLocalEntries(entries);
    renderBoard(false);
    setSubmitting(false);

    paymentHeading.textContent = `Number ${numberToClaim} is yours, ${firstName}!`;
    paymentBallBadge.textContent = String(numberToClaim);
    stepClaimEl.classList.add("hidden");
    stepPaymentEl.classList.remove("hidden");
  });

  modalCloseBtn.addEventListener("click", closeModal);
  backToBoardBtn.addEventListener("click", closeModal);

  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalBackdrop.classList.contains("hidden")) {
      closeModal();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      syncFromBackend(false);
    }
  });

  const cachedTheme = loadLocalTheme();
  if (cachedTheme && typeof window.applyRaceysTheme === "function") {
    window.applyRaceysTheme(cachedTheme);
  }

  lastEntriesSnapshot = serializeEntries(entries);
  renderBoard(true);
  syncFromBackend(false);
  setInterval(() => {
    if (!document.hidden) {
      syncFromBackend(false);
    }
  }, 10000);
})();
