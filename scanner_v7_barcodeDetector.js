 SCANNER V7 — BarcodeDetector nativo + UX pulida
   ============================================================ */

(function () {
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

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function beep(freq = 1200, duration = 120) {
    try {
      if (!AudioCtx) return;
      if (!audioCtx) audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
@@ -120,189 +120,220 @@
    }
  }

  async function tapToFocus(normX, normY) {
    const track = getVideoTrack();
    if (!track || !track.getCapabilities) return;

    const capabilities = track.getCapabilities();
    if (!capabilities.focusMode || !capabilities.focusPointX || !capabilities.focusPointY) {
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: "manual",
            focusPointX: normX,
            focusPointY: normY,
          },
        ],
      });
    } catch (e) {
      console.warn("No se pudo aplicar enfoque manual:", e);
    }
  }

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

  function stopCamera() {
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      video.srcObject = null;
    }
  }

  function closeScanner() {
    scanning = false;
    multiMode = false;
    detectedCodes = [];
    torchOn = false;
    zoomLevel = 1;

    stopCamera();
    overlay.classList.add("hidden");
    document.body.classList.remove("scanner-active");
  }

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

  async function startDecoding() {
    if (!("BarcodeDetector" in window)) {
      window.appCore?.showToast?.("BarcodeDetector no soportado en este dispositivo");
      return;
    }

    const formats = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e"];
    const detector = new BarcodeDetector({ formats });

    scanning = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    async function loop() {
      if (!scanning || !video || video.readyState !== 4) {
        if (scanning) requestAnimationFrame(loop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const barcodes = await detector.detect(canvas);
        if (barcodes && barcodes.length > 0) {
          const best = barcodes[0];
          if (best.rawValue) {
            handleDetected(best.rawValue);
          }
        }
      } catch (e) {
        console.warn("BarcodeDetector error:", e);
      }

      if (scanning) requestAnimationFrame(loop);
    }

    loop();
  }

  async function startScanner(callback, mode) {
    if (scanning) return;

    endCallback = typeof callback === "function" ? callback : null;
    scannerMode = mode === "completo" ? "completo" : "simple";

    overlay.classList.remove("hidden");
    document.body.classList.add("scanner-active");

    createControls();

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
    if (btnZoomIn)
      btnZoomIn.onclick = () => {
        zoomLevel += 0.3;
        applyZoom();
      };
    if (btnZoomOut)
      btnZoomOut.onclick = () => {
        zoomLevel -= 0.3;
        applyZoom();
      };
    if (btnClose)
      btnClose.onclick = () => {
        closeScanner();
        if (typeof endCallback === "function") {
          endCallback(null);
        }
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
    if (video) {
      video.onclick = (ev) => {
        const rect = video.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width;
        const y = (ev.clientY - rect.top) / rect.height;
        tapToFocus(x, y);
      };
    }
  }

  window.startScannerInterno1 = function (cb, mode) {
    startScanner(cb, mode === "completo" ? "completo" : "simple");
  };

  window.startScannerExternoPreferido = function (cb) {
    startScanner(cb, "completo");
  };
})();
