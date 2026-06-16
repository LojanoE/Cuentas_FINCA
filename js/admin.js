import { auth, db, logoutUser, hashPassword } from "./auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Actualizar email del admin en el header
const adminEmailSpan = document.getElementById("adminEmail");
auth.onAuthStateChanged((user) => {
  if (user && adminEmailSpan) {
    adminEmailSpan.textContent = user.email;
  }
});

// Cerrar sesión
document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);

// === LISTA DE TRABAJADORES ===
const workerList = document.getElementById("workerList");
const workerMessage = document.getElementById("workerMessage");

function loadWorkers() {
  if (!workerList) return;

  const workersQuery = query(collection(db, "workers"), orderBy("name"));

  onSnapshot(workersQuery, async (snapshot) => {
    workerList.innerHTML = "";

    if (snapshot.empty) {
      workerList.innerHTML = "<li class='worker-item'>No hay trabajadores registrados.</li>";
      return;
    }

    for (const docSnap of snapshot.docs) {
      const worker = docSnap.data();
      const workerId = docSnap.id;
      const balance = await getWorkerBalance(workerId);

      const li = document.createElement("li");
      li.className = "worker-item";
      li.innerHTML = `
        <div>
          <div class="worker-name">${escapeHtml(worker.name)}</div>
          <div style="font-size:0.85rem; color:#666;">@${escapeHtml(worker.username || "")}</div>
        </div>
        <div class="worker-balance">$${formatMoney(balance)}</div>
      `;
      li.addEventListener("click", () => openDetailModal(workerId, worker.name, balance, worker.phone, worker.username));
      workerList.appendChild(li);
    }
  }, (error) => {
    showMessage(workerMessage, "Error cargando trabajadores: " + error.message, "error");
  });
}

async function getWorkerBalance(workerId) {
  const q = query(collection(db, "advances"), where("workerId", "==", workerId));
  const snapshot = await getDocs(q);
  let total = 0;
  snapshot.forEach((docSnap) => {
    total += Number(docSnap.data().amount) || 0;
  });
  return total;
}

// === MODAL NUEVO TRABAJADOR ===
const workerModal = document.getElementById("workerModal");
const openWorkerModalBtn = document.getElementById("openWorkerModal");
const workerForm = document.getElementById("workerForm");
const workerFormMessage = document.getElementById("workerFormMessage");

openWorkerModalBtn?.addEventListener("click", () => {
  workerModal.classList.add("active");
});

window.closeWorkerModal = function() {
  workerModal.classList.remove("active");
  workerForm?.reset();
  hideMessage(workerFormMessage);
};

workerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const adminUser = auth.currentUser;
  if (!adminUser) {
    showMessage(workerFormMessage, "No hay sesión de administrador.", "error");
    return;
  }

  const name = document.getElementById("wName").value.trim();
  const username = document.getElementById("wUsername").value.trim().toLowerCase();
  const password = document.getElementById("wPassword").value;
  const phone = document.getElementById("wPhone").value.trim();
  const notes = document.getElementById("wNotes").value.trim();

  if (!name || !username || !password || !phone) {
    showMessage(workerFormMessage, "Completa todos los campos obligatorios.", "error");
    return;
  }

  try {
    showMessage(workerFormMessage, "Guardando trabajador...", "info");

    // Verificar que el usuario no exista
    const usernameQuery = query(collection(db, "workers"), where("username", "==", username));
    const usernameSnap = await getDocs(usernameQuery);
    if (!usernameSnap.empty) {
      showMessage(workerFormMessage, "Ese nombre de usuario ya está en uso.", "error");
      return;
    }

    const passwordHash = await hashPassword(password);
    const workerId = doc(collection(db, "workers")).id;

    await setDoc(doc(db, "workers", workerId), {
      name,
      username,
      passwordHash,
      phone,
      notes,
      createdAt: serverTimestamp(),
      createdBy: adminUser.uid
    });

    showMessage(workerFormMessage, "Trabajador creado correctamente.", "success");
    workerForm.reset();
  } catch (error) {
    showMessage(workerFormMessage, "Error: " + error.message, "error");
  }
});

// === MODAL DETALLE + ADELANTOS ===
const detailModal = document.getElementById("detailModal");
const detailName = document.getElementById("detailName");
const detailBalance = document.getElementById("detailBalance");
const detailWorkerId = document.getElementById("detailWorkerId");
const advanceForm = document.getElementById("advanceForm");
const advanceFormMessage = document.getElementById("advanceFormMessage");
const advancesTable = document.getElementById("advancesTable");
const whatsappBtn = document.getElementById("whatsappBtn");

let currentDetailUnsubscribe = null;
let currentWorkerPhone = "";
let currentWorkerUsername = "";

window.openDetailModal = async function(workerId, name, balance, phone, username) {
  detailModal.classList.add("active");
  detailName.textContent = name;
  detailBalance.textContent = "$" + formatMoney(balance);
  detailWorkerId.value = workerId;
  currentWorkerPhone = phone || "";
  currentWorkerUsername = username || "";

  // Fecha por defecto: hoy
  document.getElementById("aDate").valueAsDate = new Date();

  // Cargar adelantos en tiempo real
  if (currentDetailUnsubscribe) currentDetailUnsubscribe();

  const q = query(
    collection(db, "advances"),
    where("workerId", "==", workerId),
    orderBy("date", "desc")
  );

  currentDetailUnsubscribe = onSnapshot(q, (snapshot) => {
    advancesTable.innerHTML = "";
    let newBalance = 0;

    if (snapshot.empty) {
      advancesTable.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No hay adelantos registrados.</td></tr>";
    } else {
      snapshot.forEach((docSnap) => {
        const a = docSnap.data();
        newBalance += Number(a.amount) || 0;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${formatDate(a.date)}</td>
          <td>${escapeHtml(a.concept)}</td>
          <td class="text-right">$${formatMoney(a.amount)}</td>
        `;
        advancesTable.appendChild(tr);
      });
    }

    detailBalance.textContent = "$" + formatMoney(newBalance);
  }, (error) => {
    advancesTable.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Error cargando adelantos.</td></tr>";
  });
};

window.closeDetailModal = function() {
  detailModal.classList.remove("active");
  advanceForm?.reset();
  hideMessage(advanceFormMessage);
  currentWorkerPhone = "";
  currentWorkerUsername = "";
  if (currentDetailUnsubscribe) {
    currentDetailUnsubscribe();
    currentDetailUnsubscribe = null;
  }
};

advanceForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const workerId = detailWorkerId.value;
  const date = document.getElementById("aDate").value;
  const amount = parseFloat(document.getElementById("aAmount").value);
  const concept = document.getElementById("aConcept").value.trim();

  if (!workerId || !date || isNaN(amount) || amount <= 0 || !concept) {
    showMessage(advanceFormMessage, "Completa todos los campos correctamente.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "advances"), {
      workerId,
      date,
      amount,
      concept,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || ""
    });
    showMessage(advanceFormMessage, "Adelanto guardado correctamente.", "success");
    advanceForm.reset();
    document.getElementById("aDate").valueAsDate = new Date();
    document.getElementById("detailWorkerId").value = workerId;
  } catch (error) {
    showMessage(advanceFormMessage, "Error guardando adelanto: " + error.message, "error");
  }
});

// === BOTÓN WHATSAPP ===
whatsappBtn?.addEventListener("click", () => {
  if (!currentWorkerPhone) {
    showMessage(advanceFormMessage, "Este trabajador no tiene número de celular.", "error");
    return;
  }

  const url = window.location.origin + window.location.pathname.replace("admin.html", "index.html");
  const text = `Hola ${detailName.textContent}, tu cuenta en Cuentas FINCA ha sido creada.\n\nUsuario: ${currentWorkerUsername}\nIngresa aquí: ${url}\n\nEl administrador te dará la contraseña.`;
  const waLink = `https://wa.me/${currentWorkerPhone}?text=${encodeURIComponent(text)}`;
  window.open(waLink, "_blank");
});

// === UTILIDADES ===
function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = "message " + type;
  element.classList.remove("hidden");
}

function hideMessage(element) {
  if (!element) return;
  element.classList.add("hidden");
  element.textContent = "";
}

// Cargar lista inicial
loadWorkers();
