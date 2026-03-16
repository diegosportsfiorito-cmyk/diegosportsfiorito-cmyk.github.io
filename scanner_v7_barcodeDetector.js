/* ============================================================
   SCANNER V7 — BarcodeDetector + autofocus + zoom persistente
   ============================================================ */

(function () {
  let video = null;
  let canvas = null;
  let ctx = null;
  let stream = null;
  let detector = null;

  let scanning = false;
  let endCallback = null;
  let scannerMode = "simple";

  let zoomLevel = 1;
  let maxZoom = 1;

  let multiMode = false;
  let detectedCodes = [];

  let lastFrameData = null;
  let lastMotionTime = 0;

  const MOTION_THRESHOLD = 25;
  const MOTION_REFOCUS_INTERVAL = 1200;

  const overlay = document.getElementById("scanner-overlay");

  /* ------------------------------------------------------------
     Crear controles dinámicos
  ------------------------------------------------------------ */
  function createControls() {
    const old = document.getElementById("scanner-controls");
    if (old) old.remove();

    const ctr = document.createElement("div");
    ctr.id = "scanner-controls";
    ctr.className = "scanner-controls";

    ctr.innerHTML = `
      <button id="scn-torch" class="scanner-btn">🔦</button>
      <button id="scn-zoom-out" class="scanner-btn">➖</button>
      <button id="scn-zoom-in" class="scanner-btn">➕</button>
      <button id="scn-multi" class="scanner-btn">📋</button>
      <button id="scn-close" class="scanner-btn-danger">✖</button>
      <div id="scn-counter" class="scanner-counter">0</div>
    `;

    overlay.appendChild(ctr);
  }

  function updateControls() {
    const counter = document.getElementById("scn-counter");
    if (!counter) return;

    if (multiMode) {
      counter.textContent = detectedCodes.length;
      counter.classList.add("open");
    } else {
      counter.classList.remove("open");
    }
  }

  /* ------------------------------------------------------------
     Torch
  ------------------------------------------------------------ */
  async function toggleTorch() {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.();
    if (!caps || !caps.torch) {
      window.appCore?.showToast?.("Linterna no soportada");
      return;
    }

    const settings = track.getSettings();
    const newTorch = !settings.torch;

    try {
      await track.applyConstraints({ advanced: [{ torch: newTorch }] });
    } catch (e) {
      console.warn("Torch error:", e);
    }
  }

  /* ------------------------------------------------------------
     Zoom persistente
  ------------------------------------------------------------ */
  async function applyZoom() {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.();
    if (!caps || !caps.zoom) return;

    if (!applyZoom._step) {
      applyZoom._step = (caps.zoom.max - caps.zoom.min) / 8;
    }

    maxZoom = caps.zoom.max;
    zoomLevel = Math.max(caps.zoom.min, Math.min(zoomLevel, caps.zoom.max));

    try {
      await track.applyConstraints({ advanced: [{ zoom: zoomLevel }] });
      localStorage.setItem("scannerZoom", zoomLevel);
    } catch (e) {
      console.warn("Zoom error:", e);
    }
  }

  /* ------------------------------------------------------------
     Tap to focus
  ------------------------------------------------------------ */
  async function tapToFocus(x, y, px, py) {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.();
    if (!caps || !caps.focusMode || !caps.focusMode.includes("single-shot")) return;

    try {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: "single-shot",
            pointsOfInterest: [{ x, y }]
          }
        ]
      });

      const ring = document.getElementById("focus-ring");
      if (ring) {
        ring.style.left = px - 40 + "px";
        ring.style.top = py - 40 + "px";
        ring.classList.add("active");
        setTimeout(() => ring.classList.remove("active"), 600);
      }
    } catch (e) {
      console.warn("Tap focus error:", e);
    }
  }

  /* ------------------------------------------------------------
     Autofocus + Autoexposure loop
  ------------------------------------------------------------ */
  async function autoFocusExposureLoop() {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.();

    if (!caps) return;

    const constraints = { advanced: [] };

    if (caps.focusMode?.includes("continuous")) {
      constraints.advanced.push({ focusMode: "continuous" });
    }
    if (caps.exposureMode?.includes("continuous")) {
      constraints.advanced.push({ exposureMode: "continuous" });
    }

    try {
      await track.applyConstraints(constraints);
    } catch (e) {
      console.warn("Auto-focus/exposure error:", e);
    }
  }

  /* ------------------------------------------------------------
     Iniciar cámara
  ------------------------------------------------------------ */
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      video.srcObject = stream;
      await video.play();

      const savedZoom = Number(localStorage.getItem("scannerZoom") || 1);
      zoomLevel = savedZoom;

      return true;
    } catch (e) {
      console.warn("Camera error:", e);
      window.appCore?.showToast?.("No se pudo acceder a la cámara");
      return false;
    }
  }

  /* ------------------------------------------------------------
     Decodificación
  ------------------------------------------------------------ */
  async function startDecoding() {
    if (!("BarcodeDetector" in window)) {
      window.appCore?.showToast?.("BarcodeDetector no soportado");
      return;
    }

    detector = new BarcodeDetector({
      formats: [
        "code_128",
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "code_39",
        "qr_code"
      ]
    });

    scanning = true;

    function loop() {
      if (!scanning) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        requestAnimationFrame(loop);
        return;
      }

      /* --------------------------------------------------------
         DETECCIÓN DE MOVIMIENTO PARA RE-ENFOQUE
      -------------------------------------------------------- */
      try {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (lastFrameData) {
          let diff = 0;
          const step = 24;

          for (let i = 0; i < frame.data.length; i += 4 * step) {
            const d =
              Math.abs(frame.data[i] - lastFrameData.data[i]) +
              Math.abs(frame.data[i + 1] - lastFrameData.data[i + 1]) +
              Math.abs(frame.data[i + 2] - lastFrameData.data[i + 2]);
            diff += d;
          }

          const avgDiff = diff / (frame.data.length / (4 * step));
          const now = Date.now();

          if (
            avgDiff > MOTION_THRESHOLD &&
            now - lastMotionTime > MOTION_REFOCUS_INTERVAL
          ) {
            lastMotionTime = now;
            autoFocusExposureLoop();
          }
        }
        lastFrameData = frame;
      } catch {}

      /* --------------------------------------------------------
         DETECCIÓN DE CÓDIGOS
      -------------------------------------------------------- */
      detector
        .detect(canvas)
        .then((barcodes) => {
          if (!barcodes || !barcodes.length) {
            requestAnimationFrame(loop);
            return;
          }

          let best = barcodes[0];

          for (const b of barcodes) {
            const fmt = (b.format || b.formatName || "").toLowerCase();
            if (fmt.includes("code_128")) {
              best = b;
              break;
            }
          }

          if (best.rawValue) {
            const fmt = (best.format || best.formatName || "").toLowerCase();
            handleDetected(best.rawValue, fmt);
          }

          requestAnimationFrame(loop);
        })
        .catch((e) => {
          console.warn("BarcodeDetector error:", e);
          requestAnimationFrame(loop);
        });
    }

    loop();
  }

  /* ------------------------------------------------------------
     Manejo de detección
  ------------------------------------------------------------ */
  function handleDetected(code, fmt) {
    if (multiMode) {
      if (!detectedCodes.includes(code)) {
        detectedCodes.push(code);
        updateControls();
        window.appCore?.showToast?.(`+ ${code}`);
      }
      return;
    }

    if (typeof endCallback === "function") {
      endCallback(code, fmt);
    }

    closeScanner();
  }

  /* ------------------------------------------------------------
     Cerrar scanner
  ------------------------------------------------------------ */
  function closeScanner() {
    scanning = false;

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    overlay.classList.remove("open");
    document.body.classList.remove("scanner-active");
  }
  /* ------------------------------------------------------------
     Iniciar scanner
  ------------------------------------------------------------ */
  async function startScanner(callback, mode) {
    if (scanning) return;

    endCallback = typeof callback === "function" ? callback : null;
    scannerMode = mode === "completo" ? "completo" : "simple";

    overlay.classList.add("open");
    document.body.classList.add("scanner-active");

    createControls();

    multiMode = false;
    detectedCodes = [];
    updateControls();

    const ok = await startCamera();
    if (!ok) return;

    autoFocusExposureLoop();
    await applyZoom();

    startDecoding();

    const btnTorch = document.getElementById("scn-torch");
    const btnZoomIn = document.getElementById("scn-zoom-in");
    const btnZoomOut = document.getElementById("scn-zoom-out");
    const btnClose = document.getElementById("scn-close");
    const btnMulti = document.getElementById("scn-multi");

    btnTorch.onclick = toggleTorch;

    btnZoomIn.onclick = () => {
      const step = applyZoom._step || 0.3;
      zoomLevel += step;
      applyZoom();
    };

    btnZoomOut.onclick = () => {
      const step = applyZoom._step || 0.3;
      zoomLevel -= step;
      applyZoom();
    };

    btnClose.onclick = () => {
      closeScanner();
      if (typeof endCallback === "function") endCallback(null);
    };

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

    video.onclick = (ev) => {
      const rect = video.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;
      tapToFocus(x, y, ev.clientX, ev.clientY);
    };
  }

  /* ------------------------------------------------------------
     EXPORTS
  ------------------------------------------------------------ */
  window.startScannerInterno1 = function (cb, mode) {
    startScanner(cb, mode === "completo" ? "completo" : "simple");
  };

  window.startScannerExternoPreferido = function (cb) {
    startScanner(cb, "completo");
  };
})();
