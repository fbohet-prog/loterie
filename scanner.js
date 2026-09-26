import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const scannerMessage =
    document.getElementById("scannerMessage");

const scanResult =
    document.getElementById("scanResult");

const standName =
    document.getElementById("standName");

const newCount =
    document.getElementById("newCount");

const restartButton =
    document.getElementById("restartButton");

document.getElementById("scanTitle")
    .textContent =
    "En attente de scan";

newCount.textContent = "0";

let authenticatedUser = null;
let scanner = null;
let scanLocked = false;

/*
 * Accepte deux formats de QR Code :
 *
 * STAND01
 *
 * ou :
 *
 * https://fbohet-prog.github.io/lotterie/scanner.html?stand=STAND01
 */
function extractStandId(qrText) {
    const value = qrText.trim();

    try {
        const scannedUrl = new URL(value);

        const standFromUrl =
            scannedUrl.searchParams.get("stand");

        if (standFromUrl) {
            return standFromUrl
                .trim()
                .toUpperCase();
        }

    } catch (error) {
        // Le QR Code n'est pas une URL.
        // Le contenu brut sera utilisé.
    }

    return value
        .replace(/^STAND:/i, "")
        .trim()
        .toUpperCase();
}

function isValidStandId(standId) {
    return /^[A-Z0-9_-]{2,40}$/.test(standId);
}

function showError(text) {
    scannerMessage.textContent = text;
    scannerMessage.style.color = "#b42318";
}

function showInformation(text) {
    scannerMessage.textContent = text;
    scannerMessage.style.color = "#5c2d91";
}

function showSuccess(text) {
    scannerMessage.textContent = text;
    scannerMessage.style.color = "green";
}

async function stopScanner() {
    if (!scanner) {
        return;
    }

    try {
        await scanner.clear();
    } catch (error) {
        console.warn(
            "Le scanner n'a pas pu être arrêté :",
            error
        );
    }
}

async function validateScan(decodedText) {
    if (scanLocked || !authenticatedUser) {
        return;
    }

    scanLocked = true;

    showInformation(
        "Vérification du QR Code..."
    );

    const standId =
        extractStandId(decodedText);

    if (!isValidStandId(standId)) {
        showError(
            "Ce QR Code n'est pas reconnu."
        );

        scanLocked = false;
        return;
    }

    try {
        const standReference =
            doc(db, "stands", standId);

        const standSnapshot =
            await getDoc(standReference);

        if (!standSnapshot.exists()) {
            throw new Error(
                "Ce stand n'existe pas dans la base de données."
            );
        }

        const standData =
            standSnapshot.data();

        if (standData.active !== true) {
            throw new Error(
                "Ce stand n'est pas actif."
            );
        }

        const userReference =
            doc(
                db,
                "users",
                authenticatedUser.uid
            );

        const scanId =
            `${authenticatedUser.uid}_${standId}`;

        const scanReference =
            doc(db, "scans", scanId);

        const result =
            await runTransaction(
                db,
                async function (transaction) {
                    const existingScan =
                        await transaction.get(
                            scanReference
                        );

                    if (existingScan.exists()) {
                        throw new Error(
                            "Vous avez déjà validé ce stand."
                        );
                    }

                    const userSnapshot =
                        await transaction.get(
                            userReference
                        );

                    if (!userSnapshot.exists()) {
                        throw new Error(
                            "Votre profil participant est introuvable."
                        );
                    }

                    const userData =
                        userSnapshot.data();

                    const currentCount =
                        Number(
                            userData.scanCount || 0
                        );

                    const updatedCount =
                        currentCount + 1;

                    const eligible =
                        updatedCount >= 10;

                    transaction.set(
                        scanReference,
                        {
                            participantId:
                                authenticatedUser.uid,

                            standId: standId,

                            standName:
                                standData.name || standId,

                            scannedAt:
                                serverTimestamp()
                        }
                    );

                    transaction.update(
                        userReference,
                        {
                            scanCount: updatedCount,
                            eligible: eligible,
                            lastScanAt:
                                serverTimestamp()
                        }
                    );

                    return {
                        count: updatedCount,
                        eligible: eligible,
                        name:
                            standData.name || standId
                    };
                }
            );

        await stopScanner();

        document.getElementById("scanTitle")
            .textContent = "✅ Stand validé";

        standName.textContent = result.name;
        newCount.textContent = Math.min(result.count, 10);

        restartButton.classList.remove("hidden");
        scanResult.classList.remove("hidden");

        if (result.eligible) {
            showSuccess(
                "Félicitations ! Votre participation au tirage est validée."
            );
        } else {
            const remaining =
                Math.max(0, 10 - result.count);

            showSuccess(
                `Stand validé. Encore ${remaining} stand(s) à visiter.`
            );
        }

    } catch (error) {
        console.error(
            "Erreur de validation du scan :",
            error
        );

        showError(error.message || "Une erreur est survenue.");

        scanLocked = false;
    }
}

function handleScanFailure(errorMessage) {
    // This is intentionally left blank.
    // We do not want to spam the user with repeated scanning errors.
}

function startScanner() {
    scanLocked = false;

    scanResult.classList.add("hidden");
    restartButton.classList.add("hidden");

    showInformation(
        "Placez le QR Code dans le cadre."
    );

    scanner =
        new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,

                qrbox: {
                    width: 240,
                    height: 240
                },

                rememberLastUsedCamera: true,

                supportedScanTypes: [
                    Html5QrcodeScanType.SCAN_TYPE_CAMERA,
                    Html5QrcodeScanType.SCAN_TYPE_FILE
                ]
            },
            false
        );

    scanner.render(
        validateScan,
        handleScanFailure
    );
}

restartButton.addEventListener(
    "click",
    async function () {
        await stopScanner();
        startScanner();
    }
);

onAuthStateChanged(
    auth,
    function (user) {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        authenticatedUser = user;
        startScanner();
    }
);
