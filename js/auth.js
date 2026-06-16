import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// === UTILIDAD: Hashear con SHA-256 ===
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// === SELECTOR DE TIPO DE USUARIO ===
const userTypeSelect = document.getElementById("userType");
const adminForm = document.getElementById("adminLoginForm");
const workerForm = document.getElementById("workerLoginForm");

if (userTypeSelect) {
  userTypeSelect.addEventListener("change", (e) => {
    if (e.target.value === "admin") {
      adminForm.classList.remove("hidden");
      workerForm.classList.add("hidden");
    } else {
      adminForm.classList.add("hidden");
      workerForm.classList.remove("hidden");
    }
  });
}

// === LOGIN ADMIN (Firebase Auth) ===
adminForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  try {
    showMessage("Iniciando sesión...", "info");
    await signInWithEmailAndPassword(auth, email, password);
    // La redirección la maneja onAuthStateChanged
  } catch (error) {
    showMessage("Error: " + translateError(error.code), "error");
  }
});

// === LOGIN TRABAJADOR (Firestore) ===
workerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("workerUsername").value.trim();
  const password = document.getElementById("workerPassword").value;

  if (!username || !password) {
    showMessage("Ingresa usuario y contraseña.", "error");
    return;
  }

  try {
    showMessage("Verificando...", "info");
    const passwordHash = await hashPassword(password);

    const q = query(
      collection(db, "workers"),
      where("username", "==", username),
      where("passwordHash", "==", passwordHash)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      showMessage("Usuario o contraseña incorrectos.", "error");
      return;
    }

    const workerDoc = snapshot.docs[0];
    const worker = workerDoc.data();

    // Guardar sesión de trabajador
    sessionStorage.setItem("workerId", workerDoc.id);
    sessionStorage.setItem("workerName", worker.name || "");
    sessionStorage.setItem("isWorker", "true");

    window.location.href = "worker.html";
  } catch (error) {
    showMessage("Error: " + error.message, "error");
  }
});

// === REDIRECCIÓN SEGÚN ROL DE ADMIN ===
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    // Verificar si es admin
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await signOut(auth);
      showMessage("Tu cuenta no está registrada como administrador en Firestore.", "error");
      return;
    }

    if (userSnap.data().role !== "admin") {
      await signOut(auth);
      showMessage("No tienes permisos de administrador.", "error");
      return;
    }

    // Si está en el login, redirigir al admin
    const path = window.location.pathname;
    if (path === "/" || path === "/index.html") {
      window.location.href = "admin.html";
    }
  } catch (error) {
    await signOut(auth);
    showMessage("Error de Firestore: " + error.message, "error");
  }
});

// === CERRAR SESIÓN ===
export async function logoutUser() {
  sessionStorage.removeItem("workerId");
  sessionStorage.removeItem("workerName");
  sessionStorage.removeItem("isWorker");
  try {
    await signOut(auth);
  } catch (error) {
    // Puede fallar si no hay usuario de Firebase (trabajador), ignorable
  }
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

function showMessage(text, type) {
  const msg = document.getElementById("message");
  if (msg) {
    msg.textContent = text;
    msg.className = "message " + type;
    msg.classList.remove("hidden");
  }
}

export { auth, db, signOut };
