// ============================================================
// ORB ADMIN ENGINE — V4 FINAL
// Totalmente compatible con:
// - orb_engine_v2.js
// - styles_v2.css (8 partes)
// - index.html optimizado
// - Presets IA PRO
// ============================================================

const ORB_ADMIN = {
  panel: document.getElementById("admin-panel"),

  // Inputs del panel
  inputColorDia: document.getElementById("orb-color"),
  inputColorNoche: document.getElementById("orb-color-dark"),
  inputSize: document.getElementById("orb-size"),
  inputHalo: document.getElementById("orb-halo"),
  inputModo: document.getElementById("orb-mode"),
  inputPresets: document.getElementById("orb-presets"),
  btnReset: document.getElementById("orb-reset"),

  // ============================================================
  // Cargar valores actuales del ORB en el panel
  // ============================================================
  cargarConfig() {
    if (!window.ORB) return;

    this.inputColorDia.value = ORB.color || "#4f8cff";
    this.inputColorNoche.value = ORB.colorDark || "#7c4dff";
    this.inputSize.value = ORB.size || 130;
    this.inputHalo.value = ORB.halo || 60;
    this.inputModo.value = ORB.mode || "ultra";
    this.inputPresets.value = ORB.preset || "default";
  },

  // ============================================================
  // Listeners del panel admin
  // ============================================================
  initListeners() {
    if (!window.ORB) return;

    // Color día
    this.inputColorDia?.addEventListener("input", () => {
      ORB.color = this.inputColorDia.value;
      ORB.saveConfig();
      ORB.applyVisuals();
    });

    // Color noche
    this.inputColorNoche?.addEventListener("input", () => {
      ORB.colorDark = this.inputColorNoche.value;
      ORB.saveConfig();
      ORB.applyVisuals();
    });

    // Tamaño ORB
    this.inputSize?.addEventListener("input", () => {
      ORB.size = parseInt(this.inputSize.value);
      ORB.saveConfig();
      ORB.applyVisuals();
    });

    // Intensidad halo
    this.inputHalo?.addEventListener("input", () => {
      ORB.halo = parseInt(this.inputHalo.value);
      ORB.saveConfig();
      ORB.applyVisuals();
    });

    // Modo visual (Ultra / 3D / Classic)
    this.inputModo?.addEventListener("change", () => {
      ORB.mode = this.inputModo.value;
      ORB.saveConfig();
      ORB.applyVisuals();
    });

    // Presets IA PRO
    this.inputPresets?.addEventListener("change", () => {
      ORB.applyPreset(this.inputPresets.value);
      this.cargarConfig();

      if (window.AppCore && AppCore.showToast) {
        AppCore.showToast("Preset aplicado");
      }
    });

    // Reset ORB
    this.btnReset?.addEventListener("click", () => {
      this.resetOrb();
    });
  },

  // ============================================================
  // Reset completo del ORB
  // ============================================================
  resetOrb() {
    if (!window.ORB) return;

    ORB.reset();
    this.cargarConfig();

    if (window.AppCore && AppCore.showToast) {
      AppCore.showToast("ORB restaurado");
    }
  },

  // ============================================================
  // Inicializar panel admin
  // ============================================================
  init() {
    this.cargarConfig();
    this.initListeners();
  },
};

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  ORB_ADMIN.init();
});
