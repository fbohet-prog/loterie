import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const reportBody = document.getElementById("reportBody");
const participantCountElement = document.getElementById("participantCount");
const scanCountElement = document.getElementById("scanCount");
const companyCountElement = document.getElementById("companyCount");
const statusElement = document.getElementById("status");
const errorBox = document.getElementById("errorBox");

const searchInput = document.getElementById("searchInput");
const scanFilter = document.getElementById("scanFilter");
const sortSelect = document.getElementById("sortSelect");

const printButton = document.getElementById("printBtn");
const wordButton = document.getElementById("wordBtn");
const csvButton = document.getElementById("csvBtn");
const refreshButton = document.getElementById("refreshBtn");

let participants = [];

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getParticipantName(participant) {
    const firstName =
        participant.prenom ||
        participant.firstName ||
        participant.firstname ||
        "";

    const lastName =
        participant.nom ||
        participant.lastName ||
        participant.lastname ||
        "";

    const completeName = `${firstName} ${lastName}`.trim();

    return completeName || participant.displayName || "Participant";
}

function getParticipantEmail(participant) {
    return participant.email || participant.mail || "";
}

function getParticipantCompany(participant) {
    return (
        participant.societe ||
        participant.société ||
        participant.company ||
        participant.companyName ||
        participant.organisation ||
        participant.organization ||
        ""
    );
}

function getRegistrationDate(participant) {
    const date =
        participant.createdAt ||
        participant.registeredAt ||
        participant.registrationDate ||
        participant.dateInscription;

    if (!date) {
        return "";
    }

    try {
        if (typeof date.toDate === "function") {
            return date.toDate().toLocaleString("fr-BE");
        }

        const convertedDate = new Date(date);

        if (!Number.isNaN(convertedDate.getTime())) {
            return convertedDate.toLocaleString("fr-BE");
        }
    } catch (error) {
        console.warn("Date non reconnue :", date);
    }

    return "";
}

function normalizeScan(scan) {
    if (typeof scan === "string" || typeof scan === "number") {
        return {
            code: String(scan),
            company: String(scan),
            date: ""
        };
    }

    if (!scan || typeof scan !== "object") {
        return null;
    }

    const code =
        scan.code ||
        scan.qrCode ||
        scan.qrId ||
        scan.standId ||
        scan.id ||
        scan.value ||
        "";

    const company =
        scan.societe ||
        scan.société ||
        scan.company ||
        scan.companyName ||
        scan.standName ||
        scan.nom ||
        scan.name ||
        scan.exhibitor ||
        code;

    let scanDate = "";

    const date =
        scan.scannedAt ||
        scan.date ||
        scan.createdAt ||
        scan.timestamp;

    if (date) {
        try {
            if (typeof date.toDate === "function") {
                scanDate = date.toDate().toLocaleString("fr-BE");
            } else {
                const convertedDate = new Date(date);

                if (!Number.isNaN(convertedDate.getTime())) {
                    scanDate = convertedDate.toLocaleString("fr-BE");
                }
            }
        } catch (error) {
            console.warn("Date de scan non reconnue :", date);
        }
    }

    return {
        code: String(code),
        company: String(company),
        date: scanDate
    };
}

function getParticipantScans(participant) {
    const possibleScanFields = [
        participant.scans,
        participant.qrScans,
        participant.scannedCodes,
        participant.scannedStands,
        participant.visitedStands,
        participant.codesScannes,
        participant.stands
    ];

    const existingScanField = possibleScanFields.find(
        (field) => field !== undefined && field !== null
    );

    if (!existingScanField) {
        return [];
    }

    let scans = [];

    if (Array.isArray(existingScanField)) {
        scans = existingScanField;
    } else if (typeof existingScanField === "object") {
        scans = Object.entries(existingScanField)
            .filter(([, value]) => value !== false && value !== null)
            .map(([key, value]) => {
                if (value === true) {
                    return key;
                }

                if (typeof value === "object") {
                    return {
                        id: key,
                        ...value
                    };
                }

                return value;
            });
    }

    return scans
        .map(normalizeScan)
        .filter(Boolean)
        .filter((scan) => scan.code || scan.company);
}

function prepareParticipant(documentSnapshot) {
    const data = documentSnapshot.data();

    return {
        id: documentSnapshot.id,
        ...data,
        reportName: getParticipantName(data),
        reportEmail: getParticipantEmail(data),
        reportCompany: getParticipantCompany(data),
        reportRegistrationDate: getRegistrationDate(data),
        reportScans: getParticipantScans(data)
    };
}

async function loadParticipants() {
    statusElement.textContent = "Chargement du rapport…";
    errorBox.classList.add("hidden");

    try {
        const snapshot = await getDocs(collection(db, "users"));

        participants = snapshot.docs
            .map(prepareParticipant)
            .filter((participant) => {
                return (
                    !participant.role ||
                    participant.role === "participant"
                );
            });

        renderReport();

        statusElement.textContent =
            `${participants.length} participant(s) chargé(s).`;
    } catch (error) {
        console.error(
            "Erreur lors du chargement du rapport :",
            error
        );

        statusElement.textContent = "";

        errorBox.textContent =
            `Impossible de charger les données Firebase : ${error.message}`;

        errorBox.classList.remove("hidden");
    }
}

function getFilteredParticipants() {
    const searchValue = searchInput.value
        .trim()
        .toLowerCase();

    const scanFilterValue = scanFilter.value;
    const sortValue = sortSelect.value;

    const filteredParticipants = participants.filter((participant) => {
        const searchContent = [
            participant.reportName,
            participant.reportEmail,
            participant.reportCompany,
            ...participant.reportScans.map((scan) => scan.code),
            ...participant.reportScans.map((scan) => scan.company)
        ]
            .join(" ")
            .toLowerCase();

        const matchesSearch =
            !searchValue ||
            searchContent.includes(searchValue);

        const scanCount = participant.reportScans.length;

        const matchesScanFilter =
            scanFilterValue === "all" ||
            (scanFilterValue === "with" && scanCount > 0) ||
            (scanFilterValue === "without" && scanCount === 0);

        return matchesSearch && matchesScanFilter;
    });

    filteredParticipants.sort((participantA, participantB) => {
        if (sortValue === "scans") {
            return (
                participantB.reportScans.length -
                participantA.reportScans.length
            );
        }

        if (sortValue === "date") {
            return participantB.reportRegistrationDate.localeCompare(
                participantA.reportRegistrationDate
            );
        }

        return participantA.reportName.localeCompare(
            participantB.reportName,
            "fr"
        );
    });

    return filteredParticipants;
}

function renderReport() {
    const filteredParticipants = getFilteredParticipants();

    reportBody.innerHTML = filteredParticipants
        .map((participant) => {
            const qrCodes = participant.reportScans.length
                ? participant.reportScans
                    .map((scan) => {
                        return `
                            <span class="tag">
                                ${escapeHtml(scan.code)}
                            </span>
                        `;
                    })
                    .join("")
                : '<span class="muted">Aucun QR scanné</span>';

            const visitedCompanies = participant.reportScans.length
                ? participant.reportScans
                    .map((scan) => scan.company)
                    .filter(Boolean)
                    .filter((company, index, companies) => {
                        return companies.indexOf(company) === index;
                    })
                    .map((company) => {
                        return `
                            <span class="tag">
                                ${escapeHtml(company)}
                            </span>
                        `;
                    })
                    .join("")
                : '<span class="muted">Aucune</span>';

            return `
                <tr>
                    <td>${escapeHtml(participant.reportName)}</td>

                    <td>${escapeHtml(participant.reportEmail)}</td>

                    <td>
                        ${escapeHtml(participant.reportCompany)}
                    </td>

                    <td>
                        ${escapeHtml(
                            participant.reportRegistrationDate
                        )}
                    </td>

                    <td>${qrCodes}</td>

                    <td>${visitedCompanies}</td>

                    <td>${participant.reportScans.length}</td>
                </tr>
            `;
        })
        .join("");

    const totalScans = filteredParticipants.reduce(
        (total, participant) => {
            return total + participant.reportScans.length;
        },
        0
    );

    const uniqueCompanies = new Set(
        filteredParticipants.flatMap((participant) => {
            return participant.reportScans
                .map((scan) => scan.company)
                .filter(Boolean);
        })
    );

    participantCountElement.textContent =
        filteredParticipants.length;

    scanCountElement.textContent = totalScans;

    companyCountElement.textContent = uniqueCompanies.size;
}

function createCsvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
    const filteredParticipants = getFilteredParticipants();

    const rows = [
        [
            "Participant",
            "E-mail",
            "Société du participant",
            "Date d'inscription",
            "QR scannés",
            "Sociétés visitées",
            "Total"
        ],
        ...filteredParticipants.map((participant) => [
            participant.reportName,
            participant.reportEmail,
            participant.reportCompany,
            participant.reportRegistrationDate,

            participant.reportScans
                .map((scan) => scan.code)
                .join(" | "),

            participant.reportScans
                .map((scan) => scan.company)
                .filter(Boolean)
                .join(" | "),

            participant.reportScans.length
        ])
    ];

    const csvContent =
        "\uFEFF" +
        rows
            .map((row) => {
                return row.map(createCsvCell).join(";");
            })
            .join("\n");

    downloadFile(
        "rapport-loterie.csv",
        csvContent,
        "text/csv;charset=utf-8"
    );
}

function exportWord() {
    const table = document
        .getElementById("reportTable")
        .outerHTML;

    const wordContent = `
        <!DOCTYPE html>
        <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>
                    Rapport des inscriptions et scans QR
                </title>

                <style>
                    body {
                        font-family: Arial, sans-serif;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }

                    th,
                    td {
                        border: 1px solid #777;
                        padding: 7px;
                        text-align: left;
                    }

                    th {
                        background: #dddddd;
                    }

                    .tag {
                        display: inline-block;
                        margin-right: 5px;
                    }
                </style>
            </head>

            <body>
                <h1>
                    Rapport des inscriptions et scans QR
                </h1>

                <p>
                    Rapport généré le
                    ${new Date().toLocaleString("fr-BE")}
                </p>

                ${table}
            </body>
        </html>
    `;

    downloadFile(
        "rapport-loterie.doc",
        `\uFEFF${wordContent}`,
        "application/msword"
    );
}

function downloadFile(fileName, content, contentType) {
    const blob = new Blob(
        [content],
        { type: contentType }
    );

    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = fileUrl;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(fileUrl);
}

searchInput.addEventListener("input", renderReport);
scanFilter.addEventListener("change", renderReport);
sortSelect.addEventListener("change", renderReport);

printButton.addEventListener("click", () => {
    window.print();
});

wordButton.addEventListener("click", exportWord);
csvButton.addEventListener("click", exportCsv);
refreshButton.addEventListener("click", loadParticipants);

onAuthStateChanged(auth, (user) => {
    if (!user) {
        statusElement.textContent =
            "Connectez-vous pour consulter le rapport.";

        reportBody.innerHTML = "";

        window.location.href = "login.html";
        return;
    }

    loadParticipants();
});
