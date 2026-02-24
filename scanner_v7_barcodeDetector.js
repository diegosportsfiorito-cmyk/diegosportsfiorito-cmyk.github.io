/* ============================================================
   SCANNER V7 — ESTABLE / RÁPIDO / COMPATIBLE / SIN LAG
   ============================================================ */

(function () {
  let scanning = false;
  let endCallback = null;

  const overlay = document.getElementById("scanner-overlay");
  const video = document.getElementById("scanner-video");

  /* ============================================================
     BEEP SIMPLE
     ============================================================ */
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function beep() {
    try {
      if (!AudioCtx) return;
      if (!audioCtx) audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1200;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      setTimeout(() => osc.stop(), 120);
    } catch (_) {}
  }

  /* ============================================================
     START CAMERA
     ============================================================ */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
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
     STOP CAMERA
     ============================================================ */
  function stopCamera() {
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }

  /* ============================================================
     CLOSE SCANNER
     ============================================================ */
  function closeScanner() {
    scanning = false;
    stopCamera();
    overlay.classList.add("hidden");
    document.body.classList.remove("scanner-active");
  }

  /* ============================================================
     HANDLE DETECTED
     ============================================================ */
  function handleDetected(code) {
    if (!code) return;

    beep();

    const input = document.getElementById("search-input");
    if (input) input.value = code;

    closeScanner();

    if (typeof endCallback === "function") {
      endCallback(code);
    }
  }

  /* ============================================================
     DECODING LOOP — SIMPLE / RÁPIDO / EFECTIVO
     ============================================================ */
  async function startDecoding() {
    if (!("BarcodeDetector" in window)) {
      window.appCore?.showToast?.("BarcodeDetector no soportado");
      return;
    }

    const detector = new BarcodeDetector({
      formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e"]
    });

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
          // Priorizar CODE_128
          let best = barcodes[0];
          for (const b of barcodes) {
            if ((b.format || "").toLowerCase().includes("code_128")) {
              best = b;
              break;
            }
          }

          if (best.rawValue) {
            handleDetected(best.rawValue);
            return;
          }
        }
      } catch (_) {}

      if (scanning) requestAnimationFrame(loop);
    }

    loop();
  }

  /* ============================================================
     START SCANNER (SIMPLE)
     ============================================================ */
  async function startScanner(callback) {
    if (scanning) return;

    endCallback = typeof callback === "function" ? callback : null;

    overlay.classList.remove("hidden");
    document.body.classList.add("scanner-active");

    const ok = await startCamera();
    if (!ok) return;

    startDecoding();
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */

  window.startScannerInterno1 = function (cb) {
    startScanner(cb);
  };

  window.startScannerExternoPreferido = function (cb) {
    startScanner(cb);
  };
})();
