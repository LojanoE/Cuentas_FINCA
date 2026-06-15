import { auth, db, logoutUser } from "./auth.js";
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
          <div style="font-size:0.85rem; color:#666;">${escapeHtml(worker.phone || "Sin teléfono")}</div>
        </div>
        <div class="worker-balance">$${formatMoney(balance)}</div>
      `;
      li.addEventListener("click", () => openDetailModal(workerId, worker.name, balance));
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
  const uid = document.getElementById("wUid").value.trim();
  const email = document.getElementById("wEmail").value.trim();
  const phone = document.getElementById("wPhone").value.trim();
  const notes = document.getElementById("wNotes").value.trim();

  if (!uid) {
    showMessage(workerFormMessage, "Debes ingresar el UID del usuario.", "error");
    return;
  }

  try {
    showMessage(workerFormMessage, "Vinculando trabajador...", "info");

    // Verificar que no exista ya
    const existingWorker = await getDoc(doc(db, "workers", uid));
    if (existingWorker.exists()) {
      showMessage(workerFormMessage, "Ya existe un trabajador vinculado a ese UID.", "error");
      return;
    }

    // Guardar documento de usuario con rol worker
    await setDoc(doc(db, "users", uid), {
      email,
      name,
      role: "worker",
      createdAt: serverTimestamp(),
      createdBy: adminUser.uid
    });

    // Crear documento del trabajador
    await setDoc(doc(db, "workers", uid), {
      name,
      phone,
      notes,
      userId: uid,
      createdAt: serverTimestamp(),
      createdBy: adminUser.uid
    });

    showMessage(workerFormMessage, "Trabajador vinculado correctamente.", "success");
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

let currentDetailUnsubscribe = null;

window.openDetailModal = async function(workerId, name, balance) {
  detailModal.classList.add("active");
  detailName.textContent = name;
  detailBalance.textContent = "$" + formatMoney(balance);
  detailWorkerId.value = workerId;

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
      userId: workerId,
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
