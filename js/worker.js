import { db } from "./firebase-config.js";
import {
  formatMoney,
  formatDate,
  escapeHtml,
  showMessage,
  initTheme
} from "./utils.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

initTheme(document.getElementById("themeToggle"));

const workerName = document.getElementById("workerName");
const workerBalance = document.getElementById("workerBalance");
const advancesTable = document.getElementById("advancesTable");
const workerMessage = document.getElementById("workerMessage");
const loadMoreBtn = document.getElementById("loadMoreBtn");

const PAGE = 50;
let currentUnsubscribe = null;
let lastVisible = null;
let hasMore = false;
let currentWorkerId = null;

function getWorkerIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function loadWorkerData(workerId) {
  currentWorkerId = workerId;
  try {
    const workerRef = doc(db, "workers", workerId);
    const workerSnap = await getDoc(workerRef);

    if (!workerSnap.exists()) {
      showMessage(workerMessage, "Trabajador no encontrado.", "error");
      return;
    }

    const worker = workerSnap.data();
    if (workerName) workerName.textContent = worker.name || "Trabajador";

    if (currentUnsubscribe) currentUnsubscribe();

    const advancesQuery = query(
      collection(db, "advances"),
      where("workerId", "==", workerId),
      orderBy("date", "desc"),
      limit(PAGE)
    );

    currentUnsubscribe = onSnapshot(advancesQuery, (advSnapshot) => {
      advancesTable.innerHTML = "";
      let total = 0;

      if (advSnapshot.empty) {
        advancesTable.innerHTML =
          "<tr><td colspan='3' style='text-align:center;'>No tienes adelantos registrados.</td></tr>";
      } else {
        advSnapshot.forEach((docSnap) => {
          const a = docSnap.data();
          total += Number(a.amount) || 0;
          appendRow(a);
        });
      }

      lastVisible = advSnapshot.docs[advSnapshot.docs.length - 1] || null;
      hasMore = advSnapshot.size === PAGE;
      loadMoreBtn?.classList.toggle("hidden", !hasMore);

      // El total mostrado es del saldo completo (no sólo de la página visible).
      computeAndShowTotal();
    }, (error) => {
      showMessage(workerMessage, "Error cargando adelantos: " + error.message, "error");
    });
  } catch (error) {
    showMessage(workerMessage, "Error: " + error.message, "error");
  }
}

// Calcula el saldo completo con una consulta sin orderBy (evita índice extra).
async function computeAndShowTotal() {
  try {
    const all = await getDocs(query(
      collection(db, "advances"),
      where("workerId", "==", currentWorkerId)
    ));
    let total = 0;
    all.forEach((d) => { total += Number(d.data().amount) || 0; });
    workerBalance.textContent = "$" + formatMoney(total);
  } catch (e) {
    // si falla, se mantiene el total parcial de la página.
  }
}

function appendRow(a) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${formatDate(a.date)}</td>
    <td>${escapeHtml(a.concept)}</td>
    <td class="text-right">$${formatMoney(a.amount)}</td>
  `;
  advancesTable.appendChild(tr);
}

loadMoreBtn?.addEventListener("click", async () => {
  if (!currentWorkerId || !lastVisible) return;
  loadMoreBtn.disabled = true;
  loadMoreBtn.classList.add("btn-loading");
  try {
    const next = query(
      collection(db, "advances"),
      where("workerId", "==", currentWorkerId),
      orderBy("date", "desc"),
      startAfter(lastVisible),
      limit(PAGE)
    );
    const snap = await getDocs(next);
    snap.forEach((d) => appendRow(d.data()));
    lastVisible = snap.docs[snap.docs.length - 1] || lastVisible;
    hasMore = snap.size === PAGE;
    loadMoreBtn?.classList.toggle("hidden", !hasMore);
  } finally {
    loadMoreBtn.disabled = false;
    loadMoreBtn.classList.remove("btn-loading");
  }
});

// Iniciar
const workerId = getWorkerIdFromUrl();
if (workerId) {
  loadWorkerData(workerId);
} else {
  showMessage(workerMessage, "Enlace inválido. Falta el identificador del trabajador.", "error");
}