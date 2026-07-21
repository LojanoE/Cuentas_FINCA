import { db } from "./firebase-config.js";
import { logoutUser, isAdminLoggedIn } from "./auth.js";
import {
  formatMoney,
  formatDate,
  escapeHtml,
  showMessage,
  hideMessage,
  validatePhone,
  debounce,
  withLoading,
  initTheme,
  initModalEscape,
  focusFirst,
  PAGE_SIZE
} from "./utils.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Inicializa modo oscuro y cierre con Escape.
initTheme(document.getElementById("themeToggle"));
initModalEscape();

// Verificar sesión de admin
if (!isAdminLoggedIn()) {
  window.location.href = "index.html";
}

document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);

// === LISTA DE TRABAJADORES (sin N+1) ===
const workerList = document.getElementById("workerList");
const workerMessage = document.getElementById("workerMessage");
const reportWorker = document.getElementById("reportWorker");
const workerSearch = document.getElementById("workerSearch");

const workerMap = new Map();        // workerId -> data del trabajador
const balanceMap = new Map();       // workerId -> saldo actual
const workersOrder = [];            // orden de workers por nombre
const advancesCache = new Map();   // advanceId -> data del adelanto (para totales del reporte)

let workersUnsub = null;
let advancesBalanceUnsub = null;

function loadWorkers() {
  if (!workerList) return;

  if (workersUnsub) workersUnsub();
  if (advancesBalanceUnsub) advancesBalanceUnsub();

  const workersQuery = query(collection(db, "workers"), orderBy("name"));

  workersUnsub = onSnapshot(workersQuery, (snapshot) => {
    workersOrder.length = 0;
    workerMap.clear();
    snapshot.docs.forEach((d) => {
      workerMap.set(d.id, d.data());
      workersOrder.push(d.id);
    });
    renderWorkerList();
    rebuildReportSelect();
  }, (error) => {
    showMessage(workerMessage, "Error cargando trabajadores: " + error.message, "error");
  });

  // Sola suscripción a advances para mantener balances y cache del reporte.
  const allAdvances = query(collection(db, "advances"));
  advancesBalanceUnsub = onSnapshot(allAdvances, (snapshot) => {
    balanceMap.clear();
    advancesCache.clear();
    snapshot.forEach((d) => {
      const a = d.data();
      advancesCache.set(d.id, a);
      const wid = a.workerId;
      if (!wid) return;
      balanceMap.set(wid, (balanceMap.get(wid) || 0) + (Number(a.amount) || 0));
    });
    renderWorkerList();
    // Si el reporte está visible, refrescar el total sin re-leer.
    if (reportTable && reportTable.children.length > 0) {
      refreshReportTotalFromCache();
    }
  }, (error) => {
    showMessage(workerMessage, "Error cargando saldos: " + error.message, "error");
  });
}

function renderWorkerList() {
  if (!workerList) return;
  const filter = (workerSearch?.value || "").trim().toLowerCase();
  workerList.innerHTML = "";

  const items = workersOrder
    .map((id) => ({ id, data: workerMap.get(id) }))
    .filter(({ data }) => !filter || (data?.name || "").toLowerCase().includes(filter));

  if (items.length === 0) {
    workerList.innerHTML = filter
      ? "<li class='worker-item'>Sin coincidencias para tu búsqueda.</li>"
      : "<li class='worker-item'>No hay trabajadores registrados.</li>";
    return;
  }

  for (const { id, data } of items) {
    const balance = balanceMap.get(id) || 0;
    const li = document.createElement("li");
    li.className = "worker-item";
    li.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div class="worker-name">${escapeHtml(data.name)}</div>
        <div style="font-size:0.85rem; color:#666;">${escapeHtml(data.phone || "Sin teléfono")}</div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="worker-balance">$${formatMoney(balance)}</div>
        <button class="btn btn-danger btn-small delete-worker-btn" data-id="${escapeHtml(id)}" title="Eliminar trabajador" aria-label="Eliminar trabajador">🗑️</button>
      </div>
    `;
    li.addEventListener("click", (e) => {
      if (e.target.closest(".delete-worker-btn")) return;
      openDetailModal(id, data.name, balance, data.phone);
    });
    li.querySelector(".delete-worker-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteWorker(id, data.name);
    });
    workerList.appendChild(li);
  }
}

function rebuildReportSelect() {
  if (!reportWorker) return;
  const current = reportWorker.value;
  reportWorker.innerHTML = '<option value="">Todos los trabajadores</option>';
  workersOrder.forEach((id) => {
    const data = workerMap.get(id);
    if (!data) return;
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = data.name;
    reportWorker.appendChild(opt);
  });
  if (current && workerMap.has(current)) reportWorker.value = current;
}

// Búsqueda en vivo.
workerSearch?.addEventListener("input", debounce(renderWorkerList, 150));

// === REPORTE DE ADELANTOS (filtro en servidor + paginación) ===
const reportFilterBtn = document.getElementById("reportFilterBtn");
const reportDateFrom = document.getElementById("reportDateFrom");
const reportDateTo = document.getElementById("reportDateTo");
const reportTable = document.getElementById("reportTable");
const reportTotal = document.getElementById("reportTotal");
const reportMessage = document.getElementById("reportMessage");
const reportMoreBtn = document.getElementById("reportMoreBtn");

let reportLastVisible = null;
let reportHasMore = false;

function buildReportQuery(startAfterDoc) {
  const workerId = reportWorker?.value || "";
  const dateFrom = reportDateFrom?.value || "";
  const dateTo = reportDateTo?.value || "";

  const filters = [];
  if (workerId) filters.push(where("workerId", "==", workerId));
  if (dateFrom) filters.push(where("date", ">=", dateFrom));
  if (dateTo) filters.push(where("date", "<=", dateTo));

  const constraints = [...filters, orderBy("date", "desc")];
  if (startAfterDoc) {
    constraints.push(startAfter(startAfterDoc));
  }
  constraints.push(limit(PAGE_SIZE));
  return query(collection(db, "advances"), ...constraints);
}

async function loadReport(append) {
  if (!reportTable || !reportTotal) return;

  if (!append) {
    reportLastVisible = null;
    reportTable.innerHTML = "";
    reportTotal.textContent = "$0";
    reportMoreBtn?.classList.add("hidden");
  }
  hideMessage(reportMessage);

  await withLoading(reportFilterBtn, async () => {
    try {
      const q = buildReportQuery(reportLastVisible);
      const snapshot = await getDocs(q);

      if (snapshot.empty && !append) {
        reportTable.innerHTML =
          "<tr><td colspan='4' style='text-align:center;'>No hay adelantos para los filtros seleccionados.</td></tr>";
        reportHasMore = false;
      } else {
        snapshot.forEach((docSnap) => {
          const a = docSnap.data();
          const worker = workerMap.get(a.workerId) || { name: "Desconocido" };
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeHtml(worker.name)}</td>
            <td>${formatDate(a.date)}</td>
            <td>${escapeHtml(a.concept)}</td>
            <td class="text-right">$${formatMoney(a.amount)}</td>
          `;
          reportTable.appendChild(tr);
        });
      }

      if (!snapshot.empty) reportLastVisible = snapshot.docs[snapshot.docs.length - 1];
      reportHasMore = !snapshot.empty && snapshot.size === PAGE_SIZE;
      reportMoreBtn?.classList.toggle("hidden", !reportHasMore);

      // Total calculado desde el cache en memoria (todas las advances).
      refreshReportTotalFromCache();
    } catch (error) {
      showMessage(reportMessage, "Error cargando reporte: " + error.message, "error");
    }
  });
}

reportFilterBtn?.addEventListener("click", () => loadReport(false));
reportMoreBtn?.addEventListener("click", () => loadReport(true));

// Calcula el total real a partir del cache en memoria (todas las advances),
// aplicando los mismos filtros del reporte. Sin lecturas extra.
function refreshReportTotalFromCache() {
  if (!reportTotal) return;
  const workerId = reportWorker?.value || "";
  const dateFrom = reportDateFrom?.value || "";
  const dateTo = reportDateTo?.value || "";
  let total = 0;
  advancesCache.forEach((a) => {
    if (workerId && a.workerId !== workerId) return;
    if (dateFrom && (a.date || "") < dateFrom) return;
    if (dateTo && (a.date || "") > dateTo) return;
    total += Number(a.amount) || 0;
  });
  reportTotal.textContent = "$" + formatMoney(total);
}

// === ELIMINACIÓN EN CASCADA DE ADELANTOS ===
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

  const btn = document.querySelector(`.delete-worker-btn[data-id="${workerId}"]`);
  await withLoading(btn, async () => {
    try {
      showMessage(workerMessage, "Eliminando trabajador...", "info");
      await deleteWorkerAdvances(workerId);
      await deleteDoc(doc(db, "workers", workerId));
      showMessage(workerMessage, "Trabajador eliminado correctamente.", "success");
      if (currentWorkerId === workerId) closeDetailModal();
    } catch (error) {
      showMessage(workerMessage, "Error eliminando trabajador: " + error.message, "error");
    }
  });
}

// === MODAL NUEVO / EDITAR TRABAJADOR ===
const workerModal = document.getElementById("workerModal");
const openWorkerModalBtn = document.getElementById("openWorkerModal");
const workerForm = document.getElementById("workerForm");
const workerFormMessage = document.getElementById("workerFormMessage");
const workerModalTitle = document.getElementById("workerModalTitle");

let editingWorkerId = null;
let lastFocusedBeforeModal = null;

openWorkerModalBtn?.addEventListener("click", () => openWorkerModal(null));

function openWorkerModal(workerId) {
  editingWorkerId = workerId;
  lastFocusedBeforeModal = document.activeElement;

  if (workerId) {
    const data = workerMap.get(workerId);
    workerModalTitle.textContent = "Editar trabajador";
    document.getElementById("wName").value = data?.name || "";
    document.getElementById("wPhone").value = data?.phone || "";
    document.getElementById("wNotes").value = data?.notes || "";
  } else {
    workerModalTitle.textContent = "Nuevo trabajador";
    workerForm?.reset();
  }

  workerModal.classList.add("active");
  focusFirst(workerModal);
}

window.closeWorkerModal = function () {
  workerModal.classList.remove("active");
  workerForm?.reset();
  editingWorkerId = null;
  hideMessage(workerFormMessage);
  if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
};

workerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.submitter || workerForm.querySelector("button[type=submit]");

  const name = document.getElementById("wName").value.trim();
  const phone = document.getElementById("wPhone").value.trim();
  const notes = document.getElementById("wNotes").value.trim();

  if (!name || !phone) {
    showMessage(workerFormMessage, "Completa todos los campos obligatorios.", "error");
    return;
  }
  if (!validatePhone(phone)) {
    showMessage(workerFormMessage, "El celular debe tener entre 8 y 15 dígitos numéricos (sin + ni espacios).", "error");
    return;
  }

  await withLoading(submitBtn, async () => {
    try {
      showMessage(workerFormMessage, "Guardando trabajador...", "info");

      if (editingWorkerId) {
        await updateDoc(doc(db, "workers", editingWorkerId), {
          name, phone, notes
        });
        showMessage(workerFormMessage, "Trabajador actualizado correctamente.", "success");
      } else {
        const workerId = doc(collection(db, "workers")).id;
        await setDoc(doc(db, "workers", workerId), {
          name, phone, notes,
          createdAt: serverTimestamp()
        });
        showMessage(workerFormMessage, "Trabajador creado correctamente.", "success");
      }
      workerForm.reset();
      setTimeout(() => closeWorkerModal(), 800);
    } catch (error) {
      showMessage(workerFormMessage, "Error: " + error.message, "error");
    }
  });
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
const editWorkerBtn = document.getElementById("editWorkerBtn");
const loadMoreAdvancesBtn = document.getElementById("loadMoreAdvancesBtn");

let currentDetailUnsubscribe = null;
let lastAdvance = null;
let currentWorkerId = "";
let currentWorkerPhone = "";
let detailLastVisible = null;
let detailHasMore = false;

window.openDetailModal = async function (workerId, name, balance, phone) {
  lastFocusedBeforeModal = document.activeElement;
  detailModal.classList.add("active");
  detailName.textContent = name;
  detailBalance.textContent = "$" + formatMoney(balance);
  detailWorkerId.value = workerId;
  currentWorkerId = workerId;
  currentWorkerPhone = phone || "";
  lastAdvance = null;
  advanceWhatsappContainer?.classList.add("hidden");

  document.getElementById("aDate").valueAsDate = new Date();

  if (currentDetailUnsubscribe) currentDetailUnsubscribe();

  detailLastVisible = null;
  const initialQuery = query(
    collection(db, "advances"),
    where("workerId", "==", workerId),
    orderBy("date", "desc"),
    limit(PAGE_SIZE)
  );

  currentDetailUnsubscribe = onSnapshot(initialQuery, (snapshot) => {
    renderAdvanceRows(snapshot);
    detailLastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    detailHasMore = snapshot.size === PAGE_SIZE;
    loadMoreAdvancesBtn?.classList.toggle("hidden", !detailHasMore);

    // Saldo total recalculado en cliente (sin consultar nada extra).
    let total = 0;
    snapshot.forEach((d) => { total += Number(d.data().amount) || 0; });
    // Si hay paginación, recalcular el total completo desde balanceMap.
    detailBalance.textContent = "$" + formatMoney(balanceMap.get(currentWorkerId) || total);
  }, (error) => {
    advancesTable.innerHTML =
      "<tr><td colspan='4' style='text-align:center;'>Error cargando adelantos.</td></tr>";
  });
};

// Cargar más adelantos (sólo añade filas; no replica onSnapshot en vivo).
loadMoreAdvancesBtn?.addEventListener("click", async () => {
  await withLoading(loadMoreAdvancesBtn, async () => {
    try {
      const next = query(
        collection(db, "advances"),
        where("workerId", "==", currentWorkerId),
        orderBy("date", "desc"),
        startAfter(detailLastVisible),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(next);
      snap.forEach((d) => appendAdvanceRow(d.id, d.data()));
      detailLastVisible = snap.docs[snap.docs.length - 1] || detailLastVisible;
      detailHasMore = snap.size === PAGE_SIZE;
      loadMoreAdvancesBtn?.classList.toggle("hidden", !detailHasMore);
    } catch (error) {
      showMessage(advanceFormMessage, "Error cargando más adelantos: " + error.message, "error");
    }
  });
});

function renderAdvanceRows(snapshot) {
  advancesTable.innerHTML = "";
  if (snapshot.empty) {
    advancesTable.innerHTML =
      "<tr><td colspan='4' style='text-align:center;'>No hay adelantos registrados.</td></tr>";
    return;
  }
  snapshot.forEach((docSnap) => {
    appendAdvanceRow(docSnap.id, docSnap.data());
  });
}

function appendAdvanceRow(advanceId, a) {
  const tr = document.createElement("tr");
  tr.dataset.id = advanceId;
  tr.innerHTML = `
    <td>${formatDate(a.date)}</td>
    <td>${escapeHtml(a.concept)}</td>
    <td class="text-right">$${formatMoney(a.amount)}</td>
    <td class="text-right advance-actions">
      <button class="btn btn-small edit-advance-btn" title="Editar" aria-label="Editar adelanto">✏️</button>
      <button class="btn btn-danger btn-small delete-advance-btn" title="Eliminar" aria-label="Eliminar adelanto">🗑️</button>
    </td>
  `;
  tr.querySelector(".edit-advance-btn").addEventListener("click", () => openEditAdvanceModal(advanceId, a));
  tr.querySelector(".delete-advance-btn").addEventListener("click", () => deleteAdvance(advanceId));
  advancesTable.appendChild(tr);
}

window.closeDetailModal = function () {
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
  if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
};

// Editar trabajador desde el detalle.
editWorkerBtn?.addEventListener("click", () => {
  if (!currentWorkerId) return;
  closeDetailModal();
  openWorkerModal(currentWorkerId);
});

advanceForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.submitter || advanceForm.querySelector("button[type=submit]");

  const workerId = detailWorkerId.value;
  const date = document.getElementById("aDate").value;
  const amount = parseFloat(document.getElementById("aAmount").value);
  const concept = document.getElementById("aConcept").value.trim();

  if (!workerId || !date || isNaN(amount) || amount <= 0 || !concept) {
    showMessage(advanceFormMessage, "Completa todos los campos correctamente.", "error");
    return;
  }

  await withLoading(submitBtn, async () => {
    try {
      await addDoc(collection(db, "advances"), {
        workerId, date, amount, concept,
        createdAt: serverTimestamp()
      });
      lastAdvance = { date, amount, concept };
      showMessage(advanceFormMessage, "Adelanto guardado correctamente.", "success");
      advanceWhatsappContainer?.classList.remove("hidden");
      advanceForm.reset();
      document.getElementById("aDate").valueAsDate = new Date();
      document.getElementById("detailWorkerId").value = workerId;
    } catch (error) {
      showMessage(advanceFormMessage, "Error guardando adelanto: " + error.message, "error");
    }
  });
});

// === ELIMINAR / EDITAR ADELANTO INDIVIDUAL ===
async function deleteAdvance(advanceId) {
  if (!confirm("¿Eliminar este adelanto? Esta acción no se puede deshacer.")) return;
  await withLoading(null, async () => {
    try {
      await deleteDoc(doc(db, "advances", advanceId));
      document.querySelector(`tr[data-id="${advanceId}"]`)?.remove();
      showMessage(advanceFormMessage, "Adelanto eliminado.", "success");
    } catch (error) {
      showMessage(advanceFormMessage, "Error al eliminar: " + error.message, "error");
    }
  });
}

// Modal de edición de adelanto.
const editAdvanceModal = document.getElementById("editAdvanceModal");
const editAdvanceForm = document.getElementById("editAdvanceForm");
const editAdvanceIdInput = document.getElementById("eaId");
const editAdvanceDate = document.getElementById("eaDate");
const editAdvanceAmount = document.getElementById("eaAmount");
const editAdvanceConcept = document.getElementById("eaConcept");
const editAdvanceMessage = document.getElementById("editAdvanceMessage");

let editingAdvanceId = null;
let lastFocusedBeforeEditAdvance = null;

function openEditAdvanceModal(advanceId, data) {
  editingAdvanceId = advanceId;
  lastFocusedBeforeEditAdvance = document.activeElement;
  editAdvanceIdInput.value = advanceId;
  editAdvanceDate.value = data.date || "";
  editAdvanceAmount.value = data.amount || "";
  editAdvanceConcept.value = data.concept || "";
  editAdvanceModal.classList.add("active");
  focusFirst(editAdvanceModal);
}

window.closeEditAdvanceModal = function () {
  editAdvanceModal.classList.remove("active");
  editingAdvanceId = null;
  hideMessage(editAdvanceMessage);
  if (lastFocusedBeforeEditAdvance) lastFocusedBeforeEditAdvance.focus();
};

editAdvanceForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.submitter || editAdvanceForm.querySelector("button[type=submit]");

  const date = editAdvanceDate.value;
  const amount = parseFloat(editAdvanceAmount.value);
  const concept = editAdvanceConcept.value.trim();

  if (!date || isNaN(amount) || amount <= 0 || !concept) {
    showMessage(editAdvanceMessage, "Completa todos los campos correctamente.", "error");
    return;
  }

  await withLoading(submitBtn, async () => {
    try {
      await updateDoc(doc(db, "advances", editingAdvanceId), { date, amount, concept });
      // El onSnapshot del detalle actualizará la fila en vivo.
      showMessage(editAdvanceMessage, "Adelanto actualizado.", "success");
      setTimeout(() => closeEditAdvanceModal(), 600);
    } catch (error) {
      showMessage(editAdvanceMessage, "Error: " + error.message, "error");
    }
  });
});

// === ENLACE DEL TRABAJADOR ===
function getWorkerLink() {
  if (!currentWorkerId) return "";
  return `${window.location.origin}${window.location.pathname.replace("admin.html", "worker.html")}?id=${currentWorkerId}`;
}

const copyLinkBtn = document.getElementById("copyLinkBtn");
copyLinkBtn?.addEventListener("click", async () => {
  await withLoading(copyLinkBtn, async () => {
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
});

// === WHATSAPP ADELANTO ===
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

// === WHATSAPP REGISTRO ===
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
  lastFocusedBeforeModal = document.activeElement;
  resetModal.classList.add("active");
  focusFirst(resetModal);
});

window.closeResetModal = function () {
  resetModal.classList.remove("active");
  if (resetConfirmInput) resetConfirmInput.value = "";
  hideMessage(resetMessage);
  if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
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

  await withLoading(resetAllBtn, async () => {
    try {
      showMessage(resetMessage, "Eliminando todos los datos...", "info");
      await deleteAllDocuments("advances");
      await deleteAllDocuments("workers");
      closeDetailModal();
      showMessage(resetMessage, "Todos los datos han sido eliminados.", "success");
      setTimeout(() => closeResetModal(), 1500);
    } catch (error) {
      showMessage(resetMessage, "Error eliminando datos: " + error.message, "error");
    }
  });
});

// === INICIALIZACIÓN ===
loadWorkers();