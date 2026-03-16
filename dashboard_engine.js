/* ============================================================
   DASHBOARD ENGINE V5 — Chart.js + Modo día/noche + UI V5
   ============================================================ */

let chartInstance = null;

/* ------------------------------------------------------------
   Construir dataset según modo seleccionado
------------------------------------------------------------ */
function buildDataset(items, modo) {
  const map = new Map();

  items.forEach((it) => {
    if (!it.talles) return;

    if (modo === "talle") {
      it.talles.forEach((t) => {
        const key = String(t.talle || "—");
        const val = Number(t.stock || 0);
        map.set(key, (map.get(key) || 0) + val);
      });
    }

    if (modo === "marca") {
      const key = String(it.marca || "—");
      const total = it.talles.reduce((a, t) => a + Number(t.stock || 0), 0);
      map.set(key, (map.get(key) || 0) + total);
    }

    if (modo === "rubro") {
      const key = String(it.rubro || "—");
      const total = it.talles.reduce((a, t) => a + Number(t.stock || 0), 0);
      map.set(key, (map.get(key) || 0) + total);
    }
  });

  const labels = [...map.keys()];
  const values = [...map.values()];

  return { labels, values };
}

/* ------------------------------------------------------------
   Crear colores dinámicos
------------------------------------------------------------ */
function generarColores(n) {
  const base = [
    "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#f59e0b", "#84cc16", "#10b981", "#14b8a6",
    "#06b6d4", "#0ea5e9", "#22d3ee", "#a855f7", "#e879f9"
  ];

  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(base[i % base.length]);
  }
  return out;
}

/* ------------------------------------------------------------
   Renderizar gráfico
------------------------------------------------------------ */
function renderChart(labels, values, tipo) {
  const ctx = document.getElementById("chart-canvas");
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const colores = generarColores(labels.length);

  chartInstance = new Chart(ctx, {
    type: tipo,
    data: {
      labels,
      datasets: [
        {
          label: "Stock",
          data: values,
          backgroundColor: colores,
          borderColor: colores,
          borderWidth: 1.5,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: document.body.classList.contains("light-mode")
              ? "#111"
              : "#e5e7eb"
          }
        }
      },
      scales: tipo === "pie" || tipo === "doughnut" || tipo === "polarArea"
        ? {}
        : {
            x: {
              ticks: {
                color: document.body.classList.contains("light-mode")
                  ? "#111"
                  : "#e5e7eb"
              }
            },
            y: {
              ticks: {
                color: document.body.classList.contains("light-mode")
                  ? "#111"
                  : "#e5e7eb"
              }
            }
          }
    }
  });
}

/* ------------------------------------------------------------
   Actualizar dashboard
------------------------------------------------------------ */
function actualizarDashboard(items) {
  try {
    const modo = document.getElementById("chart-mode")?.value || "talle";
    const tipo = document.querySelector(".chart-type-btn.active")?.dataset.chartType || "pie";

    const { labels, values } = buildDataset(items, modo);

    renderChart(labels, values, tipo);
  } catch (e) {
    console.warn("Error actualizando dashboard:", e);
  }
}

/* ------------------------------------------------------------
   Inicializar listeners
------------------------------------------------------------ */
window.addEventListener("DOMContentLoaded", () => {
  const chartMode = document.getElementById("chart-mode");
  const typeButtons = document.querySelectorAll(".chart-type-btn");

  chartMode?.addEventListener("change", () => {
    if (window.appCore?.state?.items) {
      actualizarDashboard(window.appCore.state.items);
    }
  });

  typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      typeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (window.appCore?.state?.items) {
        actualizarDashboard(window.appCore.state.items);
      }
    });
  });
});

/* ------------------------------------------------------------
   Exponer función global
------------------------------------------------------------ */
window.actualizarDashboard = actualizarDashboard;
