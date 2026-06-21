import { db } from "./firebase-config.js";
import { logoutUser, isAdminLoggedIn } from "./auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Verificar sesión de admin
if (!isAdminLoggedIn()) {
  window.location.href = "index.html";
}

// Cerrar sesión
document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);

// === LISTA DE TRABAJADORES ===
const workerList = document.getElementById("workerList");
const workerMessage = document.getElementById("workerMessage");
const reportWorker = document.getElementById("reportWorker");

const workerMap = new Map();

function loadWorkers() {
  if (!workerList) return;

  const workersQuery = query(collection(db, "workers"), orderBy("name"));

  onSnapshot(workersQuery, async (snapshot) => {
    workerList.innerHTML = "";
    workerMap.clear();

    // Mantener opción por defecto del filtro
    if (reportWorker) {
      reportWorker.innerHTML = '<option value="">Todos los trabajadores</option>';
    }

    if (snapshot.empty) {
      workerList.innerHTML = "<li class='worker-item'>No hay trabajadores registrados.</li>";
      return;
    }

    for (const docSnap of snapshot.docs) {
      const worker = docSnap.data();
      const workerId = docSnap.id;
      workerMap.set(workerId, worker);

      const balance = await getWorkerBalance(workerId);

      const li = document.createElement("li");
      li.className = "worker-item";
      li.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div class="worker-name">${escapeHtml(worker.name)}</div>
          <div style="font-size:0.85rem; color:#666;">${escapeHtml(worker.phone || "Sin teléfono")}</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="worker-balance">$${formatMoney(balance)}</div>
          <button class="btn btn-danger btn-small delete-worker-btn" data-id="${escapeHtml(workerId)}" title="Eliminar trabajador">🗑️</button>
        </div>
      `;
      li.addEventListener("click", (e) => {
        if (e.target.closest(".delete-worker-btn")) return;
        openDetailModal(workerId, worker.name, balance, worker.phone);
      });
      li.querySelector(".delete-worker-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteWorker(workerId, worker.name);
      });
      workerList.appendChild(li);

      // Llenar select del reporte
      if (reportWorker) {
        const option = document.createElement("option");
        option.value = workerId;
        option.textContent = worker.name;
        reportWorker.appendChild(option);
      }
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

// === REPORTE DE ADELANTOS ===
const reportFilterBtn = document.getElementById("reportFilterBtn");
const reportDateFrom = document.getElementById("reportDateFrom");
const reportDateTo = document.getElementById("reportDateTo");
const reportTable = document.getElementById("reportTable");
const reportTotal = document.getElementById("reportTotal");
const reportMessage = document.getElementById("reportMessage");

async function loadReport() {
  if (!reportTable || !reportTotal) return;

  const workerId = reportWorker?.value || "";
  const dateFrom = reportDateFrom?.value || "";
  const dateTo = reportDateTo?.value || "";

  reportTable.innerHTML = "";
  reportTotal.textContent = "$0";
  hideMessage(reportMessage);

  try {
    let advancesQuery;

    if (workerId) {
      // Filtrar por trabajador; ordenamos en memoria para no requerir otro índice compuesto
      advancesQuery = query(collection(db, "advances"), where("workerId", "==", workerId));
    } else {
      // Todos los adelantos ordenados por fecha
      advancesQuery = query(collection(db, "advances"), orderBy("date", "desc"));
    }

    const snapshot = await getDocs(advancesQuery);
    const rows = [];

    snapshot.forEach((docSnap) => {
      const a = docSnap.data();

      // Filtro por rango de fechas (client-side)
      if (dateFrom && a.date < dateFrom) return;
      if (dateTo && a.date > dateTo) return;

      const worker = workerMap.get(a.workerId) || { name: "Desconocido" };
      rows.push({
        name: worker.name,
        date: a.date,
        concept: a.concept,
        amount: Number(a.amount) || 0
      });
    });

    // Ordenar por fecha descendente
    rows.sort((a, b) => b.date.localeCompare(a.date));

    let total = 0;

    if (rows.length === 0) {
      reportTable.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No hay adelantos para los filtros seleccionados.</td></tr>";
    } else {
      rows.forEach((row) => {
        total += row.amount;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(row.name)}</td>
          <td>${formatDate(row.date)}</td>
          <td>${escapeHtml(row.concept)}</td>
          <td class="text-right">$${formatMoney(row.amount)}</td>
        `;
        reportTable.appendChild(tr);
      });
    }

    reportTotal.textContent = "$" + formatMoney(total);
  } catch (error) {
    showMessage(reportMessage, "Error cargando reporte: " + error.message, "error");
  }
}

reportFilterBtn?.addEventListener("click", loadReport);

async function deleteWorkerAdvances(workerId) {
  const q = query(collection(db, "advances"), where("workerId", "==", workerId));
  const snapshot = await getDocs(q);
  const deletes = [];
  snapshot.forEach((docSnap) => {
    deletes.push(deleteDoc(doc(db, "advances", docSnap.id)));
  });
  await Promise.all(deletes);
}

async function deleteWorker(workerId, workerName) {
  const confirmed = confirm(`¿Eliminar a ${workerName || "este trabajador"}?\n\nSe borrarán también todos sus adelantos. Esta acción no se puede deshacer.`);
  if (!confirmed) return;

  try {
    showMessage(workerMessage, "Eliminando trabajador...", "info");
    await deleteWorkerAdvances(workerId);
    await deleteDoc(doc(db, "workers", workerId));
    showMessage(workerMessage, "Trabajador eliminado correctamente.", "success");
    if (currentWorkerId === workerId) {
      closeDetailModal();
    }
  } catch (error) {
    showMessage(workerMessage, "Error eliminando trabajador: " + error.message, "error");
  }
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

  const name = document.getElementById("wName").value.trim();
  const phone = document.getElementById("wPhone").value.trim();
  const notes = document.getElementById("wNotes").value.trim();

  if (!name || !phone) {
    showMessage(workerFormMessage, "Completa todos los campos obligatorios.", "error");
    return;
  }

  try {
    showMessage(workerFormMessage, "Guardando trabajador...", "info");

    const workerId = doc(collection(db, "workers")).id;

    await setDoc(doc(db, "workers", workerId), {
      name,
      phone,
      notes,
      createdAt: serverTimestamp()
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
const deleteWorkerBtn = document.getElementById("deleteWorkerBtn");
const advanceWhatsappContainer = document.getElementById("advanceWhatsappContainer");
const advanceWhatsappBtn = document.getElementById("advanceWhatsappBtn");

let currentDetailUnsubscribe = null;
let lastAdvance = null;
let currentWorkerId = "";
let currentWorkerPhone = "";

window.openDetailModal = async function(workerId, name, balance, phone) {
  detailModal.classList.add("active");
  detailName.textContent = name;
  detailBalance.textContent = "$" + formatMoney(balance);
  detailWorkerId.value = workerId;
  currentWorkerId = workerId;
  currentWorkerPhone = phone || "";

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
  currentWorkerId = "";
  currentWorkerPhone = "";
  lastAdvance = null;
  advanceWhatsappContainer?.classList.add("hidden");
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
      createdAt: serverTimestamp()
    });

    lastAdvance = { date, amount, concept };
    showMessage(advanceFormMessage, "Adelanto guardado correctamente.", "success");

    // Mostrar botón para avisar por WhatsApp
    advanceWhatsappContainer?.classList.remove("hidden");

    advanceForm.reset();
    document.getElementById("aDate").valueAsDate = new Date();
    document.getElementById("detailWorkerId").value = workerId;
  } catch (error) {
    showMessage(advanceFormMessage, "Error guardando adelanto: " + error.message, "error");
  }
});

function getWorkerLink() {
  if (!currentWorkerId) return "";
  return `${window.location.origin}${window.location.pathname.replace("admin.html", "worker.html")}?id=${currentWorkerId}`;
}

// === BOTÓN COPIAR ENLACE ===
const copyLinkBtn = document.getElementById("copyLinkBtn");
copyLinkBtn?.addEventListener("click", async () => {
  const link = getWorkerLink();
  if (!link) {
    showMessage(advanceFormMessage, "No hay trabajador seleccionado.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(link);
    showMessage(advanceFormMessage, "Enlace copiado al portapapeles.", "success");
  } catch (error) {
    showMessage(advanceFormMessage, "No se pudo copiar automáticamente. Enlace: " + link, "info");
  }
});

// === BOTÓN WHATSAPP DEL ADELANTO ===
advanceWhatsappBtn?.addEventListener("click", () => {
  if (!currentWorkerPhone) {
    showMessage(advanceFormMessage, "Este trabajador no tiene número de celular.", "error");
    return;
  }

  if (!lastAdvance) {
    showMessage(advanceFormMessage, "Primero guarda un adelanto.", "error");
    return;
  }

  const link = getWorkerLink();
  const text = `Hola ${detailName.textContent}, se ha registrado un nuevo adelanto en tu cuenta.\n\nFecha: ${formatDate(lastAdvance.date)}\nConcepto: ${lastAdvance.concept}\nValor: $${formatMoney(lastAdvance.amount)}\n\nPuedes ver tu cuenta aquí: ${link}`;
  const waLink = `https://wa.me/${currentWorkerPhone}?text=${encodeURIComponent(text)}`;
  window.open(waLink, "_blank");
});

// === BOTÓN WHATSAPP DE REGISTRO ===
whatsappBtn?.addEventListener("click", () => {
  if (!currentWorkerPhone) {
    showMessage(advanceFormMessage, "Este trabajador no tiene número de celular.", "error");
    return;
  }

  const link = getWorkerLink();
  const text = `Hola ${detailName.textContent}, tu registro en Cuentas FINCA ha sido creado.\n\nPuedes consultar tu cuenta aquí: ${link}`;
  const waLink = `https://wa.me/${currentWorkerPhone}?text=${encodeURIComponent(text)}`;
  window.open(waLink, "_blank");
});

deleteWorkerBtn?.addEventListener("click", () => {
  if (!currentWorkerId) return;
  deleteWorker(currentWorkerId, detailName.textContent);
});

// === MODAL RESTABLECER TODO ===
const resetModal = document.getElementById("resetModal");
const openResetModalBtn = document.getElementById("openResetModal");
const resetAllBtn = document.getElementById("resetAllBtn");
const resetConfirmInput = document.getElementById("resetConfirmInput");
const resetMessage = document.getElementById("resetMessage");

openResetModalBtn?.addEventListener("click", () => {
  resetModal.classList.add("active");
  resetConfirmInput?.focus();
});

window.closeResetModal = function() {
  resetModal.classList.remove("active");
  resetConfirmInput.value = "";
  hideMessage(resetMessage);
};

async function deleteAllDocuments(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  const deletes = [];
  snapshot.forEach((docSnap) => {
    deletes.push(deleteDoc(doc(db, collectionName, docSnap.id)));
  });
  return Promise.all(deletes);
}

resetAllBtn?.addEventListener("click", async () => {
  if (resetConfirmInput.value.trim() !== "ELIMINAR") {
    showMessage(resetMessage, "Escribe ELIMINAR para confirmar.", "error");
    return;
  }

  try {
    resetAllBtn.disabled = true;
    showMessage(resetMessage, "Eliminando todos los datos...", "info");

    await deleteAllDocuments("advances");
    await deleteAllDocuments("workers");

    closeDetailModal();
    showMessage(resetMessage, "Todos los datos han sido eliminados.", "success");
    setTimeout(() => closeResetModal(), 1500);
  } catch (error) {
    showMessage(resetMessage, "Error eliminando datos: " + error.message, "error");
  } finally {
    resetAllBtn.disabled = false;
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
