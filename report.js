import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  collection,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const reportBody = document.getElementById("reportBody");
const status = document.getElementById("status");
const errorBox = document.getElementById("errorBox");
const participantCount = document.getElementById("participantCount");
const scanCount = document.getElementById("scanCount");
const companyCount = document.getElementById("companyCount");
const searchInput = document.getElementById("searchInput");
const scanFilter = document.getElementById("scanFilter");
const sortSelect = document.getElementById("sortSelect");

let reportRows = [];

function firstValue(object, fields, fallback = "") {
  for (const field of fields) {
    const value = object?.[field];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("fr-BE");
}

function companyFromStand(standData, fallback = "") {
  return firstValue(
    standData,
    ["companyName", "company", "societe", "société", "organisation", "name"],
    fallback
  );
}

async function loadReport() {
  status.textContent = "Chargement du rapport…";
  errorBox.classList.add("hidden");

  try {
    const [usersSnapshot, scansSnapshot, standsSnapshot] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "scans"), orderBy("scannedAt", "desc"))),
      getDocs(collection(db, "stands"))
    ]);

    const standsById = new Map();
    standsSnapshot.forEach(documentSnapshot => {
      const stand = documentSnapshot.data();
      standsById.set(documentSnapshot.id, {
        name: stand.name || documentSnapshot.id,
        company: companyFromStand(stand, stand.name || documentSnapshot.id)
      });
    });

    const scansByParticipant = new Map();
    scansSnapshot.forEach(documentSnapshot => {
      const scan = documentSnapshot.data();
      if (!scan.participantId) return;

      const stand = standsById.get(scan.standId) || {};
      const normalizedScan = {
        standId: scan.standId || "",
        standName: scan.standName || stand.name || scan.standId || "Stand inconnu",
        company: scan.standCompany || stand.company || scan.standName || scan.standId || "Société inconnue",
        scannedAt: formatDate(scan.scannedAt),
        scannedAtSort: scan.scannedAt?.toMillis?.() || 0
      };

      if (!scansByParticipant.has(scan.participantId)) {
        scansByParticipant.set(scan.participantId, []);
      }
      scansByParticipant.get(scan.participantId).push(normalizedScan);
    });

    reportRows = usersSnapshot.docs.map(documentSnapshot => {
      const user = documentSnapshot.data();
      const participantId = documentSnapshot.id;
      const scans = scansByParticipant.get(participantId) || [];

      return {
        participantId,
        name: firstValue(
          user,
          ["displayName", "fullName", "name", "nomComplet"],
          `${firstValue(user, ["firstName", "prenom", "prénom"])} ${firstValue(user, ["lastName", "nom"])}`.trim() || "Sans nom"
        ),
        email: firstValue(user, ["email", "mail"]),
        participantCompany: firstValue(user, ["companyName", "company", "societe", "société", "organisation"]),
        registrationDate: formatDate(firstValue(user, ["createdAt", "registeredAt", "registrationDate", "dateInscription"])),
        registrationSort: firstValue(user, ["createdAt", "registeredAt"])?.toMillis?.() || 0,
        eligible: user.eligible === true,
        scans,
        scanCount: scans.length
      };
    });

    // Conserve également un scan si son participant n'existe plus dans users.
    for (const [participantId, scans] of scansByParticipant.entries()) {
      if (!reportRows.some(row => row.participantId === participantId)) {
        reportRows.push({
          participantId,
          name: "Participant introuvable",
          email: "",
          participantCompany: "",
          registrationDate: "",
          registrationSort: 0,
          eligible: scans.length >= 10,
          scans,
          scanCount: scans.length
        });
      }
    }

    renderReport();
    status.textContent = `Rapport généré le ${new Date().toLocaleString("fr-BE")}`;
  } catch (error) {
    console.error("Erreur lors du chargement du rapport :", error);
    status.textContent = "";
    errorBox.textContent = `Impossible de charger le rapport : ${error.message}`;
    errorBox.classList.remove("hidden");
  }
}

function getFilteredRows() {
  const search = searchInput.value.trim().toLowerCase();
  const filter = scanFilter.value;
  const sort = sortSelect.value;

  const rows = reportRows.filter(row => {
    const searchableText = [
      row.name,
      row.email,
      row.participantCompany,
      ...row.scans.flatMap(scan => [scan.standId, scan.standName, scan.company])
    ].join(" ").toLowerCase();

    const matchesSearch = !search || searchableText.includes(search);
    const matchesFilter = filter === "all" ||
      (filter === "with" && row.scanCount > 0) ||
      (filter === "without" && row.scanCount === 0) ||
      (filter === "eligible" && row.eligible);

    return matchesSearch && matchesFilter;
  });

  rows.sort((a, b) => {
    if (sort === "scans") return b.scanCount - a.scanCount;
    if (sort === "date") return b.registrationSort - a.registrationSort;
    return a.name.localeCompare(b.name, "fr");
  });

  return rows;
}

function renderReport() {
  const rows = getFilteredRows();

  reportBody.innerHTML = rows.map(row => {
    const scanDetails = row.scans.length
      ? row.scans.map(scan => `
          <div class="scan-detail">
            <strong>${escapeHtml(scan.standName)}</strong>
            <span>QR : ${escapeHtml(scan.standId)}</span>
            <span>Société : ${escapeHtml(scan.company)}</span>
            <span>${escapeHtml(scan.scannedAt)}</span>
          </div>`).join("")
      : '<span class="muted">Aucun scan</span>';

    return `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.participantCompany)}</td>
        <td>${escapeHtml(row.registrationDate)}</td>
        <td>${scanDetails}</td>
        <td>${row.scanCount}</td>
        <td>${row.eligible ? "Oui" : "Non"}</td>
      </tr>`;
  }).join("");

  participantCount.textContent = rows.length;
  scanCount.textContent = rows.reduce((total, row) => total + row.scanCount, 0);
  companyCount.textContent = new Set(
    rows.flatMap(row => row.scans.map(scan => scan.company)).filter(Boolean)
  ).size;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCsv() {
  const header = ["Participant", "E-mail", "Société participant", "Date inscription", "QR", "Stand", "Société visitée", "Date du scan", "Éligible"];
  const lines = [header];

  getFilteredRows().forEach(row => {
    if (!row.scans.length) {
      lines.push([row.name, row.email, row.participantCompany, row.registrationDate, "", "", "", "", row.eligible ? "Oui" : "Non"]);
      return;
    }

    row.scans.forEach(scan => lines.push([
      row.name, row.email, row.participantCompany, row.registrationDate,
      scan.standId, scan.standName, scan.company, scan.scannedAt,
      row.eligible ? "Oui" : "Non"
    ]));
  });

  downloadFile(
    "rapport-loterie.csv",
    "\ufeff" + lines.map(line => line.map(csvCell).join(";")).join("\n"),
    "text/csv;charset=utf-8"
  );
}

function exportWord() {
  const documentHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:7px;vertical-align:top}th{background:#ddd}.scan-detail{margin-bottom:8px}.scan-detail span{display:block}
  </style></head><body><h1>Rapport des inscriptions et scans QR</h1><p>Généré le ${new Date().toLocaleString("fr-BE")}</p>${document.getElementById("reportTable").outerHTML}</body></html>`;

  downloadFile("rapport-loterie.doc", "\ufeff" + documentHtml, "application/msword");
}

searchInput.addEventListener("input", renderReport);
scanFilter.addEventListener("change", renderReport);
sortSelect.addEventListener("change", renderReport);
document.getElementById("printBtn").addEventListener("click", () => window.print());
document.getElementById("wordBtn").addEventListener("click", exportWord);
document.getElementById("csvBtn").addEventListener("click", exportCsv);
document.getElementById("refreshBtn").addEventListener("click", loadReport);

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  loadReport();
});
