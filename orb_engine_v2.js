// ============================================================
// ORB ENGINE V4 — Núcleo visual del asistente IA PRO
// ============================================================
// Compatibilidad total con:
// - styles_v2.css (8 partes)
// - index.html optimizado
// - orb_admin_engine.js V4
// - Estados: ready, loading, listening, error
// - Modos visuales: ultra, 3d, classic
// - Presets IA PRO
// - Modo día/noche real
// ============================================================

const ORB = {
  core: null,

  // Config visual persistente
  size: 130,
  halo: 60,
  color: "#4f8cff",
  colorDark: "#7c4dff",
  mode: "ultra",
  preset: "default",

  // Estados
  isDark: false,
  isLoading: false,
  isSpeaking: false,
  isError: false,

  // ============================================================
  // Inicialización
  // ============================================================
  init() {
    this.core = document.getElementById("orb-core");
    if (!this.core) return;

    this.loadConfig();
    this.applyPreset(this.preset);
    this.applyVisuals();
    this.bindEvents();
  },

  // ============================================================
  // Cargar configuración guardada
  // ============================================================
  loadConfig() {
    const c1 = localStorage.getItem("orbColor");
    const c2 = localStorage.getItem("orbColorDark");
    const s = localStorage.getItem("orbSize");
    const h = localStorage.getItem("orbHalo");
    const m = localStorage.getItem("orbMode");
    const p = localStorage.getItem("orbPreset");

    if (c1) this.color = c1;
    if (c2) this.colorDark = c2;
    if (s) this.size = parseInt(s);
    if (h) this.halo = parseInt(h);
    if (m) this.mode = m;
    if (p) this.preset = p;
  },

  saveConfig() {
    localStorage.setItem("orbColor", this.color);
    localStorage.setItem("orbColorDark", this.colorDark);
    localStorage.setItem("orbSize", this.size);
    localStorage.setItem("orbHalo", this.halo);
    localStorage.setItem("orbMode", this.mode);
    localStorage.setItem("orbPreset", this.preset);
  },

  // ============================================================
  // Eventos globales
  // ============================================================
  bindEvents() {
    const toggleDark = document.getElementById("toggle-dark");
    if (toggleDark) {
      this.isDark = toggleDark.checked;
      toggleDark.addEventListener("change", () => {
        this.isDark = toggleDark.checked;
        this.applyVisuals();
      });
    }
  },

  // ============================================================
  // Aplicar visuales base (idle)
  // ============================================================
  applyVisuals() {
    if (!this.core) return;

    // Reset de clases
    this.core.className = "";
    this.core.classList.add(`orb-${this.mode}`);

    // Tamaño dinámico
    this.core.style.width = this.size + "px";
    this.core.style.height = this.size + "px";

    // Variables CSS dinámicas
    document.documentElement.style.setProperty("--orb-color", this.color);
    document.documentElement.style.setProperty("--orb-color-dark", this.colorDark);
    document.documentElement.style.setProperty("--orb-halo-strength", this.halo);
  },

  // ============================================================
  // Presets IA PRO
  // ============================================================
  applyPreset(p) {
    this.preset = p;

    const presets = {
      default:  { color: "#4f8cff", dark: "#7c4dff", halo: 60, mode: "ultra" },
      plasma:   { color: "#ff00ff", dark: "#ff00ff", halo: 80, mode: "ultra" },
      fuego:    { color: "#ff4500", dark: "#ff4500", halo: 90, mode: "3d" },
      neon:     { color: "#39ff14", dark: "#39ff14", halo: 100, mode: "ultra" },
      minimal:  { color: "#888888", dark: "#444444", halo: 20, mode: "classic" }
    };

    if (presets[p]) {
      this.color = presets[p].color;
      this.colorDark = presets[p].dark;
      this.halo = presets[p].halo;
      this.mode = presets[p].mode;
    }

    this.saveConfig();
    this.applyVisuals();
  },

  // ============================================================
  // Estado: hablando (dictado / manos libres)
  // ============================================================
  setSpeaking(v) {
    this.isSpeaking = v;
    if (!this.core) return;

    this.core.classList.remove("orb-loading", "orb-error", "orb-ready");

    if (v) {
      this.core.classList.add("orb-listening");
    } else {
      this.core.classList.remove("orb-listening");
      this.applyVisuals();
    }
  },

  // ============================================================
  // Estado: cargando (búsqueda)
  // ============================================================
  setLoading(v) {
    this.isLoading = v;
    if (!this.core) return;

    this.core.classList.remove("orb-listening", "orb-error", "orb-ready");

    if (v) {
      this.core.classList.add("orb-loading");
    } else {
      this.core.classList.remove("orb-loading");
      this.applyVisuals();
    }
  },

  // ============================================================
  // Estado: error
  // ============================================================
  setError(v) {
    this.isError = v;
    if (!this.core) return;

    this.core.classList.remove("orb-loading", "orb-listening", "orb-ready");

    if (v) {
      this.core.classList.add("orb-error");
    } else {
      this.core.classList.remove("orb-error");
      this.applyVisuals();
    }
  },

  // ============================================================
  // Estado: listo
  // ============================================================
  setReady() {
    if (!this.core) return;

    this.core.classList.remove("orb-loading", "orb-listening", "orb-error");
    this.core.classList.add("orb-ready");
  },

  // ============================================================
  // Reset total
  // ============================================================
  reset() {
    this.color = "#4f8cff";
    this.colorDark = "#7c4dff";
    this.size = 130;
    this.halo = 60;
    this.mode = "ultra";
    this.preset = "default";

    this.saveConfig();
    this.applyVisuals();
  }
};

// Inicializar
window.addEventListener("DOMContentLoaded", () => ORB.init());
