import { db, logoutUser } from "./auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const workerName = document.getElementById("workerName");
const workerBalance = document.getElementById("workerBalance");
const advancesTable = document.getElementById("advancesTable");
const workerMessage = document.getElementById("workerMessage");

document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);

let currentUnsubscribe = null;

function checkWorkerSession() {
  const workerId = sessionStorage.getItem("workerId");
  const isWorker = sessionStorage.getItem("isWorker");

  if (!workerId || isWorker !== "true") {
    window.location.href = "index.html";
    return null;
  }

  return workerId;
}

async function loadWorkerData(workerId) {
  if (workerName) {
    const storedName = sessionStorage.getItem("workerName");
    workerName.textContent = storedName || "Trabajador";
  }

  try {
    // Verificar que el trabajador exista
    const workerRef = doc(db, "workers", workerId);
    const workerSnap = await getDoc(workerRef);

    if (!workerSnap.exists()) {
      showMessage("No se encontró información del trabajador.", "error");
      return;
    }

    const worker = workerSnap.data();
    if (workerName) workerName.textContent = worker.name || "Trabajador";

    // Escuchar adelantos en tiempo real
    if (currentUnsubscribe) currentUnsubscribe();

    const advancesQuery = query(
      collection(db, "advances"),
      where("workerId", "==", workerId),
      orderBy("date", "desc")
    );

    currentUnsubscribe = onSnapshot(advancesQuery, (advSnapshot) => {
      advancesTable.innerHTML = "";
      let total = 0;

      if (advSnapshot.empty) {
        advancesTable.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No tienes adelantos registrados.</td></tr>";
      } else {
        advSnapshot.forEach((docSnap) => {
          const a = docSnap.data();
          total += Number(a.amount) || 0;
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${formatDate(a.date)}</td>
            <td>${escapeHtml(a.concept)}</td>
            <td class="text-right">$${formatMoney(a.amount)}</td>
          `;
          advancesTable.appendChild(tr);
        });
      }

      workerBalance.textContent = "$" + formatMoney(total);
    }, (error) => {
      showMessage("Error cargando adelantos: " + error.message, "error");
    });
  } catch (error) {
    showMessage("Error: " + error.message, "error");
  }
}

// Iniciar
const workerId = checkWorkerSession();
if (workerId) {
  loadWorkerData(workerId);
}

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

function showMessage(text, type) {
  if (!workerMessage) return;
  workerMessage.textContent = text;
  workerMessage.className = "message " + type;
  workerMessage.classList.remove("hidden");
}
