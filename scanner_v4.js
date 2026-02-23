/* ============================================================
   SCANNER V4 PRO — IA PRO ULTRA (versión final PWA 2026)
   ============================================================ */

(function () {
  let codeReader = null;
  let scanning = false;
  let multiMode = false;
  let detectedCodes = [];
  let zoomLevel = 1;
  let maxZoom = 1;
  let torchOn = false;
  let endCallback = null;

  let scannerMode = "simple";

  const overlay = document.getElementById("scanner-overlay");
  const video = document.getElementById("scanner-video");

  /* ============================================================
     FIX iOS / PWA — playsinline obligatorio
     ============================================================ */
  if (video) {
    video.setAttribute("playsinline", true);
    video.setAttribute("webkit-playsinline", true);
    video.setAttribute("muted", true);
  }

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
     CREAR CONTROLES
     ============================================================ */
  function createControls() {
    const controls = document.createElement("div");
    controls.className = "scanner-controls";

    controls.innerHTML = `
      <button class="scanner-btn" id="scn-torch">🔦</button>
      <button class="scanner-btn" id="scn-zoom-in">➕</button>
      <button class="scanner-btn" id="scn-zoom-out">➖</button>
      <button class="scanner-btn-primary" id="scn-multi">Multi-scan</button>
      <button class="scanner-btn-danger" id="scn-close">✖</button>
    `;

    overlay.appendChild(controls);

    const counter = document.createElement("div");
    counter.className = "scanner-counter hidden";
    counter.id = "scn-counter";
    overlay.appendChild(counter);
  }

  /* ============================================================
     MOSTRAR / OCULTAR CONTROLES
     ============================================================ */
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
     OBTENER TRACK DE VIDEO
     ============================================================ */
  function getVideoTrack() {
    if (!video || !video.srcObject) return null;
    const tracks = video.srcObject.getVideoTracks();
    return tracks && tracks[0] ? tracks[0] : null;
  }

  /* ============================================================
     TORCH
     ============================================================ */
  async function toggleTorch() {
    const track = getVideoTrack();
    if (!track) return;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!capabilities.torch) {
      window.appCore?.showToast?.("Linterna no disponible");
      return;
    }

    torchOn = !torchOn;

    try {
      await track.applyConstraints({
        advanced: [{ torch: torchOn }],
      });
    } catch (e) {
      window.appCore?.showToast?.("No se pudo activar la linterna");
    }
  }

  /* ============================================================
     ZOOM
     ============================================================ */
  async function applyZoom() {
    const track = getVideoTrack();
    if (!track) return;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!capabilities.zoom) {
      window.appCore?.showToast?.("Zoom no soportado");
      return;
    }

    maxZoom = capabilities.zoom.max || 1;
    zoomLevel = Math.max(1, Math.min(zoomLevel, maxZoom));

    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoomLevel }],
      });
    } catch (e) {
      console.warn("Zoom error:", e);
    }
  }

  /* ============================================================
     INICIAR CÁMARA (PWA FIX)
     ============================================================ */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: "continuous",
        },
        audio: false,
      });

      video.srcObject = stream;
      await video.play();
      return true;
    } catch (e) {
      window.appCore?.showToast?.("No se pudo acceder a la cámara");
      return false;
    }
  }

  /* ============================================================
     DETENER CÁMARA
     ============================================================ */
  function stopCamera() {
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      video.srcObject = null;
    }
  }

  /* ============================================================
     CERRAR SCANNER
     ============================================================ */
  function closeScanner() {
    scanning = false;
    multiMode = false;
    detectedCodes = [];
    torchOn = false;
    zoomLevel = 1;

    if (codeReader) {
      try {
        codeReader.reset();
      } catch (_) {}
    }

    stopCamera();
    overlay.classList.add("hidden");
    document.body.classList.remove("scanner-active");
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

      closeScanner();

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
     DECODIFICACIÓN ZXING — PRIORIDAD CODE128
     ============================================================ */
  async function startDecoding() {
    if (!codeReader) {
      const hints = new Map([
        [
          ZXing.DecodeHintType.POSSIBLE_FORMATS,
          [
            ZXing.BarcodeFormat.CODE_128,
            ZXing.BarcodeFormat.CODE_39,
            ZXing.BarcodeFormat.EAN_13,
            ZXing.BarcodeFormat.EAN_8,
            ZXing.BarcodeFormat.UPC_A,
            ZXing.BarcodeFormat.UPC_E,
            ZXing.BarcodeFormat.ITF,
            ZXing.BarcodeFormat.CODABAR
          ]
        ],
        [ZXing.DecodeHintType.TRY_HARDER, true]
      ]);

      codeReader = new ZXing.BrowserMultiFormatReader(hints);
    }

    scanning = true;

    try {
      await codeReader.decodeFromVideoDevice(
        null,
        "scanner-video",
        (result, err) => {
          if (result && scanning) {
            handleDetected(result.text);
          }
        }
      );
    } catch (e) {
      console.warn("ZXing error:", e);
      window.appCore?.showToast?.("Error iniciando scanner");
    }
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

    const ok = await startCamera();
    if (!ok) return;

    startDecoding();

    const btnTorch = document.getElementById("scn-torch");
    const btnZoomIn = document.getElementById("scn-zoom-in");
    const btnZoomOut = document.getElementById("scn-zoom-out");
    const btnClose = document.getElementById("scn-close");
    const btnMulti = document.getElementById("scn-multi");

    if (btnTorch) btnTorch.onclick = toggleTorch;
    if (btnZoomIn) btnZoomIn.onclick = () => { zoomLevel += 0.3; applyZoom(); };
    if (btnZoomOut) btnZoomOut.onclick = () => { zoomLevel -= 0.3; applyZoom(); };

    if (btnClose)
      btnClose.onclick = () => {
        closeScanner();
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

    if (video) video.onclick = toggleTorch;
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
