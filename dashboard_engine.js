// ============================================================
// DASHBOARD ENGINE — Gráficos por talle / marca / rubro
// Versión optimizada + selector de tipo de gráfico (Opción C)
// ============================================================

let stockChart = null;

// ------------------------------------------------------------
// PREPARAR DATOS SEGÚN AGRUPACIÓN
// ------------------------------------------------------------
function prepararDatos(items, modo) {
  const conteo = {};

  for (const item of items || []) {
    if (modo === "talle") {
      if (Array.isArray(item.talles)) {
        for (const t of item.talles) {
          const talle = t.talle ?? "—";
          const cant = Number(t.stock || 0);
          if (!conteo[talle]) conteo[talle] = 0;
          conteo[talle] += cant;
        }
      }
    }

    else if (modo === "marca") {
      const m = item.marca?.trim() || "Sin marca";
      const total = (item.talles || []).reduce(
        (acc, t) => acc + Number(t.stock || 0),
        0
      );
      if (!conteo[m]) conteo[m] = 0;
      conteo[m] += total;
    }

    else if (modo === "rubro") {
      const r = item.rubro?.trim() || "Sin rubro";
      const total = (item.talles || []).reduce(
        (acc, t) => acc + Number(t.stock || 0),
        0
      );
      if (!conteo[r]) conteo[r] = 0;
      conteo[r] += total;
    }
  }

  // Ordenar de mayor a menor
  const zipped = Object.entries(conteo)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    labels: zipped.map((z) => z.label),
    valores: zipped.map((z) => z.value),
  };
}

// ------------------------------------------------------------
// ACTUALIZAR DASHBOARD
// ------------------------------------------------------------
function actualizarDashboard(items) {
  const modoSelect = document.getElementById("chart-mode");
  const canvas = document.getElementById("stockChart");

  if (!canvas || !modoSelect) return;

  const modo = modoSelect.value || "talle";

  // Tipo de gráfico seleccionado
  let tipo = "pie";
  const activeBtn = document.querySelector("[data-chart-type].active");
  if (activeBtn) tipo = activeBtn.dataset.chartType;

  // Ajuste responsive
  canvas.style.width = "100%";
  canvas.style.height = "100%";

  const { labels, valores } = prepararDatos(items, modo);

  // Si no hay datos → destruir gráfico
  if (!labels.length || !valores.length) {
    if (stockChart) {
      try { stockChart.destroy(); } catch (_) {}
      stockChart = null;
    }
    return;
  }

  // Destruir gráfico previo
  if (stockChart) {
    try { stockChart.destroy(); } catch (_) {}
  }

  const isLight = document.body.classList.contains("light-mode");
  const textColor = isLight ? "#111827" : "#e5e7eb";

  stockChart = new Chart(canvas, {
    type: tipo,
    data: {
      labels,
      datasets: [
        {
          label: "Unidades",
          data: valores,
          backgroundColor: generarColores(labels.length),
          borderColor: isLight ? "#000" : "#fff",
          borderWidth: 1,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: textColor,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed || 0;
              return ` ${v.toLocaleString("es-AR")} unidades`;
            },
          },
        },
      },
      scales:
        tipo !== "pie" && tipo !== "doughnut" && tipo !== "polarArea"
          ? {
              x: {
                ticks: { color: textColor, maxRotation: 45 },
                grid: { color: isLight ? "#e5e7eb" : "#374151" },
              },
              y: {
                ticks: { color: textColor },
                grid: { color: isLight ? "#e5e7eb" : "#374151" },
              },
            }
          : {},
    },
  });
}

// ------------------------------------------------------------
// GENERAR PALETA DE COLORES
// ------------------------------------------------------------
function generarColores(n) {
  const colores = [];
  for (let i = 0; i < n; i++) {
    const h = Math.floor((360 / Math.max(n, 1)) * i);
    colores.push(`hsl(${h}, 70%, 55%)`);
  }
  return colores;
}

// ------------------------------------------------------------
// EVENTOS: CAMBIO DE AGRUPACIÓN Y TIPO DE GRÁFICO
// ------------------------------------------------------------

// Cambio de agrupación (talle / marca / rubro)
document.getElementById("chart-mode")?.addEventListener("change", () => {
  if (window.appCore?.state?.items) {
    actualizarDashboard(window.appCore.state.items);
  }
});

// Botones de tipo de gráfico (torta, barra, líneas, doughnut, polar)
const chartTypeButtons = document.querySelectorAll("[data-chart-type]");

chartTypeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    chartTypeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (window.appCore?.state?.items) {
      actualizarDashboard(window.appCore.state.items);
    }
  });
});

// ------------------------------------------------------------
// REACTIVIDAD CON MODO DÍA / NOCHE
// ------------------------------------------------------------
const toggleDark = document.getElementById("toggle-dark");
if (toggleDark) {
  toggleDark.addEventListener("change", () => {
    if (window.appCore?.state?.items) {
      actualizarDashboard(window.appCore.state.items);
    }
  });
}

// ------------------------------------------------------------
// EXPONER FUNCIÓN GLOBAL
// ------------------------------------------------------------
window.actualizarDashboard = actualizarDashboard;
