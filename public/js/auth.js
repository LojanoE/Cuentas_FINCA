import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// === LOGIN ===
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const msg = document.getElementById("message");

    try {
      msg.textContent = "Iniciando sesión...";
      msg.className = "message info";
      await signInWithEmailAndPassword(auth, email, password);
      // Redirección se maneja en onAuthStateChanged
    } catch (error) {
      msg.textContent = "Error: " + translateError(error.code);
      msg.className = "message error";
    }
  });
}

// === REDIRECCIÓN SEGÚN ROL ===
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // No hay sesión activa
    const publicPages = ["/", "/index.html"];
    if (!publicPages.includes(window.location.pathname)) {
      window.location.href = "index.html";
    }
    return;
  }

  // Hay sesión activa: verificar rol
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Usuario autenticado pero sin rol asignado
    if (window.location.pathname !== "/index.html") {
      window.location.href = "index.html";
    }
    showMessage("Tu cuenta no tiene permisos asignados. Contacta al administrador.");
    await signOut(auth);
    return;
  }

  const role = userSnap.data().role;

  // Redirigir según la página actual
  const path = window.location.pathname;
  if (role === "admin") {
    if (path === "/" || path === "/index.html") {
      window.location.href = "admin.html";
    }
  } else if (role === "worker") {
    if (path === "/" || path === "/index.html" || path === "/admin.html") {
      window.location.href = "worker.html";
    }
  } else {
    // Rol desconocido
    await signOut(auth);
    window.location.href = "index.html";
  }
});

// === CERRAR SESIÓN ===
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

// === TRADUCCIÓN DE ERRORES ===
function translateError(code) {
  const errors = {
    "auth/invalid-email": "Correo no válido.",
    "auth/user-disabled": "Esta cuenta fue deshabilitada.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos."
  };
  return errors[code] || "Ocurrió un error. Intenta de nuevo.";
}

function showMessage(text) {
  const msg = document.getElementById("message");
  if (msg) {
    msg.textContent = text;
    msg.className = "message error";
  }
}

export { auth, db, signOut };
