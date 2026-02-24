/* ============================================================
   SCANNER V7 — BarcodeDetector + Autofocus + AutoExposure
   + Overlay + Motion Refocus + Fast CODE_128
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

  let lastFrameData = null;
  let lastMotionTime = 0;
  const MOTION_THRESHOLD = 18;
  const MOTION_REFOCUS_INTERVAL = 1200;

  const overlay = document.getElementById("scanner-overlay");
  const video = document.getElementById("scanner-video");
  const focusRing = document.getElementById("focus-ring");

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

  function createControls() {
    if (!overlay || document.querySelector(".scanner-controls")) return;

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

  function getVideoTrack() {
    if (!video || !video.srcObject) return null;
    const tracks = video.srcObject.getVideoTracks();
    return tracks && tracks[0] ? tracks[0] : null;
  }

  async function toggleTorch() {
    const track = getVideoTrack();
    if (!track) return;

    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) {
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

  async function applyZoom() {
    const track = getVideoTrack();
    if (!track) return;

    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.zoom) {
      window.appCore?.showToast?.("Zoom no soportado");
      return;
    }

    maxZoom = caps.zoom.max || 1;
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
     TAP-TO-FOCUS + ANIMACIÓN
     ============================================================ */
  async function tapToFocus(normX, normY, px, py) {
    const track = getVideoTrack();
    if (!track || !track.getCapabilities) return;

    const caps = track.getCapabilities();

    if (!caps.focusMode || !caps.focusPointX || !caps.focusPointY) {
      console.warn("Tap-to-focus no soportado");
      return;
    }

    if (focusRing) {
      focusRing.style.left = `${px}px`;
      focusRing.style.top = `${py}px`;
      focusRing.style.opacity = "1";
      focusRing.style.transform = "translate(-50%, -50%) scale(1.2)";

      setTimeout(() => {
        focusRing.style.opacity = "0";
        focusRing.style.transform = "translate(-50%, -50%) scale(1)";
      }, 300);
    }

    try {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: "manual",
            focusPointX: normX,
            focusPointY: normY
          }
        ]
      });

      setTimeout(() => {
        track.applyConstraints({
          advanced: [{ focusMode: "continuous" }]
        });
      }, 1200);

    } catch (e) {
      console.warn("Error aplicando tap-to-focus:", e);
    }
  }

  /* ============================================================
     AUTOFOCUS + AUTOEXPOSURE LOOP
     ============================================================ */
  async function autoFocusExposureLoop() {
    const track = getVideoTrack();
    if (!track || !track.getCapabilities) return;

    const caps = track.getCapabilities();
    const constraints = { advanced: [] };

    if (caps.focusMode && caps.focusMode.includes("continuous")) {
      constraints.advanced.push({ focusMode: "continuous" });
    }

    if (caps.exposureMode && caps.exposureMode.includes("continuous")) {
      constraints.advanced.push({ exposureMode: "continuous" });
    }

    if (caps.exposureCompensation) {
      const mid = (caps.exposureCompensation.min + caps.exposureCompensation.max) / 2;
      constraints.advanced.push({ exposureCompensation: mid });
    }

    try {
      if (constraints.advanced.length > 0) {
        await track.applyConstraints(constraints);
      }
    } catch (e) {
      console.warn("AutoFocus/Exposure error:", e);
    }

    if (scanning) {
      setTimeout(autoFocusExposureLoop, 2200);
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
          exposureMode: "continuous"
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
    lastFrameData = null;
    lastMotionTime = 0;

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

      // --- DETECCIÓN DE MOVIMIENTO PARA RE-ENFOQUE ---
      try {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (lastFrameData) {
          let diff = 0;
          const step = 16;
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
      } catch (e) {
        // no romper si algo falla
      }

      try {
        const barcodes = await detector.detect(canvas);
        if (barcodes && barcodes.length > 0) {
          // Priorizar CODE_128 si está presente
          let best = barcodes[0];

          for (const b of barcodes) {
            const fmt = (b.format || b.formatName || "").toLowerCase();
            if (fmt.includes("code_128")) {
              best = b;
              break;
            }
          }

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

    autoFocusExposureLoop();
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

    if (video) {
      video.onclick = (ev) => {
        const rect = video.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width;
        const y = (ev.clientY - rect.top) / rect.height;
        tapToFocus(x, y, ev.clientX, ev.clientY);
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
