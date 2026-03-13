// ============================================================
// UI ENGINE V5 — Compatible con AppCore V5
// Control de vistas, filtros, ayuda, ORB, scanner y layout
// ============================================================

function initUI(app) {

  // ============================================================
  // 🔐 PROTECCIÓN: si no hay token → login.html
  // ============================================================
  if (!app.auth?.token) {
    window.location.href = "login.html";
    return;
  }

  const els = app.els;

  // ============================================================
  // SCANNER MODE (simple/completo)
  // ============================================================
  window.scannerModoFallback = "simple";

  function getScannerModo() {
    try {
      return localStorage.getItem("scannerModo") || window.scannerModoFallback;
    } catch {
      return window.scannerModoFallback;
    }
  }

  function setScannerModo(modo) {
    try {
      localStorage.setItem("scannerModo", modo);
    } catch {
      window.scannerModoFallback = modo;
    }
  }

  // ============================================================
  // ELEMENTOS BASE
  // ============================================================
  const orbCore = document.getElementById("orb-core");
  const micButton = document.getElementById("mic-button");
  const dictadoAutoSwitch = document.getElementById("modo-voz-switch");
  const voiceStatus = document.getElementById("voice-status");
  const helpButton = document.getElementById("help-button");
  const helpModal = document.getElementById("help-modal");
  const helpClose = document.getElementById("help-close");
  const scannerOverlay = document.getElementById("scanner-overlay");
  const autoList = document.getElementById("autocomplete-list");

  const btnClear = document.getElementById("btn-limpiar");
  const btnCopy = document.getElementById("btn-copiar");
  const btnStop = document.getElementById("btn-stop");

  const btnFiltros = document.getElementById("btn-filtros");

  const btnVistaTabla = document.getElementById("btn-ver-tabla");
  const btnVistaTarjetas = document.getElementById("btn-ver-tarjetas");
  const btnVistaArticulo = document.getElementById("btn-ver-articulo");

  const vistaTabla = document.getElementById("vista-tabla");
  const vistaTarjeta = document.getElementById("vista-tarjeta");
  const vistaArticulo = document.getElementById("vista-articulo");

  const adminPanel = document.getElementById("admin-panel");
  const adminGuardar = document.getElementById("admin-guardar");
  const adminCerrar = document.getElementById("admin-cerrar");

  const toggleDark = document.getElementById("toggle-light");

  const fuenteToggle = document.getElementById("fuente-datos-toggle");
  const fuentePanel = document.getElementById("fuente-datos-panel");

  // ============================================================
  // ESTADOS INICIALES
  // ============================================================
  if (els.filtrosPanel) {
    els.filtrosPanel.classList.add("hidden");
    els.filtrosPanel.classList.remove("visible");
  }
  if (fuentePanel) {
    fuentePanel.classList.add("hidden");
    fuentePanel.classList.remove("visible");
  }
  if (helpModal) helpModal.classList.add("hidden");
  if (scannerOverlay) {
    scannerOverlay.classList.add("hidden");
    scannerOverlay.style.display = "none";
  }

  // ============================================================
  // SCANNER SWITCH
  // ============================================================
  const scannerSwitch = document.getElementById("scanner-mode-switch");

  if (scannerSwitch) {
    const modoActual = getScannerModo();
    scannerSwitch.checked = modoActual === "completo";

    scannerSwitch.addEventListener("change", () => {
      const nuevoModo = scannerSwitch.checked ? "completo" : "simple";
      setScannerModo(nuevoModo);
      app.showToast(`Scanner en modo ${nuevoModo}`);
    });
  }

  // ============================================================
  // BEEP
  // ============================================================
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function beep(freq = 1000, duration = 120) {
    try {
      if (!AudioCtx) return;
      if (!audioCtx) audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      setTimeout(() => osc.stop(), duration);
    } catch {}
  }

  // ============================================================
  // ESTADO DE VOZ
  // ============================================================
  function setVoiceUIState(state) {
    if (!voiceStatus) return;

    if (state === "off") {
      voiceStatus.textContent = "Dictado desactivado";
      voiceStatus.classList.remove("listening");
      ORB.setSpeaking?.(false);
    } else if (state === "ready") {
      voiceStatus.textContent = "Dictado listo";
      voiceStatus.classList.remove("listening");
      ORB.setSpeaking?.(false);
    } else if (state === "listening") {
      voiceStatus.textContent = "Escuchando…";
      voiceStatus.classList.add("listening");
      ORB.setSpeaking?.(true);
    }
  }

  // ============================================================
  // DICTADO AUTOMÁTICO
  // ============================================================
  if (dictadoAutoSwitch) {
    const savedAuto = localStorage.getItem("dictadoAutomatico");
    dictadoAutoSwitch.checked = savedAuto === "on";
    setVoiceUIState(savedAuto === "on" ? "ready" : "off");

    dictadoAutoSwitch.addEventListener("change", (e) => {
      const on = e.target.checked;
      localStorage.setItem("dictadoAutomatico", on ? "on" : "off");
      setVoiceUIState(on ? "ready" : "off");
      beep(on ? 1400 : 600);
      app.showToast(on ? "Dictado automático activado" : "Dictado automático desactivado");
    });
  }

  // ============================================================
  // DICTADO MANUAL
  // ============================================================
  function startDictado() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SR) {
      app.showToast("Dictado no soportado");
      beep(600);
      return;
    }

    const rec = new SR();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    setVoiceUIState("listening");
    beep(1500);

    rec.onresult = (ev) => {
      let text = ev.results[0][0].transcript || "";
      text = text.replace(/[.。]+$/g, "").trim();
      if (els.searchInput) els.searchInput.value = text;
      setVoiceUIState("ready");
      if (autoList) autoList.innerHTML = "";

      ORB.setLoading?.(true);
      app.buscar();
      setTimeout(() => app.setOrbIdle?.(), 600);
    };

    rec.onerror = () => {
      setVoiceUIState("ready");
      app.showToast("Error en dictado");
    };

    rec.onend = () => {
      if (dictadoAutoSwitch?.checked) setVoiceUIState("ready");
      else setVoiceUIState("off");
    };

    rec.start();
  }

  micButton?.addEventListener("click", () => startDictado());

  // ============================================================
  // AUTOCOMPLETE
  // ============================================================
  function renderAutocomplete(term) {
    if (!autoList || !els.searchInput) return;
    const value = term.trim();
    if (!value) {
      autoList.innerHTML = "";
      return;
    }

    const sugerencias = app.getAutocompleteSuggestions?.(value) || [];

    if (!sugerencias.length) {
      autoList.innerHTML = "";
      return;
    }

    autoList.innerHTML = sugerencias
      .map((s) => `<li data-value="${s}">${s}</li>`)
      .join("");
  }

  els.searchInput?.addEventListener("input", (e) => {
    renderAutocomplete(e.target.value || "");
  });

  els.searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = e.target.value.trim().toLowerCase();

      if (val === "admin") {
        adminPanel.classList.remove("hidden");
        adminPanel.classList.add("visible");
        e.target.value = "";
        if (autoList) autoList.innerHTML = "";
        app.showToast("Modo administrador activado");
        return;
      }

      if (autoList && autoList.children.length > 0) {
        const first = autoList.querySelector("li");
        if (first) {
          els.searchInput.value = first.dataset.value || first.textContent;
          autoList.innerHTML = "";
        }
      }

      ORB.setLoading?.(true);
      app.buscar();
      setTimeout(() => app.setOrbIdle?.(), 600);
    }
  });

  autoList?.addEventListener("click", (e) => {
    const li = e.target;
    if (li.tagName === "LI") {
      els.searchInput.value = li.dataset.value || li.textContent;
      autoList.innerHTML = "";
      ORB.setLoading?.(true);
      app.buscar();
      setTimeout(() => app.setOrbIdle?.(), 600);
    }
  });

  document.addEventListener("click", (e) => {
    if (!autoList) return;
    if (e.target !== els.searchInput && !autoList.contains(e.target)) {
      autoList.innerHTML = "";
    }
  });
  // ============================================================
  // ORB
  // ============================================================
  if (orbCore) {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if (isMobile) {
      orbCore.addEventListener("touchend", () => {
        if (autoList) autoList.innerHTML = "";
        ORB.setLoading?.(true);
        app.buscar();
        setTimeout(() => app.setOrbIdle?.(), 600);
      });
    }

    orbCore.addEventListener("click", () => {
      if (autoList) autoList.innerHTML = "";
      ORB.setLoading?.(true);
      app.buscar();
      setTimeout(() => app.setOrbIdle?.(), 600);
    });

    orbCore.addEventListener("dblclick", () => {
      adminPanel.classList.remove("hidden");
      adminPanel.classList.add("visible");
      app.showToast("Modo administrador activado");
    });
  }

  // ============================================================
  // SCANNER — overlay liviano
  // ============================================================
  const isAndroidApp = !!(window.Android && typeof Android.abrirScanner === "function");

  function setScannerOverlay(active) {
    if (!scannerOverlay) return;
    const laser = document.getElementById("scan-laser");

    if (active) {
      scannerOverlay.classList.remove("hidden");
      scannerOverlay.style.display = "block";
      document.body.classList.add("scanner-active");
      if (laser) laser.style.display = "none";
    } else {
      scannerOverlay.classList.add("hidden");
      scannerOverlay.style.display = "none";
      document.body.classList.remove("scanner-active");
    }
  }

  function scannerCallback() {
    setTimeout(() => setScannerOverlay(false), 1500);
    if (els.searchInput?.value.trim()) {
      ORB.setLoading?.(true);
      app.buscar();
      setTimeout(() => app.setOrbIdle?.(), 600);
    }
  }

  function abrirScannerNativo() {
    try {
      Android.abrirScanner();
    } catch (e) {
      console.warn("Error al abrir scanner nativo:", e);
    }
  }

  function abrirScannerWebInterno() {
    if (typeof window.startScannerInterno1 === "function") {
      const modo = getScannerModo();
      setScannerOverlay(true);
      window.startScannerInterno1(scannerCallback, modo);
    } else {
      app.showToast("Scanner interno no disponible");
    }
  }

  function abrirScannerWebExternoPreferido() {
    if (typeof window.startScannerExternoPreferido === "function") {
      setScannerOverlay(true);
      window.startScannerExternoPreferido(scannerCallback);
    } else {
      app.showToast("Scanner externo no disponible");
    }
  }

  const btnScannerInterno1 = document.getElementById("btn-scanner-interno-1");
  const btnScannerExternoPreferido = document.getElementById("btn-scanner-externo-preferido");

  btnScannerInterno1?.addEventListener("click", () => {
    if (isAndroidApp) abrirScannerNativo();
    else abrirScannerWebInterno();
  });

  btnScannerExternoPreferido?.addEventListener("click", () => {
    if (isAndroidApp) abrirScannerNativo();
    else abrirScannerWebExternoPreferido();
  });

  // ============================================================
  // BOTONES DE ACCIÓN
  // ============================================================
  btnClear?.addEventListener("click", () => {
    app.limpiarPantalla();
    app.setOrbIdle?.();
    beep(800);
  });

  btnCopy?.addEventListener("click", () => {
    app.copiarResultados();
    beep(900);
  });

  btnStop?.addEventListener("click", () => {
    app.stopTodo();
    app.setOrbIdle?.();
    beep(500);
  });

  // ============================================================
  // FILTROS
  // ============================================================
  btnFiltros?.addEventListener("click", () => {
    if (!els.filtrosPanel) return;
    const visible = els.filtrosPanel.classList.contains("visible");
    els.filtrosPanel.classList.toggle("visible", !visible);
    els.filtrosPanel.classList.toggle("hidden", visible);
  });

  els.btnAplicarFiltros?.addEventListener("click", () => {
    ORB.setLoading?.(true);
    app.buscarPorFiltros();
    setTimeout(() => app.setOrbIdle?.(), 600);
  });

  // ============================================================
  // VISTAS
  // ============================================================
  function setVista(v) {
    app.state.vistaActual = v;

    btnVistaTabla?.classList.toggle("active", v === "tabla");
    btnVistaTarjetas?.classList.toggle("active", v === "tarjeta");
    btnVistaArticulo?.classList.toggle("active", v === "articulo");

    if (vistaTabla) vistaTabla.style.display = v === "tabla" ? "block" : "none";
    if (vistaTarjeta) vistaTarjeta.style.display = v === "tarjeta" ? "block" : "none";
    if (vistaArticulo) vistaArticulo.style.display = v === "articulo" ? "block" : "none";

    if (autoList) autoList.innerHTML = "";
    app.renderResultados(app.state.items);
  }

  btnVistaTabla?.addEventListener("click", () => setVista("tabla"));
  btnVistaTarjetas?.addEventListener("click", () => setVista("tarjeta"));
  btnVistaArticulo?.addEventListener("click", () => setVista("articulo"));

  setVista(app.state.vistaActual || "tarjeta");

  // ============================================================
  // PANEL ADMIN
  // ============================================================
  adminGuardar?.addEventListener("click", () => {
    const modo = document.getElementById("admin-modo-defecto").value;
    const backend = document.getElementById("admin-backend-url").value;

    localStorage.setItem("modoDefecto", modo);
    localStorage.setItem("backendURL", backend);

    app.showToast("Configuración guardada");

    adminPanel.classList.remove("visible");
    adminPanel.classList.add("hidden");
  });

  adminCerrar?.addEventListener("click", () => {
    adminPanel.classList.remove("visible");
    adminPanel.classList.add("hidden");
  });

  // ============================================================
  // MÉTRICAS FILTRABLES
  // ============================================================
  const mArt = document.getElementById("metric-articulos");
  const mUni = document.getElementById("metric-pares");
  const mNeg = document.getElementById("metric-alertas-negativos");
  const mCero = document.getElementById("metric-alertas-cero");
  const mVal = document.getElementById("metric-valorizado");
  const mUlt = document.getElementById("metric-ultima-unidad");

  function mostrarTodos() {
    app.renderResultados(app.state.items);
    app.actualizarIndicadores(app.state.items);
    app.showToast("Mostrando todos los artículos");
  }

  function filtrarNegativos() {
    const items = app.state.items.filter((it) =>
      (it.talles || []).some((t) => Number(t.stock) < 0)
    );
    app.renderResultados(items);
    app.actualizarIndicadores(items);
    app.showToast("Mostrando artículos con stock negativo");
  }

  function filtrarSinStock() {
    const items = app.state.items.filter((it) => {
      const total = (it.talles || []).reduce((a, t) => a + Number(t.stock || 0), 0);
      return total === 0;
    });
    app.renderResultados(items);
    app.actualizarIndicadores(items);
    app.showToast("Mostrando artículos sin stock");
  }

  function filtrarConStock() {
    const items = app.state.items.filter((it) => {
      const total = (it.talles || []).reduce((a, t) => a + Number(t.stock || 0), 0);
      return total > 0;
    });
    app.renderResultados(items);
    app.actualizarIndicadores(items);
    app.showToast("Mostrando artículos con stock");
  }

  function filtrarUltimaUnidad() {
    const items = app.state.items.filter((it) => {
      const total = (it.talles || []).reduce((a, t) => a + Number(t.stock || 0), 0);
      return total === 1;
    });
    app.renderResultados(items);
    app.actualizarIndicadores(items);
    app.showToast("Mostrando artículos con última unidad");
  }

  function ordenarPorValorizado() {
    const items = [...app.state.items].sort(
      (a, b) => Number(b.valorizado || 0) - Number(a.valorizado || 0)
    );
    app.renderResultados(items);
    app.actualizarIndicadores(items);
    app.showToast("Ordenado por valorizado");
  }

  mArt?.addEventListener("click", mostrarTodos);
  mUni?.addEventListener("click", filtrarConStock);
  mNeg?.addEventListener("click", filtrarNegativos);
  mCero?.addEventListener("click", filtrarSinStock);
  mVal?.addEventListener("click", ordenarPorValorizado);
  mUlt?.addEventListener("click", filtrarUltimaUnidad);
  // ============================================================
  // MODO DÍA / NOCHE
  // ============================================================
  function aplicarModoDark(on) {
    document.body.classList.toggle("light-mode", on);
    localStorage.setItem("theme", on ? "light" : "dark");
  }

  const savedTheme = localStorage.getItem("theme") || "dark";
  aplicarModoDark(savedTheme === "light");
  if (toggleDark) toggleDark.checked = savedTheme === "light";

  toggleDark?.addEventListener("change", () => {
    aplicarModoDark(toggleDark.checked);
  });

  // ============================================================
  // AYUDA
  // ============================================================
  helpModal?.classList.add("hidden");

  helpButton?.addEventListener("click", () => {
    helpModal.classList.remove("hidden");
  });

  helpClose?.addEventListener("click", () => {
    helpModal.classList.add("hidden");
  });

  helpModal?.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
  });

  // ============================================================
  // FUENTE DE DATOS — TOGGLE
  // ============================================================
  fuenteToggle?.addEventListener("click", () => {
    if (!fuentePanel) return;
    const visible = fuentePanel.classList.contains("visible");
    fuentePanel.classList.toggle("visible", !visible);
    fuentePanel.classList.toggle("hidden", visible);
  });

  // ============================================================
  // ATAJOS DE TECLADO
  // ============================================================
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    const isInput = ["INPUT", "TEXTAREA"].includes(tag);

    // ESC limpia autocomplete o pantalla
    if (e.key === "Escape") {
      if (autoList?.innerHTML.trim()) {
        autoList.innerHTML = "";
        return;
      }
      app.limpiarPantalla();
      return;
    }

    // F2 = Scanner interno
    if (e.key === "F2" && !isInput) {
      const btnScannerInterno1 = document.getElementById("btn-scanner-interno-1");
      btnScannerInterno1?.click();
      e.preventDefault();
      return;
    }

    // F3 = Dictado manual
    if (e.key === "F3" && !isInput) {
      micButton?.click();
      e.preventDefault();
      return;
    }
  });
}

// Exponer initUI
window.initUI = initUI;
