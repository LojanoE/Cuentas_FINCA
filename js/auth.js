// CONTRASEÑA DE ADMINISTRADOR
import { showMessage } from "./utils.js";
const ADMIN_PASSWORD = "123";

// === LOGIN ADMIN ===
const adminForm = document.getElementById("adminLoginForm");

adminForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const password = document.getElementById("adminPassword").value;
  const remember = document.getElementById("rememberMe")?.checked;

  if (password === ADMIN_PASSWORD) {
    setAdminSession(remember);
    window.location.href = "admin.html";
  } else {
    showMessage(document.getElementById("message"), "Contraseña incorrecta.", "error");
  }
});

// Guarda la sesión en el almacenamiento indicado según preferencia.
function setAdminSession(remember) {
  // Limpia ambos storages para evitar duplicados.
  sessionStorage.removeItem("isAdmin");
  localStorage.removeItem("isAdmin");
  if (remember) {
    localStorage.setItem("isAdmin", "true");
  } else {
    sessionStorage.setItem("isAdmin", "true");
  }
}

// === CERRAR SESIÓN ===
export function logoutUser() {
  sessionStorage.removeItem("isAdmin");
  localStorage.removeItem("isAdmin");
  window.location.href = "index.html";
}

// === VERIFICAR SESIÓN ADMIN ===
export function isAdminLoggedIn() {
  return sessionStorage.getItem("isAdmin") === "true" ||
    localStorage.getItem("isAdmin") === "true";
}
