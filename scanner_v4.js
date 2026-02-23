/* ============================================================
   SCANNER V5 PRO — QUAGGA2 (versión final 2026)
   Lectura industrial CODE_128 / CODE_39 / EAN / ITF / UPC
   ============================================================ */

(function () {
  let scanning = false;
  let multiMode = false;
  let detectedCodes = [];
  let endCallback = null;
  let scannerMode = "simple";

  const overlay = document.getElementById("scanner-overlay");
  const video = document.getElementById("scanner-video");

  /* ============================================================
     BEEP
     ============================================================ */
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function beep(freq = 1200, duration = 120) {
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
    } catch (_) {}
  }

  /* ============================================================
     PROCESAR CÓDIGO
     ============================================================ */
  function handleDetected(rawCode) {
    if (!rawCode) return;
    beep();

    let code = rawCode;

    if (scannerMode === "simple") {
      const separadores = /[\/\\! ]/;
      const partes = rawCode.split(separadores);
      code = partes[0] || rawCode;
    }

    if (!multiMode) {
      const input = document.getElementById("search-input");
      if (input) input.value = code;

      stopScanner();

      if (typeof endCallback === "function") {
        endCallback(code);
      }
      return;
    }

    if (!detectedCodes.includes(code)) {
      detectedCodes.push(code);
      updateControls();
    }
  }

  /* ============================================================
     CREAR CONTROLES
     ============================================================ */
  function createControls() {
    const controls = document.createElement("div");
    controls.className = "scanner-controls";

    controls.innerHTML = `
      <button class="scanner-btn" id="scn-multi">Multi-scan</button>
      <button class="scanner-btn-danger" id="scn-close">✖</button>
    `;

    overlay.appendChild(controls);

    const counter = document.createElement("div");
    counter.className = "scanner-counter hidden";
    counter.id = "scn-counter";
    overlay.appendChild(counter);
  }

  function updateControls() {
    const btnMulti = document.getElementById("scn-multi");
    const counter = document.getElementById("scn-counter");
    if (!btnMulti || !counter) return;

    if (!multiMode) {
      btnMulti.textContent = "Multi-scan";
      counter.classList.add("hidden");
    } else {
      btnMulti.textContent = "Enviar todos";
      counter.classList.remove("hidden");
      counter.textContent = `${detectedCodes.length} códigos`;
    }
  }

  /* ============================================================
     INICIAR QUAGGA2
     ============================================================ */
  function startQuagga() {
    return Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: video,
          constraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        decoder: {
          readers: [
            "code_128_reader",
            "code_39_reader",
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "codabar_reader",
            "i2of5_reader"
          ]
        },
        locate: true,
        numOfWorkers: 2
      },
      (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          window.appCore?.showToast?.("Error iniciando scanner");
          return;
        }
        Quagga.start();
      }
    );
  }

  /* ============================================================
     DETENER QUAGGA
     ============================================================ */
  function stopScanner() {
    scanning = false;
    multiMode = false;
    detectedCodes = [];

    try {
      Quagga.stop();
    } catch (_) {}

    overlay.classList.add("hidden");
    document.body.classList.remove("scanner-active");
  }

  /* ============================================================
     INICIAR SCANNER
     ============================================================ */
  async function startScanner(callback, mode) {
    if (scanning) return;

    endCallback = typeof callback === "function" ? callback : null;
    scannerMode = mode === "completo" ? "completo" : "simple";

    overlay.classList.remove("hidden");
    document.body.classList.add("scanner-active");

    if (!document.querySelector(".scanner-controls")) {
      createControls();
    }

    multiMode = false;
    detectedCodes = [];
    updateControls();

    scanning = true;

    startQuagga();

    Quagga.onDetected((data) => {
      if (!scanning) return;
      if (!data || !data.codeResult) return;

      const code = data.codeResult.code;
      handleDetected(code);
    });

    const btnClose = document.getElementById("scn-close");
    const btnMulti = document.getElementById("scn-multi");

    if (btnClose)
      btnClose.onclick = () => {
        stopScanner();
        if (typeof endCallback === "function") endCallback(null);
      };

    if (btnMulti)
      btnMulti.onclick = () => {
        if (!multiMode) {
          multiMode = true;
          detectedCodes = [];
          updateControls();
        } else {
          const txt = detectedCodes.join("\n");
          if (txt) {
            navigator.clipboard.writeText(txt);
            window.appCore?.showToast?.("Códigos copiados");
          } else {
            window.appCore?.showToast?.("No hay códigos para copiar");
          }
        }
      };
  }

  /* ============================================================
     EXPONER FUNCIONES GLOBALES
     ============================================================ */
  window.startScannerInterno1 = function (cb, mode) {
    startScanner(cb, mode === "completo" ? "completo" : "simple");
  };

  window.startScannerExternoPreferido = function (cb) {
    startScanner(cb, "completo");
  };
})();
