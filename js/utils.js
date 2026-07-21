// === UTILIDADES COMPARTIDAS ===
// Funciones reutilizadas en admin.js y worker.js.

export const PAGE_SIZE = 50;

// Formatea un número como moneda en pesos colombianos (sin decimales).
export function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

// Convierte una fecha ISO (yyyy-mm-dd) a formato legible dd/mm/yyyy.
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// Escapa texto para insertarlo de forma segura en innerHTML.
export function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

// Muestra un mensaje en un elemento con clase .message.
export function showMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = "message " + type;
  element.classList.remove("hidden");
}

// Oculta un mensaje.
export function hideMessage(element) {
  if (!element) return;
  element.classList.add("hidden");
  element.textContent = "";
}

// Valida un número de celular: 8 a 15 dígitos, solo números.
export function validatePhone(phone) {
  return /^\d{8,15}$/.test(phone || "");
}

// Formatea un teléfono para mostrarlo de forma legible.
export function formatPhoneDisplay(phone) {
  if (!phone) return "Sin teléfono";
  const digits = String(phone);
  if (digits.length <= 4) return digits;
  // Agrupa de a 3-4 dígitos para legibilidad.
  return digits.replace(/(\d{2,4})(?=\d)/g, "$1 ");
}

// Devuelve una función debounce.
export function debounce(fn, ms = 150) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Ejecuta una acción async sobre un botón mostrando un spinner.
// Restaura el botón al terminar y devuelve el resultado de la acción.
export async function withLoading(button, action) {
  if (!button) return action();
  const originalHTML = button.innerHTML;
  const wasDisabled = button.disabled;
  button.disabled = true;
  button.classList.add("btn-loading");
  button.setAttribute("aria-busy", "true");
  try {
    return await action();
  } finally {
    button.disabled = wasDisabled;
    button.classList.remove("btn-loading");
    button.removeAttribute("aria-busy");
    button.innerHTML = originalHTML;
  }
}

// Inicializa el modo oscuro según preferencia guardada o sistema.
export function initTheme(toggleBtn) {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  if (toggleBtn) {
    updateThemeIcon(toggleBtn, theme);
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      updateThemeIcon(toggleBtn, next);
    });
  }
}

function updateThemeIcon(btn, theme) {
  btn.textContent = theme === "dark" ? "☀️" : "🌙";
  btn.setAttribute("aria-label",
    theme === "dark" ? "Activar modo claro" : "Activar modo oscuro");
}

// Cierra modales con la tecla Escape.
export function initModalEscape() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector(".modal-overlay.active");
    if (!open) return;
    const closer = open.querySelector(".close-btn");
    if (closer) closer.click();
  });
}

// Mueve el foco al primer elemento enfocable de un contenedor.
export function focusFirst(container) {
  if (!container) return;
  const target = container.querySelector(
    "input, select, textarea, button:not([disabled])"
  );
  if (target) target.focus();
}