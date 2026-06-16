// CONTRASEÑA DE ADMINISTRADOR
const ADMIN_PASSWORD = "Mirador1";

// === LOGIN ADMIN ===
const adminForm = document.getElementById("adminLoginForm");

adminForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const password = document.getElementById("adminPassword").value;

  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem("isAdmin", "true");
    window.location.href = "admin.html";
  } else {
    showMessage("Contraseña incorrecta.", "error");
  }
});

// === CERRAR SESIÓN ===
export function logoutUser() {
  sessionStorage.removeItem("isAdmin");
  window.location.href = "index.html";
}

// === VERIFICAR SESIÓN ADMIN ===
export function isAdminLoggedIn() {
  return sessionStorage.getItem("isAdmin") === "true";
}

function showMessage(text, type) {
  const msg = document.getElementById("message");
  if (msg) {
    msg.textContent = text;
    msg.className = "message " + type;
    msg.classList.remove("hidden");
  }
}
